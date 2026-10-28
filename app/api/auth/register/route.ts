import { authenticate } from "@/lib/security/authHandlers";
export async function POST(request: Request) {
  return authenticate(request, true);
}
