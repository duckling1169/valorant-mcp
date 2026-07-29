export type AgentRole = "duelist" | "initiator" | "controller" | "sentinel";

// Static because HenrikDev's /valorant/v1/content endpoint (confirmed live during
// M2 slice 1 planning) returns agent names but not their role. Riot ships new
// agents rarely (~2-3/year) — update this table when one launches; an unrecognized
// name resolves to null rather than throwing (ARCHITECTURE.md, 2026-07-28).
//
// Miks and Veto appeared in the live content list but aren't classified here —
// no verified role information was available when this table was written.
export const AGENT_ROLES: Record<string, AgentRole> = {
  Astra: "controller",
  Breach: "initiator",
  Brimstone: "controller",
  Chamber: "sentinel",
  Clove: "controller",
  Cypher: "sentinel",
  Deadlock: "sentinel",
  Fade: "initiator",
  Gekko: "initiator",
  Harbor: "controller",
  Iso: "duelist",
  Jett: "duelist",
  "KAY/O": "initiator",
  Killjoy: "sentinel",
  Neon: "duelist",
  Omen: "controller",
  Phoenix: "duelist",
  Raze: "duelist",
  Reyna: "duelist",
  Sage: "sentinel",
  Skye: "initiator",
  Sova: "initiator",
  Tejo: "initiator",
  Viper: "controller",
  Vyse: "sentinel",
  Waylay: "duelist",
  Yoru: "duelist",
};

export function agentRole(name: string | null): AgentRole | null {
  if (!name) return null;
  return AGENT_ROLES[name] ?? null;
}
