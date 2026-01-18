/**
 * MCP Server Configuration
 * Defines available MCP servers and provides dynamic server selection
 * based on task classification.
 */

import type { TaskClassification } from "./task-classifier.js";

// Type from Claude Agent SDK
interface McpStdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

type McpServerConfig = McpStdioServerConfig;

// Options for building Stagehand/Browserbase config with context
export interface StagehandContextOptions {
  contextId?: string;
  sessionId?: string;
}

/**
 * Detect if running in Docker/production environment
 */
const isDocker = process.env.DOCKER === "true" || process.platform === "linux";

/**
 * Available MCP server configurations
 */
export const MCP_SERVERS: Record<string, McpStdioServerConfig> = {
  // Default: Playwright headless - precise element-based browser automation
  playwright: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright", "--headless"],
    env: {
      // Use virtual display :99 (xvfb) in Docker, or native display locally
      DISPLAY: process.env.DISPLAY || (isDocker ? ":99" : ":0"),
      // Point to system chromium in Docker, let Playwright find it locally
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (isDocker ? "/usr/bin/chromium" : ""),
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "",
      // Chromium flags for headless containerized environments
      PLAYWRIGHT_CHROMIUM_ARGS: process.env.PLAYWRIGHT_CHROMIUM_ARGS ||
        "--disable-gpu --disable-dev-shm-usage --no-sandbox --disable-setuid-sandbox",
    },
  },

  // Playwright headed mode - for OAuth flows where user interaction is needed
  "playwright-headed": {
    type: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright"], // No --headless flag
    env: {
      DISPLAY: process.env.DISPLAY || ":0",
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (isDocker ? "/usr/bin/chromium" : ""),
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "",
    },
  },

  // Alternative: Stagehand - AI-powered natural language browser automation via Browserbase
  // Note: Use buildStagehandConfig() for sessions with context persistence
  stagehand: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@browserbasehq/mcp-server-browserbase"],
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY ?? "",
      BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID ?? "",
    },
  },
};

/**
 * Build a Stagehand MCP server config with optional context persistence.
 * When contextId is provided, the session will use/persist cookies from that context.
 */
export function buildStagehandConfig(options?: StagehandContextOptions): McpStdioServerConfig {
  const args = ["-y", "@browserbasehq/mcp-server-browserbase"];

  // Add context options if provided
  if (options?.contextId) {
    args.push("--contextId", options.contextId);
    args.push("--persist", "true");
  }

  // Add session ID if connecting to existing session
  if (options?.sessionId) {
    args.push("--sessionId", options.sessionId);
  }

  return {
    type: "stdio",
    command: "npx",
    args,
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY ?? "",
      BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID ?? "",
    },
  };
}

/**
 * Get the preferred browser MCP server name from environment
 */
export function getBrowserMcpServer(): string {
  const server = process.env.BROWSER_MCP ?? "playwright";
  // Validate it exists in our registry
  if (server in MCP_SERVERS) {
    return server;
  }
  console.warn(`Unknown BROWSER_MCP: ${server}, falling back to playwright`);
  return "playwright";
}

/**
 * Build MCP servers config for a task based on its classification
 * @param classification - Task classification from classifier
 * @param stagehandOptions - Optional context/session options for Stagehand
 */
export function getMcpServersForTask(
  classification: TaskClassification,
  stagehandOptions?: StagehandContextOptions
): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  for (const serverName of classification.suggestedMcpServers) {
    // Special handling for stagehand with context options
    if (serverName === "stagehand" && stagehandOptions) {
      servers[serverName] = buildStagehandConfig(stagehandOptions);
    } else {
      const config = MCP_SERVERS[serverName];
      if (config) {
        servers[serverName] = config;
      } else {
        console.warn(`Unknown MCP server requested: ${serverName}`);
      }
    }
  }

  return servers;
}

/**
 * Get human-readable description of MCP servers for logging
 */
export function formatMcpServers(
  servers: Record<string, McpServerConfig>
): string {
  const names = Object.keys(servers);
  if (names.length === 0) {
    return "none";
  }
  return names.join(", ");
}
