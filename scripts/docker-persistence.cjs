/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS validation launcher. */
const fs = require("node:fs");
const env = fs.readFileSync(".env.docker", "utf8");
const read = (key) =>
  env
    .match(new RegExp("^" + key + "=(.*)$", "m"))?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, "");
const base = read("APP_URL");
const headers = {
  "content-type": "application/json",
  cookie: '',
};
const artifact = "artifacts/docker-persistence.json";
async function request(path, method = "GET", value) {
  const response = await fetch(new URL(path, base), {
    method,
    headers,
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return result.data ?? result;
}
async function main() {
  if (!process.env.SMOKE_EMAIL || !process.env.SMOKE_PASSWORD) throw new Error('Set SMOKE_EMAIL and SMOKE_PASSWORD for a registered test account.');
  const login=await fetch(new URL('/api/auth',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.SMOKE_EMAIL,password:process.env.SMOKE_PASSWORD})});
  if (!login.ok) throw new Error('Test account login failed');
  headers.cookie=login.headers.get('set-cookie')?.split(';')[0] || '';
  if (process.argv[2] === "init") {
    const template = JSON.parse(
      fs.readFileSync("examples/workflows/routing.json", "utf8"),
    );
    const w = await request("/api/workflows", "POST", {
      ...template,
      name: "Docker persistence validation",
    });
    fs.mkdirSync("artifacts", { recursive: true });
    fs.writeFileSync(artifact, JSON.stringify({ workflowId: w.id }));
    const run = await request(`/api/workflows/${w.id}/run`, "POST", {
      input: { text: "Persistent test", priority: "high" },
    });
    fs.writeFileSync(
      artifact,
      JSON.stringify({ workflowId: w.id, runId: run.id }),
    );
    for (let attempt = 0; attempt < 60; attempt++) {
      const current = await request(`/api/workflow-runs/${run.id}`);
      if (current.status === "succeeded") {
        console.log(
          "Created completed workflow for container-restart validation.",
        );
        return;
      }
      if (!["queued", "running"].includes(current.status))
        throw new Error("Persistence setup run failed");
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Worker did not finish");
  }
  const { workflowId, runId } = JSON.parse(fs.readFileSync(artifact, "utf8"));
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const health = await request("/api/health");
      if (health.workerOnline) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const workflow = await request(`/api/workflows/${workflowId}`),
    run = await request(`/api/workflow-runs/${runId}`);
  if (
    workflow.id !== workflowId ||
    run.status !== "succeeded" ||
    run.output.queue !== "urgent"
  )
    throw new Error("Persistent records were not retained");
  await request(`/api/workflows/${workflowId}`, "DELETE");
  fs.unlinkSync(artifact);
  console.log(
    "PASS: workflow graph and completed execution survived container recreation; temporary records removed.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
