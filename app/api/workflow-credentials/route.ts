import { withUser } from "@/lib/security/routeAuth";
import { CredentialInputSchema } from "@/lib/workflows/schema";
import { workflowStore, StoreError } from "@/lib/workflows/store";
import { ok, failure, body } from "@/lib/workflows/api";
export const GET = withUser(async function GET(request: Request) {
  return ok(await workflowStore.credentials());
});
export const POST = withUser(async function POST(request: Request) {
  try {
    const data = CredentialInputSchema.parse(await body(request));
    data.values = Object.fromEntries(
      Object.entries(data.values).filter(([, v]) => v.trim().length),
    );
    const required = {
      telegram: ["botToken", "webhookSecret"],
      email: ["imapHost", "smtpHost", "user", "password"],
      x: ["accessToken", "userId"],
      http: [],
    }[data.kind];
    for (const key of required)
      if (!data.values[key]?.trim())
        throw new StoreError(`Credential requires ${key}`);
    if (
      data.kind === "telegram" &&
      !/^[A-Za-z0-9_-]{1,256}$/.test(data.values.webhookSecret)
    )
      throw new StoreError(
        "Telegram webhook secret must contain 1–256 letters, numbers, underscores or hyphens",
      );
    if (data.kind === "email") {
      for (const key of ["imapPort", "smtpPort"])
        if (
          data.values[key] &&
          (!/^\d+$/.test(data.values[key]) ||
            Number(data.values[key]) < 1 ||
            Number(data.values[key]) > 65535)
        )
          throw new StoreError("Invalid email port");
      if (
        data.values.smtpPort &&
        !["465", "587"].includes(data.values.smtpPort)
      )
        throw new StoreError("SMTP requires TLS port 465 or STARTTLS port 587");
    }
    return ok(await workflowStore.saveCredential(data), 201);
  } catch (e) {
    return failure(e);
  }
});
export const DELETE = withUser(async function DELETE(request: Request) {
  try {
    const url = new URL(request.url),
      id = url.searchParams.get("id");
    if (!id) throw new StoreError("Credential ID required");
    await workflowStore.deleteCredential(id);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
});
