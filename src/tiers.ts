// Static because HenrikDev's stored-matches endpoint (unlike mmr/mmr-history)
// returns only a bare numeric tier, no name. Index = Riot's tier ID, confirmed
// against HenrikDev's own published `tiers` enum ordering and cross-checked live
// (id 10 -> "Silver 2", id 15 -> "Platinum 1"). An out-of-range id resolves to
// null rather than throwing (same forward-compatible fallback as agent-roles.ts).
const TIER_NAMES: readonly string[] = [
  "Unrated",
  "Unknown 1",
  "Unknown 2",
  "Iron 1",
  "Iron 2",
  "Iron 3",
  "Bronze 1",
  "Bronze 2",
  "Bronze 3",
  "Silver 1",
  "Silver 2",
  "Silver 3",
  "Gold 1",
  "Gold 2",
  "Gold 3",
  "Platinum 1",
  "Platinum 2",
  "Platinum 3",
  "Diamond 1",
  "Diamond 2",
  "Diamond 3",
  "Ascendant 1",
  "Ascendant 2",
  "Ascendant 3",
  "Immortal 1",
  "Immortal 2",
  "Immortal 3",
  "Radiant",
];

export function tierName(id: number): string | null {
  return TIER_NAMES[id] ?? null;
}
