-- M4 slice 1: identity foundation for other-user access (ARCHITECTURE.md,
-- 2026-07-29 grilling session — two-list consent model). Applied directly to
-- the "VALORANT MCP" Supabase project via the Supabase MCP tool; this file is
-- a durable record, not a CLI-runnable migration (no CLI workflow in use yet).
--
-- consented_profiles (List 2): a VALORANT profile whose data may be looked up
-- by anyone on List 1 — group-wide consent, not pairwise. Group membership
-- itself (who's in the friend group) isn't modeled; only "this puuid has
-- consented" is.
--
-- mcp_users (List 1): grants actual MCP service access, one row per person,
-- keyed by the email in their Supabase-issued JWT. Strictly narrower than
-- List 2 (enforced by the FK): nobody gets service access without also being
-- a consented profile — every mcp_users row identifies that person's own
-- puuid as their "operator" identity for their own requests.
create table consented_profiles (
  puuid         text primary key,
  name          text not null,
  tag           text not null,
  region        text not null,
  platform      text not null default 'pc',
  consented_at  timestamptz not null default now()
);

create table mcp_users (
  email       text primary key,
  puuid       text not null references consented_profiles (puuid),
  created_at  timestamptz not null default now()
);

-- Same RLS posture as cached_matches: only the server-side service-role key
-- has any legitimate reason to touch these tables (no browser-side use case).
alter table consented_profiles enable row level security;
alter table mcp_users enable row level security;
