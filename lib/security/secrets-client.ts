/**
 * Client-safe secrets helper.
 *
 * IMPORTANT: This module runs in the browser. It does NOT do real encryption —
 * that happens server-side in lib/security/secrets.ts (AES-256-GCM).
 *
 * When a user marks a header value as "secret" in the UI we prefix it with
 * "raw:" so the server knows to encrypt it before writing to the database.
 * The repository layer strips the prefix and calls encryptSecret() on PATCH.
 *
 * Encrypted values stored in the DB start with "enc:" — the toolRegistry
 * strips that prefix and calls decryptSecret() at runtime.
 */

export function markSecretForEncryption(plaintext: string): string {
  if (plaintext.startsWith("raw:") || plaintext.startsWith("enc:")) return plaintext;
  return `raw:${plaintext}`;
}

/** Returns true when the value has NOT yet been encrypted by the server. */
export function isRawSecret(value: string): boolean {
  return value.startsWith("raw:");
}

export function maskDisplayValue(value: string): string {
  const plain = value.startsWith("raw:") ? value.slice(4) : value;
  if (plain.length <= 4) return "••••";
  return plain.slice(0, 4) + "••••";
}
