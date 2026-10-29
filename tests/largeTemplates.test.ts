import { describe, expect, it, vi } from "vitest";

// Isolate the graph from the account/runtime services. Pure nodes still execute
// through the production executor; only external HTTP/SMTP calls are stubbed.
vi.mock("@/lib/runtime/runAgent", () => ({
  runAgent: vi.fn(),
  setServerSandbox: vi.fn(),
}));
vi.mock("@/lib/sandbox/customToolRunner", () => ({
  getServerSandbox: vi.fn(),
}));
vi.mock("@/lib/repositories/agents", () => ({ agentsRepository: {} }));
vi.mock("@/lib/repositories/runs", () => ({ runsRepository: {} }));
vi.mock("@/lib/workflows/store", () => ({ workflowStore: {} }));

import { executeGraph } from "@/lib/workflows/engine";
import { executeNode, type ExecutionContext } from "@/lib/workflows/executors";
import { resolveBindings, validateGraph } from "@/lib/workflows/graph";
import { templates } from "@/lib/workflows/templates";
import { largeTemplates } from "@/lib/workflows/large-templates";
import type { WorkflowNode } from "@/lib/workflows/schema";

function configured(id: string) {
  const graph = structuredClone(largeTemplates.find((t) => t.id === id)!.graph);
  for (const n of graph.nodes) {
    if (["email", "discord"].includes(n.kind))
      n.config.credentialId = "test-connection";
    if (n.id === "settings") {
      const values = n.config.values as Record<string, unknown>;
      if ("recipient" in values) values.recipient = "owner@example.com";
      if ("teamInbox" in values) values.teamInbox = "team@example.com";
    }
  }
  return graph;
}

function harness(responses: Record<string, unknown>, failAt?: string) {
  const sent: Record<string, unknown>[] = [];
  const requested: string[] = [];
  const executor = async (n: WorkflowNode, ctx: ExecutionContext) => {
    if (n.kind !== "http" && n.kind !== "email" && n.kind !== "discord")
      return executeNode(n, ctx);
    const c = resolveBindings(n.config, ctx) as Record<string, unknown>;
    if (n.id === failAt) throw new Error("Provider unavailable");
    if (n.kind === "http") {
      requested.push(String(c.url));
      if (!Object.hasOwn(responses, n.id))
        throw new Error(`Missing fixture: ${n.id}`);
      return { output: responses[n.id] };
    }
    sent.push(c);
    if (n.kind === "discord")
      return {
        output: { messageId: "discord-test", channelId: "channel-test" },
      };
    return { output: { messageId: "smtp-test", accepted: [c.to] } };
  };
  return { executor, sent, requested };
}

function forecast(rain: number, wind: number, high: number) {
  return {
    current: { temperature_2m: 24 },
    daily: {
      time: ["2026-10-29"],
      temperature_2m_max: [high],
      temperature_2m_min: [15],
      precipitation_probability_max: [rain],
      wind_speed_10m_max: [wind],
    },
  };
}
function weatherResponses(rain = 10, wind = 15, high = 25) {
  return {
    "home-forecast": forecast(rain, wind, high),
    "second-forecast": forecast(20, 18, 22),
    "third-forecast": forecast(30, 20, 21),
  };
}

