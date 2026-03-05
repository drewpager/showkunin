/**
 * Type definitions for the Docker Code Execution Sandbox
 */

/**
 * Supported runtime environments for code execution
 */
export type SandboxRuntime = "node" | "python" | "clasp";

/**
 * Status of a code execution
 */
export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "timeout";

/**
 * Configuration for creating a sandbox container
 */
export interface SandboxConfig {
  /** Runtime environment */
  runtime: SandboxRuntime;
  /** CPU limit (default: 0.5 cores) */
  cpuLimit?: number;
  /** Memory limit in MB (default: 512) */
  memoryLimitMb?: number;
  /** Execution timeout in seconds (default: 60) */
  timeoutSeconds?: number;
  /** Network allowlist patterns (default: ["*.googleapis.com"]) */
  networkAllowlist?: string[];
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Working directory inside container */
  workDir?: string;
}

/**
 * Request to execute code in a sandbox
 */
export interface CodeExecutionRequest {
  /** Unique execution ID */
  executionId: string;
  /** Associated agent run ID */
  agentRunId: string;
  /** Runtime to use */
  runtime: SandboxRuntime;
  /** Generated code to execute */
  code: string;
  /** Optional entry point file name (default based on runtime) */
  entryPoint?: string;
  /** Environment variables (credentials, config) */
  env?: Record<string, string>;
  /** Execution timeout in seconds */
  timeoutSeconds?: number;
  /** Additional files to include (filename -> content) */
  additionalFiles?: Record<string, string>;
}

/**
 * Result from code execution
 */
export interface CodeExecutionResult {
  /** Execution ID */
  executionId: string;
  /** Final status */
  status: ExecutionStatus;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number | null;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Container ID used */
  containerId?: string;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Template for code generation
 */
export interface CodeTemplate {
  /** Runtime this template is for */
  runtime: SandboxRuntime;
  /** Template name */
  name: string;
  /** Description of what this template does */
  description: string;
  /** Base code template with placeholders */
  template: string;
  /** Required environment variables */
  requiredEnv: string[];
  /** Default entry point file */
  entryPoint: string;
  /** Package dependencies */
  dependencies?: string[];
}

/**
 * Credentials needed for different execution types
 */
export interface ExecutionCredentials {
  /** Google Service Account key JSON for direct API calls */
  googleServiceAccountKey?: string;
  /** Google OAuth refresh token for Apps Script */
  googleOAuthRefreshToken?: string;
  /** Additional credentials as key-value pairs */
  additional?: Record<string, string>;
}

/**
 * Container lifecycle events for logging
 */
export interface ContainerEvent {
  timestamp: Date;
  event: "created" | "started" | "stopped" | "destroyed" | "timeout" | "error" | "completed";
  containerId?: string;
  message?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_SANDBOX_CONFIG: Required<Omit<SandboxConfig, "runtime" | "env">> = {
  cpuLimit: 0.5,
  memoryLimitMb: 512,
  timeoutSeconds: 60,
  networkAllowlist: ["*.googleapis.com"],
  workDir: "/app",
};

/**
 * Security settings applied to all containers
 */
export const CONTAINER_SECURITY = {
  /** Run as non-root user */
  user: "1000:1000",
  /** Drop all capabilities */
  capDrop: ["ALL"],
  /** Prevent privilege escalation */
  securityOpt: ["no-new-privileges"],
  /** Read-only root filesystem */
  readOnlyRootfs: true,
  /** Tmpfs mounts for writable areas */
  tmpfsMounts: ["/tmp", "/app/output"],
};
