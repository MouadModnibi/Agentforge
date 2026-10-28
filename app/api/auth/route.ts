export { GET } from "@/lib/security/authHandlers";
import { authenticate } from "@/lib/security/authHandlers";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/adminAuth";
import {
  logoutSession,
  cookieToken,
  sessionCookie,
} from "@/lib/security/accounts";
export async function POST(request: Request) {
  return authenticate(request);
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: { message: "Cross-origin mutations are blocked" } },
      { status: 403 },
    );
  await logoutSession(cookieToken(request));
  const r = NextResponse.json({ data: { success: true } });
  r.cookies.set(sessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return r;
}
