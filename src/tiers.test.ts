import { describe, it, expect } from "vitest";
import { tierName } from "./tiers";

describe("tierName", () => {
  it("returns null for an out-of-range id rather than throwing", () => {
    expect(tierName(999)).toBeNull();
    expect(tierName(-1)).toBeNull();
  });
});
