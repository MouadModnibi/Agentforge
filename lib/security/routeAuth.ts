import { NextResponse } from "next/server";
import { cookieToken, sessionAccount } from "./accounts";
import { sameOrigin } from "./adminAuth";
import { withOwner } from "./owner";
import { runMigrations, query } from "@/lib/db/client";
import { hashApiKey } from "./secrets";

const unauthorized = () =>
  NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Sign in to continue" } },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
export function withUser<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    const req = args[0] as Request;
    if (!req) return unauthorized();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req))
      return NextResponse.json(
        { error: { message: "Cross-origin mutations are blocked" } },
        { status: 403 },
      );
    const user = await sessionAccount(cookieToken(req));
    if (!user) return unauthorized();
    const response = await withOwner(user.id, () => handler(...args));
    response.headers.set("cache-control", "no-store");
    return response;
  };
}
// These wrappers only establish owner context. The hook handler still verifies its signature.
export function withHookOwner<
  Args extends [Request, { params: Promise<{ id: string }> }],
>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args) => {
    await runMigrations();
    const { id } = await args[1].params;
    const [r] = await query(
      "SELECT w.owner_id FROM workflows w JOIN users u ON u.id=w.owner_id WHERE w.id=? AND u.password_hash IS NOT NULL",
      id,
    );
    if (!r)
      return NextResponse.json(
        { error: { message: "Webhook unavailable" } },
        { status: 404 },
      );
    return withOwner(String(r.owner_id), () => handler(...args));
  };
}
export function withAgentKey<
  Args extends [Request, { params: Promise<{ id: string }> }],
>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args) => {
    await runMigrations();
    const req = args[0],
      { id } = await args[1].params;
    const key = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!key) return unauthorized();
    const [r] = await query(
      "SELECT a.owner_id FROM agents a JOIN users u ON u.id=a.owner_id WHERE a.id=? AND a.api_key_hash=? AND u.password_hash IS NOT NULL",
      id,
      hashApiKey(key),
    );
    if (!r) return unauthorized();
    return withOwner(String(r.owner_id), () => handler(...args));
  };
}
