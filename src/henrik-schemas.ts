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

const nullableNameRefSchema = z.object({ name: z.string().nullable() });

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

const storedMatchItemSchema = z.object({
  meta: z.object({
    id: z.string(),
    map: nullableNameRefSchema,
    mode: z.string(),
    started_at: z.string(),
    season: seasonRefSchema,
  }),
  stats: z.object({
    team: z.string(),
    character: nullableNameRefSchema,
    tier: z.number(),
    score: z.number(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    shots: z.object({
      head: z.number(),
      body: z.number(),
      leg: z.number(),
    }),
    damage: z.object({
      made: z.number(),
      received: z.number(),
    }),
  }),
  teams: z.object({
    red: z.number().nullable(),
    blue: z.number().nullable(),
  }),
});

export const storedMatchesSchema = z.object({
  status: z.number(),
  data: z.array(storedMatchItemSchema),
});
export type StoredMatchesResponse = z.infer<typeof storedMatchesSchema>;

export const mmrHistorySchema = z.object({
  status: z.number(),
  data: z.object({
    history: z.array(
      z.object({
        tier: tierRefSchema,
        match_id: z.string(),
        map: nullableNameRefSchema,
        season: seasonRefSchema,
        rr: z.number(),
        last_change: z.number(),
        elo: z.number(),
        refunded_rr: z.number(),
        was_derank_protected: z.boolean(),
        date: z.string(),
      }),
    ),
  }),
});
export type MmrHistoryResponse = z.infer<typeof mmrHistorySchema>;

const matchPlayerSchema = z.object({
  puuid: z.string(),
  name: z.string(),
  tag: z.string(),
  team_id: z.string(),
  party_id: z.string(),
  // Broader than the "pc"|"console" enum the mmr endpoint's path param takes —
  // unconfirmed whether HenrikDev reports a more granular console platform
  // name (e.g. "playstation") here, so this stays a plain string; callers that
  // need the narrower enum (compare-rank.ts) normalize it themselves.
  platform: z.string(),
  agent: nullableNameRefSchema,
  tier: tierRefSchema,
  stats: z.object({
    score: z.number(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    headshots: z.number(),
    bodyshots: z.number(),
    legshots: z.number(),
    damage: z.object({ dealt: z.number(), received: z.number() }),
  }),
});

const matchTeamSchema = z.object({
  team_id: z.string(),
  rounds: z.object({ won: z.number(), lost: z.number() }),
  won: z.boolean(),
});

// M2's T2 facets (KAST, trades, first bloods, multi-kills, weapon kills, side
// splits, economy buckets, plants/defuses, clutch stats) all derive from these
// two arrays. Validate only the fields those facets need, matching the file's
// existing "validate only what we consume" convention.

const roundPlayerRefSchema = z.object({
  puuid: z.string(),
  team: z.string(),
});

const weaponRefSchema = z.object({
  name: z.string().nullable(),
});

const roundStatsSchema = z.object({
  player: roundPlayerRefSchema,
  damage_events: z.array(
    z.object({
      player: roundPlayerRefSchema,
      bodyshots: z.number(),
      headshots: z.number(),
      legshots: z.number(),
      damage: z.number(),
    }),
  ),
  stats: z.object({
    bodyshots: z.number(),
    headshots: z.number(),
    legshots: z.number(),
    kills: z.number(),
    score: z.number(),
  }),
  economy: z.object({
    loadout_value: z.number(),
    weapon: weaponRefSchema.nullable(),
  }),
});

const matchRoundSchema = z.object({
  id: z.number(),
  winning_team: z.string(),
  plant: z
    .object({
      round_time_in_ms: z.number(),
      site: z.string(),
      player: roundPlayerRefSchema,
    })
    .nullable(),
  defuse: z
    .object({
      round_time_in_ms: z.number(),
      player: roundPlayerRefSchema,
    })
    .nullable(),
  stats: z.array(roundStatsSchema),
});

const matchKillSchema = z.object({
  round: z.number(),
  time_in_round_in_ms: z.number(),
  killer: roundPlayerRefSchema,
  victim: roundPlayerRefSchema,
  assistants: z.array(roundPlayerRefSchema),
  weapon: weaponRefSchema,
});

export const matchByIdSchema = z.object({
  status: z.number(),
  data: z.object({
    metadata: z.object({
      match_id: z.string(),
      map: z.object({ name: z.string() }),
      queue: z.object({ id: z.string(), name: z.string().nullable() }),
      started_at: z.string(),
      game_length_in_ms: z.number(),
      is_completed: z.boolean(),
      season: seasonRefSchema,
    }),
    players: z.array(matchPlayerSchema),
    teams: z.array(matchTeamSchema),
    rounds: z.array(matchRoundSchema),
    kills: z.array(matchKillSchema),
  }),
});
export type MatchByIdResponse = z.infer<typeof matchByIdSchema>;
export type MatchRound = z.infer<typeof matchRoundSchema>;
export type MatchKill = z.infer<typeof matchKillSchema>;

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
