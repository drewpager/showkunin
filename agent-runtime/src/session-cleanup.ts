/**
 * Session Cleanup and Rate Limit Management
 * Handles Browserbase session lifecycle to prevent rate limit errors
 */

import type { PrismaClient } from "@prisma/client";
import Browserbase from "@browserbasehq/sdk";

// Initialize the Browserbase SDK
const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

const projectId = process.env.BROWSERBASE_PROJECT_ID;

// Session limits - Browserbase has concurrency limits per account
const MAX_CONCURRENT_SESSIONS = 25; // Adjust based on your Browserbase plan
const STALE_SESSION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface SessionSlotResult {
  available: boolean;
  activeCount: number;
  message?: string;
}

/**
 * Clean up stale sessions that have been inactive for more than 30 minutes
 * This prevents orphaned sessions from blocking new session creation
 */
export async function cleanupStaleSessions(
  prisma: PrismaClient
): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_SESSION_THRESHOLD_MS);

  // Find stale sessions
  const staleSessions = await prisma.browserbaseActiveSession.findMany({
    where: {
      status: "active",
      lastPingAt: {
        lt: staleThreshold,
      },
    },
  });

  if (staleSessions.length === 0) {
    return 0;
  }

  console.log(`[Session Cleanup] Found ${staleSessions.length} stale sessions`);

  // Try to close sessions at Browserbase
  for (const session of staleSessions) {
    try {
      // Attempt to stop the session at Browserbase
      // Note: The session may already be closed, which is fine
      await browserbase.sessions.update(session.sessionId, {
        projectId: projectId!,
        status: "REQUEST_RELEASE",
      });
      console.log(`[Session Cleanup] Released session ${session.sessionId}`);
    } catch (error) {
      // Session may already be closed or not exist
      console.log(
        `[Session Cleanup] Could not release session ${session.sessionId} (may already be closed)`
      );
    }
  }

  // Mark all stale sessions as stale in our database
  const result = await prisma.browserbaseActiveSession.updateMany({
    where: {
      id: {
        in: staleSessions.map((s) => s.id),
      },
    },
    data: {
      status: "stale",
    },
  });

  console.log(`[Session Cleanup] Marked ${result.count} sessions as stale`);
  return result.count;
}

/**
 * Check if a session slot is available before creating a new session
 * Throws an error if at the rate limit to prevent 429 errors
 */
export async function ensureSessionSlotAvailable(
  prisma: PrismaClient
): Promise<SessionSlotResult> {
  // First, clean up any stale sessions
  await cleanupStaleSessions(prisma);

  // Count active sessions
  const activeCount = await prisma.browserbaseActiveSession.count({
    where: {
      status: "active",
    },
  });

  if (activeCount >= MAX_CONCURRENT_SESSIONS) {
    return {
      available: false,
      activeCount,
      message: `Rate limit: ${activeCount}/${MAX_CONCURRENT_SESSIONS} sessions active. Please wait for a session to complete.`,
    };
  }

  return {
    available: true,
    activeCount,
  };
}

/**
 * Register a new session in the tracking database
 * Call this after successfully creating a Browserbase session
 */
export async function registerSession(
  prisma: PrismaClient,
  sessionId: string,
  userId: string,
  agentRunId?: string
): Promise<void> {
  await prisma.browserbaseActiveSession.create({
    data: {
      sessionId,
      userId,
      agentRunId,
      status: "active",
      lastPingAt: new Date(),
    },
  });

  console.log(`[Session Tracking] Registered session ${sessionId}`);
}

/**
 * Mark a session as closed when the agent run completes
 */
export async function releaseSession(
  prisma: PrismaClient,
  sessionId: string
): Promise<void> {
  try {
    await prisma.browserbaseActiveSession.update({
      where: { sessionId },
      data: {
        status: "closed",
      },
    });

    console.log(`[Session Tracking] Released session ${sessionId}`);
  } catch (error) {
    // Session may not exist in tracking (legacy runs)
    console.log(
      `[Session Tracking] Could not release session ${sessionId} (may not be tracked)`
    );
  }
}

/**
 * Update the lastPingAt timestamp for an active session
 * Call this periodically during agent execution to prevent stale detection
 */
export async function pingSession(
  prisma: PrismaClient,
  sessionId: string
): Promise<void> {
  try {
    await prisma.browserbaseActiveSession.update({
      where: { sessionId },
      data: {
        lastPingAt: new Date(),
      },
    });
  } catch (error) {
    // Session may not exist in tracking
    // This is fine - just means we won't extend the stale timeout
  }
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessionsForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ sessionId: string; agentRunId: string | null; lastPingAt: Date }[]> {
  const sessions = await prisma.browserbaseActiveSession.findMany({
    where: {
      userId,
      status: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return sessions.map((s) => ({
    sessionId: s.sessionId,
    agentRunId: s.agentRunId,
    lastPingAt: s.lastPingAt,
  }));
}

/**
 * Force close all sessions for a user
 * Useful when the user wants to free up their session slots
 */
export async function closeAllSessionsForUser(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  const activeSessions = await prisma.browserbaseActiveSession.findMany({
    where: {
      userId,
      status: "active",
    },
  });

  // Try to release at Browserbase
  for (const session of activeSessions) {
    try {
      await browserbase.sessions.update(session.sessionId, {
        projectId: projectId!,
        status: "REQUEST_RELEASE",
      });
    } catch {
      console.log(
        `[Session Cleanup] Could not release session ${session.sessionId} (may already be closed)`
      );
      // Ignore errors
    }
  }

  // Mark as closed in our database
  const result = await prisma.browserbaseActiveSession.updateMany({
    where: {
      userId,
      status: "active",
    },
    data: {
      status: "closed",
    },
  });

  return result.count;
}

/**
 * Close all sessions associated with a specific agent run
 * Use this when cancelling or cleaning up an agent run
 */
export async function closeSessionsForAgentRun(
  prisma: PrismaClient,
  agentRunId: string
): Promise<number> {
  const activeSessions = await prisma.browserbaseActiveSession.findMany({
    where: {
      agentRunId,
      status: "active",
    },
  });

  if (activeSessions.length === 0) {
    return 0;
  }

  console.log(`[Session Cleanup] Closing ${activeSessions.length} sessions for agent run ${agentRunId}`);

  // Try to release at Browserbase
  for (const session of activeSessions) {
    try {
      await browserbase.sessions.update(session.sessionId, {
        projectId: projectId!,
        status: "REQUEST_RELEASE",
      });
      console.log(`[Session Cleanup] Released session ${session.sessionId}`);
    } catch {
      // Session may already be closed
      console.log(`[Session Cleanup] Could not release session ${session.sessionId} (may already be closed)`);
    }
  }

  // Mark as closed in our database
  const result = await prisma.browserbaseActiveSession.updateMany({
    where: {
      agentRunId,
      status: "active",
    },
    data: {
      status: "closed",
    },
  });

  return result.count;
}
