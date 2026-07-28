import { describe, it, expect } from "vitest";
import { RateBudget } from "./rate-budget";

describe("RateBudget", () => {
  it("allows up to capacity reservations, then refuses", () => {
    const budget = new RateBudget({ capacity: 3, windowMs: 1000 });
    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(false);
    expect(budget.available()).toBe(0);
  });

  it("reserves a whole batch atomically, or nothing at all", () => {
    const budget = new RateBudget({ capacity: 3, windowMs: 1000 });
    expect(budget.reserve(2)).toBe(true);
    expect(budget.reserve(2)).toBe(false); // only 1 slot left, batch of 2 refused
    expect(budget.available()).toBe(1); // nothing partially consumed
  });

  it("ages reservations out of the sliding window", () => {
    let now = 0;
    const budget = new RateBudget({
      capacity: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(false);
    now = 1001;
    expect(budget.reserve()).toBe(true);
  });

  it("reconcile only ever clamps down, never up", () => {
    const budget = new RateBudget({ capacity: 10, windowMs: 1000 });
    budget.reserve(2); // 8 available locally
    budget.reconcile(9); // server says more available than we think — ignored
    expect(budget.available()).toBe(8);
    budget.reconcile(3); // server says fewer — believed
    expect(budget.available()).toBe(3);
  });

  it("msUntilReset reports 0 when slots are free, else time until the oldest ages out", () => {
    let now = 0;
    const budget = new RateBudget({
      capacity: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(budget.msUntilReset()).toBe(0);
    budget.reserve();
    expect(budget.msUntilReset()).toBe(1000);
    now = 400;
    expect(budget.msUntilReset()).toBe(600);
  });
});
