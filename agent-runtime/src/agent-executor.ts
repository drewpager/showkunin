import { type PrismaClient, type AgentRun, type Video } from "@prisma/client";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { streamLog, streamToolCall, streamToolResult } from "./log-streamer";
import {
  decryptCredentials,
  injectCredentialsToEnv,
} from "./credential-manager";
import {
  initializeWorkspace,
  createCheckpoint,
  cleanupWorkspace,
} from "./checkpoint-manager";
import { checkForCancellation, checkRunStatus, waitWhilePaused } from "./index";
import {
  classifyTask,
  formatClassification,
  type TaskClassification,
} from "./task-classifier";
import {
  getMcpServersForTask,
  formatMcpServers,
  type StagehandContextOptions,
} from "./mcp-config";
import {
  getOrCreateContext,
  closeSession,
  pingSession,
  detectAuthProvider,
  getSessionDebugInfo,
  releaseSession,
} from "./browserbase-manager";
import { registerSession } from "./session-cleanup";
import { detectAuthRequirements } from "./auth-detector";

// Timeout and progress tracking constants
const DEFAULT_MAX_DURATION_MS = 300_000;      // 5 minutes
const PROGRESS_STALL_THRESHOLD_MS = 180_000;  // 3 minutes without progress
const MAX_STALL_COUNT = 2;                    // Max consecutive stalls before termination
const PING_INTERVAL_MS = 30_000;              // Ping session every 30 seconds

// Auth detection patterns for runtime detection
const AUTH_PAGE_PATTERNS = [
  { regex: /accounts\.google\.com/i, provider: "google" },
  { regex: /google\.com\/signin/i, provider: "google" },
  { regex: /drive\.google\.com\/.*signin/i, provider: "google" },
  { regex: /github\.com\/login/i, provider: "github" },
  { regex: /github\.com\/session/i, provider: "github" },
  { regex: /login\.microsoftonline\.com/i, provider: "microsoft" },
  { regex: /login\.live\.com/i, provider: "microsoft" },
  { regex: /facebook\.com\/login/i, provider: "facebook" },
  { regex: /(twitter|x)\.com\/i\/flow\/login/i, provider: "twitter" },
  { regex: /linkedin\.com\/(login|uas)/i, provider: "linkedin" },
  { regex: /slack\.com\/signin/i, provider: "slack" },
  { regex: /notion\.so\/login/i, provider: "notion" },
  { regex: /id\.atlassian\.com/i, provider: "atlassian" },
];

// Auth-related keywords in page titles/content
const AUTH_KEYWORDS = [
  "sign in",
  "log in",
  "login",
  "signin",
  "authenticate",
  "enter your password",
  "verify your identity",
  "two-factor",
  "2fa",
  "verification code",
  "captcha",
];

interface AgentRunWithVideo extends AgentRun {
  video: Video;
}

interface SemanticStep {
  action: string;
  target?: string;
  how_to_find?: string;
  value?: string;
  expected_result?: string;
  fallback?: string;
  // Legacy fields for backward compatibility
  coordinate?: [number, number];
  text?: string;
  description?: string;
}

interface ComputerUsePlan {
  // New semantic format
  goal?: string;
  starting_url?: string;
  steps?: SemanticStep[];
  success_criteria?: string[];
  // Legacy format
  task_description?: string;
}

interface ValidationResult {
  valid: boolean;
  reason: string;
}

