import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await agentsRepository.duplicate(id);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);
    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents/[id]/duplicate error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to duplicate agent", 500);
  }
}
