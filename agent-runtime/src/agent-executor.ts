import { type PrismaClient, type AgentRun, type Video } from "@prisma/client";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { streamLog, streamToolCall, streamToolResult } from "./log-streamer.js";
import {
  decryptCredentials,
  injectCredentialsToEnv,
} from "./credential-manager.js";
import {
  initializeWorkspace,
  createCheckpoint,
  cleanupWorkspace,
} from "./checkpoint-manager.js";
import { checkForCancellation, checkRunStatus, waitWhilePaused } from "./index.js";
import {
  classifyTask,
  formatClassification,
  type TaskClassification,
} from "./task-classifier.js";
import { getMcpServersForTask, formatMcpServers } from "./mcp-config.js";

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
  let plan = parseComputerUsePlan(run.video.aiAnalysis);

  if (!plan) {
    plan = {
      task_description: `${run.video.title} - ${run.video.aiAnalysis}`,
    };
    console.log("No Computer Use Plan found in video analysis");
    // throw new Error("No Computer Use Plan found in video analysis");
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

  // 1b. Classify task to determine required MCP servers
  const classification = classifyTask(plan, run.video.aiAnalysis);
  const mcpServers = getMcpServersForTask(classification);

  await streamLog(
    prisma,
    run.id,
    "info",
    `Task classification: ${formatClassification(classification)}`
  );

  if (Object.keys(mcpServers).length > 0) {
    await streamLog(
      prisma,
      run.id,
      "info",
      `MCP servers enabled: ${formatMcpServers(mcpServers)}`
    );
  }

  // 2. Initialize workspace and create initial checkpoint
  const workspacePath = await initializeWorkspace(run.id);
  await streamLog(prisma, run.id, "info", `Workspace initialized: ${workspacePath}`);

  // Create initial checkpoint before any changes
  try {
    await createCheckpoint(prisma, run.id, "Pre-execution state");
  } catch (error) {
    // Log but don't fail if checkpoint fails (workspace may be empty)
    await streamLog(prisma, run.id, "debug", "Initial checkpoint skipped (empty workspace)");
  }

  // 3. Load and decrypt credentials
  const credentials = await prisma.taskCredential.findMany({
    where: { videoId: run.videoId },
  });

  let decryptedCredentials: { key: string; value: string }[] = [];
  if (credentials.length > 0) {
    await streamLog(
      prisma,
      run.id,
      "info",
      `Loading ${credentials.length} credentials...`
    );
    decryptedCredentials = decryptCredentials(credentials);
    injectCredentialsToEnv(decryptedCredentials);

    // Log credential keys (not values) for debugging
    await streamLog(
      prisma,
      run.id,
      "debug",
      `Credentials available: ${decryptedCredentials.map(c => c.key).join(", ")}`
    );
  }

  // 4. Build prompt with video context, plan, AND credentials
  const prompt = buildAgentPrompt(run.video, plan, decryptedCredentials);

  // 5. Execute via Claude Agent SDK
  await streamLog(prisma, run.id, "info", "Initializing Claude Agent SDK...");

  try {
    let sessionId: string | undefined;

    // Query the agent with allowed tools and dynamic MCP servers
    // Use 'claude_code' preset to enable all built-in tools PLUS MCP tools
    for await (const message of query({
      prompt,
      options: {
        tools: { type: "preset", preset: "claude_code" }, // Enable all tools including MCP
        mcpServers, // Dynamic MCP servers based on task classification
        permissionMode: "acceptEdits", // Allow file edits without prompts
        systemPrompt: buildSystemPrompt(run.video, classification, decryptedCredentials),
        cwd: workspacePath, // Set working directory to workspace
        env: process.env as Record<string, string>, // Pass environment with credentials
      },
    })) {
      // Check for cancellation or pause
      const status = await checkRunStatus(run.id);
      if (status === 'cancelled') {
        await streamLog(prisma, run.id, "info", "Execution cancelled by user", {
          actionType: "system",
        });
        throw new Error("Execution cancelled");
      }
      if (status === 'paused') {
        await streamLog(prisma, run.id, "info", "Execution paused by user", {
          actionType: "system",
        });
        // Wait until resumed or cancelled
        const resumed = await waitWhilePaused(run.id);
        if (!resumed) {
          await streamLog(prisma, run.id, "info", "Execution cancelled while paused", {
            actionType: "system",
          });
          throw new Error("Execution cancelled");
        }
        await streamLog(prisma, run.id, "info", "Execution resumed", {
          actionType: "system",
        });
      }

      // Capture session ID for potential resume
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { agentSessionId: sessionId },
        });
        await streamLog(prisma, run.id, "debug", `Session ID: ${sessionId}`);
      }

      // Log agent messages
      await logAgentMessage(prisma, run.id, message);
    }

    // Create final checkpoint after successful execution
    try {
      await createCheckpoint(prisma, run.id, "Post-execution state");
    } catch {
      await streamLog(prisma, run.id, "debug", "Final checkpoint skipped");
    }

    await streamLog(prisma, run.id, "info", "Agent execution completed successfully");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await streamLog(prisma, run.id, "error", `Agent SDK error: ${errorMsg}`);

    // Create checkpoint on failure for debugging
    try {
      await createCheckpoint(prisma, run.id, "State at failure");
    } catch {
      // Ignore checkpoint errors on failure
    }

    throw error;
  } finally {
    // Optionally clean up workspace (disabled for debugging)
    // await cleanupWorkspace(run.id);
  }
}

