import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { query } = await import("../lib/db/client");
  const { withOwner } = await import("../lib/security/owner");
  const { workflowStore } = await import("../lib/workflows/store");
  const [u] = await query(
    "SELECT id FROM users WHERE email=? COLLATE NOCASE",
    process.argv[2],
  );
  if (!u) throw new Error("Account missing");
  await withOwner(String(u.id), async () => {
    const run = await workflowStore.getRun(process.argv[3]);
    if (!run) throw new Error("Run missing");
    const input = run.input as Record<string, unknown>;
    const chatId = String(input.chatId ?? "");
    if (!/^-?\d+$/.test(chatId)) {
      console.log(
        JSON.stringify({
          issue:
            "chatId must be your numeric Telegram chat ID; the current input is missing or is still a placeholder.",
        }),
      );
      return;
    }
    const node = run.graph.nodes.find((n) => n.kind === "telegram")!;
    const credential = await workflowStore.credential(
      String(node.config.credentialId),
      "telegram",
    );
    const r = await fetch(
      `https://api.telegram.org/bot${credential.botToken}/getChat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await r.json();
    console.log(
      JSON.stringify({ ok: data.ok, description: data.description ?? null }),
    );
  });
}
main().catch(() => {
  console.error("Unable to check Telegram destination");
  process.exitCode = 1;
});
