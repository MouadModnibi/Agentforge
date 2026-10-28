import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/runtime/runAgent", () => ({
  runAgent: vi.fn(),
  setServerSandbox: vi.fn(),
}));
vi.mock("@/lib/repositories/agents", () => ({
  agentsRepository: { findById: vi.fn(), getResources: vi.fn() },
}));
vi.mock("@/lib/repositories/runs", () => ({
  runsRepository: { create: vi.fn() },
}));
vi.mock("@/lib/workflows/store", () => ({
  workflowStore: { credential: vi.fn() },
}));
vi.mock("@/lib/security/ssrfGuard", () => ({
  guardedFetch: vi.fn(),
  resolvePublicHost: vi.fn(async () => "93.184.216.34"),
}));
vi.mock("@/lib/sandbox/customToolRunner", () => ({
  getServerSandbox: vi.fn(() => ({ isAvailable: () => false })),
}));
const { sendMail, close } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail, close }) },
}));
import { executeNode } from "@/lib/workflows/executors";
import { NodeSchema } from "@/lib/workflows/schema";
import { workflowStore } from "@/lib/workflows/store";
import { guardedFetch } from "@/lib/security/ssrfGuard";
const context = {
  input: { text: "hello", chatId: 55 },
  trigger: { text: "original" },
  nodes: {},
  signal: new AbortController().signal,
};
const node = (kind: string, config: unknown) =>
  NodeSchema.parse({
    id: "test",
    kind,
    label: kind,
    position: { x: 0, y: 0 },
    config,
  });
beforeEach(() => vi.clearAllMocks());
describe("workflow node executors", () => {
  it("maps typed transform data", async () =>
    expect(
      await executeNode(
        node("transform", {
          values: { chatId: "{{input.chatId}}", text: "{{trigger.text}}" },
        }),
        context,
      ),
    ).toEqual({ output: { chatId: 55, text: "original" } }));
  it("selects true and false condition handles", async () => {
    expect(
      (
        await executeNode(
          node("condition", {
            value: "{{input.chatId}}",
            operator: "greaterThan",
            compare: 50,
          }),
          context,
        )
      ).branch,
    ).toBe("true");
    expect(
      (
        await executeNode(
          node("condition", { value: "a", operator: "equals", compare: "b" }),
          context,
        )
      ).branch,
    ).toBe("false");
  });
  it("routes cases and default", async () => {
    expect(
      (
        await executeNode(
          node("router", { value: "a", cases: { first: "a" } }),
          context,
        )
      ).branch,
    ).toBe("first");
    expect(
      (
        await executeNode(
          node("router", { value: "b", cases: { first: "a" } }),
          context,
        )
      ).branch,
    ).toBe("default");
  });
  it("sends Telegram payloads with server credentials", async () => {
    vi.mocked(workflowStore.credential).mockResolvedValue({
      botToken: "12345:token",
    });
    vi.mocked(guardedFetch).mockResolvedValue(
      new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
      }),
    );
    await executeNode(
      node("telegram", {
        credentialId: "c",
        chatId: "{{input.chatId}}",
        text: "{{input.text}}",
      }),
      context,
    );
    expect(guardedFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bot12345:token/sendMessage",
      expect.objectContaining({ body: '{"chat_id":55,"text":"hello"}' }),
    );
  });
  it("sends SMTP without file or URL attachment access", async () => {
    vi.mocked(workflowStore.credential).mockResolvedValue({
      smtpHost: "smtp.example.com",
      user: "user@example.com",
      password: "secret",
    });
    sendMail.mockResolvedValue({
      messageId: "id",
      accepted: ["recipient@example.com"],
    });
    const r = await executeNode(
      node("email", {
        credentialId: "c",
        to: "recipient@example.com",
        subject: "test",
        text: "{{input.text}}",
      }),
      context,
    );
    expect(r.output).toEqual({
      messageId: "id",
      accepted: ["recipient@example.com"],
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(close).toHaveBeenCalled();
  });
  it("calls X with bearer authentication", async () => {
    vi.mocked(workflowStore.credential).mockResolvedValue({
      accessToken: "x-token",
    });
    vi.mocked(guardedFetch).mockResolvedValue(
      new Response('{"data":{"id":"1"}}', {
        headers: { "content-type": "application/json" },
      }),
    );
    await executeNode(
      node("x", { credentialId: "c", text: "{{input.text}}" }),
      context,
    );
    expect(guardedFetch).toHaveBeenCalledWith(
      "https://api.x.com/2/tweets",
      expect.objectContaining({
        headers: {
          authorization: "Bearer x-token",
          "content-type": "application/json",
        },
      }),
    );
  });
  it("does not reveal provider response bodies on HTTP errors", async () => {
    vi.mocked(guardedFetch).mockResolvedValue(
      new Response("secret body", { status: 401 }),
    );
    await expect(
      executeNode(
        node("http", {
          url: "https://example.com",
          method: "GET",
          headers: {},
        }),
        context,
      ),
    ).rejects.toThrow("HTTP 401");
  });
  it("stops immediately for an aborted execution", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      executeNode(node("transform", { values: {} }), {
        ...context,
        signal: c.signal,
      }),
    ).rejects.toThrow();
  });
});
