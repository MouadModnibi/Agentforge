import { describe, it, expect, vi } from "vitest";
import { withRateLimitHandling } from "@/lib/runtime/withRateLimitHandling";

describe("withRateLimitHandling", () => {
  it("returns result on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRateLimitHandling(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 error", async () => {
    const rateLimitError = Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue("ok");

    const result = await withRateLimitHandling(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it("throws after max attempts", async () => {
    const rateLimitError = Object.assign(new Error("quota exceeded"), { status: 429 });
    const fn = vi.fn().mockRejectedValue(rateLimitError);

    await expect(withRateLimitHandling(fn, 2)).rejects.toThrow("quota");
    expect(fn).toHaveBeenCalledTimes(2);
  }, 15000);

  it("does not retry non-rate-limit errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Some other error"));
    await expect(withRateLimitHandling(fn, 3)).rejects.toThrow("Some other error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
