import { NextResponse } from "next/server";
import { workflowStore } from "@/lib/workflows/store";
import { runtimeStatus } from "@/lib/workflows/runtime-status";
export async function GET() {
  try {
    return NextResponse.json(
      {
        status: "ok",
        workerOnline: await workflowStore.workerOnline(),
        ...(await runtimeStatus()),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
