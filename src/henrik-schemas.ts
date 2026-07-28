import { z } from "zod";
import { SchemaError } from "./errors";

// Validate only the fields get_profile actually consumes from each HenrikDev
// payload (ARCHITECTURE.md: "validate HenrikDev payloads at the boundary and fail
// closed on schema drift"). Unknown extra fields are ignored (forward-compatible);
// missing/wrong-typed fields we depend on fail closed.

const tierRefSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const seasonRefSchema = z.object({
  id: z.string(),
  short: z.string(),
});

export const accountByPuuidSchema = z.object({
  status: z.number(),
  data: z.object({
    puuid: z.string(),
    region: z.string(),
    account_level: z.number(),
    name: z.string(),
    tag: z.string(),
    card: z.string(),
    title: z.string(),
    platforms: z.array(z.string()),
    updated_at: z.string(),
  }),
});
export type AccountByPuuidResponse = z.infer<typeof accountByPuuidSchema>;

export const mmrByPuuidSchema = z.object({
  status: z.number(),
  data: z.object({
    account: z.object({
      puuid: z.string(),
      name: z.string(),
      tag: z.string(),
    }),
    peak: z.object({
      season: seasonRefSchema,
      tier: tierRefSchema,
      rr: z.number(),
    }),
    current: z.object({
      tier: tierRefSchema,
      rr: z.number(),
      elo: z.number(),
      leaderboard_placement: z.number().nullable(),
    }),
  }),
});
export type MmrByPuuidResponse = z.infer<typeof mmrByPuuidSchema>;

/** Parse `body` against `schema`; on failure, throw SchemaError naming the field
 * path only — never the offending value (ARCHITECTURE.md's error-mapping rule). */
export function parseHenrikPayload<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const firstIssue = result.error.issues[0];
  const fieldPath = firstIssue?.path.join(".") || undefined;
  throw new SchemaError(
    `HenrikDev payload did not match the expected shape${fieldPath ? ` (field: ${fieldPath})` : ""}`,
    fieldPath,
  );
}
