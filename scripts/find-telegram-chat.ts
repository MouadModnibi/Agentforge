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
  if (!u) throw new Error("Account not found");
  await withOwner(String(u.id), async () => {
    const list = (await workflowStore.credentials()).filter(
      (c) => c.kind === "telegram",
    );
    const credential = list.find((c) => c.name === "My Telegram bot");
    if (!credential) throw new Error("Telegram credential not found");
    const secret = await workflowStore.credential(credential.id, "telegram");
    const response = await fetch(
      `https://api.telegram.org/bot${secret.botToken}/getUpdates?timeout=0&limit=100`,
      { signal: AbortSignal.timeout(15000) },
    );
    const data = await response.json();
    if (!data.ok) {
      console.log(JSON.stringify({ ok: false, description: data.description }));
      return;
    }
    const chats = new Map<string, { id: string; firstName: string }>();
    for (const item of data.result ?? []) {
      const chat = item.message?.chat;
      if (chat?.type === "private")
        chats.set(String(chat.id), {
          id: String(chat.id),
          firstName: String(chat.first_name ?? ""),
        });
    }
    console.log(
      JSON.stringify({ ok: true, privateChats: [...chats.values()] }, null, 2),
    );
  });
}
main().catch(() => {
  console.error("Unable to retrieve chat IDs from Telegram");
  process.exitCode = 1;
});
