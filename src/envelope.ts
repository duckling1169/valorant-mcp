import {
  RateBudgetExhaustedError,
  UpstreamError,
  SchemaError,
  InputError,
} from "./errors.js";

// The one envelope every tool returns (ARCHITECTURE.md's Error mapping section).
// Internal code throws; only the tool boundary (guardTool/toToolError) converts a
// throw into this envelope. Never leak a raw exception, a HenrikDev response body,
// or a player value to the client.

export type ErrorKind = "rate" | "upstream" | "schema" | "input";

export interface ToolError {
  kind: ErrorKind;
  message: string;
  /** present for "rate" only. */
  retryAfterMs?: number;
}

export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: ToolError;
}

export function successEnvelope<T>(data: T): Envelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(error: ToolError): Envelope<never> {
  return { ok: false, error };
}

/** Map an internal throw to one of the four ToolError kinds. */
export function toToolError(err: unknown): ToolError {
  if (err instanceof RateBudgetExhaustedError) {
    return {
      kind: "rate",
      message: err.message,
      retryAfterMs: err.retryAfterMs,
    };
  }
  if (err instanceof SchemaError) {
    return { kind: "schema", message: err.message };
  }
  if (err instanceof InputError) {
    return { kind: "input", message: err.message };
  }
  if (err instanceof UpstreamError) {
    return { kind: "upstream", message: err.message };
  }
  // Unknown/unexpected throws are treated as upstream rather than leaking internals.
  return {
    kind: "upstream",
    message: err instanceof Error ? err.message : String(err),
  };
}

/** Run a tool body, returning its envelope; any throw becomes an error envelope. */
export async function guardTool<T>(fn: () => Promise<T>): Promise<Envelope<T>> {
  try {
    return successEnvelope(await fn());
  } catch (err) {
    return errorEnvelope(toToolError(err));
  }
}