// False positive patterns that indicate the agent gave instructions instead of automating
const FALSE_POSITIVE_PATTERNS = [
  /here['']?s how you (should|need to|can)/i,
  /i['']?d recommend/i,
  /follow these steps/i,
  /you (should|need to|can) (manually|do this)/i,
  /requires (manual|human) (intervention|input)/i,
  /please (manually|do this yourself)/i,
  /i cannot (perform|complete|automate)/i,
  /this (requires|needs) you to/i,
  /unfortunately,? i (cannot|can't|am unable)/i,
];

// Tool patterns that indicate actual automation occurred
const AUTOMATION_TOOL_PATTERNS = [
  /^mcp__playwright__browser_/,
  /^mcp__stagehand__/,
  /^browser_/,
];

/**
 * Detect if a URL or page content indicates an authentication page
 * Returns the provider name if auth is detected, null otherwise
 */
function detectAuthFromContent(content: string): string | null {
  const lowerContent = content.toLowerCase();

  // Check URL patterns
  for (const { regex, provider } of AUTH_PAGE_PATTERNS) {
    if (regex.test(content)) {
      return provider;
    }
  }

  // Check for auth keywords in content (with some heuristics)
  const keywordMatches = AUTH_KEYWORDS.filter(kw => lowerContent.includes(kw));
  if (keywordMatches.length >= 2) {
    // Multiple auth keywords suggest this is likely an auth page
    // Try to identify the provider from the content
    if (lowerContent.includes("google")) return "google";
    if (lowerContent.includes("github")) return "github";
    if (lowerContent.includes("microsoft") || lowerContent.includes("outlook")) return "microsoft";
    if (lowerContent.includes("facebook")) return "facebook";
    if (lowerContent.includes("twitter") || lowerContent.includes("x.com")) return "twitter";
    if (lowerContent.includes("linkedin")) return "linkedin";
    if (lowerContent.includes("slack")) return "slack";
    if (lowerContent.includes("notion")) return "notion";
    if (lowerContent.includes("atlassian") || lowerContent.includes("jira")) return "atlassian";
    return "generic"; // Unknown provider but auth detected
  }

  return null;
}

/**
 * Pause run for authentication and notify user
 */
async function pauseForAuth(
  prisma: PrismaClient,
  runId: string,
  provider: string
): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "paused",
      authRequired: provider,
    },
  });

  await streamLog(
    prisma,
    runId,
    "info",
    `AUTH_REQUIRED: ${provider} login detected. Execution paused - please complete authentication via Live View.`,
    { actionType: "system" }
  );
}

/**
 * Validate that the agent actually performed automation vs just giving instructions
 */
