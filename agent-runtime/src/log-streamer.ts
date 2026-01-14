import { type PrismaClient } from "@prisma/client";

type LogLevel = "info" | "error" | "debug";

/**
 * Stream a log message to the database for real-time UI updates
 */
export async function streamLog(
  prisma: PrismaClient,
  agentRunId: string,
  level: LogLevel,
  message: string
): Promise<void> {
  await prisma.agentLog.create({
    data: {
      agentRunId,
      level,
      message,
      timestamp: new Date(),
    },
  });

  // Also log to console for debugging
  const prefix = level.toUpperCase().padEnd(5);
  const shortId = agentRunId.slice(0, 8);
  console.log(`[${prefix}] [${shortId}] ${message}`);
}
