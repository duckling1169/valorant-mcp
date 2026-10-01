/** Read a required env var or throw. Returns a definite `string`, not `string |
 * undefined` — control-flow narrowing on a plain guard doesn't persist into a
 * closure defined later in the same module, so this avoids that pitfall entirely. */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/** `denominator > 0 ? numerator / denominator : fallback` — guards the
 * zero-rounds/zero-shots/zero-kills case that recurs across derived-stat
 * calculations (match-insight.ts, player-stats.ts). */
export function safeDivide(
  numerator: number,
  denominator: number,
  fallback = 0,
): number {
  return denominator > 0 ? numerator / denominator : fallback;
}

/** Runs `fn`, swallowing any thrown error and returning `undefined` instead —
 * README.md's fail-open cache decision: a cache outage (read or write)
 * must never fail an otherwise-successful tool call, since the live HenrikDev
 * path is always a working fallback. Logs operational metadata only (`label`
 * + the error message) — never player data or cache content. */
export async function cacheFailOpen<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error(label, err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
