-- M3 slice 2: get_match_detail cache read-through. A cached row can only
-- satisfy an include_insight:true request if it was itself written with
-- insight included — has_insight makes that check explicit rather than
-- inferring it from a coincidental field in the stored `detail` jsonb.
alter table cached_matches add column has_insight boolean not null default false;
