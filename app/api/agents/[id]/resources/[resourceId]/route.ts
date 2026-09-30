import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    await agentsRepository.deleteResource(resourceId);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete resource" } }, { status: 500 });
  }
}
