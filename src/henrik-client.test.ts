import { describe, it, expect, vi } from "vitest";
import { HenrikClient } from "./henrik-client";
import { RateBudget } from "./rate-budget";
import { RateBudgetExhaustedError, UpstreamError } from "./errors";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("HenrikClient", () => {
  it("returns the raw body on a 2xx response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        200,
        { status: 200, data: { hello: "world" } },
        {
          "x-ratelimit-remaining": "29",
        },
      ),
    );
    const client = new HenrikClient({ apiKey: "k", fetchImpl });
    const result = await client.get("/valorant/v2/account/a/b");
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: 200, data: { hello: "world" } });
  });

  it("sends the Authorization header", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { status: 200, data: {} }),
    );
    const client = new HenrikClient({ apiKey: "secret-key", fetchImpl });
    await client.get("/valorant/v2/account/a/b");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "secret-key" }),
      }),
    );
  });

  it("throws RateBudgetExhaustedError(fromServer: true) on a 429, reconciling budget to 0", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        429,
        { status: 429, message: "rate limited" },
        {
          "x-ratelimit-reset": "12",
        },
      ),
    );
    const budget = new RateBudget();
    const client = new HenrikClient({ apiKey: "k", fetchImpl, budget });
    await expect(client.get("/x")).rejects.toThrow(RateBudgetExhaustedError);
    expect(budget.available()).toBe(0);
  });

  it("throws RateBudgetExhaustedError(fromServer: false) without a network call when the local budget is exhausted", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { status: 200, data: {} }),
    );
    const budget = new RateBudget({ capacity: 0 });
    const client = new HenrikClient({ apiKey: "k", fetchImpl, budget });
    await expect(client.get("/x")).rejects.toThrow(RateBudgetExhaustedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws UpstreamError on a non-429 error response, without leaking the body into the message", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(500, {
        status: 500,
        message: "super secret internal detail",
      }),
    );
    const client = new HenrikClient({ apiKey: "k", fetchImpl });
    const err = await client.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).message).not.toContain(
      "super secret internal detail",
    );
    expect((err as UpstreamError).status).toBe(500);
  });

  it("throws UpstreamError on a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const client = new HenrikClient({ apiKey: "k", fetchImpl });
    await expect(client.get("/x")).rejects.toThrow(UpstreamError);
  });
});
