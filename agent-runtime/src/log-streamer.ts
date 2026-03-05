import { type PrismaClient } from "@prisma/client";

type LogLevel = "info" | "error" | "debug";
type ActionType = "tool_call" | "tool_result" | "text" | "system" | "step";

interface StructuredLogOptions {
  actionType?: ActionType;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  stepNumber?: number;
}

/**
 * Stream a log message to the database for real-time UI updates
 */
export async function streamLog(
  prisma: PrismaClient,
  agentRunId: string,
  level: LogLevel,
  message: string,
  options?: StructuredLogOptions
): Promise<void> {
  // Truncate large outputs to prevent DB bloat
  let toolOutputStr: string | undefined;
  if (options?.toolOutput !== undefined) {
    const outputJson = JSON.stringify(options.toolOutput);
    toolOutputStr = outputJson.length > 5000
      ? outputJson.slice(0, 5000) + "...[truncated]"
      : outputJson;
  }

  await prisma.agentLog.create({
    data: {
      agentRunId,
      level,
      message,
      timestamp: new Date(),
      actionType: options?.actionType,
      toolName: options?.toolName,
      toolInput: options?.toolInput ? JSON.stringify(options.toolInput) : undefined,
      toolOutput: toolOutputStr,
      stepNumber: options?.stepNumber,
    },
  });

  // Also log to console for debugging
  const prefix = level.toUpperCase().padEnd(5);
  const shortId = agentRunId.slice(0, 8);
  const toolInfo = options?.toolName ? ` [${options.toolName}]` : "";
  console.log(`[${prefix}] [${shortId}]${toolInfo} ${message}`);
}

/**
 * Log a tool call (when the agent invokes a tool)
 */
export async function streamToolCall(
  prisma: PrismaClient,
  agentRunId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  stepNumber?: number
): Promise<void> {
  // Create a human-readable summary
  let summary = `Calling ${toolName}`;
  if (toolName === "Bash" && toolInput.command) {
    const cmd = String(toolInput.command);
    summary = `Running command: ${cmd.slice(0, 100)}${cmd.length > 100 ? "..." : ""}`;
  } else if (toolName === "Edit" && toolInput.file_path) {
    summary = `Editing file: ${toolInput.file_path}`;
  } else if (toolName === "Read" && toolInput.file_path) {
    summary = `Reading file: ${toolInput.file_path}`;
  } else if (toolName === "Write" && toolInput.file_path) {
    summary = `Writing file: ${toolInput.file_path}`;
  } else if (toolName === "Glob" && toolInput.pattern) {
    summary = `Searching for files: ${toolInput.pattern}`;
  } else if (toolName === "Grep" && toolInput.pattern) {
    summary = `Searching in files for: ${toolInput.pattern}`;
  }

  await streamLog(prisma, agentRunId, "info", summary, {
    actionType: "tool_call",
    toolName,
    toolInput,
    stepNumber,
  });
}

/**
 * Log a tool result (after a tool completes)
 */
export async function streamToolResult(
  prisma: PrismaClient,
  agentRunId: string,
  toolName: string,
  toolOutput: unknown,
  success: boolean = true
): Promise<void> {
  const summary = success
    ? `${toolName} completed successfully`
    : `${toolName} failed`;

  await streamLog(prisma, agentRunId, success ? "info" : "error", summary, {
    actionType: "tool_result",
    toolName,
    toolOutput,
  });
}
