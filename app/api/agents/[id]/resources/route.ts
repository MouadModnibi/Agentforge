import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ALLOWED_TYPES = ["application/json", "text/plain", "text/markdown", "text/csv"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const resources = await agentsRepository.getResources(id);
    return NextResponse.json({ data: resources });
  } catch (err) {
    return errorResponse("INTERNAL_ERROR", "Failed to fetch resources", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return errorResponse("MISSING_FILE", "No file provided", 400);
    if (file.size > MAX_FILE_SIZE) return errorResponse("FILE_TOO_LARGE", "File exceeds 1MB limit", 400);

    const mimeType = file.type || "text/plain";

    // Validate MIME type (browser may send wrong type for .md files)
    const filename = file.name.toLowerCase();
    const allowedExtensions = [".json", ".txt", ".md", ".csv"];
    const hasAllowedExt = allowedExtensions.some((ext) => filename.endsWith(ext));
    if (!hasAllowedExt && !ALLOWED_TYPES.includes(mimeType)) {
      return errorResponse(
        "INVALID_FILE_TYPE",
        `File type not allowed. Accepted: .json, .txt, .md, .csv`,
        400
      );
    }

    const content = await file.text();

    // Sanitize - ensure it's valid text
    if (typeof content !== "string") {
      return errorResponse("INVALID_FILE", "File content must be text", 400);
    }

    // Validate JSON files are well-formed
    if (filename.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch {
        return errorResponse("INVALID_JSON", "JSON file contains invalid JSON", 400);
      }
    }

    // Enforce size limit on content length as well (text could expand)
    if (content.length > MAX_FILE_SIZE * 2) {
      return errorResponse("FILE_TOO_LARGE", "File content exceeds size limit", 400);
    }

    const resourceId = await agentsRepository.addResource(id, {
      name: file.name,
      mimeType: mimeType,
      size: file.size,
      content,
    });

    return NextResponse.json({ data: { id: resourceId } }, { status: 201 });
  } catch (err) {
    return errorResponse("INTERNAL_ERROR", "Failed to upload resource", 500);
  }
}
