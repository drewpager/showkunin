#!/usr/bin/env node
/**
 * MCP Server for Code Sandbox
 * Exposes sandbox execution tools via Model Context Protocol.
 *
 * Tools provided:
 * - sandbox_execute_code: Execute code in an isolated container
 * - sandbox_list_templates: List available code templates
 * - sandbox_get_result: Get execution result by ID
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { getSandboxManager } from "./sandbox-manager";
import { getCodeExecutor } from "./code-executor";
import type { SandboxRuntime, CodeExecutionResult, ExecutionCredentials } from "./types";

// Store execution results for retrieval
const executionResults = new Map<string, CodeExecutionResult>();

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "sandbox_execute_code",
    description: `Execute code in an isolated Docker container with Google API access.

Supports three runtimes:
- node: Node.js with googleapis SDK (recommended for Sheets/Drive)
- python: Python with google-api-python-client
- clasp: Google Apps Script via clasp CLI (requires OAuth)

The code runs in a secure sandbox with:
- 60 second timeout
- 512MB memory limit
- 0.5 CPU cores
- Network restricted to *.googleapis.com
- Non-root execution

Returns stdout, stderr, exit code, and execution duration.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        template: {
          type: "string",
          description: "Template name (e.g., 'google-sheets-node', 'google-sheets-python', 'apps-script', 'generic-node')",
        },
        code: {
          type: "string",
          description: "The code to execute (will be inserted into the template)",
        },
        runtime: {
          type: "string",
          enum: ["node", "python", "clasp"],
          description: "Runtime to use if not using a template",
        },
        timeout_seconds: {
          type: "number",
          description: "Execution timeout in seconds (default: 60, max: 300)",
        },
        env: {
          type: "object",
          description: "Additional environment variables (credentials are auto-injected)",
          additionalProperties: { type: "string" },
        },
      },
      required: ["code"],
    },
  },
  {
    name: "sandbox_list_templates",
    description: "List available code execution templates with their descriptions and required credentials.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "sandbox_get_result",
    description: "Get the result of a previous code execution by its execution ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        execution_id: {
          type: "string",
          description: "The execution ID returned from sandbox_execute_code",
        },
      },
      required: ["execution_id"],
    },
  },
  {
    name: "sandbox_check_availability",
    description: "Check if the Docker sandbox is available and which runtimes are ready.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

/**
 * Generate a unique execution ID
 */
function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build credentials from environment variables
 */
function buildCredentials(additionalEnv?: Record<string, string>): ExecutionCredentials {
  return {
    googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    googleOAuthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    additional: additionalEnv,
  };
}

/**
 * Handle sandbox_execute_code tool call
 */
