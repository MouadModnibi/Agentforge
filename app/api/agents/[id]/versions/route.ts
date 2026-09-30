import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const versions = await agentsRepository.getVersions(id);
    return NextResponse.json({ data: versions });
  } catch (err) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch versions" } }, { status: 500 });
  }
}
