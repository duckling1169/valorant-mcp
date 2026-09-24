-- The composite primary key on (operator_puuid, match_id) already supports
-- filters on its leading operator_puuid column. Avoid maintaining a duplicate
-- single-column index for the cache's operator-scoped queries.
drop index if exists public.cached_matches_operator_puuid_idx;
