import type { HenrikClient } from "./henrik-client";
import type { Region, Platform } from "./config";
import {
  accountByPuuidSchema,
  mmrByPuuidSchema,
  parseHenrikPayload,
  type AccountByPuuidResponse,
  type MmrByPuuidResponse,
} from "./henrik-schemas";

// Thin, version-picked primitives over HenrikClient — one fn per endpoint we use,
// pinned to the current version confirmed against docs.henrikdev.xyz during
// Slice 1 research (account -> v2 by-puuid, mmr -> v3 by-puuid). This layer's job
// is correct URL construction and fail-closed validation; it does not reshape or
// aggregate (that's profile.ts).

const seg = (s: string) => encodeURIComponent(s);

export class Endpoints {
  constructor(private readonly client: HenrikClient) {}

  async getAccountByPuuid(
    puuid: string,
  ): Promise<AccountByPuuidResponse["data"]> {
    const res = await this.client.get(
      `/valorant/v2/by-puuid/account/${seg(puuid)}`,
    );
    return parseHenrikPayload(accountByPuuidSchema, res.data).data;
  }

  async getMmr(
    region: Region,
    platform: Platform,
    puuid: string,
  ): Promise<MmrByPuuidResponse["data"]> {
    const res = await this.client.get(
      `/valorant/v3/by-puuid/mmr/${region}/${platform}/${seg(puuid)}`,
    );
    return parseHenrikPayload(mmrByPuuidSchema, res.data).data;
  }
}
