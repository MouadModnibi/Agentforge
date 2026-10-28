import { timingSafeEqual } from "node:crypto";
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function sameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(process.env.APP_URL || request.url).origin;
  } catch {
    return false;
  }
}
