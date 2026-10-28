import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { query, runMigrations } = await import("../lib/db/client");
  const { withOwner } = await import("../lib/security/owner");
  const { workflowStore } = await import("../lib/workflows/store");
  await runMigrations();
  const [u] = await query(
    "SELECT id FROM users WHERE email=? COLLATE NOCASE",
    process.argv[2],
  );
  if (!u) throw new Error("Account not found");
  await withOwner(String(u.id), async () => {
    const credentials = await workflowStore.credentials();
    const workflows = (await workflowStore.list()).filter((w) =>
      w.name.startsWith("Telegram ·"),
    );
    const report = [];
    for (const w of workflows) {
      const runs = await workflowStore.runs(w.id, 3);
      report.push({
        name: w.name,
        id: w.id,
        active: !!w.activeRevision,
        nodes: w.graph.nodes
          .filter((n) => n.kind.startsWith("telegram"))
          .map((n) => ({
            label: n.label,
            credential:
              credentials.find((c) => c.id === n.config.credentialId)?.name ??
              null,
          })),
        runs: runs.map((r) => ({
          id: r.id,
          status: r.status,
          error: r.error,
          chatIdProvided:
            typeof r.input === "object" &&
            r.input !== null &&
            "chatId" in r.input,
          steps: r.steps.map((s) => ({
            label: s.label,
            status: s.status,
            error: s.error,
          })),
        })),
      });
    }
    const running = await query(
      "SELECT w.name,r.status,r.created_at,r.started_at FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE w.owner_id=? AND r.status IN ('running','queued')",
      String(u.id),
    );
    const locks = await query("SELECT name,expires_at FROM worker_locks");
    console.log(
      JSON.stringify(
        {
          workerOnline: await workflowStore.workerOnline(),
          pending: running.map((r) => ({
            workflow: r.name,
            status: r.status,
            ageSeconds: Math.round((Date.now() - Number(r.created_at)) / 1000),
          })),
          pollingLocks: locks.map((l) => ({
            name: l.name,
            secondsToExpiry: Math.round(
              (Number(l.expires_at) - Date.now()) / 1000,
            ),
          })),
          telegramCredentials: credentials
            .filter((c) => c.kind === "telegram")
            .map((c) => c.name),
          workflows: report,
        },
        null,
        2,
      ),
    );
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
