import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Encrypts text using AES-256-GCM
 * @param text - The plaintext to encrypt
 * @param key - 32-byte hex string (64 hex characters)
 * @returns Encrypted string in format: iv:authTag:encryptedData
 */
export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(key, "hex");
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts text encrypted with AES-256-GCM
 * @param encryptedText - Encrypted string in format: iv:authTag:encryptedData
 * @param key - 32-byte hex string (64 hex characters)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const keyBuffer = Buffer.from(key, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
