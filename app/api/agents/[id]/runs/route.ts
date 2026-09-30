import { NextRequest, NextResponse } from "next/server";
import { runsRepository } from "@/lib/repositories/runs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const runs = await runsRepository.findByAgent(id, 50);
    return NextResponse.json({ data: runs });
  } catch (err) {
    console.error("GET /api/agents/[id]/runs error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch runs", 500);
  }
}
