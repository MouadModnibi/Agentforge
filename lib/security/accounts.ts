import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { query, execute, runMigrations } from "@/lib/db/client";
import { ownerId } from "./owner";
import { encryptSecret, decryptSecret } from "./secrets";
const derive = promisify(scrypt);
export const sessionCookie = "m4m_session";
export const sessionAge = 7 * 24 * 60 * 60;
export type Account = { id: string; name: string; email: string };
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// The dummy derivation keeps unknown-account login work comparable to known accounts.
const dummy = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
export async function registerAccount(
  name: string,
  email: string,
  password: string,
): Promise<Account> {
  await runMigrations();
  const id = randomUUID();
  const hash = await hashPassword(password);
  await execute(
    "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",
    id,
    email.trim().toLowerCase(),
    name,
    hash,
    Date.now(),
  );
  return { id, email: email.trim().toLowerCase(), name };
}
export async function loginAccount(
  email: string,
  password: string,
): Promise<Account | null> {
  await runMigrations();
  const [r] = await query(
    "SELECT id,email,name,password_hash FROM users WHERE email=? COLLATE NOCASE",
    email.trim(),
  );
  const valid = await verifyPassword(
    password,
    String(r?.password_hash ?? dummy),
  );
  return r?.password_hash && valid
    ? { id: String(r.id), name: String(r.name), email: String(r.email) }
    : null;
}
export function cookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(sessionCookie + "="))
    ?.slice(sessionCookie.length + 1);
}
export async function createAccountSession(userId: string) {
  await runMigrations();
  const token = randomBytes(32).toString("base64url");
  await execute("DELETE FROM user_sessions WHERE expires_at<?", Date.now());
  await execute(
    "INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    digest(token),
    userId,
    Date.now() + sessionAge * 1000,
  );
  return token;
}
export async function sessionAccount(token?: string): Promise<Account | null> {
  if (!token || token.length > 128) return null;
  await runMigrations();
  const [r] = await query(
    "SELECT u.id,u.name,u.email FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.password_hash IS NOT NULL",
    digest(token),
    Date.now(),
  );
  return r
    ? { id: String(r.id), name: String(r.name), email: String(r.email) }
    : null;
}
export async function logoutSession(token?: string) {
  if (token) {
    await runMigrations();
    await execute(
      "DELETE FROM user_sessions WHERE token_hash=?",
      digest(token),
    );
  }
}
export async function accountRateLimit(
  key: string,
  limit: number,
  windowMs = 15 * 60 * 1000,
) {
  await runMigrations();
  const now = Date.now();
  const rows = await query(
    "INSERT INTO auth_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count",
    digest(key),
    now + windowMs,
    now,
    now,
  );
  return Number(rows[0].count) <= limit;
}
export async function accountModelKey() {
  await runMigrations();
  const id = ownerId();
  const [r] = await query("SELECT gemini_key FROM users WHERE id=?", id);
  if (r?.gemini_key) return decryptSecret(String(r.gemini_key));
  if (id === "legacy") return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return undefined;
}
export async function saveModelKey(key: string) {
  await runMigrations();
  await execute(
    "UPDATE users SET gemini_key=? WHERE id=?",
    key ? encryptSecret(key) : null,
    ownerId(),
  );
}
