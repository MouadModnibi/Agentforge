import { NextRequest, NextResponse } from "next/server";
import { cookieToken, sessionAccount } from "@/lib/security/accounts";
import { sameOrigin } from "@/lib/security/adminAuth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // The scheduler route verifies its own high-entropy bearer secret.
  if (path === "/api/automation/tick") return NextResponse.next();
  if (
    path === "/login" ||
    path === "/register" ||
    path.startsWith("/api/auth") ||
    path === "/api/health" ||
    path.startsWith("/api/workflow-hooks/") ||
    /^\/api\/agents\/[^/]+\/run$/.test(path)
  )
    return NextResponse.next();
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !sameOrigin(request)
  )
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cross-origin mutations are blocked",
        },
      },
      { status: 403 },
    );
  const user = await sessionAccount(cookieToken(request));
  if (user) return NextResponse.next();
  if (path.startsWith("/api/"))
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue" } },
      { status: 401 },
    );
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
