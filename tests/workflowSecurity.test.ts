import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sameOrigin,
} from "@/lib/security/adminAuth";
import { redactSecrets } from "@/lib/security/redaction";
import { body } from "@/lib/workflows/api";
import { validateInput } from "@/lib/runtime/validateInput";
afterEach(() => vi.unstubAllEnvs());
describe("workspace authentication", () => {
  it("rejects foreign origins and cross-site browser requests", () => {
    expect(
      sameOrigin(
        new Request("https://example.com/api", {
          headers: { origin: "https://evil.com" },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("https://example.com/api", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
  });
});
describe("payload and secret safety", () => {
  it("redacts credentials inside nested values without destroying JSON", () => {
    expect(
      redactSecrets({ trace: [{ header: 'Bearer secret"value' }] }, [
        'secret"value',
      ]),
    ).toEqual({ trace: [{ header: "Bearer [REDACTED]" }] });
  });
  it("enforces streamed request size", async () => {
    await expect(
      body(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ x: "a".repeat(1024 * 1024) }),
        }),
      ),
    ).rejects.toThrow("1 MB");
  });
  it("parses a valid JSON request", async () =>
    expect(
      await body(
        new Request("http://localhost", { method: "POST", body: '{"x":1}' }),
      ),
    ).toEqual({ x: 1 }));
  it("validates typed agent inputs on the server", () => {
    expect(() =>
      validateInput(
        [{ id: "1", name: "count", type: "number", required: true }],
        { count: "one" },
      ),
    ).toThrow("must be number");
  });
  it("applies typed input defaults", () =>
    expect(
      validateInput(
        [
          {
            id: "1",
            name: "count",
            type: "number",
            required: true,
            default: "3",
          },
        ],
        {},
      ),
    ).toEqual({ count: 3 }));
});
