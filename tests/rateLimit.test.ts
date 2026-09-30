import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/security/rateLimit";

// Reset module state between tests by manipulating time
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    const key = `test-${Date.now()}-allow`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 10);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over limit", () => {
    const key = `test-${Date.now()}-block`;
    // Exhaust the bucket
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key, 10);
    }
    const result = checkRateLimit(key, 10);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("different keys have independent buckets", () => {
    const key1 = `test-${Date.now()}-k1`;
    const key2 = `test-${Date.now()}-k2`;

    for (let i = 0; i < 10; i++) checkRateLimit(key1, 10);

    // key2 should still be allowed
    const result = checkRateLimit(key2, 10);
    expect(result.allowed).toBe(true);
  });

  it("refills after a minute", () => {
    const key = `test-${Date.now()}-refill`;
    for (let i = 0; i < 10; i++) checkRateLimit(key, 10);

    // Blocked now
    expect(checkRateLimit(key, 10).allowed).toBe(false);

    // Advance time by 61 seconds
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    const result = checkRateLimit(key, 10);
    expect(result.allowed).toBe(true);
  });
});
