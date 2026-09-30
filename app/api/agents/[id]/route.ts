import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";
import { UpdateAgentSchema } from "@/lib/schemas/agent";

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await agentsRepository.findById(id);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);
    return NextResponse.json({ data: agent });
  } catch (err) {
    console.error("GET /api/agents/[id] error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch agent", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateAgentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.flatten());
    }

    const agent = await agentsRepository.update(id, parsed.data);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);

    return NextResponse.json({ data: agent });
  } catch (err) {
    console.error("PATCH /api/agents/[id] error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to update agent", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await agentsRepository.findById(id);
    if (!existing) return errorResponse("NOT_FOUND", "Agent not found", 404);

    await agentsRepository.delete(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("DELETE /api/agents/[id] error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to delete agent", 500);
  }
}
