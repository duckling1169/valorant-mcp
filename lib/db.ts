import { neon } from "@neondatabase/serverless";

// Neon Postgres over HTTP. The schema is applied before the first query, so a fresh
// deployment needs no migration step. All tables are server-only.

export const SCHEMA = [
  // Profiles that have consented to be looked up: the owner's own account and friends
  // who accepted an invite.
  `create table if not exists consented_profiles (
    puuid         text primary key,
    name          text not null,
    tag           text not null,
    region        text not null,
    platform      text not null default 'pc',
    consented_at  timestamptz not null default now()
  )`,
  // One row per connector URL; only SHA-256(key) is stored.
  `create table if not exists connections (
    key_hash      text primary key,
    puuid         text not null references consented_profiles (puuid) on delete cascade,
    created_at    timestamptz not null default now(),
    last_used_at  timestamptz
  )`,
  `create index if not exists connections_puuid_idx on connections (puuid)`,
  // Single-use invites; deleted when claimed.
  `create table if not exists invites (
    code        text primary key,
    puuid       text not null,
    name        text not null,
    tag         text not null,
    region      text not null,
    platform    text not null default 'pc',
    created_at  timestamptz not null default now()
  )`,
  // Per-profile match cache (lib/match-cache.ts). detail is null for "light" rows.
  `create table if not exists cached_matches (
    operator_puuid      text not null,
    match_id            text not null,
    map                 text,
    mode                text,
    started_at          timestamptz not null,
    season_id           text,
    season_short        text,
    operator_agent      text,
    operator_tier_id    int,
    operator_tier_name  text,
    operator_score      int,
    operator_kills      int,
    operator_deaths     int,
    operator_assists    int,
    operator_won        boolean,
    detail              jsonb,
    has_insight         boolean not null default false,
    cached_at           timestamptz not null default now(),
    primary key (operator_puuid, match_id)
  )`,
  `create index if not exists cached_matches_cached_at_idx on cached_matches (cached_at desc)`,
  `create index if not exists cached_matches_started_at_idx on cached_matches (started_at desc)`,
];

export type Row = Record<string, unknown>;

/** The database as the app uses it: tagged-template SQL, plus `query` for SQL built at
 * runtime. Parameters are always sent separately from the SQL text. */
export interface Db {
  sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  query(text: string, params?: unknown[]): Promise<Row[]>;
}

export function createDb(url: string): Db {
  const q = neon(url);
  let ready: Promise<void> | undefined;
  const ensure = () => {
    ready ??= (async () => {
      for (const statement of SCHEMA) await q.query(statement);
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  };
  return {
    async sql(strings, ...values) {
      await ensure();
      return (await q(strings, ...values)) as Row[];
    },
    async query(text, params = []) {
      await ensure();
      return (await q.query(text, params)) as Row[];
    },
  };
}
