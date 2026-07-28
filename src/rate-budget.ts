/**
 * Client-side rate budget for HenrikDev's API (Basic key tier: 30 calls / 60s,
 * confirmed during M0 research — see ARCHITECTURE.md Decisions, 2026-07-28).
 *
 * Modeled as a sliding window of dispatch timestamps: a reservation occupies a
 * slot for `windowMs`, then ages out. `reconcile()` folds HenrikDev's authoritative
 * `x-ratelimit-remaining` header back in, but only ever clamps DOWN — our local
 * view stays the conservative floor so we never over-issue and eat a wasted 429.
 */
export interface RateBudgetOptions {
  capacity?: number;
  windowMs?: number;
  now?: () => number;
}

export class RateBudget {
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private reservations: number[] = [];

  constructor(opts: RateBudgetOptions = {}) {
    this.capacity = opts.capacity ?? 30;
    this.windowMs = opts.windowMs ?? 60_000;
    this.now = opts.now ?? (() => Date.now());
  }

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    this.reservations = this.reservations.filter((t) => t > cutoff);
  }

  /** Slots free to reserve right now. */
  available(): number {
    this.prune();
    return Math.max(0, this.capacity - this.reservations.length);
  }

  /**
   * Atomically reserve `count` slots. Fail-fast: if the whole batch doesn't fit,
   * reserve nothing and return false — never a partial reservation.
   */
  reserve(count = 1): boolean {
    if (count <= 0) return true;
    if (this.available() < count) return false;
    const t = this.now();
    for (let i = 0; i < count; i++) this.reservations.push(t);
    return true;
  }

  /**
   * Fold in the server's authoritative remaining count. Only clamps down: if the
   * server reports fewer slots than we think we have, we believe it; if it
   * reports more, we keep our stricter local view.
   */
  reconcile(serverRemaining: number): void {
    const localAvailable = this.available();
    if (serverRemaining >= localAvailable) return;
    const t = this.now();
    for (let i = 0; i < localAvailable - serverRemaining; i++) {
      this.reservations.push(t);
    }
  }

  /** Milliseconds until at least one slot frees; 0 if slots are available now. */
  msUntilReset(): number {
    if (this.available() > 0) return 0;
    const oldest = Math.min(...this.reservations);
    return Math.max(0, oldest + this.windowMs - this.now());
  }
}
