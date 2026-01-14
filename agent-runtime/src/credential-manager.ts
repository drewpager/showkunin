import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

interface TaskCredential {
  key: string;
  value: string;
}

interface DecryptedCredential {
  key: string;
  value: string;
}

/**
 * Decrypt credentials stored in the database
 */
export function decryptCredentials(
  credentials: TaskCredential[]
): DecryptedCredential[] {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }

  return credentials.map((cred) => ({
    key: cred.key,
    value: decrypt(cred.value, encryptionKey),
  }));
}

/**
 * Inject decrypted credentials into the process environment
 */
export function injectCredentialsToEnv(
  credentials: DecryptedCredential[]
): void {
  for (const cred of credentials) {
    process.env[cred.key] = cred.value;
    console.log(`[Credentials] Injected ${cred.key} into environment`);
  }
}

/**
 * Decrypt text encrypted with AES-256-GCM
 */
function decrypt(encryptedText: string, key: string): string {
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
