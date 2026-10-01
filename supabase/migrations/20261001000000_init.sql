-- valorant-mcp schema. All tables are server-only: RLS is on with no policies,
-- so only the service-role key can read or write them.

-- VALORANT profiles that have consented to be looked up on this deployment:
-- the owner's own account (added on /setup) and friends who accepted an invite.
create table consented_profiles (
  puuid         text primary key,
  name          text not null,
  tag           text not null,
  region        text not null,
  platform      text not null default 'pc',
  consented_at  timestamptz not null default now()
);

-- One row per connector URL. Only SHA-256(key) is stored.
create table connections (
  key_hash      text primary key,
  puuid         text not null references consented_profiles (puuid) on delete cascade,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index connections_puuid_idx on connections (puuid);

-- Single-use invites created by the owner; deleted when claimed.
create table invites (
  code        text primary key,
  puuid       text not null,
  name        text not null,
  tag         text not null,
  region      text not null,
  platform    text not null default 'pc',
  created_at  timestamptz not null default now()
);

-- Per-profile match cache (lib/match-cache.ts), bounded to 100 rows per profile.
-- detail is null for "light" rows written from match lists.
create table cached_matches (
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
);
create index cached_matches_cached_at_idx on cached_matches (cached_at desc);
create index cached_matches_started_at_idx on cached_matches (started_at desc);

alter table consented_profiles enable row level security;
alter table connections enable row level security;
alter table invites enable row level security;
alter table cached_matches enable row level security;