/**
 * Log an agent message to the database with structured action data
 */
async function logAgentMessage(
  prisma: PrismaClient,
  runId: string,
  message: unknown
): Promise<void> {
  const msg = message as Record<string, unknown>;

  // Handle different message types
  if (msg.type === "assistant" && msg.message) {
    const content = msg.message as Record<string, unknown>;
    if (content.content && Array.isArray(content.content)) {
      for (const block of content.content) {
        const blockData = block as Record<string, unknown>;
        if (blockData.type === "text") {
          const text = String(blockData.text);
          await streamLog(prisma, runId, "info", text, {
            actionType: "text",
          });
        } else if (blockData.type === "tool_use") {
          const toolName = String(blockData.name);
          const toolInput = blockData.input as Record<string, unknown>;
          await streamToolCall(prisma, runId, toolName, toolInput);
        }
      }
    }
  } else if (msg.type === "result") {
    const result = msg.result ?? "Execution completed";
    await streamLog(prisma, runId, "info", String(result), {
      actionType: "system",
    });
  } else if (msg.type === "tool") {
    const toolMsg = msg as Record<string, unknown>;
    const toolName = String(toolMsg.name ?? "unknown");
    const toolContent = toolMsg.content ?? toolMsg.result;
    const isError = toolMsg.is_error === true;
    await streamToolResult(prisma, runId, toolName, toolContent, !isError);
  }
}

/**
 * Build the system prompt for the agent
 */
