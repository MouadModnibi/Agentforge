import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.APP_SECRET ||
      process.env.APP_SECRET.length < 32 ||
      process.env.APP_SECRET.startsWith("change-me"))
  )
    throw new Error(
      "Set a strong APP_SECRET of at least 32 characters in production",
    );
  const secret =
    process.env.APP_SECRET || "default-dev-secret-change-in-prod-00";
  // Derive a 32-byte key from the secret
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv,
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****" + value.slice(-2);
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return "af_" + crypto.randomBytes(24).toString("hex");
}
