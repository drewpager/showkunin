import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "greadings@showkunin.iam.gserviceaccount.com";

// Patterns for Google product URLs
const GOOGLE_PRODUCT_PATTERNS = [
  /docs\.google\.com\/document/i,
  /docs\.google\.com\/spreadsheets/i,
  /docs\.google\.com\/presentation/i,
  /drive\.google\.com/i,
  /sheets\.google\.com/i,
  /slides\.google\.com/i,
];

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
 * Extract the Google Service Account key JSON from decrypted credentials.
 * Returns the raw JSON string if found, or undefined if not present.
 */
export function extractServiceAccountKey(
  credentials: DecryptedCredential[]
): string | undefined {
  const serviceAccountCred = credentials.find(
    (c) => c.key === "GOOGLE_SERVICE_ACCOUNT_KEY"
  );
  if (!serviceAccountCred) return undefined;

  // Validate it looks like a service account JSON key
  try {
    const parsed = JSON.parse(serviceAccountCred.value);
    if (parsed.type === "service_account" && parsed.client_email && parsed.private_key) {
      return serviceAccountCred.value;
    }
    // If it doesn't have expected fields, return it anyway (user may have a non-standard format)
    console.warn("[Credentials] Service account key missing expected fields (type, client_email, private_key)");
    return serviceAccountCred.value;
  } catch {
    // Might be base64 encoded
    try {
      const decoded = Buffer.from(serviceAccountCred.value, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (parsed.type === "service_account") {
        return decoded;
      }
    } catch {
      // Not valid JSON or base64 - return raw value
    }
    console.warn("[Credentials] GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON - passing through as-is");
    return serviceAccountCred.value;
  }
}

/**
 * Check if a URL is a Google product URL that requires sharing permissions
 */
export function isGoogleProductUrl(url: string): boolean {
  return GOOGLE_PRODUCT_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Generate a notification message for the user to share a Google resource
 * with the service account. Returns the message if the URL is a Google product,
 * or undefined if sharing is not needed.
 */
export function getGoogleSharingNotification(url: string): string | undefined {
  if (!isGoogleProductUrl(url)) {
    return undefined;
  }

  return `📋 To allow access to this Google resource, please share it with the service account email:\n\n   ${GOOGLE_SERVICE_ACCOUNT_EMAIL}\n\nGrant "Editor" access if you need the agent to make changes, or "Viewer" for read-only access.`;
}

/**
 * Get the Google service account email address
 */
export function getGoogleServiceAccountEmail(): string {
  return GOOGLE_SERVICE_ACCOUNT_EMAIL;
}

/**
 * Extract Google OAuth refresh token from decrypted credentials.
 * This is used for Apps Script execution via clasp.
 * Returns the refresh token if found, or undefined if not present.
 */
export function extractOAuthRefreshToken(
  credentials: DecryptedCredential[]
): string | undefined {
  const oauthCred = credentials.find(
    (c) => c.key === "GOOGLE_OAUTH_REFRESH_TOKEN"
  );
  return oauthCred?.value;
}

/**
 * Build clasp credentials JSON from OAuth refresh token.
 * This creates the .clasprc.json content needed for clasp CLI.
 */
export function buildClaspCredentials(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string
): string {
  // Use default Google OAuth client if not provided
  const defaultClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const defaultClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";

  const clasprc = {
    token: {
      access_token: "", // Will be refreshed automatically
      refresh_token: refreshToken,
      scope: "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive.file",
      token_type: "Bearer",
    },
    oauth2ClientSettings: {
      clientId: clientId ?? defaultClientId,
      clientSecret: clientSecret ?? defaultClientSecret,
      redirectUri: "http://localhost",
    },
  };

  return JSON.stringify(clasprc, null, 2);
}

/**
 * Check if credentials contain all required keys for a specific operation
 */
export function hasRequiredCredentials(
  credentials: DecryptedCredential[],
  requiredKeys: string[]
): { valid: boolean; missing: string[] } {
  const credentialKeys = new Set(credentials.map(c => c.key));
  const missing = requiredKeys.filter(key => !credentialKeys.has(key));

  return {
    valid: missing.length === 0,
    missing,
  };
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
