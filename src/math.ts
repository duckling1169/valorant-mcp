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
