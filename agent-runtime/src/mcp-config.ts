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
      DISPLAY: process.env.DISPLAY ?? "",
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "",
    },
  },

  // Playwright headed mode - for OAuth flows where user interaction is needed
  "playwright-headed": {
    type: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright"], // No --headless flag
    env: {
      DISPLAY: process.env.DISPLAY ?? ":0",
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "",
    },
  },

  // Alternative: Stagehand - AI-powered natural language browser automation
  stagehand: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@browserbase/mcp-server-browserbase"],
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY ?? "",
      BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID ?? "",
    },
  },
};

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
 */
export function getMcpServersForTask(
  classification: TaskClassification
): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  for (const serverName of classification.suggestedMcpServers) {
    const config = MCP_SERVERS[serverName];
    if (config) {
      servers[serverName] = config;
    } else {
      console.warn(`Unknown MCP server requested: ${serverName}`);
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
