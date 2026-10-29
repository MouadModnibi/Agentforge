// Client-safe validation shared by the credential form, API and executor.
export function discordWebhookUrl(value: string): string {
  const message =
    "Use a Discord webhook URL: https://discord.com/api/webhooks/ID/TOKEN";
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(message);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "discord.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/api\/(?:v10\/)?webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)
  )
    throw new Error(message);
  return url.toString();
}
