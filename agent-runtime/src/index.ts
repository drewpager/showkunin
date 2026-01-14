import { PrismaClient } from "@prisma/client";
import { executeAgentRun } from "./agent-executor.js";

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Poll the database for pending agent runs
 */
async function pollForPendingRuns(): Promise<void> {
  console.log("[Polling] Checking for pending agent runs...");

  try {
    // Find oldest pending run
    const pendingRun = await prisma.agentRun.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        video: true,
      },
    });

    if (!pendingRun) {
      console.log("[Polling] No pending runs found");
      return;
    }

    console.log(`[Polling] Found pending run: ${pendingRun.id}`);

    // Mark as running
    await prisma.agentRun.update({
      where: { id: pendingRun.id },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // Execute the run
    try {
      await executeAgentRun(prisma, pendingRun);

      await prisma.agentRun.update({
        where: { id: pendingRun.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });

      console.log(`[Polling] Run ${pendingRun.id} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await prisma.agentRun.update({
        where: { id: pendingRun.id },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });

      console.error(`[Polling] Run ${pendingRun.id} failed:`, errorMessage);
    }
  } catch (error) {
    console.error("[Polling] Error during polling:", error);
  }
}

/**
 * Check if a run has been cancelled
 */
async function checkForCancellation(runId: string): Promise<boolean> {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  return run?.status === "cancelled";
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("[Agent Runtime] Starting polling loop...");
  console.log(`[Agent Runtime] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[Agent Runtime] Database URL: ${process.env.DATABASE_URL?.slice(0, 30)}...`);

  // Verify database connection
  try {
    await prisma.$connect();
    console.log("[Agent Runtime] Database connection successful");
  } catch (error) {
    console.error("[Agent Runtime] Failed to connect to database:", error);
    process.exit(1);
  }

  // Initial poll
  await pollForPendingRuns();

  // Set up interval
  setInterval(() => {
    void pollForPendingRuns();
  }, POLL_INTERVAL_MS);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Agent Runtime] Received SIGINT, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Agent Runtime] Received SIGTERM, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((error) => {
  console.error("[Agent Runtime] Fatal error:", error);
  process.exit(1);
});

export { checkForCancellation };
