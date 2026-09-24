# Supabase schema history

Keep SQL changes flat in `migrations/`, ordered by their timestamp. Each file
represents one schema change so the deployed database's evolution remains
auditable.

| Migration | Change |
| --- | --- |
| `20260729000000_cached_matches.sql` | Create the bounded match cache. |
| `20260729010000_cached_matches_has_insight.sql` | Record whether cached detail includes insight. |
| `20260729020000_cached_matches_nullable_detail.sql` | Allow light cache rows without full match detail. |
| `20260729030000_mcp_users_consented_profiles.sql` | Add consented profiles and the MCP user allowlist. |
| `20260729040000_cached_matches_operator_puuid.sql` | Scope cached rows to an operator and backfill existing rows. |
| `20260729050000_mcp_invites.sql` | Add single-use onboarding invites. |
| `20260924181044_drop_redundant_cached_matches_operator_puuid_idx.sql` | Drop the duplicate operator index; the composite primary key has the same leading column. |

The first six changes were applied directly to the hosted project and recorded
here. The latest file removes a duplicate index from that schema. This
repository does not yet have a Supabase CLI configuration or a reconciled CLI
migration history, so don't assume `supabase db push` can safely apply pending
files. Before adopting it, establish a baseline from the deployed schema and
reconcile the remote migration history. Preserve the operator backfill if
squashing the schema history, since it changes existing data.

For future changes, add a new timestamped migration after the history has been
reconciled with the CLI workflow.
