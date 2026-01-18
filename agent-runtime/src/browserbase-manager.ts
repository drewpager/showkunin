/**
 * Browserbase Manager
 * Handles Browserbase context creation and session management for
 * persistent authentication across agent runs.
 */

import Browserbase from "@browserbasehq/sdk";
import type { PrismaClient } from "@prisma/client";

// Initialize the Browserbase SDK
const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

const projectId = process.env.BROWSERBASE_PROJECT_ID;

export interface SessionWithLiveView {
  sessionId: string;
  liveViewUrl: string;
  connectUrl: string;
}

/**
 * Get or create a Browserbase context for a user/provider combination.
 * Contexts persist authentication state (cookies) across sessions.
 */
export async function getOrCreateContext(
  prisma: PrismaClient,
  userId: string,
  provider: string = "generic"
): Promise<string> {
  // Check if we already have a context for this user/provider
  const existing = await prisma.browserbaseContext.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (existing) {
    // Update lastUsedAt
    await prisma.browserbaseContext.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date() },
    });
    console.log(`Using existing Browserbase context: ${existing.contextId}`);
    return existing.contextId;
  }

  // Create a new context at Browserbase
  if (!projectId) {
    throw new Error("BROWSERBASE_PROJECT_ID is not configured");
  }

  const context = await browserbase.contexts.create({
    projectId,
  });

  // Store the context ID in our database
  await prisma.browserbaseContext.create({
    data: {
      userId,
      provider,
      contextId: context.id,
    },
  });

  console.log(`Created new Browserbase context: ${context.id}`);
  return context.id;
}

/**
 * Create a Browserbase session with context persistence enabled.
 * Returns session ID, live view URL, and WebSocket connect URL.
 */
export async function createSessionWithContext(
  contextId: string
): Promise<SessionWithLiveView> {
  if (!projectId) {
    throw new Error("BROWSERBASE_PROJECT_ID is not configured");
  }

  // Create session with context and persistence enabled
  const session = await browserbase.sessions.create({
    projectId,
    browserSettings: {
      context: {
        id: contextId,
        persist: true, // Save cookies back to context on session end
      },
    },
  });

  // Get the debug/live view URLs
  const debugInfo = await browserbase.sessions.debug(session.id);

  return {
    sessionId: session.id,
    liveViewUrl: debugInfo.debuggerFullscreenUrl,
    connectUrl: debugInfo.wsUrl,
  };
}

/**
 * Create a session without context (for one-off browser tasks)
 */
export async function createSession(): Promise<SessionWithLiveView> {
  if (!projectId) {
    throw new Error("BROWSERBASE_PROJECT_ID is not configured");
  }

  const session = await browserbase.sessions.create({
    projectId,
  });

  const debugInfo = await browserbase.sessions.debug(session.id);

  return {
    sessionId: session.id,
    liveViewUrl: debugInfo.debuggerFullscreenUrl,
    connectUrl: debugInfo.wsUrl,
  };
}

/**
 * Delete a Browserbase context (reset authentication for a provider).
 * Note: The Browserbase SDK doesn't support context deletion, so we only
 * remove the reference from our database. The context will remain at
 * Browserbase but won't be used again (orphaned contexts are cleaned up
 * by Browserbase's retention policies).
 */
export async function deleteContext(
  prisma: PrismaClient,
  userId: string,
  provider: string
): Promise<boolean> {
  const existing = await prisma.browserbaseContext.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!existing) {
    return false;
  }

  // Delete from our database
  // Note: Context remains at Browserbase but will be orphaned and eventually cleaned up
  await prisma.browserbaseContext.delete({
    where: { id: existing.id },
  });

  console.log(`Deleted Browserbase context reference for ${provider} (contextId: ${existing.contextId})`);
  return true;
}

/**
 * List all contexts for a user
 */
export async function listContexts(
  prisma: PrismaClient,
  userId: string
): Promise<{ provider: string; contextId: string; lastUsedAt: Date }[]> {
  const contexts = await prisma.browserbaseContext.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" },
  });

  return contexts.map((ctx) => ({
    provider: ctx.provider,
    contextId: ctx.contextId,
    lastUsedAt: ctx.lastUsedAt,
  }));
}

/**
 * Detect the authentication provider from URLs in the task
 */
export function detectAuthProvider(urls: string[]): string {
  for (const url of urls) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("google.com") || lowerUrl.includes("accounts.google")) {
      return "google";
    }
    if (lowerUrl.includes("github.com")) {
      return "github";
    }
    if (lowerUrl.includes("microsoft.com") || lowerUrl.includes("live.com")) {
      return "microsoft";
    }
    if (lowerUrl.includes("facebook.com")) {
      return "facebook";
    }
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) {
      return "twitter";
    }
    if (lowerUrl.includes("linkedin.com")) {
      return "linkedin";
    }
  }
  return "generic";
}
