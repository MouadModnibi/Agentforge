import { createClient, type Client, type InArgs } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { initialSchema } from "./migrations";
import path from "node:path";
import fs from "node:fs";

let connection: Client | undefined;
function connect(): Client {
  if (connection) return connection;
  const remote = process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL && (!remote || !process.env.TURSO_AUTH_TOKEN))
    throw new Error(
      "Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel",
    );
  const local =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "agentforge.db");
  if (!remote && local !== ":memory:")
    fs.mkdirSync(path.dirname(local), { recursive: true });
  connection = createClient({
    url:
      remote ||
      (local === ":memory:"
        ? ":memory:"
        : `file:${local.replaceAll("\\", "/")}`),
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: "number",
  });
  return connection;
}
// Lazy connections let Next build pages without opening a database or requiring secrets.
export const sqlite = new Proxy({} as Client, {
  get(_target, prop) {
    const client = connect();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
export const db = drizzle(sqlite, { schema });
export type Row = Record<string, unknown>;
export async function query(sql: string, ...args: unknown[]): Promise<Row[]> {
  return (await sqlite.execute({ sql, args: args as InArgs }))
    .rows as unknown as Row[];
}
export async function execute(sql: string, ...args: unknown[]) {
  return sqlite.execute({ sql, args: args as InArgs });
}
let migration: Promise<void> | undefined;
export function runMigrations(): Promise<void> {
  migration ??= migrate().catch((error) => {
    migration = undefined;
    throw error;
  });
  return migration;
}
async function migrate() {
  await sqlite.execute("PRAGMA foreign_keys=ON");
  const tx = await sqlite.transaction("write");
  try {
    await tx.execute(
      "CREATE TABLE IF NOT EXISTS app_migrations(version INTEGER PRIMARY KEY)",
    );
    const done = await tx.execute(
      "SELECT version FROM app_migrations WHERE version=2",
    );
    if (!done.rows.length) {
      for (const sql of initialSchema
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.execute(sql);
      await tx.execute(
        "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT,gemini_key TEXT,created_at INTEGER NOT NULL)",
      );
      await tx.execute({
        sql: "INSERT OR IGNORE INTO users(id,email,name,created_at) VALUES(?,?,?,?)",
        args: [
          "legacy",
          "legacy@local.invalid",
          "Unclaimed local workspace",
          Date.now(),
        ],
      });
      for (const table of ["agents", "workflows", "workflow_credentials"]) {
        const columns = await tx.execute(`PRAGMA table_info(${table})`);
        if (!columns.rows.some((c) => c.name === "owner_id"))
          await tx.execute(
            `ALTER TABLE ${table} ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy'`,
          );
        await tx.execute(
          `CREATE INDEX IF NOT EXISTS ${table}_owner ON ${table}(owner_id)`,
        );
      }
      await tx.execute(
        "CREATE TABLE IF NOT EXISTS user_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)",
      );
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS sessions_expiry ON user_sessions(expires_at)",
      );
      await tx.execute(
        "CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL)",
      );
      await tx.execute(
        "CREATE TABLE IF NOT EXISTS worker_locks(name TEXT PRIMARY KEY,holder TEXT NOT NULL,expires_at INTEGER NOT NULL)",
      );
      await tx.execute("INSERT INTO app_migrations VALUES(2)");
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
