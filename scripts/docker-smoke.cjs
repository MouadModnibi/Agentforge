/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Node launcher. */
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const envText = fs.readFileSync(".env.docker", "utf8");
const read = (key) => {
  const value = envText
    .match(new RegExp("^" + key + "=(.*)$", "m"))?.[1]
    ?.trim();
  return value?.replace(/^['"]|['"]$/g, "");
};
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/workflow-smoke.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: read("APP_URL") ?? "http://localhost:3000",
      SMOKE_EMAIL: process.env.SMOKE_EMAIL,
      SMOKE_PASSWORD: process.env.SMOKE_PASSWORD,
      SMOKE_TEST_SANDBOX: "1",
    },
  },
);
process.exitCode = result.status ?? 1;
