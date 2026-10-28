import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { query } = await import("../lib/db/client");
  const { withOwner } = await import("../lib/security/owner");
  const { workflowStore } = await import("../lib/workflows/store");
  const { assertExecutable } = await import("../lib/workflows/service");
  const [u] = await query(
    "SELECT id FROM users WHERE email=? COLLATE NOCASE",
    process.argv[2],
  );
  if (!u) throw new Error("Account not found");
  const base = new URL(process.argv[3]);
  const configured = new URL(process.env.APP_URL || "http://localhost:3000");
  if (
    base.protocol !== "https:" ||
    base.origin !== configured.origin ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("Unexpected public endpoint");
  await withOwner(String(u.id), async () => {
    const id = "891c30c8-8c63-4152-b24a-3c4dd40f485f";
    let w = await workflowStore.get(id);
    if (!w) throw new Error("Workflow missing");
    const c = (await workflowStore.credentials()).find(
      (c) => c.kind === "telegram" && c.name === "My Telegram bot",
    );
    if (!c) throw new Error("Bot credential missing");
    const graph = {
      ...w.graph,
      nodes: w.graph.nodes.map((n) =>
        n.kind.startsWith("telegram")
          ? { ...n, config: { ...n.config, credentialId: c.id } }
          : n,
      ),
    };
    await assertExecutable(graph);
    if (JSON.stringify(graph) !== JSON.stringify(w.graph))
      w = await workflowStore.save(
        {
          name: w.name,
          description: w.description,
          graph,
          revision: w.revision,
        },
        id,
      );
    const secret = await workflowStore.credential(c.id, "telegram");
    const endpoint = `${base.origin}/api/workflow-hooks/${id}`;
    await workflowStore.activate(id, true);
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${secret.botToken}/setWebhook`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: endpoint,
            secret_token: secret.webhookSecret,
            allowed_updates: ["message"],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await r.json();
      if (!data.ok)
        throw new Error(
          String(data.description ?? "Telegram registration failed"),
        );
      console.log(
        JSON.stringify({
          registered: true,
          workflow: id,
          endpoint,
          workerOnline: await workflowStore.workerOnline(),
        }),
      );
    } catch (e) {
      if (!w.activeRevision) await workflowStore.activate(id, false);
      throw e;
    }
  });
}
main().catch(() => {
  console.error(
    "Webhook connection failed; check the app configuration, APP_URL and deployed endpoint.",
  );
  process.exitCode = 1;
});