export async function validateSuccessCriteria(
  prisma: PrismaClient,
  runId: string,
  successCriteria?: string[]
): Promise<ValidationResult> {
  // Get all logs for this run
  const logs = await prisma.agentLog.findMany({
    where: { agentRunId: runId },
    orderBy: { timestamp: "asc" },
  });

  // Check for false positive patterns in text output
  const textLogs = logs.filter((l) => l.actionType === "text");
  for (const log of textLogs) {
    for (const pattern of FALSE_POSITIVE_PATTERNS) {
      if (pattern.test(log.message)) {
        return {
          valid: false,
          reason: `Agent output instructions instead of automating: "${log.message.substring(0, 100)}..."`,
        };
      }
    }
  }

  // Check that actual automation tools were used
  const toolCalls = logs.filter((l) => l.actionType === "tool_call" && l.toolName);
  const automationToolCalls = toolCalls.filter((l) =>
    AUTOMATION_TOOL_PATTERNS.some((p) => p.test(l.toolName ?? ""))
  );

  if (automationToolCalls.length === 0 && toolCalls.length > 0) {
    // Agent used tools but no browser automation tools
    // This might be OK for non-browser tasks, so just flag it
    console.log(`[Validation] No browser automation tools used (${toolCalls.length} total tool calls)`);
  }

  // If no tool calls at all, that's suspicious
  if (toolCalls.length === 0) {
    return {
      valid: false,
      reason: "No tool executions detected - agent may have only provided text output",
    };
  }

  // Check for tool errors in the last few tool results
  const recentToolResults = logs
    .filter((l) => l.actionType === "tool_result")
    .slice(-5);

  const hasRecentErrors = recentToolResults.some(
    (l) => l.level === "error" || l.message.toLowerCase().includes("error")
  );

  if (hasRecentErrors) {
    return {
      valid: false,
      reason: "Recent tool executions contained errors",
    };
  }

  // If we have success criteria, check that they were addressed in the logs
  if (successCriteria && successCriteria.length > 0) {
    const allLogText = logs.map((l) => l.message).join(" ").toLowerCase();
    const unaddressedCriteria = successCriteria.filter(
      (criteria) => !allLogText.includes(criteria.toLowerCase().substring(0, 20))
    );

    if (unaddressedCriteria.length > 0) {
      console.log(`[Validation] Some success criteria may not have been addressed: ${unaddressedCriteria.join(", ")}`);
      // Don't fail for this - it's just informational
    }
  }

  return {
    valid: true,
    reason: "Automation completed with tool executions and no false positive patterns detected",
  };
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
      goal: `${run.video.title}`,
      task_description: `${run.video.title} - ${run.video.aiAnalysis}`,
    };
    console.log("No Computer Use Plan found in video analysis");
  }

  // Use new semantic format 'goal' or fall back to legacy 'task_description'
  const taskSummary = plan.goal ?? plan.task_description ?? "Unknown task";

  await streamLog(
    prisma,
    run.id,
    "info",
    `Goal: ${taskSummary}`
  );
  await streamLog(
    prisma,
    run.id,
    "info",
    `Found ${plan.steps?.length ?? 0} semantic steps in plan`
  );

  if (plan.starting_url) {
    await streamLog(prisma, run.id, "info", `Starting URL: ${plan.starting_url}`);
  }

  if (plan.success_criteria?.length) {
    await streamLog(prisma, run.id, "debug", `Success criteria: ${plan.success_criteria.join(", ")}`);
  }

  // 1b. Classify task to determine required MCP servers
  const classification = classifyTask(plan, run.video.aiAnalysis);

  await streamLog(
    prisma,
    run.id,
    "info",
    `Task classification: ${formatClassification(classification)}`
  );

  // 1c. Check for pre-execution auth requirements
  // This catches auth-required URLs BEFORE we waste time trying to automate
  if (classification.browserUrls.length > 0) {
    const authRequirement = detectAuthRequirements(classification.browserUrls);
    if (authRequirement.required && !authRequirement.canSkip) {
      await streamLog(
        prisma,
        run.id,
        "info",
        `Pre-execution auth check: ${authRequirement.provider} authentication required (${authRequirement.reason})`
      );

      // Check if we have an existing authenticated context for this provider
      const existingContext = await prisma.browserbaseContext.findUnique({
        where: {
          userId_provider: {
            userId: run.userId,
            provider: authRequirement.provider,
          },
        },
      });

      if (!existingContext) {
        await streamLog(
          prisma,
          run.id,
          "info",
          `No existing ${authRequirement.provider} session found. Authentication will be required.`
        );
        // Note: We don't pause here - we'll let the agent start and pause when it hits the login page
        // This gives the user a chance to see the Live View and authenticate
      } else {
        await streamLog(
          prisma,
          run.id,
          "info",
          `Found existing ${authRequirement.provider} context (${existingContext.contextId.substring(0, 8)}...) - will attempt to reuse session`
        );
      }
    }
  }

  // 1d. Set up Browserbase context for browser tasks using stagehand
  let stagehandOptions: StagehandContextOptions | undefined;
  // Track the session ID created by stagehand MCP (not pre-created)
  let activeSessionId: string | undefined;

  const usesStagehand = classification.suggestedMcpServers.includes("stagehand");

  if (usesStagehand) {
    try {
      // Detect auth provider from URLs in the task
      const provider = detectAuthProvider(classification.browserUrls);

      await streamLog(
        prisma,
        run.id,
        "info",
        `Setting up Browserbase context for provider: ${provider}`
      );

      // Get or create a persistent context for this user/provider
      // NOTE: We only get the context ID here - the actual session will be
      // created by the Stagehand MCP server when the agent calls session_create.
      // This avoids creating duplicate sessions (one unused, one active).
      const contextId = await getOrCreateContext(prisma, run.userId, provider);

      stagehandOptions = {
        contextId,
        // sessionId is NOT passed - Stagehand MCP creates its own session
      };

      await streamLog(
        prisma,
        run.id,
        "info",
        `Browserbase context ready: ${contextId.substring(0, 8)}... (session will be created by Stagehand)`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await streamLog(
        prisma,
        run.id,
        "error",
        `Failed to set up Browserbase context: ${errorMsg}`
      );
      // Continue without context - will use default stagehand config
    }
  }

  // Build MCP servers config with optional stagehand context
  const mcpServers = getMcpServersForTask(classification, stagehandOptions);

  if (Object.keys(mcpServers).length > 0) {
    await streamLog(
      prisma,
      run.id,
      "info",
      `MCP servers enabled: ${formatMcpServers(mcpServers)}`
    );
    // Log MCP server configuration for debugging (redact sensitive args)
    for (const [serverName, config] of Object.entries(mcpServers)) {
      const mcpConfig = config as { command: string; args?: string[] };
      // Redact sensitive arguments (API keys, tokens, secrets)
      const redactedArgs = mcpConfig.args?.map((arg, i, arr) => {
        // Check if previous arg was a sensitive flag
        const prevArg = i > 0 ? arr[i - 1]?.toLowerCase() ?? "" : "";
        const sensitiveFlags = ["--apikey", "--modelapikey", "--key", "--token", "--secret", "--password"];
        if (sensitiveFlags.some(flag => prevArg.includes(flag.replace("--", "")))) {
          return "[REDACTED]";
        }
        // Also redact args that look like API keys (long alphanumeric strings)
        if (arg.length > 20 && /^[a-zA-Z0-9_-]+$/.test(arg) && !arg.startsWith("--")) {
          return "[REDACTED]";
        }
        return arg;
      });
      await streamLog(
        prisma,
        run.id,
        "debug",
        `MCP server '${serverName}': ${mcpConfig.command} ${redactedArgs?.join(" ") ?? ""}`
      );
    }
  } else {
    await streamLog(
      prisma,
      run.id,
      "info",
      "WARNING: No MCP servers configured for this task"
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

  // Progress tracking variables
  const executionStartTime = Date.now();
  let lastProgressTime = Date.now();
  let stallCount = 0;
  const maxDuration = run.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  // Session ping interval - will be started when stagehand creates a session
  let pingIntervalId: NodeJS.Timeout | undefined;

  // Helper to start pinging the session
  const startSessionPing = (sessionId: string) => {
    if (pingIntervalId) return; // Already pinging
    pingIntervalId = setInterval(async () => {
      try {
        await pingSession(prisma, sessionId);
      } catch {
        // Ignore ping errors
      }
    }, PING_INTERVAL_MS);
  };

  // Initialize progress tracking in database
  await prisma.agentRun.update({
    where: { id: run.id },
    data: { lastProgressAt: new Date() },
  });

  try {
    let sessionId: string | undefined;

    // Query the agent with allowed tools and dynamic MCP servers
    // Use 'claude_code' preset to enable all built-in tools PLUS MCP tools
    for await (const message of query({
      prompt,
      options: {
        tools: { type: "preset", preset: "claude_code" }, // Enable all tools including MCP
        mcpServers, // Dynamic MCP servers based on task classification
        permissionMode: "bypassPermissions", // Allow all tools without prompts (for automated execution)
        allowDangerouslySkipPermissions: true, // Required safety flag for bypassPermissions
        systemPrompt: buildSystemPrompt(run.video, classification, decryptedCredentials),
        cwd: workspacePath, // Set working directory to workspace
        env: process.env as Record<string, string>, // Pass environment with credentials
      },
    })) {
      // Check for timeout
      const elapsedTime = Date.now() - executionStartTime;
      if (elapsedTime > maxDuration) {
        await streamLog(prisma, run.id, "error", `Execution timeout: exceeded ${maxDuration / 1000}s limit`, {
          actionType: "system",
        });
        throw new Error(`Execution timeout: exceeded ${maxDuration / 1000}s limit`);
      }

      // Check for stalls (no progress for 3 minutes)
      const timeSinceProgress = Date.now() - lastProgressTime;
      if (timeSinceProgress > PROGRESS_STALL_THRESHOLD_MS) {
        stallCount++;
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { progressStallCount: stallCount },
        });

        if (stallCount >= MAX_STALL_COUNT) {
          await streamLog(prisma, run.id, "error", `Execution stalled: no progress for ${PROGRESS_STALL_THRESHOLD_MS / 1000}s (${stallCount} consecutive stalls)`, {
            actionType: "system",
          });
          throw new Error(`Execution stalled after ${stallCount} consecutive stalls`);
        } else {
          await streamLog(prisma, run.id, "info", `Warning: No progress detected for ${timeSinceProgress / 1000}s (stall ${stallCount}/${MAX_STALL_COUNT})`, {
            actionType: "system",
          });
        }
      }

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

      // Capture session ID and log MCP server status for debugging
      if (message.type === "system" && message.subtype === "init") {
        const initMsg = message as {
          session_id: string;
          tools?: string[];
          mcp_servers?: { name: string; status: string }[];
        };
        sessionId = initMsg.session_id;
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { agentSessionId: sessionId },
        });
        await streamLog(prisma, run.id, "debug", `Session ID: ${sessionId}`);

        // Log MCP server status - critical for debugging tool availability
        if (initMsg.mcp_servers && initMsg.mcp_servers.length > 0) {
          for (const server of initMsg.mcp_servers) {
            const level = server.status === "connected" ? "info" : "error";
            await streamLog(
              prisma,
              run.id,
              level,
              `MCP server '${server.name}': ${server.status}`
            );
          }
        } else {
          await streamLog(
            prisma,
            run.id,
            "error",
            "No MCP servers initialized - tools will not be available"
          );
        }

        // Log available tools for debugging
        if (initMsg.tools && initMsg.tools.length > 0) {
          const mcpTools = initMsg.tools.filter(t => t.startsWith("mcp__"));
          if (mcpTools.length > 0) {
            await streamLog(
              prisma,
              run.id,
              "debug",
              `MCP tools available: ${mcpTools.join(", ")}`
            );
          } else {
            await streamLog(
              prisma,
              run.id,
              "error",
              `No MCP tools available. Built-in tools: ${initMsg.tools.slice(0, 10).join(", ")}...`
            );
          }
        }
      }

      // Update progress timestamp on meaningful activity
      const msg = message as Record<string, unknown>;
      const isToolActivity = msg.type === "assistant" || msg.type === "tool";
      if (isToolActivity) {
        lastProgressTime = Date.now();
        stallCount = 0; // Reset stall count on activity
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            lastProgressAt: new Date(),
            progressStallCount: 0,
          },
        });
      }

      // Log agent messages and check for auth detection
      const { authProvider: detectedAuthProvider, sessionId: detectedSessionId } =
        await logAgentMessage(prisma, run.id, message, usesStagehand);

      // If a stagehand session was created, capture it and update the AgentRun
      if (detectedSessionId && !activeSessionId) {
        activeSessionId = detectedSessionId;
        await streamLog(prisma, run.id, "info", `Stagehand session created: ${detectedSessionId}`);

        // Register the session for tracking so it can be cleaned up on cancellation
        // This is important because Stagehand MCP creates sessions independently
        try {
          await registerSession(prisma, detectedSessionId, run.userId, run.id);
          await streamLog(prisma, run.id, "debug", `Session registered for tracking: ${detectedSessionId}`);
        } catch (error) {
          // Session might already be registered, or registration might fail
          console.log(`[Agent Executor] Could not register session ${detectedSessionId}:`, error);
        }

        // Start pinging the session to keep it alive
        startSessionPing(detectedSessionId);

        // Get the Live View URL for this session and update AgentRun
        try {
          const debugInfo = await getSessionDebugInfo(detectedSessionId);
          if (debugInfo) {
            await prisma.agentRun.update({
              where: { id: run.id },
              data: {
                browserbaseSessionId: detectedSessionId,
                liveViewUrl: debugInfo.liveViewUrl,
              },
            });
            await streamLog(prisma, run.id, "info", `Live View available for browser session`);
            await streamLog(prisma, run.id, "debug", `Live View URL: ${debugInfo.liveViewUrl}`);
          }
        } catch (error) {
          console.log(`[Agent Executor] Could not get Live View URL: ${error}`);
        }
      }

      // If auth was detected, pause the run and wait for user to complete auth
      if (detectedAuthProvider) {
        await pauseForAuth(prisma, run.id, detectedAuthProvider);

        // Wait for the user to complete auth and resume
        // The status will change to 'running' when user clicks resume after auth
        const authResumed = await waitWhilePaused(run.id);
        if (!authResumed) {
          await streamLog(prisma, run.id, "info", "Execution cancelled while waiting for authentication", {
            actionType: "system",
          });
          throw new Error("Execution cancelled during auth wait");
        }

        // Auth completed - clear the authRequired flag and continue
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            authRequired: null,
            authCompleted: true,
          },
        });

        await streamLog(prisma, run.id, "info", "Authentication completed - resuming execution", {
          actionType: "system",
        });
      }
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
    // Clean up ping interval
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
    }

    // Close browser session if one was created by stagehand
    if (activeSessionId) {
      try {
        await closeSession(prisma, activeSessionId);
        await streamLog(prisma, run.id, "debug", "Browser session closed");
      } catch (error) {
        console.log(`[Agent Executor] Could not close session: ${error}`);
      }
    }

    // Optionally clean up workspace (disabled for debugging)
    await cleanupWorkspace(run.id);
  }
}

