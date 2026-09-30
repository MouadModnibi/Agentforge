import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSandbox } from "@/lib/sandbox/customToolRunner";
import { SandboxError } from "@/lib/sandbox/customToolRunner";

const TestToolSchema = z.object({
  code: z.string().min(1, "Code is required"),
  args: z.record(z.string(), z.unknown()).default({}),
  timeoutMs: z.number().int().min(100).max(5000).default(3000),
});

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TestToolSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    const sandbox = getServerSandbox();

    if (!sandbox.isAvailable()) {
      return errorResponse(
        "SANDBOX_UNAVAILABLE",
        "Server sandbox (isolated-vm) is not installed. Install it with: npm install isolated-vm",
        503
      );
    }

    const start = Date.now();
    const result = await sandbox.run(parsed.data.code, parsed.data.args, {
      timeoutMs: parsed.data.timeoutMs,
    });
    const durationMs = Date.now() - start;

    return NextResponse.json({ data: { result, durationMs } });
  } catch (err) {
    if (err instanceof SandboxError) {
      const statusMap: Record<string, number> = {
        TIMEOUT: 408,
        RUNTIME_ERROR: 422,
        NETWORK_BLOCKED: 403,
        UNAVAILABLE: 503,
      };
      return errorResponse(err.code, err.message, statusMap[err.code] ?? 422);
    }
    console.error("Tool test error:", err);
    return errorResponse("INTERNAL_ERROR", "Tool test failed", 500);
  }
}
