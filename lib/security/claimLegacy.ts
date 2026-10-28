import { runMigrations, sqlite } from "@/lib/db/client";
import { encryptSecret } from "./secrets";

/** Operator-only migration. Never called from registration or an HTTP route. */
export async function claimLegacy(email: string) {
  await runMigrations();
  const tx = await sqlite.transaction("write");
  try {
    const { rows } = await tx.execute({
      sql: "SELECT id,gemini_key FROM users WHERE email=? COLLATE NOCASE AND password_hash IS NOT NULL",
      args: [email.trim()],
    });
    if (!rows[0])
      throw new Error(
        "Register this account before assigning the legacy workspace.",
      );
    const id = String(rows[0].id);
    const counts: Record<string, number> = {};
    for (const table of ["agents", "workflows", "workflow_credentials"]) {
      counts[table] = (
        await tx.execute({
          sql: `UPDATE ${table} SET owner_id=? WHERE owner_id='legacy'`,
          args: [id],
        })
      ).rowsAffected;
    }
    if (!rows[0].gemini_key && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      await tx.execute({
        sql: "UPDATE users SET gemini_key=? WHERE id=?",
        args: [encryptSecret(process.env.GOOGLE_GENERATIVE_AI_API_KEY), id],
      });
    }
    await tx.commit();
    return counts;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
