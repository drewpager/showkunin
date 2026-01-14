import { type PrismaClient, type AgentRun, type Video } from "@prisma/client";
import { streamLog } from "./log-streamer.js";
import {
  decryptCredentials,
  injectCredentialsToEnv,
} from "./credential-manager.js";

interface AgentRunWithVideo extends AgentRun {
  video: Video;
}

interface ComputerUsePlan {
  task_description?: string;
  steps?: Array<{
    action: string;
    coordinate?: [number, number];
    text?: string;
    description?: string;
  }>;
}

/**
 * Execute an agent run using the Claude Agent SDK
 */
export async function executeAgentRun(
  prisma: PrismaClient,
  run: AgentRunWithVideo
): Promise<void> {
  await streamLog(prisma, run.id, "info", "Starting agent execution...");

  // 1. Parse Computer Use Plan from aiAnalysis
  const plan = parseComputerUsePlan(run.video.aiAnalysis);
  if (!plan) {
    throw new Error("No Computer Use Plan found in video analysis");
  }

  await streamLog(
    prisma,
    run.id,
    "info",
    `Task: ${plan.task_description ?? "Unknown"}`
  );
  await streamLog(
    prisma,
    run.id,
    "info",
    `Found ${plan.steps?.length ?? 0} steps in plan`
  );

  // 2. Load and decrypt credentials
  const credentials = await prisma.taskCredential.findMany({
    where: { videoId: run.videoId },
  });

  if (credentials.length > 0) {
    await streamLog(
      prisma,
      run.id,
      "info",
      `Loading ${credentials.length} credentials...`
    );
    const decrypted = decryptCredentials(credentials);
    injectCredentialsToEnv(decrypted);
  }

  // 3. Build system prompt with video context
  const systemPrompt = buildSystemPrompt(run.video, plan);

  // 4. Execute via Claude Agent SDK
  await streamLog(prisma, run.id, "info", "Initializing Claude Agent SDK...");

  try {
    // TODO: Phase 4 - Full SDK integration
    // For now, log the plan and complete
    await streamLog(
      prisma,
      run.id,
      "info",
      `System prompt length: ${systemPrompt.length} chars`
    );
    await streamLog(
      prisma,
      run.id,
      "info",
      "SDK execution placeholder - full integration pending"
    );

    // Simulate some work
    for (const [index, step] of (plan.steps ?? []).entries()) {
      await streamLog(
        prisma,
        run.id,
        "info",
        `Step ${index + 1}: ${step.action} - ${step.description ?? "No description"}`
      );
    }

    await streamLog(prisma, run.id, "info", "Execution completed (placeholder)");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await streamLog(prisma, run.id, "error", `Agent SDK error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Build system prompt from video context and plan
 */
function buildSystemPrompt(video: Video, plan: ComputerUsePlan): string {
  // Get analysis without the computer use plan section
  const analysisPart = video.aiAnalysis?.split("---COMPUTER_USE_PLAN")[0] ?? "";
  const truncatedAnalysis = analysisPart.slice(0, 2000);

  return `You are an automation agent executing a workflow recorded by the user.

## Context
- Task Title: ${video.title}
- User Context: ${video.userContext ?? "None provided"}

## Analysis Summary
${truncatedAnalysis}

## Your Goal
Execute the automation plan step by step. Use the available tools to complete each action.
If a step fails, try an alternative approach or report what went wrong.

## Plan
${JSON.stringify(plan, null, 2)}

## Important Notes
- You have access to Bash for running commands
- You can read and edit files
- Be careful with any destructive operations
- Log your progress clearly`;
}

/**
 * Parse Computer Use Plan from video aiAnalysis field
 */
function parseComputerUsePlan(
  aiAnalysis: string | null
): ComputerUsePlan | null {
  if (!aiAnalysis) return null;

  const separators = ["---COMPUTER_USE_PLAN---", "---COMPUTER_USE_PLAN"];
  for (const sep of separators) {
    if (aiAnalysis.includes(sep)) {
      const parts = aiAnalysis.split(sep);
      const planString = parts[1]?.trim();
      if (planString) {
        try {
          // Extract JSON from potential markdown
          const firstBrace = planString.indexOf("{");
          const lastBrace = planString.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            return JSON.parse(
              planString.substring(firstBrace, lastBrace + 1)
            ) as ComputerUsePlan;
          }
        } catch {
          console.error("Failed to parse Computer Use Plan JSON");
        }
      }
    }
  }
  return null;
}
