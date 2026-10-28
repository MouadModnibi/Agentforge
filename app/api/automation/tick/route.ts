import { after, NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/adminAuth";
import { runServerless, serverlessEnabled } from "@/lib/workflows/serverless";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (
    secret.length < 32 ||
    !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serverlessEnabled())
    return NextResponse.json(
      { error: "Serverless runtime is disabled" },
      { status: 409 },
    );
  after(async () => {
    try {
      await runServerless();
    } catch {
      console.error(JSON.stringify({ event: "serverless.tick.failed" }));
    }
  });
  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
