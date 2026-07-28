import { RateBudget } from "./rate-budget";
import { RateBudgetExhaustedError, UpstreamError } from "./errors";

export interface HenrikClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable so the budget can be shared/inspected; defaults to 30/60s. */
  budget?: RateBudget;
}

/** A successful fetch: raw HenrikDev body, untyped — the caller validates it. */
export interface FetchResult {
  data: unknown;
  status: number;
}

const DEFAULT_BASE = "https://api.henrikdev.xyz";

/**
 * Thin wrapper over HenrikDev's API that drives a RateBudget.
 *
 * - Stay raw: the response body is returned untouched; validation happens one
 *   layer up (endpoints.ts), never here.
 * - Fail-fast: if the local budget can't afford the call, throw before touching
 *   the network. A server 429 is treated as exhaustion too — reconcile to 0 and
 *   throw, never retry (ARCHITECTURE.md: no auto-retry in M1).
 * - Reconcile the budget from `x-ratelimit-remaining` on every response.
 * - Never include the response body in a thrown error's message — HenrikDev
 *   payloads may carry player data, and ARCHITECTURE.md's logging decision bans
 *   logging response bodies.
 */
export class HenrikClient {
  readonly budget: RateBudget;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HenrikClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.budget = opts.budget ?? new RateBudget();
  }

  async get(path: string): Promise<FetchResult> {
    if (!this.budget.reserve(1)) {
      throw new RateBudgetExhaustedError(this.budget.msUntilReset(), false);
    }

    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        headers: { Authorization: this.apiKey, Accept: "application/json" },
      });
    } catch (err) {
      throw new UpstreamError(
        `HenrikDev request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "0");
    const resetSeconds = Number(res.headers.get("x-ratelimit-reset") ?? "0");

    if (res.status === 429) {
      this.budget.reconcile(0);
      throw new RateBudgetExhaustedError(resetSeconds * 1000, true);
    }

    this.budget.reconcile(remaining);

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      throw new UpstreamError(
        `HenrikDev API error (status ${res.status})`,
        res.status,
      );
    }

    return { data: body, status: res.status };
  }
}