function buildSystemPrompt(
  video: Video,
  classification: TaskClassification,
  credentials: { key: string; value: string }[] = []
): string {
  // Get analysis without the computer use plan section
  const analysisPart = video.aiAnalysis?.split("---COMPUTER_USE_PLAN")[0] ?? "";
  const truncatedAnalysis = analysisPart.slice(0, 3000);

  let prompt = `You are an automation agent executing a workflow based on a screencast recording.

## Context
- Task Title: ${video.title}
- User Context: ${video.userContext ?? "None provided"}

## Video Analysis Summary
${truncatedAnalysis}

## Guidelines
- Execute the automation plan step by step
- Use the available tools to complete each action
- If a step fails, try an alternative approach or report what went wrong
- Be careful with destructive operations
- Log your progress clearly`;

  // Add credentials section if any are available
  if (credentials.length > 0) {
    prompt += `

## Available Credentials (Environment Variables)
The following credentials have been provided and are available as environment variables:
`;
    for (const cred of credentials) {
      // Show the key and a hint about its value (first few chars or type)
      const valueHint = cred.value.startsWith("http")
        ? `URL: ${cred.value.substring(0, 60)}...`
        : cred.value.length > 20
          ? `${cred.value.substring(0, 10)}...`
          : "(set)";
      prompt += `- \$${cred.key}: ${valueHint}\n`;
    }
    prompt += `
Use these environment variables in your commands (e.g., \`echo $SPREADSHEET_URL\` or access via \`process.env.SPREADSHEET_URL\`).`;
  }

  // Add browser-specific guidance if browser automation is enabled
  if (classification.requiresBrowser) {
    // Get URL from credentials or detected URLs
    const urlCredential = credentials.find(c =>
      c.key.includes("URL") || c.key.includes("SPREADSHEET")
    );
    const browserUrls = urlCredential
      ? urlCredential.value
      : classification.browserUrls.length > 0
        ? classification.browserUrls.slice(0, 5).join(", ")
        : "Check credentials above or task description";

    prompt += `

## Browser Automation
You have access to browser automation tools via MCP (Model Context Protocol).

**IMPORTANT**: The MCP browser tools are available with the prefix \`mcp__playwright__\`:
- \`mcp__playwright__browser_navigate\`: Navigate to URLs
- \`mcp__playwright__browser_click\`: Click elements by ref
- \`mcp__playwright__browser_type\`: Type text into inputs
- \`mcp__playwright__browser_snapshot\`: Capture page accessibility tree (ALWAYS use this first!)
- \`mcp__playwright__browser_take_screenshot\`: Take visual screenshots
- \`mcp__playwright__browser_fill_form\`: Fill multiple form fields at once

**Workflow for browser tasks:**
1. First, navigate to the target URL: \`mcp__playwright__browser_navigate\` with url parameter
2. Use \`mcp__playwright__browser_snapshot\` to get the page structure and element refs
3. Find elements by their ref (from snapshot) and use \`mcp__playwright__browser_click\` or \`mcp__playwright__browser_type\`
4. After each action, take another snapshot to verify success
5. Repeat until the task is complete

**Target URL to navigate to**: ${browserUrls}`;
  }

  return prompt;
}

/**
 * Build the main prompt with the execution plan
 */
function buildAgentPrompt(
  video: Video,
  plan: ComputerUsePlan,
  credentials: { key: string; value: string }[] = []
): string {
  // Build credentials section for the prompt
  let credentialsSection = "";
  if (credentials.length > 0) {
    credentialsSection = `

## Provided Credentials
The following credentials are available as environment variables:
`;
    for (const cred of credentials) {
      if (cred.value.startsWith("http")) {
        // For URLs, show the full value
        credentialsSection += `- **${cred.key}**: ${cred.value}\n`;
      } else {
        // For secrets, just show it's available
        credentialsSection += `- **${cred.key}**: (available in environment)\n`;
      }
    }
  }

  return `Execute the following automation plan based on a screencast recording.

## Task: ${video.title}
${credentialsSection}
## Execution Plan
${JSON.stringify(plan, null, 2)}

**Instructions:**
1. Start by navigating to the target URL if this is a browser task (use mcp__playwright__browser_navigate)
2. Take a snapshot to understand the page (use mcp__playwright__browser_snapshot)
3. Execute each step in the plan using the appropriate tools
4. Verify each action succeeded before moving to the next step
5. If you encounter errors, try alternative approaches or report what went wrong

**For browser automation**, always use the MCP Playwright tools:
- \`mcp__playwright__browser_navigate\` - to go to URLs
- \`mcp__playwright__browser_snapshot\` - to see page structure and get element refs
- \`mcp__playwright__browser_click\` - to click elements (requires ref from snapshot)
- \`mcp__playwright__browser_type\` - to type text (requires ref from snapshot)`;
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
