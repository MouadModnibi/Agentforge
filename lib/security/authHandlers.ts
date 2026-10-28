import { NextResponse } from "next/server";
import { z } from "zod";
import {
  accountRateLimit,
  loginAccount,
  registerAccount,
  createAccountSession,
  cookieToken,
  sessionAccount,
  logoutSession,
  sessionCookie,
  sessionAge,
} from "@/lib/security/accounts";
import { sameOrigin } from "@/lib/security/adminAuth";
import { body } from "@/lib/workflows/api";
const input = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});
const error = (message: string, status: number) =>
  NextResponse.json(
    { error: { message } },
    { status, headers: { "cache-control": "no-store" } },
  );
export async function GET(request: Request) {
  const user = await sessionAccount(cookieToken(request));
  return NextResponse.json(
    { data: { user } },
    { headers: { "cache-control": "no-store" } },
  );
}
export async function authenticate(request: Request, register = false) {
  if (!sameOrigin(request))
    return error("Cross-origin mutations are blocked", 403);
  try {
    const data = input.parse(await body(request));
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const allowed = await accountRateLimit(
      `${register ? "register" : "login"}:ip:${ip}`,
      register ? 10 : 100,
    );
    const emailAllowed = await accountRateLimit(
      `login:email:${data.email}`,
      15,
    );
    if (!allowed || !emailAllowed)
      return error("Too many attempts. Try again in 15 minutes.", 429);
    if (register && process.env.ALLOW_REGISTRATION === "false")
      return error(
        "Registration is closed. Contact the workspace operator.",
        403,
      );
    if (register && (!data.name || data.password.length < 10))
      return error(
        "Enter your name and a password of at least 10 characters.",
        400,
      );
    const user = register
      ? await registerAccount(data.name!, data.email, data.password)
      : await loginAccount(data.email, data.password);
    if (!user) return error("Email or password is incorrect.", 401);
    await logoutSession(cookieToken(request));
    const token = await createAccountSession(user.id);
    const response = NextResponse.json(
      { data: { user } },
      {
        status: register ? 201 : 200,
        headers: { "cache-control": "no-store" },
      },
    );
    response.cookies.set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionAge,
    });
    return response;
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return error("Enter a valid email and password.", 400);
    const code = (e as { code?: string }).code;
    if (code?.includes("CONSTRAINT"))
      return error(
        "Unable to create an account with those details. Try signing in.",
        409,
      );
    console.error("Authentication request failed");
    return error("Unable to complete authentication. Please try again.", 500);
  }
}
