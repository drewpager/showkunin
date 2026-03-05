/**
 * Test script to verify agent-runtime can connect to the database
 * and has the required environment variables.
 *
 * Run from project root: cd agent-runtime && npx tsx test-connection.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load .env from parent directory
dotenv.config({ path: "../.env" });

async function testConnection() {
  console.log("\n🔍 Agent Runtime Connection Test\n");
  console.log("=".repeat(50));

  // Check required environment variables
  const envVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    AWS_KEY_ID: !!process.env.AWS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET: !!process.env.S3_BUCKET,
  };

  console.log("\n📋 Environment Variables:");
  for (const [key, present] of Object.entries(envVars)) {
    console.log(`  ${present ? "✅" : "❌"} ${key}: ${present ? "Set" : "MISSING"}`);
  }

  // Test database connection
  console.log("\n🔌 Testing Database Connection...");
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("  ✅ Database connection successful");

    // Check for pending runs
    const pendingRuns = await prisma.agentRun.findMany({
      where: { status: "pending" },
      select: { id: true, createdAt: true, videoId: true },
    });

    console.log(`\n📊 Pending Agent Runs: ${pendingRuns.length}`);
    if (pendingRuns.length > 0) {
      for (const run of pendingRuns) {
        console.log(`  - ${run.id} (created: ${run.createdAt.toISOString()})`);
      }
    } else {
      console.log("  No pending runs found. Create one from the UI to test.");
    }

    // Show all runs
    const allRuns = await prisma.agentRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, createdAt: true },
    });

    console.log(`\n📜 Recent Agent Runs:`);
    for (const run of allRuns) {
      const statusEmoji = {
        pending: "⏳",
        running: "🔄",
        paused: "⏸️",
        completed: "✅",
        failed: "❌",
        cancelled: "🚫",
      }[run.status] ?? "❓";
      console.log(`  ${statusEmoji} ${run.id} - ${run.status} (${run.createdAt.toISOString()})`);
    }

  } catch (error) {
    console.error("  ❌ Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n📖 To start the agent runtime:");
  console.log("   cd agent-runtime");
  console.log("   cp ../.env .env  # Copy env vars");
  console.log("   npm run dev      # Start with hot-reload\n");
}

testConnection().catch(console.error);