async function handleExecuteCode(args: {
  template?: string;
  code: string;
  runtime?: SandboxRuntime;
  timeout_seconds?: number;
  env?: Record<string, string>;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const executor = getCodeExecutor();
  const executionId = generateExecutionId();
  const agentRunId = process.env.AGENT_RUN_ID ?? "unknown";
  const credentials = buildCredentials(args.env);

  // Validate timeout
  const timeoutSeconds = Math.min(args.timeout_seconds ?? 60, 300);

  let result: CodeExecutionResult;

  try {
    if (args.template) {
      // Use template-based execution
      result = await executor.execute(
        executionId,
        agentRunId,
        args.template,
        args.code,
        credentials,
        { timeoutSeconds }
      );
    } else if (args.runtime) {
      // Use raw execution with specified runtime
      result = await executor.executeRaw(
        executionId,
        agentRunId,
        args.runtime,
        args.code,
        credentials,
        { timeoutSeconds }
      );
    } else {
      // Try to suggest a template based on code content
      const suggestedTemplate = executor.suggestTemplate(args.code);
      if (suggestedTemplate) {
        result = await executor.execute(
          executionId,
          agentRunId,
          suggestedTemplate,
          args.code,
          credentials,
          { timeoutSeconds }
        );
      } else {
        // Default to generic Node.js
        result = await executor.execute(
          executionId,
          agentRunId,
          "generic-node",
          args.code,
          credentials,
          { timeoutSeconds }
        );
      }
    }

    // Store result for later retrieval
    executionResults.set(executionId, result);

    // Format response
    const statusEmoji = result.status === "completed" ? "SUCCESS" :
                        result.status === "timeout" ? "TIMEOUT" : "FAILED";

    let responseText = `Execution ${statusEmoji}\n`;
    responseText += `ID: ${executionId}\n`;
    responseText += `Status: ${result.status}\n`;
    responseText += `Exit Code: ${result.exitCode}\n`;
    responseText += `Duration: ${result.durationMs}ms\n\n`;

    if (result.stdout) {
      responseText += `=== STDOUT ===\n${result.stdout}\n\n`;
    }

    if (result.stderr) {
      responseText += `=== STDERR ===\n${result.stderr}\n\n`;
    }

    if (result.error) {
      responseText += `=== ERROR ===\n${result.error}\n`;
    }

    return {
      content: [{ type: "text", text: responseText }],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Execution FAILED\nError: ${errorMsg}`,
      }],
    };
  }
}

/**
 * Handle sandbox_list_templates tool call
 */
async function handleListTemplates(): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const executor = getCodeExecutor();
  const templates = executor.listTemplates();

  let text = "Available Code Execution Templates:\n\n";

  for (const template of templates) {
    text += `## ${template.displayName}\n`;
    text += `Name: ${template.name}\n`;
    text += `Runtime: ${template.runtime}\n`;
    text += `Description: ${template.description}\n`;
    text += `Required Credentials: ${template.requiredEnv.length > 0 ? template.requiredEnv.join(", ") : "None"}\n\n`;
  }

  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Handle sandbox_get_result tool call
 */
async function handleGetResult(args: {
  execution_id: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = executionResults.get(args.execution_id);

  if (!result) {
    return {
      content: [{
        type: "text",
        text: `Execution not found: ${args.execution_id}\n\nNote: Results are only available for executions performed in this session.`,
      }],
    };
  }

  let text = `Execution Result: ${args.execution_id}\n\n`;
  text += `Status: ${result.status}\n`;
  text += `Exit Code: ${result.exitCode}\n`;
  text += `Duration: ${result.durationMs}ms\n`;

  if (result.containerId) {
    text += `Container: ${result.containerId.substring(0, 12)}\n`;
  }

  text += "\n";

  if (result.stdout) {
    text += `=== STDOUT ===\n${result.stdout}\n\n`;
  }

  if (result.stderr) {
    text += `=== STDERR ===\n${result.stderr}\n\n`;
  }

  if (result.error) {
    text += `=== ERROR ===\n${result.error}\n`;
  }

  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Handle sandbox_check_availability tool call
 */
async function handleCheckAvailability(): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const sandboxManager = getSandboxManager();

  const dockerAvailable = await sandboxManager.isAvailable();
  if (!dockerAvailable) {
    return {
      content: [{
        type: "text",
        text: "Docker Sandbox: UNAVAILABLE\n\nDocker is not available. Code execution is disabled.",
      }],
    };
  }

  const runtimes = await sandboxManager.listAvailableRuntimes();

  let text = "Docker Sandbox: AVAILABLE\n\n";
  text += "Runtime Images:\n";

  for (const { runtime, available } of runtimes) {
    const status = available ? "Ready" : "Not installed (will be pulled on first use)";
    text += `- ${runtime}: ${status}\n`;
  }

  text += "\nCredentials Available:\n";
  text += `- GOOGLE_SERVICE_ACCOUNT_KEY: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? "Yes" : "No"}\n`;
  text += `- GOOGLE_OAUTH_REFRESH_TOKEN: ${process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? "Yes" : "No"}\n`;

  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Main server setup and run
 */
async function main() {
  const server = new Server(
    {
      name: "code-sandbox",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "sandbox_execute_code":
        return handleExecuteCode(args as Parameters<typeof handleExecuteCode>[0]);

      case "sandbox_list_templates":
        return handleListTemplates();

      case "sandbox_get_result":
        return handleGetResult(args as Parameters<typeof handleGetResult>[0]);

      case "sandbox_check_availability":
        return handleCheckAvailability();

      default:
        return {
          content: [{
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          }],
          isError: true,
        };
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Code Sandbox MCP] Server started");
}

// Run if executed directly
main().catch((error) => {
  console.error("[Code Sandbox MCP] Fatal error:", error);
  process.exit(1);
});
