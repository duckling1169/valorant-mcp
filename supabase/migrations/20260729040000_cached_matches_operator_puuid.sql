-- M4 slice 2: scope cached_matches per operator. Before this, the cache's
-- read-through (get_match_detail) trusted a cache hit without re-checking
-- the requesting operator was a participant — safe under M1/M3's single
-- hardcoded operator, but not once a second mcp_users identity exists: a
-- cache hit for match_id X written by operator A must never be served to
-- operator B, even if B was never a participant in X. Making operator_puuid
-- part of the primary key (not just an added column) enforces this by
-- construction — a lookup scoped to B's own puuid can only ever find rows B
-- itself wrote, so B always falls through to the live path (which still does
-- the participant check) for a match only A has cached.
--
-- Backfilled with the one operator who has ever used this deployment
-- (ARCHITECTURE.md's M4 slice 1: mcp_users seed row) since all 20 existing
-- rows were cached under them.
alter table cached_matches add column operator_puuid text;

update cached_matches
set operator_puuid = '698d1ebe-27b1-5f0d-8148-6955719f84ff'
where operator_puuid is null;

alter table cached_matches alter column operator_puuid set not null;
alter table cached_matches drop constraint cached_matches_pkey;
alter table cached_matches add primary key (operator_puuid, match_id);

create index cached_matches_operator_puuid_idx on cached_matches (operator_puuid);