describe("large workflow templates", () => {
  it("preserves template IDs/order and publishes valid connected graphs after explicit credential setup", () => {
    expect(templates.slice(0, 5).map((t) => t.id)).toEqual([
      "starter",
      "routing",
      "agent",
      "telegram",
      "email",
    ]);
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect(largeTemplates.map((t) => t.graph.nodes.length)).toEqual([
      24, 20, 18, 24,
    ]);
    for (const t of largeTemplates) {
      expect(t.description.length).toBeLessThanOrEqual(1000);
      expect(
        t.graph.nodes.find((n) => ["email", "discord"].includes(n.kind))?.config
          .credentialId,
      ).toBe("");
      expect(
        validateGraph(t.graph).every((e) =>
          e.includes("credentialId is required"),
        ),
      ).toBe(true);
      expect(validateGraph(configured(t.id))).toEqual([]);
      for (const n of t.graph.nodes.filter(
        (n) =>
          n.kind === "http" && String(n.config.url).includes("api.github.com"),
      )) {
        expect(n.config.headers).toMatchObject({
          "User-Agent": "m8m-workflow",
          Accept: "application/vnd.github+json",
        });
      }
    }
  });

  for (let mask = 0; mask < 8; mask++) {
    it(`sends one complete weather briefing for risk combination ${mask}`, async () => {
      const h = harness(
        weatherResponses(
          mask & 1 ? 90 : 10,
          mask & 2 ? 55 : 10,
          mask & 4 ? 38 : 25,
        ),
      );
      const result = await executeGraph(
        configured("weather-email-briefing"),
        {},
        h,
      );
      expect(result.status, result.error).toBe("succeeded");
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0].to).toBe("owner@example.com");
      expect(h.sent[0].subject).toContain("Marrakech | 2026-10-29");
      const text = String(h.sent[0].text);
      for (const city of ["Marrakech", "Casablanca", "Rabat"])
        expect(text).toContain(city);
      expect(text).toContain("Open-Meteo");
      expect(text).not.toContain("{{");
      for (const [id, bit] of [
        ["rain", 1],
        ["wind", 2],
        ["heat", 4],
      ] as const) {
        expect(
          result.steps.find(
            (s) => s.nodeId === `${id}-${mask & bit ? "yes" : "no"}`,
          )?.status,
        ).toBe("succeeded");
        expect(
          result.steps.find(
            (s) => s.nodeId === `${id}-${mask & bit ? "no" : "yes"}`,
          )?.status,
        ).toBe("skipped");
      }
      expect(h.requested).toHaveLength(3);
      for (const url of h.requested) {
        expect(new URL(url).hostname).toBe("api.open-meteo.com");
        expect(url).not.toContain("{{");
      }
    });
  }

  it("uses strict greater-than thresholds, including exact boundary values", async () => {
    const h = harness(weatherResponses(60, 40, 32));
    const r = await executeGraph(configured("weather-email-briefing"), {}, h);
    expect(r.status, r.error).toBe("succeeded");
    for (const id of ["rain", "wind", "heat"])
      expect(r.steps.find((s) => s.nodeId === id)?.branch).toBe("false");
  });

  it("posts a complete weather briefing to Discord without any SMTP dependency", async () => {
    const h = harness(weatherResponses(90, 55, 38));
    const g = configured("weather-discord-briefing");
    expect(g.nodes.some((n) => n.kind === "email")).toBe(false);
    const r = await executeGraph(g, {}, h);
    expect(r.status, r.error).toBe("succeeded");
    expect(h.sent).toHaveLength(1);
    expect(String(h.sent[0].text).length).toBeLessThanOrEqual(2000);
    for (const city of ["Marrakech", "Casablanca", "Rabat"])
      expect(h.sent[0].text).toContain(city);
    expect(r.output).toMatchObject({
      messageId: "discord-test",
      channelId: "channel-test",
    });
  });

  it("fails before email when a forecast is unavailable or its expected fields are absent", async () => {
    for (const h of [
      harness(weatherResponses(), "second-forecast"),
      harness({ ...weatherResponses(), "home-forecast": {} }),
    ]) {
      const r = await executeGraph(configured("weather-email-briefing"), {}, h);
      expect(r.status).toBe("failed");
      expect(h.sent).toHaveLength(0);
    }
  });

  for (const archived of [true, false])
    for (const openItems of [2, 40]) {
      it(`briefs GitHub evidence with archived=${archived}, openItems=${openItems}`, async () => {
        const h = harness({
          repo: {
            full_name: "example/project",
            html_url: "https://github.com/example/project",
            stargazers_count: 3,
            forks_count: 1,
            open_issues_count: openItems,
            archived,
            pushed_at: "2026-10-29T08:00:00Z",
          },
          languages: { TypeScript: 12000 },
          commits: [{ sha: "abc", commit: { message: "Fix a bug" } }],
        });
        const r = await executeGraph(
          configured("github-project-briefing"),
          {},
          h,
        );
        expect(r.status, r.error).toBe("succeeded");
        expect(h.sent).toHaveLength(1);
        expect(String(h.sent[0].text)).toContain("Fix a bug");
        expect(String(h.sent[0].text)).toContain("TypeScript");
        expect(r.steps.find((s) => s.nodeId === "archived")?.branch).toBe(
          String(archived),
        );
        expect(r.steps.find((s) => s.nodeId === "backlog")?.branch).toBe(
          String(openItems > 20),
        );
      });
    }

  it("does not email a GitHub report after an API failure", async () => {
    const h = harness({}, "repo");
    expect(
      (await executeGraph(configured("github-project-briefing"), {}, h)).status,
    ).toBe("failed");
    expect(h.sent).toHaveLength(0);
  });

  for (const [category, queue] of [
    ["billing", "Billing"],
    ["technical", "Technical"],
    ["something else", "General"],
  ]) {
    for (const priority of ["urgent", "normal"]) {
      it(`routes ${category}/${priority} to the fixed team inbox, retaining a customer draft only`, async () => {
        const h = harness({});
        const r = await executeGraph(
          configured("support-intake-desk"),
          {
            name: "Alex",
            email: "customer@example.com",
            category,
            priority,
            text: "Please help with this request.",
          },
          h,
        );
        expect(r.status, r.error).toBe("succeeded");
        expect(h.sent).toHaveLength(1);
        expect(h.sent[0].to).toBe("team@example.com");
        expect(h.sent[0].subject).toContain(queue);
        expect(String(h.sent[0].text)).toContain(
          priority === "urgent" ? "URGENT -" : "STANDARD -",
        );
        expect(r.output).toMatchObject({
          acknowledgment: {
            status: "Draft only. No customer reply has been sent.",
          },
        });
        expect(h.requested).toHaveLength(0);
      });
    }
  }
});
