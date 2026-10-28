import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.TURSO_DATABASE_URL)
    throw new Error("Export requires the local database environment.");
  const source = path.resolve(
    process.env.DATABASE_PATH || "data/agentforge.db",
  );
  const target = path.resolve(`data/exports/m4m-turso-${Date.now()}.db`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const original = new Database(source, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await original.backup(target);
  } finally {
    original.close();
  }
  const snapshot = new Database(target);
  try {
    // Ephemeral process leases cannot survive a move. Never replay external actions automatically.
    snapshot
      .prepare(
        "UPDATE workflow_runs SET status='interrupted', error='Database moved to cloud. Review completed actions before retrying.', finished_at=?, lease_until=NULL WHERE status='running'",
      )
      .run(Date.now());
    snapshot.exec(
      "DELETE FROM workflow_worker_health; DELETE FROM worker_locks;",
    );
    snapshot.pragma("wal_checkpoint(TRUNCATE)");
    snapshot.pragma("journal_mode=DELETE");
    const integrity = snapshot.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error("Snapshot integrity check failed.");
  } finally {
    snapshot.close();
  }
  console.log(`Cloud snapshot ready: ${target}`);
  console.log(
    "Contains private account and email data. Upload only to your own new Turso database. Preserve your existing APP_SECRET. Stop local writes before the final cutover export.",
  );
}
main().catch(() => {
  console.error("Export failed. Check the local database and configuration.");
  process.exitCode = 1;
});
