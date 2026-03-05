/**
 * Sandbox Manager
 * Manages Docker container lifecycle for isolated code execution.
 * Uses Dockerode for container operations with security constraints.
 */

import Docker from "dockerode";
import { Readable, Writable } from "stream";
import {
  type SandboxConfig,
  type SandboxRuntime,
  type CodeExecutionRequest,
  type CodeExecutionResult,
  type ContainerEvent,
  DEFAULT_SANDBOX_CONFIG,
  CONTAINER_SECURITY,
} from "./types";

// Docker image names for each runtime
const RUNTIME_IMAGES: Record<SandboxRuntime, string> = {
  node: "showkunin/sandbox-node:latest",
  python: "showkunin/sandbox-python:latest",
  clasp: "showkunin/sandbox-clasp:latest",
};

// Default entry points for each runtime
const DEFAULT_ENTRY_POINTS: Record<SandboxRuntime, string> = {
  node: "index.js",
  python: "main.py",
  clasp: "Code.gs",
};

/**
 * Docker sandbox manager for isolated code execution
 */
export class SandboxManager {
  private docker: Docker;
  private events: ContainerEvent[] = [];

  constructor(socketPath?: string) {
    this.docker = new Docker({
      socketPath: socketPath ?? process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
    });
  }

  /**
   * Log a container event
   */
  private logEvent(
    event: ContainerEvent["event"],
    containerId?: string,
    message?: string
  ): void {
    const containerEvent: ContainerEvent = {
      timestamp: new Date(),
      event,
      containerId,
      message,
    };
    this.events.push(containerEvent);
    console.log(
      `[Sandbox] ${event.toUpperCase()}${containerId ? ` (${containerId.substring(0, 12)})` : ""}: ${message ?? ""}`
    );
  }

