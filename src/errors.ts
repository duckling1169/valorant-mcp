// One Error subclass per kind in ARCHITECTURE.md's Error mapping table. The tool
// boundary (envelope.ts) maps each of these to its ToolError["kind"]; nothing else
// in the codebase should construct a ToolError directly.

/** Thrown when the local rate budget can't afford a call, or the server 429s. */
export class RateBudgetExhaustedError extends Error {
  readonly retryAfterMs: number;
  /** True if HenrikDev itself rejected us (429) vs. our local pre-call gate. */
  readonly fromServer: boolean;

  constructor(retryAfterMs: number, fromServer: boolean) {
    const secs = Math.ceil(retryAfterMs / 1000);
    super(`Rate budget exhausted; ~${secs}s until reset.`);
    this.name = "RateBudgetExhaustedError";
    this.retryAfterMs = retryAfterMs;
    this.fromServer = fromServer;
  }
}

/** Thrown for a non-429 HenrikDev error response, timeout, or network failure. */
export class UpstreamError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/**
 * Thrown when a HenrikDev payload doesn't match the validated shape we expect.
 * `fieldPath` may name the offending field; it must never carry its value.
 */
export class SchemaError extends Error {
  readonly fieldPath: string | undefined;

  constructor(message: string, fieldPath?: string) {
    super(message);
    this.name = "SchemaError";
    this.fieldPath = fieldPath;
  }
}

/** Thrown for malformed tool arguments or a request outside the approved scope. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}
