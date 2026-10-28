import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const email = process.argv[process.argv.indexOf("--email") + 1];
  if (!process.argv.includes("--email") || !email?.includes("@"))
    throw new Error(
      "Usage: npm run accounts:claim-legacy -- --email your-account@example.com",
    );
  const { claimLegacy } = await import("../lib/security/claimLegacy");
  console.log("Assigned legacy records:", await claimLegacy(email));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
