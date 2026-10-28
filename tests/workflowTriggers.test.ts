import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/workflows/store", () => ({
  workflowStore: {
    list: vi.fn(),
    activeGraph: vi.fn(),
    triggerState: vi.fn(),
    credential: vi.fn(),
    setTriggerState: vi.fn(),
    enqueue: vi.fn(),
  },
}));
vi.mock("@/lib/security/ssrfGuard", () => ({
  resolvePublicHost: vi.fn(async () => "93.184.216.34"),
  guardedFetch: vi.fn(),
}));
const imap = vi.hoisted(() => ({
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  fetch: vi.fn(),
  logout: vi.fn(),
  close: vi.fn(),
}));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    connect = imap.connect;
    mailboxOpen = imap.mailboxOpen;
    fetch = imap.fetch;
    logout = imap.logout;
    close = imap.close;
  },
}));
vi.mock("mailparser", () => ({ simpleParser: vi.fn() }));
import { pollTriggers } from "@/lib/workflows/triggers";
import { workflowStore } from "@/lib/workflows/store";
import { guardedFetch } from "@/lib/security/ssrfGuard";
import { simpleParser } from "mailparser";
import { templates } from "@/lib/workflows/templates";
import type { Workflow } from "@/lib/workflows/schema";
function setup(
  kind: "emailTrigger" | "xTrigger",
  state: Record<string, unknown> = {},
) {
  const graph = structuredClone(templates[0].graph);
  graph.nodes[0].kind = kind;
  graph.nodes[0].config = { credentialId: "credential", mailbox: "INBOX" };
  const w = {
    id: "w",
    name: "test",
    description: "",
    revision: 1,
    activeRevision: 1,
    graph,
    createdAt: 1,
    updatedAt: 1,
  } satisfies Workflow;
  vi.mocked(workflowStore.list).mockResolvedValue([w]);
  vi.mocked(workflowStore.activeGraph).mockResolvedValue(graph);
  vi.mocked(workflowStore.triggerState).mockResolvedValue(state);
  vi.mocked(workflowStore.credential).mockResolvedValue({
    imapHost: "imap.example.com",
    user: "me",
    password: "secret",
    accessToken: "token",
    userId: "55",
  });
  imap.connect.mockResolvedValue(undefined);
  imap.logout.mockResolvedValue(undefined);
  imap.mailboxOpen.mockResolvedValue({ uidValidity: BigInt(1), uidNext: 11 });
  return w;
}
const xResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
beforeEach(() => vi.clearAllMocks());
describe("integration polling", () => {
  it("does not poll when the invocation budget has expired", async () => {
    setup("emailTrigger");
    await pollTriggers(AbortSignal.abort());
    expect(imap.connect).not.toHaveBeenCalled();
    expect(workflowStore.enqueue).not.toHaveBeenCalled();
  });
  it("establishes an email baseline without processing historical mail", async () => {
    setup("emailTrigger");
    await pollTriggers();
    expect(imap.fetch).not.toHaveBeenCalled();
    expect(workflowStore.setTriggerState).toHaveBeenCalledWith("w", {
      uidValidity: "1",
      uid: 10,
    });
    expect(imap.close).toHaveBeenCalled();
  });
  it("queues new mail with durable provider keys", async () => {
    setup("emailTrigger", { uidValidity: "1", uid: 8 });
    imap.fetch.mockImplementation(async function* () {
      yield { uid: 9, source: Buffer.from("mail") };
    });
    vi.mocked(simpleParser).mockResolvedValue({
      subject: "Hi",
      text: "Body",
      messageId: "message",
      from: { text: "a@example.com" },
    } as Awaited<ReturnType<typeof simpleParser>>);
    await pollTriggers();
    expect(workflowStore.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: "Body", uid: 9 }),
      "email",
      expect.objectContaining({ eventKey: "email:1:9" }),
    );
    expect(workflowStore.setTriggerState).toHaveBeenLastCalledWith("w", {
      uidValidity: "1",
      uid: 9,
    });
  });
  it("skips oversized email and advances its cursor", async () => {
    setup("emailTrigger", { uidValidity: "1", uid: 8 });
    imap.fetch.mockImplementation(async function* () {
      yield { uid: 9, source: Buffer.alloc(1024 * 1024 + 1) };
    });
    await pollTriggers();
    expect(workflowStore.enqueue).not.toHaveBeenCalled();
    expect(workflowStore.setTriggerState).toHaveBeenLastCalledWith("w", {
      uidValidity: "1",
      uid: 9,
    });
  });
  it("resets email baseline after UIDVALIDITY changes", async () => {
    setup("emailTrigger", { uidValidity: "old", uid: 100 });
    await pollTriggers();
    expect(imap.fetch).not.toHaveBeenCalled();
  });
  it("establishes an X baseline without historical posts", async () => {
    setup("xTrigger");
    vi.mocked(guardedFetch).mockResolvedValue(
      xResponse({
        data: [{ id: "100", text: "old" }],
        meta: { newest_id: "100", next_token: "older" },
      }),
    );
    await pollTriggers();
    expect(workflowStore.enqueue).not.toHaveBeenCalled();
    expect(workflowStore.setTriggerState).toHaveBeenCalledWith("w", {
      initialized: true,
      sinceId: "100",
    });
  });
  it("uses since_id and deduplication keys for new mentions", async () => {
    setup("xTrigger", { initialized: true, sinceId: "100" });
    vi.mocked(guardedFetch).mockResolvedValue(
      xResponse({
        data: [{ id: "101", text: "new" }],
        meta: { newest_id: "101" },
      }),
    );
    await pollTriggers();
    expect(guardedFetch).toHaveBeenCalledWith(
      expect.stringContaining("since_id=100"),
      expect.anything(),
    );
    expect(workflowStore.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      { id: "101", text: "new" },
      "x",
      expect.objectContaining({ eventKey: "x:101" }),
    );
  });
  it("retains pending newest ID while draining pagination", async () => {
    setup("xTrigger", { initialized: true, sinceId: "100" });
    vi.mocked(guardedFetch).mockResolvedValue(
      xResponse({
        data: [{ id: "200", text: "new" }],
        meta: { newest_id: "200", next_token: "next" },
      }),
    );
    await pollTriggers();
    expect(workflowStore.setTriggerState).toHaveBeenCalledWith("w", {
      initialized: true,
      sinceId: "100",
      paginationToken: "next",
      pendingNewestId: "200",
    });
    setup("xTrigger", {
      initialized: true,
      sinceId: "100",
      paginationToken: "next",
      pendingNewestId: "200",
    });
    vi.mocked(guardedFetch).mockResolvedValue(
      xResponse({
        data: [{ id: "101", text: "older" }],
        meta: { newest_id: "101" },
      }),
    );
    await pollTriggers();
    expect(guardedFetch).toHaveBeenLastCalledWith(
      expect.stringContaining("pagination_token=next"),
      expect.anything(),
    );
    expect(workflowStore.setTriggerState).toHaveBeenLastCalledWith("w", {
      initialized: true,
      sinceId: "200",
    });
  });
  it("records polling errors without failing the worker loop", async () => {
    setup("xTrigger", { initialized: true, sinceId: "100" });
    vi.mocked(guardedFetch).mockResolvedValue(
      new Response("private response", { status: 403 }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await pollTriggers();
    expect(workflowStore.setTriggerState).toHaveBeenCalledWith(
      "w",
      expect.objectContaining({
        sinceId: "100",
        lastError: "X polling returned HTTP 403",
      }),
    );
    log.mockRestore();
  });
});
