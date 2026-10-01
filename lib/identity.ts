import { AsyncLocalStorage } from "node:async_hooks";
import type { Platform, Region } from "@/lib/config";

/** The VALORANT account a request acts as, resolved from its connection key. */
export interface OperatorIdentity {
  operatorPuuid: string;
  operatorRegion: Region;
  operatorPlatform: Platform;
}

/** Set by app/mcp/route.ts for the duration of each authenticated request. */
export const requestIdentity = new AsyncLocalStorage<OperatorIdentity>();

export function currentIdentity(): OperatorIdentity {
  const identity = requestIdentity.getStore();
  if (!identity) throw new Error("internal: no identity for this request");
  return identity;
}
