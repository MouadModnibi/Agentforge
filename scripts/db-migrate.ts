import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { runMigrations } = await import("../lib/db/client");
  await runMigrations();
  console.log("Database migrations complete.");
}
main().catch(() => {
  console.error(
    "Migration failed. Check database configuration and connectivity.",
  );
  process.exitCode = 1;
});