interface LogAgentMessageResult {
  authProvider: string | null;
  sessionId: string | null;
}

/**
 * Log an agent message to the database with structured action data
 * Returns detected auth provider and/or session ID from stagehand
 */
async function logAgentMessage(
  prisma: PrismaClient,
  runId: string,
  message: unknown,
  detectStagehandSession: boolean = false
): Promise<LogAgentMessageResult> {
  const msg = message as Record<string, unknown>;
  let detectedAuth: string | null = null;
  let detectedSessionId: string | null = null;

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
          // Check text output for auth detection keywords
          if (text.includes("AUTH_REQUIRED:") || text.includes("login detected")) {
            const authMatch = text.match(/AUTH_REQUIRED:\s*(\w+)/i);
            if (authMatch?.[1]) {
              detectedAuth = authMatch[1].toLowerCase();
            } else {
              detectedAuth = detectAuthFromContent(text);
            }
          }
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

    // Debug: Log all stagehand tool calls to help diagnose session detection
    if (detectStagehandSession && toolName.includes("stagehand")) {
      console.log(`[Stagehand Debug] Tool called: ${toolName}`);
    }

    // Detect stagehand session creation from tool result
    if (detectStagehandSession && toolName.includes("session_create") && !isError) {
      // Debug: Log the raw tool result for session_create
      console.log(`[Session Detection] Tool: ${toolName}, Content type: ${typeof toolContent}`);
      console.log(`[Session Detection] Content preview: ${JSON.stringify(toolContent).substring(0, 500)}`);

      detectedSessionId = extractSessionIdFromToolResult(toolContent);

      if (detectedSessionId) {
        console.log(`[Session Detection] Successfully extracted session ID: ${detectedSessionId}`);
      } else {
        console.log(`[Session Detection] WARNING: Could not extract session ID from tool result`);
      }
    }

    // Check tool results for auth page detection
    // Especially browser snapshot/screenshot results that may contain page info
    if (toolName.includes("browser") || toolName.includes("stagehand")) {
      const contentStr = typeof toolContent === "string"
        ? toolContent
        : JSON.stringify(toolContent);

      // Debug: Log content being checked for auth detection
      if (toolName.includes("navigate") || toolName.includes("snapshot") || toolName.includes("observe")) {
        console.log(`[Auth Detection] Checking tool: ${toolName}`);
        console.log(`[Auth Detection] Content preview (first 300 chars): ${contentStr.substring(0, 300)}`);
      }

      const authProvider = detectAuthFromContent(contentStr);
      if (authProvider) {
        console.log(`[Auth Detection] DETECTED auth provider: ${authProvider} in tool: ${toolName}`);
        detectedAuth = authProvider;
      }
    }
  }

  return { authProvider: detectedAuth, sessionId: detectedSessionId };
}