  /**
   * Check if Docker is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure the runtime image is available, pull if needed
   */
  async ensureImage(runtime: SandboxRuntime): Promise<void> {
    const imageName = RUNTIME_IMAGES[runtime];

    try {
      await this.docker.getImage(imageName).inspect();
      console.log(`[Sandbox] Image ${imageName} already available`);
    } catch {
      console.log(`[Sandbox] Pulling image ${imageName}...`);
      const stream = await this.docker.pull(imageName);
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`[Sandbox] Image ${imageName} pulled successfully`);
    }
  }

  /**
   * Create and run code in an isolated container
   */
  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    const {
      executionId,
      runtime,
      code,
      entryPoint = DEFAULT_ENTRY_POINTS[runtime],
      env = {},
      timeoutSeconds = DEFAULT_SANDBOX_CONFIG.timeoutSeconds,
      additionalFiles = {},
    } = request;

    let container: Docker.Container | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let timedOut = false;

    try {
      // Ensure image is available
      await this.ensureImage(runtime);

      // Prepare files to mount
      const files: Record<string, string> = {
        [entryPoint]: code,
        ...additionalFiles,
      };

      // Create container with security constraints
      const config = this.buildContainerConfig(runtime, files, env, entryPoint);
      container = await this.docker.createContainer(config);
      this.logEvent("created", container.id, `Runtime: ${runtime}`);

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new Error(`Execution timeout after ${timeoutSeconds} seconds`));
        }, timeoutSeconds * 1000);
      });

      // Start container and capture output
      const executionPromise = this.runContainer(container, files);

      // Race between execution and timeout
      const { stdout, stderr, exitCode } = await Promise.race([
        executionPromise,
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      this.logEvent("completed", container.id, `Exit code: ${exitCode}, Duration: ${durationMs}ms`);

      return {
        executionId,
        status: exitCode === 0 ? "completed" : "failed",
        stdout,
        stderr,
        exitCode,
        durationMs,
        containerId: container.id,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (timeoutId) clearTimeout(timeoutId);

      this.logEvent(
        timedOut ? "timeout" : "error",
        container?.id,
        errorMsg
      );

      // Kill container if it's still running
      if (container) {
        try {
          await container.kill();
        } catch {
          // Container may already be stopped
        }
      }

      return {
        executionId,
        status: timedOut ? "timeout" : "failed",
        stdout: "",
        stderr: errorMsg,
        exitCode: timedOut ? 124 : 1,
        durationMs,
        containerId: container?.id,
        error: errorMsg,
      };
    } finally {
      // Clean up container
      if (container) {
        try {
          await container.remove({ force: true });
          this.logEvent("destroyed", container.id);
        } catch {
          // Container may already be removed
        }
      }
    }
  }

  /**
   * Build Docker container configuration with security constraints
   */
  private buildContainerConfig(
    runtime: SandboxRuntime,
    files: Record<string, string>,
    env: Record<string, string>,
    entryPoint: string
  ): Docker.ContainerCreateOptions {
    const imageName = RUNTIME_IMAGES[runtime];

    // Build environment variables array
    const envArray = Object.entries(env).map(([key, value]) => `${key}=${value}`);

    // Build command based on runtime
    const cmd = this.getRunCommand(runtime, entryPoint);

    // Convert files to base64 for injection via environment
    // This avoids volume mounts and keeps everything ephemeral
    const filesBase64 = Buffer.from(JSON.stringify(files)).toString("base64");
    envArray.push(`SANDBOX_FILES_B64=${filesBase64}`);
    envArray.push(`SANDBOX_ENTRY=${entryPoint}`);

    return {
      Image: imageName,
      Cmd: cmd,
      Env: envArray,
      User: CONTAINER_SECURITY.user,
      WorkingDir: DEFAULT_SANDBOX_CONFIG.workDir,
      NetworkDisabled: false, // We'll use network rules instead
      HostConfig: {
        // Resource limits
        NanoCpus: DEFAULT_SANDBOX_CONFIG.cpuLimit * 1e9,
        Memory: DEFAULT_SANDBOX_CONFIG.memoryLimitMb * 1024 * 1024,
        MemorySwap: DEFAULT_SANDBOX_CONFIG.memoryLimitMb * 1024 * 1024, // No swap
        PidsLimit: 50, // Limit number of processes

        // Security constraints
        CapDrop: CONTAINER_SECURITY.capDrop,
        SecurityOpt: CONTAINER_SECURITY.securityOpt,
        ReadonlyRootfs: CONTAINER_SECURITY.readOnlyRootfs,

        // Tmpfs for writable directories (uid/gid must match container user)
        Tmpfs: {
          "/tmp": "rw,noexec,nosuid,size=64m,uid=1000,gid=1000",
          "/app/output": "rw,noexec,nosuid,size=64m,uid=1000,gid=1000",
          "/app/code": "rw,noexec,nosuid,size=16m,uid=1000,gid=1000",
        },

        // No privileged mode
        Privileged: false,

        // Auto-remove when done (backup - we also manually remove)
        AutoRemove: true,
      },
    };
  }

  /**
   * Get the run command for a specific runtime
   */
  private getRunCommand(runtime: SandboxRuntime, entryPoint: string): string[] {
    switch (runtime) {
      case "node":
        return ["/bin/sh", "-c", `cd /app/code && echo "$SANDBOX_FILES_B64" | base64 -d | node -e "const fs=require('fs');const files=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));for(const[f,c]of Object.entries(files))fs.writeFileSync(f,c);" && node ${entryPoint}`];
      case "python":
        return ["/bin/sh", "-c", `cd /app/code && echo "$SANDBOX_FILES_B64" | base64 -d > /tmp/files.json && python3 -c "import json;import os;files=json.load(open('/tmp/files.json'));[open(f,'w').write(c) for f,c in files.items()]" && python3 ${entryPoint}`];
      case "clasp":
        return ["/bin/sh", "-c", `cd /app/code && echo "$SANDBOX_FILES_B64" | base64 -d > /tmp/files.json && node -e "const fs=require('fs');const files=JSON.parse(fs.readFileSync('/tmp/files.json','utf8'));for(const[f,c]of Object.entries(files))fs.writeFileSync(f,c);" && clasp push && clasp run executeTask`];
      default:
        throw new Error(`Unknown runtime: ${runtime}`);
    }
  }

  /**
   * Run a container and capture its output
   */
  private async runContainer(
    container: Docker.Container,
    files: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Start the container
    await container.start();
    this.logEvent("started", container.id);

    // Attach to capture output
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    // Collect output
    let stdout = "";
    let stderr = "";

    const stdoutStream = new Writable({
      write(chunk, encoding, callback) {
        stdout += chunk.toString();
        callback();
      },
    });

    const stderrStream = new Writable({
      write(chunk, encoding, callback) {
        stderr += chunk.toString();
        callback();
      },
    });

    // Demux stdout/stderr from the multiplexed stream
    this.docker.modem.demuxStream(stream, stdoutStream, stderrStream);

    // Wait for container to finish
    const waitResult = await container.wait();
    this.logEvent("stopped", container.id, `Exit code: ${waitResult.StatusCode}`);

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: waitResult.StatusCode,
    };
  }

  /**
   * List available runtime images
   */
  async listAvailableRuntimes(): Promise<{ runtime: SandboxRuntime; available: boolean }[]> {
    const results: { runtime: SandboxRuntime; available: boolean }[] = [];

    for (const [runtime, imageName] of Object.entries(RUNTIME_IMAGES)) {
      try {
        await this.docker.getImage(imageName).inspect();
        results.push({ runtime: runtime as SandboxRuntime, available: true });
      } catch {
        results.push({ runtime: runtime as SandboxRuntime, available: false });
      }
    }

    return results;
  }

  /**
   * Build a sandbox image for a specific runtime
   */
  async buildImage(runtime: SandboxRuntime, dockerfilePath: string): Promise<void> {
    const imageName = RUNTIME_IMAGES[runtime];
    console.log(`[Sandbox] Building image ${imageName} from ${dockerfilePath}`);

    const stream = await this.docker.buildImage(
      {
        context: dockerfilePath,
        src: ["Dockerfile"],
      },
      { t: imageName }
    );

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
        (event: { stream?: string }) => {
          if (event.stream) {
            process.stdout.write(event.stream);
          }
        }
      );
    });

    console.log(`[Sandbox] Image ${imageName} built successfully`);
  }

  /**
   * Get recent container events
   */
  getEvents(): ContainerEvent[] {
    return [...this.events];
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = [];
  }
}

// Singleton instance
let sandboxManagerInstance: SandboxManager | undefined;

/**
 * Get the sandbox manager instance
 */
export function getSandboxManager(): SandboxManager {
  if (!sandboxManagerInstance) {
    sandboxManagerInstance = new SandboxManager();
  }
  return sandboxManagerInstance;
}
