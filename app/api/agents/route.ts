import { withUser } from "@/lib/security/routeAuth";
import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";
import { CreateAgentSchema } from "@/lib/schemas/agent";
import { publicAgent } from "@/lib/security/agentResponse";
function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
export const GET = withUser(async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") as "draft" | "active" | undefined;
    const agents = await agentsRepository.findAll({ search, status });
    return NextResponse.json({ data: agents.map(publicAgent) });
  } catch (err) {
    console.error("GET /api/agents error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch agents", 500);
  }
});
export const POST = withUser(async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.flatten(),
      );
    }
    // Check name uniqueness
    const existing = await agentsRepository.findAll({
      search: parsed.data.name,
    });
    const duplicate = existing.find(
      (a) => a.name.toLowerCase() === parsed.data.name.toLowerCase(),
    );
    if (duplicate) {
      return errorResponse(
        "DUPLICATE_NAME",
        "An agent with this name already exists",
        409,
      );
    }
    const agent = await agentsRepository.create(parsed.data);
    return NextResponse.json({ data: publicAgent(agent) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to create agent", 500);
  }
});
