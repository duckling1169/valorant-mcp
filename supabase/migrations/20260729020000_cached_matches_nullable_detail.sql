-- M3 slice 3: widen write-through to get_recent_matches/get_player_stats. A
-- "light" row (from stored-matches, operator's own stat line only — no full
-- player roster) can't populate a valid MatchDetail, so detail must be
-- nullable to represent "no full detail available yet" for these rows.
alter table cached_matches alter column detail drop not null;
