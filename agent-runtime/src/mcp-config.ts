/**
 * MCP Server Configuration
 * Defines available MCP servers and provides dynamic server selection
 * based on task classification.
 */

import type { TaskClassification } from "./task-classifier";

// Type from Claude Agent SDK
interface McpStdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

type McpServerConfig = McpStdioServerConfig;

// Options for building Stagehand/Browserbase config with context persistence
export interface StagehandContextOptions {
  // Browserbase context ID for cookie/auth persistence across sessions
  contextId?: string;
}

// Options for building Google Sheets MCP config
export interface GsheetsOptions {
  // Google service account key JSON string
  serviceAccountKey?: string;
}

// Options for building Code Sandbox MCP config
export interface CodeSandboxOptions {
  // Google service account key JSON string for API access
  googleServiceAccountKey?: string;
  // Google OAuth refresh token for Apps Script
  googleOAuthRefreshToken?: string;
  // Current agent run ID for tracking
  agentRunId?: string;
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
  // Uses official Microsoft @playwright/mcp package
  playwright: {
    type: "stdio",
    command: "npx",
    args: ["-y", "--headless","@playwright/mcp@latest"],
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
    args: ["-y", "@playwright/mcp@latest", "--browser", "chrome"], // Headed mode with Chrome
    env: {
      DISPLAY: process.env.DISPLAY || ":0",
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (isDocker ? "/usr/bin/chromium" : ""),
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "",
    },
  },

  // Google Sheets API via service account - bypasses browser login entirely
  // Note: Use buildGsheetsConfig() with dynamic service account key
  gsheets: {
    type: "stdio",
    command: "npx",
    args: ["-y", "mcp-gsheets@latest"],
    env: {
      GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "",
    },
  },

  // Alternative: Stagehand - AI-powered natural language browser automation via Browserbase
  // Note: Use buildStagehandConfig() for sessions with context persistence
  stagehand: {
    type: "stdio",
    command: "npx",
    args: [
      "-y",
      "@browserbasehq/mcp-server-browserbase",
      "--browserbaseApiKey", process.env.BROWSERBASE_API_KEY ?? "",
      "--browserbaseProjectId", process.env.BROWSERBASE_PROJECT_ID ?? "",
      "--modelName", "anthropic/claude-sonnet-4-20250514",
      "--modelApiKey", process.env.ANTHROPIC_API_KEY ?? "",
    ],
  },

  // Code Sandbox - isolated Docker container execution for generated code
  // Note: Use buildCodeSandboxConfig() to inject credentials
  "code-sandbox": {
    type: "stdio",
    command: "node",
    args: ["./sandbox/mcp-server.js"],
    env: {
      DOCKER_SOCKET: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
    },
  },
};

/**
 * Build a Stagehand MCP server config with optional context persistence.
 * When contextId is provided, the session will use/persist cookies from that context.
 */
export function buildStagehandConfig(options?: StagehandContextOptions): McpStdioServerConfig {
  const args = [
    "-y",
    "@browserbasehq/mcp-server-browserbase",
    "--browserbaseApiKey", process.env.BROWSERBASE_API_KEY ?? "",
    "--browserbaseProjectId", process.env.BROWSERBASE_PROJECT_ID ?? "",
    "--modelName", "anthropic/claude-sonnet-4-20250514",
    "--modelApiKey", process.env.ANTHROPIC_API_KEY ?? "",
    "--keepAlive", // Keep session alive during pauses/inactivity
  ];

  // Add context options if provided
  // contextId enables cookie/auth persistence across sessions
  // persist: true saves cookies back to the context when session ends
  if (options?.contextId) {
    args.push("--contextId", options.contextId);
    args.push("--persist", "true");
  }

  // NOTE: The MCP server creates and manages its own Browserbase session internally
  // when the agent calls session_create. We detect that session ID from the tool
  // result in agent-executor.ts and use it to get the Live View URL.

  return {
    type: "stdio",
    command: "npx",
    args,
  };
}

/**
 * Build a Google Sheets MCP server config with the service account key.
 * When serviceAccountKey is provided, it's passed as an env var to the MCP process.
 */
export function buildGsheetsConfig(options?: GsheetsOptions): McpStdioServerConfig {
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", "mcp-gsheets@latest"],
    env: {
      GOOGLE_SERVICE_ACCOUNT_KEY: options?.serviceAccountKey ?? process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "",
    },
  };
}

/**
 * Build a Code Sandbox MCP server config with credentials.
 * Credentials are passed as environment variables to the MCP server process.
 */
export function buildCodeSandboxConfig(options?: CodeSandboxOptions): McpStdioServerConfig {
  const env: Record<string, string> = {
    DOCKER_SOCKET: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
  };

  // Inject Google credentials if provided
  if (options?.googleServiceAccountKey) {
    env.GOOGLE_SERVICE_ACCOUNT_KEY = options.googleServiceAccountKey;
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    env.GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  }

  if (options?.googleOAuthRefreshToken) {
    env.GOOGLE_OAUTH_REFRESH_TOKEN = options.googleOAuthRefreshToken;
  } else if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    env.GOOGLE_OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }

  // Pass agent run ID for tracking executions
  if (options?.agentRunId) {
    env.AGENT_RUN_ID = options.agentRunId;
  }

  return {
    type: "stdio",
    command: "node",
    args: ["./sandbox/mcp-server.js"],
    env,
  };
}

/**
 * Get the preferred browser MCP server name from environment
 */
export function getBrowserMcpServer(): string {
  const server = process.env.BROWSER_MCP ?? "stagehand";
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
 * @param gsheetsOptions - Optional service account key for Google Sheets API
 * @param codeSandboxOptions - Optional credentials for code sandbox
 */
export function getMcpServersForTask(
  classification: TaskClassification,
  stagehandOptions?: StagehandContextOptions,
  gsheetsOptions?: GsheetsOptions,
  codeSandboxOptions?: CodeSandboxOptions
): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  for (const serverName of classification.suggestedMcpServers) {
    // Special handling for stagehand with context options
    if (serverName === "stagehand" && stagehandOptions) {
      servers[serverName] = buildStagehandConfig(stagehandOptions);
    } else if (serverName === "gsheets" && gsheetsOptions) {
      servers[serverName] = buildGsheetsConfig(gsheetsOptions);
    } else if (serverName === "code-sandbox" && codeSandboxOptions) {
      servers[serverName] = buildCodeSandboxConfig(codeSandboxOptions);
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
