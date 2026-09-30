import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";
import { generateApiKey, hashApiKey } from "@/lib/security/secrets";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await agentsRepository.findById(id);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);

    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);
    await agentsRepository.setApiKey(id, hash);

    // Return key ONCE - never stored in plaintext
    return NextResponse.json({ data: { apiKey } });
  } catch (err) {
    console.error("POST /api/agents/[id]/apikey error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to generate API key", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await agentsRepository.revokeApiKey(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return errorResponse("INTERNAL_ERROR", "Failed to revoke API key", 500);
  }
}
