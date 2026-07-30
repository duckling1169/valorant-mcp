/** Runs `fn`, swallowing any thrown error and returning `undefined` instead —
 * ARCHITECTURE.md's fail-open cache decision: a cache outage (read or write)
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
