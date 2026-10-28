import { beforeAll, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.APP_SECRET = "test-secret-only-123456789012345678901234567890";
});
import {
  registerAccount,
  loginAccount,
  createAccountSession,
  sessionAccount,
  logoutSession,
  saveModelKey,
  accountModelKey,
  accountRateLimit,
} from "@/lib/security/accounts";
import { execute, query, runMigrations } from "@/lib/db/client";
import { withOwner } from "@/lib/security/owner";
import { workflowStore as store } from "@/lib/workflows/store";
import { agentsRepository as agents } from "@/lib/repositories/agents";
import { templates } from "@/lib/workflows/templates";
import { claimLegacy } from "@/lib/security/claimLegacy";
import { GET, POST } from "@/app/api/workflows/[[...path]]/route";
import { authenticate } from "@/lib/security/authHandlers";
let alice: string, bob: string, token: string;
const password = "A strong test password";
beforeAll(async () => {
  await runMigrations();
  alice = (await registerAccount("Alice", "Alice@example.com", password)).id;
  bob = (await registerAccount("Bob", "bob@example.com", password)).id;
  token = await createAccountSession(alice);
});
describe("durable account authentication", () => {
  it('registers and logs in through the actual handler with private session cookies', async () => {
    const request=(data:unknown)=>new Request('http://localhost/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    const details={name:'Route test',email:'route@example.com',password};
    const registered=await authenticate(request(details),true);
    expect(registered.status).toBe(201);
    expect(registered.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(registered.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
    expect(registered.headers.get('cache-control')).toBe('no-store');
    const data=await registered.json();
    expect(data.data.user).not.toHaveProperty('password_hash');
    expect((await authenticate(request(details))).status).toBe(200);
    expect((await authenticate(request({...details,password:'wrong'}))).status).toBe(401);
    expect((await authenticate(request({...details,email:'short@example.com',password:'short'}),true)).status).toBe(400);
    process.env.ALLOW_REGISTRATION='false';
    try { expect((await authenticate(request({...details,email:'closed@example.com'}),true)).status).toBe(403); }
    finally { delete process.env.ALLOW_REGISTRATION; }
  });
  it("hashes passwords, normalizes email and rejects invalid login", async () => {
    const [row] = await query("SELECT * FROM users WHERE id=?", alice);
    expect(row.email).toBe("alice@example.com");
    expect(row.password_hash).not.toContain(password);
    expect((await loginAccount("ALICE@example.com", password))?.id).toBe(alice);
    expect(await loginAccount("alice@example.com", "wrong")).toBeNull();
    expect(await loginAccount("unknown@example.com", password)).toBeNull();
    await expect(
      registerAccount("Duplicate", "ALICE@example.com", password),
    ).rejects.toThrow();
  });
  it("stores only session hashes and revokes/ expires sessions", async () => {
    const temporary = await createAccountSession(bob);
    expect((await sessionAccount(temporary))?.id).toBe(bob);
    expect(await sessionAccount(temporary + "tampered")).toBeNull();
    expect(
      (await query("SELECT token_hash FROM user_sessions")).some(
        (r) => r.token_hash === temporary,
      ),
    ).toBe(false);
    await logoutSession(temporary);
    expect(await sessionAccount(temporary)).toBeNull();
    const expired = await createAccountSession(bob);
    await execute("UPDATE user_sessions SET expires_at=0 WHERE user_id=?", bob);
    expect(await sessionAccount(expired)).toBeNull();
  });
  it("rejects unauthenticated API and cross-origin mutations without proxy", async () => {
    const context = { params: Promise.resolve({ path: [] }) };
    expect(
      (await GET(new Request("http://localhost/api/workflows"), context))
        .status,
    ).toBe(401);
    expect(
      (
        await POST(
          new Request("http://localhost/api/workflows", {
            method: "POST",
            headers: {
              cookie: `m4m_session=${token}`,
              origin: "https://evil.example",
            },
            body: "{}",
          }),
          context,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await authenticate(
          new Request("http://localhost/api/auth", {
            method: "POST",
            headers: { origin: "https://evil.example" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("persists rate limits and keeps Gemini keys private", async () => {
    expect(await accountRateLimit("test-limit", 1)).toBe(true);
    expect(await accountRateLimit("test-limit", 1)).toBe(false);
    await withOwner(alice, () => saveModelKey("alice-private-key"));
    expect(
      (await query("SELECT gemini_key FROM users WHERE id=?", alice))[0]
        .gemini_key,
    ).not.toContain("alice-private-key");
    expect(await withOwner(alice, accountModelKey)).toBe("alice-private-key");
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "operator-key";
    expect(await withOwner(bob, accountModelKey)).toBeUndefined();
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });
});
describe("tenant boundaries", () => {
  it("blocks guessed workflow, credential, version and execution IDs", async () => {
    const w = await withOwner(alice, () =>
      store.save({
        name: "Alice private",
        description: "",
        graph: templates[1].graph,
      }),
    );
    const run = await withOwner(alice, () =>
      store.enqueue(w, { private: "email body" }),
    );
    const c = await withOwner(alice, () =>
      store.saveCredential({
        name: "Mail",
        kind: "http",
        values: { token: "private-token" },
      }),
    );
    await withOwner(bob, async () => {
      expect(await store.list()).toHaveLength(0);
      expect(await store.get(w.id)).toBeNull();
      expect(await store.getRun(run.id)).toBeNull();
      for (const action of [
        () => store.save({ ...w, name: "stolen" }, w.id),
        () => store.delete(w.id),
        () => store.versions(w.id),
        () => store.runs(w.id),
        () => store.cancel(run.id),
        () => store.rotateWebhookKey(w.id),
        () => store.activate(w.id, true),
        () => store.credential(c.id),
        () => store.deleteCredential(c.id),
        () => store.enqueue(w, {}),
      ])
        await expect(action()).rejects.toThrow();
      expect(await store.credentials()).toHaveLength(0);
    });
    const [a, b] = await Promise.all([
      store.claim("worker-a"),
      store.claim("worker-b"),
    ]);
    const claims = [a, b].filter(Boolean);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.ownerId).toBe(alice);
    await expect(store.list()).rejects.toThrow();
    const response = await GET(
      new Request("http://localhost/api/workflows", {
        headers: { cookie: `m4m_session=${token}` },
      }),
      { params: Promise.resolve({ path: [] }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.workflows[0].id).toBe(w.id);
  });
  it("isolates agents, secrets, resources and versions", async () => {
    const agent = await withOwner(alice, () =>
      agents.create({
        name: "Private agent",
        description: "",
        status: "draft",
      }),
    );
    const resource = await withOwner(alice, () =>
      agents.addResource(agent.id, {
        name: "Private",
        mimeType: "text/plain",
        size: 6,
        content: "secret",
      }),
    );
    await withOwner(bob, async () => {
      expect(await agents.findById(agent.id)).toBeNull();
      expect(await agents.findAll()).toHaveLength(0);
      expect(await agents.update(agent.id, { name: "stolen" })).toBeNull();
      expect(await agents.duplicate(agent.id)).toBeNull();
      expect(await agents.getResources(agent.id)).toHaveLength(0);
      expect(await agents.getVersions(agent.id)).toHaveLength(0);
      await agents.deleteResource(resource);
      await agents.delete(agent.id);
      await agents.setApiKey(agent.id, "stolen");
    });
    await withOwner(alice, async () => {
      expect(await agents.getResources(agent.id)).toHaveLength(1);
      expect((await agents.findById(agent.id))?.apiKeyHash).toBeNull();
    });
  });
  it("never gives legacy data to a registrant and assigns it only explicitly", async () => {
    const w = await withOwner("legacy", () =>
      store.save({
        name: "Original data",
        description: "",
        graph: templates[1].graph,
      }),
    );
    const user = await registerAccount("New", "new@example.com", password);
    expect(await withOwner(user.id, () => store.get(w.id))).toBeNull();
    await expect(claimLegacy("missing@example.com")).rejects.toThrow();
    const counts = await claimLegacy(user.email);
    expect(counts.workflows).toBe(1);
    expect((await withOwner(user.id, () => store.get(w.id)))?.name).toBe(
      "Original data",
    );
    expect(await claimLegacy(user.email)).toEqual({
      agents: 0,
      workflows: 0,
      workflow_credentials: 0,
    });
  });
});
