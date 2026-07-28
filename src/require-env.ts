/** Read a required env var or throw. Returns a definite `string`, not `string |
 * undefined` — control-flow narrowing on a plain guard doesn't persist into a
 * closure defined later in the same module, so this avoids that pitfall entirely. */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
