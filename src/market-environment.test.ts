import { describe, expect, it } from "vitest";
import { validateMarketplaceEnv } from "./market-environment";

const hosted = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  VITE_MARKETPLACE_FOUNDATION: "1",
};
const anon = `header.${Buffer.from('{"role":"anon"}').toString("base64url")}.signature`;

describe("marketplace environment", () => {
  it("allows disconnected demos and rejects connected demo configuration", () => {
    expect(() => validateMarketplaceEnv({}, true)).not.toThrow();
    expect(() => validateMarketplaceEnv(hosted, true)).toThrow(/disconnected/);
  });

  it("requires complete configuration when enabled", () => {
    expect(() => validateMarketplaceEnv({ VITE_MARKETPLACE_FOUNDATION: "1" }, false)).toThrow(/both/);
    expect(() => validateMarketplaceEnv({ VITE_MARKETPLACE_FOUNDATION: "true" }, false)).toThrow(/0 or 1/);
    expect(() => validateMarketplaceEnv(hosted, false)).not.toThrow();
  });

  it.each([
    "http://example.supabase.co",
    "https://user:password@example.supabase.co",
    "https://example.supabase.co/auth",
    "https://example.supabase.co/?token=fixture",
  ])("rejects an unsafe endpoint %s", (url) => {
    expect(() => validateMarketplaceEnv({ ...hosted, VITE_SUPABASE_URL: url }, false)).toThrow(/origin/);
  });

  it("accepts legacy anonymous JWTs only with a loopback project", () => {
    const legacy = { ...hosted, VITE_SUPABASE_PUBLISHABLE_KEY: anon };
    expect(() => validateMarketplaceEnv(legacy, false)).toThrow(/publishable/);
    expect(() => validateMarketplaceEnv({ ...legacy, VITE_SUPABASE_URL: "http://127.0.0.1:54321" }, false)).not.toThrow();
  });

  it("rejects secret keys", () => {
    expect(() => validateMarketplaceEnv({ ...hosted, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test_fixture" }, false)).toThrow(/publishable/);
  });
});