/**
 * Extract session ID from stagehand session_create tool result
 */
function extractSessionIdFromToolResult(content: unknown): string | null {
  if (!content) {
    console.log(`[Session Extraction] Content is null/undefined`);
    return null;
  }

  // Content might be a string or an object
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);

  // Look for session ID patterns in the result
  // Pattern 1: "sessionId": "xxx" (JSON format)
  const jsonMatch = contentStr.match(/"sessionId"\s*:\s*"([^"]+)"/);
  if (jsonMatch?.[1]) {
    console.log(`[Session Extraction] Found via Pattern 1 (JSON sessionId)`);
    return jsonMatch[1];
  }

  // Pattern 2: session_id: xxx or sessionId: xxx (various formats)
  const idMatch = contentStr.match(/session[_-]?id[:\s]+["']?([a-zA-Z0-9_-]{20,})["']?/i);
  if (idMatch?.[1]) {
    console.log(`[Session Extraction] Found via Pattern 2 (session_id/sessionId)`);
    return idMatch[1];
  }

  // Pattern 3: Look for a long alphanumeric ID that looks like a session ID
  // Browserbase session IDs are typically 32+ character UUIDs or similar
  const uuidMatch = contentStr.match(/\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i);
  if (uuidMatch?.[1]) {
    console.log(`[Session Extraction] Found via Pattern 3 (UUID)`);
    return uuidMatch[1];
  }

  // Pattern 4: If content is an object, try to access common session ID properties
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;
    if (typeof obj.sessionId === "string") {
      console.log(`[Session Extraction] Found via Pattern 4 (object.sessionId)`);
      return obj.sessionId;
    }
    if (typeof obj.session_id === "string") {
      console.log(`[Session Extraction] Found via Pattern 4 (object.session_id)`);
      return obj.session_id;
    }
    if (typeof obj.id === "string" && obj.id.length > 20) {
      console.log(`[Session Extraction] Found via Pattern 4 (object.id)`);
      return obj.id;
    }
  }

  // Pattern 5: Look for "id" in nested objects (Stagehand might return { session: { id: "xxx" } })
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;
    if (obj.session && typeof obj.session === "object") {
      const session = obj.session as Record<string, unknown>;
      if (typeof session.id === "string") {
        console.log(`[Session Extraction] Found via Pattern 5 (object.session.id)`);
        return session.id;
      }
    }
  }

  console.log(`[Session Extraction] No patterns matched. Content preview: ${contentStr.substring(0, 200)}`);
  return null;
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

  let prompt = `You are an intelligent automation agent executing a workflow based on a screencast recording.

## Context
- Task Title: ${video.title}
- User Context: ${video.userContext ?? "None provided"}

## Video Analysis Summary
${truncatedAnalysis}

## Guidelines for Adaptive Execution
- Execute the semantic automation plan step by step
- **CRITICAL**: The UI may differ slightly from the original recording. You must ADAPT to what you actually see, not blindly follow coordinates.
- Use \`browser_snapshot\` to get the accessibility tree and find elements by their text content, labels, and roles - NOT by coordinates
- If an element described in the plan isn't found exactly, look for semantically similar elements (e.g., "Submit" button might be "Send" or "Continue")
- If a step fails, try the fallback approach if provided, or find an alternative way to achieve the expected result
- Verify each action succeeded by checking the expected_result before proceeding
- Be careful with destructive operations
- Log your progress clearly, noting any adaptations you made`;

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

