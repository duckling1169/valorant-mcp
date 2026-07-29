-- M3 first slice: bounded cache for match detail (ARCHITECTURE.md, 2026-07-28
-- "bounded cache" decision). Applied directly to the "VALORANT MCP" Supabase
-- project via the Supabase MCP tool; this file is a durable record, not a
-- CLI-runnable migration (no supabase/config.toml / CLI workflow in use).
--
-- No operator_puuid column: single-tenant, hardcoded to the one configured
-- operator (ARCHITECTURE.md's M1 PUUID-binding decision). Retention (100 rows
-- or 90 days, whichever binds first) and FIFO eviction are enforced in
-- application code (src/match-cache.ts) synchronously on every write, not
-- here.
create table cached_matches (
  match_id           text primary key,
  map                text,
  mode               text,
  started_at         timestamptz not null,
  season_id          text,
  season_short       text,
  operator_agent     text,
  operator_tier_id   int,
  operator_tier_name text,
  operator_score     int,
  operator_kills     int,
  operator_deaths    int,
  operator_assists   int,
  operator_won       boolean,
  detail             jsonb not null,
  cached_at          timestamptz not null default now()
);

create index cached_matches_cached_at_idx on cached_matches (cached_at desc);
create index cached_matches_started_at_idx on cached_matches (started_at desc);

-- Only the server-side service-role key should ever touch this table (no
-- browser-side use case for cached match data) — RLS with zero policies
-- fully locks out anon/authenticated; service-role always bypasses RLS.
alter table cached_matches enable row level security;
