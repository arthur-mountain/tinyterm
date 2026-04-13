import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSafeEnv, createRateLimiter, validateMessage } from "../security.js";

describe("buildSafeEnv", () => {
  it("includes whitelisted env vars", () => {
    const env = buildSafeEnv({
      PATH: "/usr/bin",
      HOME: "/Users/test",
      USER: "test",
    });
    expect(env["PATH"]).toBe("/usr/bin");
    expect(env["HOME"]).toBe("/Users/test");
    expect(env["USER"]).toBe("test");
  });

  it("excludes non-whitelisted vars", () => {
    const env = buildSafeEnv({
      PATH: "/usr/bin",
      AWS_SECRET_ACCESS_KEY: "secret",
      GITHUB_TOKEN: "ghp_xxx",
      DATABASE_URL: "postgres://...",
    });
    expect(env["AWS_SECRET_ACCESS_KEY"]).toBeUndefined();
    expect(env["GITHUB_TOKEN"]).toBeUndefined();
    expect(env["DATABASE_URL"]).toBeUndefined();
  });

  it("omits undefined vars without crashing", () => {
    // Only PATH set; HOME, USER, etc. are undefined
    const env = buildSafeEnv({ PATH: "/usr/bin" });
    expect(env["PATH"]).toBe("/usr/bin");
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("returns empty object when no whitelisted vars present", () => {
    const env = buildSafeEnv({ SECRET: "oops", TOKEN: "abc" });
    expect(env).toEqual({});
  });
});

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows messages within limit", () => {
    const limiter = createRateLimiter(5);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
  });

  it("blocks messages over limit within the window", () => {
    const limiter = createRateLimiter(3);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
    expect(limiter.allow()).toBe(false);
  });

  it("resets count after 1 second window", () => {
    const limiter = createRateLimiter(2);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });
});

describe("validateMessage", () => {
  it("accepts a normal string", () => {
    expect(validateMessage("hello")).toBe("hello");
  });

  it("accepts an empty string", () => {
    expect(validateMessage("")).toBe("");
  });

  it("coerces non-string input to string", () => {
    expect(validateMessage(42)).toBe("42");
  });

  it("rejects messages exceeding max size", () => {
    const big = "x".repeat(64 * 1024 + 1);
    expect(validateMessage(big)).toBeNull();
  });

  it("accepts messages exactly at the size limit", () => {
    const exact = "x".repeat(64 * 1024);
    expect(validateMessage(exact)).toBe(exact);
  });
});