## Browser Automation - Stagehand via Browserbase
You have access to Stagehand browser automation via Browserbase cloud.

**Tool Prefix: \`mcp__stagehand__browserbase_\`**

Stagehand uses AI to understand and interact with web pages using natural language descriptions.
The browser runs in Browserbase cloud, enabling Live View for the user to watch and intervene if needed.

**Available Stagehand tools:**
- \`mcp__stagehand__browserbase_session_create\`: Create or reuse a cloud browser session (call this FIRST)
- \`mcp__stagehand__browserbase_stagehand_navigate\`: Navigate to a URL
- \`mcp__stagehand__browserbase_stagehand_act\`: Perform actions using natural language (e.g., "click the Submit button", "fill in the email field with test@example.com")
- \`mcp__stagehand__browserbase_stagehand_extract\`: Extract data from the page using natural language
- \`mcp__stagehand__browserbase_stagehand_observe\`: Observe and find actionable elements on the page
- \`mcp__stagehand__browserbase_screenshot\`: Capture a PNG screenshot of the current page
- \`mcp__stagehand__browserbase_stagehand_get_url\`: Get the current URL
- \`mcp__stagehand__browserbase_session_close\`: Close the browser session when done

**Stagehand Workflow:**
1. Create Session: \`mcp__stagehand__browserbase_session_create\` to start a browser session
2. Navigate: \`mcp__stagehand__browserbase_stagehand_navigate\` with the URL
3. Act: \`mcp__stagehand__browserbase_stagehand_act\` with natural language like "click the login button" or "type 'hello' into the search box"
4. Observe: \`mcp__stagehand__browserbase_stagehand_observe\` to see what elements are available
5. Extract: \`mcp__stagehand__browserbase_stagehand_extract\` to get specific data

**IMPORTANT:** Always use the \`mcp__stagehand__browserbase_\` prefixed tools for browser automation.

**Target URL to navigate to**: ${browserUrls}

## Authentication Detection
If you encounter a login page during execution:
- Log: "AUTH_REQUIRED: [provider] login detected" (e.g., "AUTH_REQUIRED: Google login detected")
- PAUSE execution immediately - do NOT attempt to automate OAuth login flows
- Never try to type passwords or click through OAuth consent screens
- Wait for the user to complete authentication manually via the Live View

## Multi-Tab Handling
Stagehand handles tabs internally. If you need to interact with content in a new tab that was opened:
1. Use \`mcp__stagehand__browserbase_stagehand_observe\` to see the current page state
2. If needed, use \`mcp__stagehand__browserbase_stagehand_navigate\` to go to a specific URL

## Element Finding Strategies
If an action fails to find an element, try these approaches:
1. **Strategy 1**: Use more specific natural language (e.g., "click the blue Submit button at the bottom")
2. **Strategy 2**: Use \`mcp__stagehand__browserbase_stagehand_observe\` to see what's on the page, then adjust your action
3. **Strategy 3**: Try partial text matching in your action description
4. **Strategy 4**: Describe the element's position or context (e.g., "click the button below the email field")

## Progress Reporting (CRITICAL)
You MUST log progress after EVERY action to avoid the 3-minute timeout:
- Log what you're about to do BEFORE each action
- Log the result AFTER each action
- If waiting for something, log periodic status updates
- If stuck, log what you've tried and what's not working

## Success Validation (CRITICAL)
Before completing the task, you MUST:
- Verify EACH success criterion from the plan has been met
- Use \`mcp__stagehand__browserbase_stagehand_observe\` to confirm the end state
- Do NOT just output instructions for the user to follow manually
- If you cannot complete the automation, explain WHY and what failed`;
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

  // Format the plan in a more readable way for the agent
  const goalText = plan.goal ?? plan.task_description ?? video.title;
  const startingUrl = plan.starting_url ?? "";
  const successCriteria = plan.success_criteria?.join("\n- ") ?? "Task completed successfully";

  // Format steps semantically
  const stepsText = plan.steps?.map((step, i) => {
    const parts = [`### Step ${i + 1}: ${step.target ?? step.description ?? step.action}`];
    parts.push(`- **Action**: ${step.action}`);
    if (step.target) parts.push(`- **Target Element**: ${step.target}`);
    if (step.how_to_find) parts.push(`- **How to Find**: ${step.how_to_find}`);
    if (step.value || step.text) parts.push(`- **Value/Text**: ${step.value ?? step.text}`);
    if (step.expected_result) parts.push(`- **Expected Result**: ${step.expected_result}`);
    if (step.fallback) parts.push(`- **Fallback**: ${step.fallback}`);
    return parts.join("\n");
  }).join("\n\n") ?? "No specific steps provided - analyze the task and determine the steps yourself.";

  return `Execute the following SEMANTIC automation plan. You must find elements by their descriptions, NOT by coordinates.

## Goal: ${goalText}

## Task: ${video.title}
${credentialsSection}
${startingUrl ? `## Starting URL\n${startingUrl}\n` : ""}
## Steps to Execute

