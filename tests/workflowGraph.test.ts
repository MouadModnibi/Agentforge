import { describe, it, expect } from "vitest";
import {
  validateGraph,
  topologicalOrder,
  resolveBindings,
  readPath,
} from "@/lib/workflows/graph";
import { templates } from "@/lib/workflows/templates";
import { GraphSchema } from "@/lib/workflows/schema";
const sample = () =>
  structuredClone(templates.find((t) => t.id === "routing")!.graph);
describe("workflow graph", () => {
  it("validates the offline branching template", () =>
    expect(validateGraph(sample())).toEqual([]));
  it("orders predecessors before successors", () => {
    const order = topologicalOrder(sample());
    expect(order.indexOf("start")).toBeLessThan(order.indexOf("priority"));
    expect(order.indexOf("priority")).toBeLessThan(order.indexOf("normal"));
  });
  it("rejects cycles", () => {
    const g = sample();
    g.edges.push({
      id: "cycle",
      source: "urgent",
      target: "priority",
      sourceHandle: "out",
    });
    expect(validateGraph(g).join()).toContain("cycle");
  });
  it("rejects disconnected nodes", () => {
    const g = sample();
    g.edges = g.edges.filter((e) => e.target !== "normal");
    expect(validateGraph(g).join()).toContain("disconnected");
  });
  it("rejects missing node references", () => {
    const g = sample();
    g.edges[0].target = "missing";
    expect(validateGraph(g).join()).toContain("missing node");
  });
  it("rejects duplicate node IDs", () => {
    const g = sample();
    g.nodes.push(g.nodes[0]);
    expect(validateGraph(g).join()).toContain("unique");
  });
  it("rejects multiple triggers", () => {
    const g = sample();
    g.nodes[1].kind = "manual";
    expect(validateGraph(g).join()).toContain("exactly one trigger");
  });
  it("rejects unknown branch handles", () => {
    const g = sample();
    g.edges[1].sourceHandle = "wrong";
    expect(validateGraph(g).join()).toContain("Unknown output");
  });
  it("rejects automatic retries on messaging nodes", () => {
    const g = sample();
    g.nodes[2].kind = "telegram";
    g.nodes[2].config = { credentialId: "c", chatId: "1", text: "hello" };
    g.nodes[2].retry.attempts = 2;
    expect(validateGraph(g).join()).toContain("external side effects");
  });
  it("rejects excessive graph sizes", () =>
    expect(
      GraphSchema.safeParse({
        nodes: Array(101).fill(sample().nodes[0]),
        edges: [],
      }).success,
    ).toBe(false));
});
describe("safe workflow bindings", () => {
  const context = {
    input: { number: 42, text: "hello" },
    trigger: { chatId: 123 },
    nodes: { agent: { answer: "yes" } },
  };
  it("preserves number types for exact references", () =>
    expect(resolveBindings("{{input.number}}", context)).toBe(42));
  it("preserves object types for exact references", () =>
    expect(resolveBindings("{{nodes.agent}}", context)).toEqual({
      answer: "yes",
    }));
  it("interpolates strings and nested arrays", () =>
    expect(
      resolveBindings(
        { values: ["Chat {{trigger.chatId}}", "{{input.text}}"] },
        context,
      ),
    ).toEqual({ values: ["Chat 123", "hello"] }));
  it("reports unresolved references", () =>
    expect(() => resolveBindings("{{nodes.missing}}", context)).toThrow(
      "Reference not found",
    ));
  it("rejects prototype references", () =>
    expect(() => readPath(context, "constructor.name")).toThrow("Unsafe"));
  it("rejects dangerous object keys", () =>
    expect(() =>
      resolveBindings(JSON.parse('{"__proto__": {"polluted":true}}'), context),
    ).toThrow("Unsafe"));
});
