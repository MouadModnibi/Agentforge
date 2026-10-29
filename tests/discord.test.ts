import { describe, expect, it } from "vitest";
import { discordWebhookUrl } from "@/lib/workflows/discord";
import { GraphSchema } from "@/lib/workflows/schema";
import { validateGraph } from "@/lib/workflows/graph";

describe("Discord configuration", () => {
  it("accepts copied Discord webhook URLs and the explicit API v10 path", () => {
    for (const path of ["api/webhooks", "api/v10/webhooks"])
      expect(
        discordWebhookUrl(
          ` https://discord.com/${path}/123456789/test_token-abc `,
        ),
      ).toBe(`https://discord.com/${path}/123456789/test_token-abc`);
  });
  for (const value of [
    "http://discord.com/api/webhooks/123/token",
    "https://evil.test/api/webhooks/123/token",
    "https://discord.com.evil.test/api/webhooks/123/token",
    "https://discord.com@evil.test/api/webhooks/123/token",
    "https://user:password@discord.com/api/webhooks/123/token",
    "https://discord.com:444/api/webhooks/123/token",
    "https://discord.com/api/webhooks/123/token?wait=false",
    "https://discord.com/api/webhooks/123/token#fragment",
    "https://discord.com/api/webhooks/123/token/messages/456",
    "https://127.0.0.1/api/webhooks/123/token",
    "not-a-url",
  ])
    it(`rejects an unsafe/non-webhook URL (${new URL(value, "https://example.invalid").hostname}) without echoing it`, () => {
      expect(() => discordWebhookUrl(value)).toThrow(
        "Use a Discord webhook URL:",
      );
      try {
        discordWebhookUrl(value);
      } catch (error) {
        expect(String(error)).not.toContain(value);
      }
    });
  it("requires a credential and disables automatic retries for Discord sends", () => {
    const graph = GraphSchema.parse({
      nodes: [
        {
          id: "start",
          kind: "manual",
          label: "Start",
          position: { x: 0, y: 0 },
        },
        {
          id: "send",
          kind: "discord",
          label: "Discord",
          position: { x: 300, y: 0 },
          config: { credentialId: "", text: "Hello" },
          retry: { attempts: 2 },
        },
      ],
      edges: [{ id: "a", source: "start", target: "send" }],
    });
    expect(validateGraph(graph)).toContain(
      "Discord: credentialId is required.",
    );
    expect(
      validateGraph(graph).some((e) =>
        e.includes("automatic retries are disabled"),
      ),
    ).toBe(true);
  });
});