${stepsText}

## Success Criteria
- ${successCriteria}

---

## CRITICAL INSTRUCTIONS - USE STAGEHAND MCP BROWSER TOOLS

**DO NOT USE COORDINATES!** Use semantic element finding with Stagehand MCP tools.

### USE STAGEHAND TOOLS (mcp__stagehand__browserbase_*)
Stagehand runs in Browserbase cloud, enabling Live View for the user.

**Workflow:**
1. **Create Session**: \`mcp__stagehand__browserbase_session_create\` to start browser (REQUIRED FIRST)
2. **Navigate**: \`mcp__stagehand__browserbase_stagehand_navigate\` to the starting URL
3. **Act**: \`mcp__stagehand__browserbase_stagehand_act\` with natural language like "click the Submit button"
4. **Observe**: \`mcp__stagehand__browserbase_stagehand_observe\` to verify the action
5. **Repeat** for each step using natural language descriptions

**Example workflow:**
- Plan says: "Click Submit button"
- You call \`mcp__stagehand__browserbase_stagehand_act\` with action="click the Submit button"

**Example workflow for forms:**
- Plan says: "Type email in the email field"
- You call \`mcp__stagehand__browserbase_stagehand_act\` with action="fill in the email field with user@example.com"

### IF STAGEHAND TOOLS ARE NOT AVAILABLE:
Report this error: "ERROR: Stagehand MCP tools not available. Expected mcp__stagehand__browserbase_* tools."
List the tools you DO have access to for debugging.`;
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
