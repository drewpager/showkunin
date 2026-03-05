/**
 * Browser Session Manager
 * Handles encrypted browser cookie/session persistence for OAuth flows
 * Uses AES-256-GCM encryption (same as credential-manager.ts)
 */

import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Serialized browser cookie format (compatible with Playwright)
 */
export interface SerializedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Browser session data structure
 */
export interface BrowserSessionData {
  cookies: SerializedCookie[];
  localStorage?: Record<string, string>;
  provider: string;
  capturedAt: string;
}

/**
 * Encrypt text using AES-256-GCM
 */
function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(key, "hex");

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
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

/**
 * Store browser session after OAuth flow completion
 * @param prisma - Prisma client instance
 * @param userId - User ID who owns this session
 * @param provider - OAuth provider name (e.g., 'google', 'github')
 * @param sessionData - Browser session data including cookies
 * @param expiresInHours - Session expiry time in hours (default: 24)
 */
export async function storeBrowserSession(
  prisma: PrismaClient,
  userId: string,
  provider: string,
  sessionData: BrowserSessionData,
  expiresInHours = 24
): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }

  // Serialize and encrypt session data
  const serialized = JSON.stringify(sessionData);
  const encryptedData = encrypt(serialized, encryptionKey);

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Upsert to handle existing sessions for same user/provider
  const session = await prisma.browserSession.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    create: {
      userId,
      provider,
      sessionData: encryptedData,
      expiresAt,
    },
    update: {
      sessionData: encryptedData,
      expiresAt,
    },
  });

  console.log(`[SessionManager] Stored ${provider} session for user ${userId}, expires: ${expiresAt.toISOString()}`);
  return session.id;
}

/**
 * Retrieve browser session for cookie injection
 * @param prisma - Prisma client instance
 * @param userId - User ID to retrieve session for
 * @param provider - OAuth provider name
 * @returns Decrypted session data or null if not found/expired
 */
export async function getBrowserSession(
  prisma: PrismaClient,
  userId: string,
  provider: string
): Promise<BrowserSessionData | null> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }

  const session = await prisma.browserSession.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!session) {
    console.log(`[SessionManager] No ${provider} session found for user ${userId}`);
    return null;
  }

  // Check expiry
  if (session.expiresAt < new Date()) {
    console.log(`[SessionManager] ${provider} session expired for user ${userId}`);
    // Delete expired session
    await prisma.browserSession.delete({
      where: { id: session.id },
    });
    return null;
  }

  try {
    const decrypted = decrypt(session.sessionData, encryptionKey);
    const data = JSON.parse(decrypted) as BrowserSessionData;
    console.log(`[SessionManager] Retrieved ${provider} session for user ${userId} with ${data.cookies.length} cookies`);
    return data;
  } catch (error) {
    console.error(`[SessionManager] Failed to decrypt ${provider} session:`, error);
    return null;
  }
}

/**
 * Delete browser session
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param provider - OAuth provider name
 */
export async function deleteBrowserSession(
  prisma: PrismaClient,
  userId: string,
  provider: string
): Promise<void> {
  await prisma.browserSession.deleteMany({
    where: {
      userId,
      provider,
    },
  });
  console.log(`[SessionManager] Deleted ${provider} session for user ${userId}`);
}

/**
 * Check if a valid browser session exists
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param provider - OAuth provider name
 * @returns true if valid session exists
 */
export async function hasBrowserSession(
  prisma: PrismaClient,
  userId: string,
  provider: string
): Promise<boolean> {
  const session = await prisma.browserSession.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    select: {
      expiresAt: true,
    },
  });

  return session !== null && session.expiresAt > new Date();
}

/**
 * Detect which provider is needed based on URLs
 * @param urls - List of URLs from task analysis
 * @returns Provider name or null
 */
export function detectProviderFromUrls(urls: string[]): string | null {
  for (const url of urls) {
    if (/google\.com|googleapis\.com/i.test(url)) {
      return "google";
    }
    if (/github\.com/i.test(url)) {
      return "github";
    }
    if (/microsoft\.com|office\.com|sharepoint\.com/i.test(url)) {
      return "microsoft";
    }
    if (/notion\.so/i.test(url)) {
      return "notion";
    }
    if (/slack\.com/i.test(url)) {
      return "slack";
    }
  }
  return null;
}
