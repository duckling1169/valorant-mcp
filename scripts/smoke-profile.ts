// Manual-only smoke test against the real HenrikDev API (CONTRIBUTING.md: "a real
// HenrikDev smoke test uses the maintainer's key and is manually invoked; it never
// runs in CI"). Run with: pnpm smoke:profile

import { loadConfig } from "../src/config.js";
import { HenrikClient } from "../src/henrik-client.js";
import { Endpoints } from "../src/endpoints.js";
import { getProfile } from "../src/profile.js";

const config = loadConfig(process.env);
const client = new HenrikClient({ apiKey: config.henrikApiKey });
const endpoints = new Endpoints(client);

const envelope = await getProfile({ endpoints, config });
console.log(JSON.stringify(envelope, null, 2));

if (!envelope.ok) {
  process.exitCode = 1;
}
