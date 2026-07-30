-- M4 slice 3: invite-code onboarding. mcp_users (List 1) is a strict
-- allowlist keyed by email, but pre-registering a friend's exact login email
-- forces deciding it before they've ever signed in. mcp_invites decouples the
-- two: the admin fixes *which puuid* an invite grants (already consent-gated
-- via consented_profiles), and whoever redeems the code becomes that puuid's
-- mcp_users row under whatever email they actually authenticated with
-- (app/api/claim/route.ts). Single-use: claimed_at set on first redemption,
-- a second attempt with the same code is rejected.
create table mcp_invites (
  code           text primary key,
  puuid          text not null references consented_profiles (puuid),
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  claimed_email  text
);

alter table mcp_invites enable row level security;
