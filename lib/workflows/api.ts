import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StoreError } from "./store";
export const ok = (data: unknown, status = 200) =>
  NextResponse.json(
    { data },
    { status, headers: { "cache-control": "no-store" } },
  );
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" "),
        },
      },
      { status: 400 },
    );
  if (error instanceof StoreError)
    return NextResponse.json(
      { error: { code: "WORKFLOW_ERROR", message: error.message } },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must contain valid JSON",
        },
      },
      { status: 400 },
    );
  console.error(
    JSON.stringify({
      event: "workflow.api.error",
      type: error instanceof Error ? error.name : "unknown",
    }),
  );
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request failed. Check server logs.",
      },
    },
    { status: 500 },
  );
}
export async function body(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 1024 * 1024)
    throw new StoreError("Request exceeds 1 MB", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError("JSON body required");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new StoreError("Request exceeds 1 MB", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
