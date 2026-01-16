import { type PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, rm, readdir } from "fs/promises";
import { pipeline } from "stream/promises";
import * as tar from "tar";
import { join } from "path";
import { streamLog } from "./log-streamer.js";

// Use environment variable for workspace path, with fallback for local development
const WORKSPACE_BASE = process.env.WORKSPACE_BASE ?? (
  process.platform === "darwin" || process.platform === "win32"
    ? join(process.cwd(), "workspace")  // Local dev: use ./workspace
    : "/app/workspace"                   // Docker: use /app/workspace
);

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: process.env.AWS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      }
    : undefined,
});

const S3_BUCKET = process.env.S3_BUCKET ?? "showkunin-checkpoints";

/**
 * Create a checkpoint of the current workspace state
 */
export async function createCheckpoint(
  prisma: PrismaClient,
  runId: string,
  description?: string
): Promise<string> {
  const workspacePath = join(WORKSPACE_BASE, runId);
  const checkpointId = `checkpoint-${Date.now()}`;
  const s3Key = `checkpoints/${runId}/${checkpointId}.tar.gz`;
  const tempFile = `/tmp/${checkpointId}.tar.gz`;

  await streamLog(prisma, runId, "info", `Creating checkpoint: ${description ?? "Auto checkpoint"}`);

  try {
    // Create tar.gz of workspace
    await createTarGz(workspacePath, tempFile);

    // Upload to S3
    await uploadToS3(tempFile, s3Key);

    // Record checkpoint in database
    const checkpoint = await prisma.agentCheckpoint.create({
      data: {
        agentRunId: runId,
        s3Key,
        description: description ?? "Auto checkpoint",
      },
    });

    await streamLog(prisma, runId, "info", `Checkpoint created: ${checkpoint.id}`);

    // Clean up temp file
    await rm(tempFile, { force: true });

    return checkpoint.id;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await streamLog(prisma, runId, "error", `Failed to create checkpoint: ${errorMsg}`);
    throw error;
  }
}

/**
 * Restore workspace from a checkpoint
 */
export async function restoreCheckpoint(
  prisma: PrismaClient,
  runId: string,
  checkpointId: string
): Promise<void> {
  const checkpoint = await prisma.agentCheckpoint.findUnique({
    where: { id: checkpointId },
  });

  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  const workspacePath = join(WORKSPACE_BASE, runId);
  const tempFile = `/tmp/restore-${Date.now()}.tar.gz`;

  await streamLog(prisma, runId, "info", `Restoring from checkpoint: ${checkpoint.description ?? checkpointId}`);

  try {
    // Download from S3
    await downloadFromS3(checkpoint.s3Key, tempFile);

    // Clear current workspace
    await rm(workspacePath, { recursive: true, force: true });
    await mkdir(workspacePath, { recursive: true });

    // Extract tar.gz to workspace
    await extractTarGz(tempFile, workspacePath);

    await streamLog(prisma, runId, "info", "Checkpoint restored successfully");

    // Clean up temp file
    await rm(tempFile, { force: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await streamLog(prisma, runId, "error", `Failed to restore checkpoint: ${errorMsg}`);
    throw error;
  }
}

/**
 * Initialize workspace directory for a run
 */
export async function initializeWorkspace(runId: string): Promise<string> {
  const workspacePath = join(WORKSPACE_BASE, runId);
  await mkdir(workspacePath, { recursive: true });
  return workspacePath;
}

/**
 * Clean up workspace after run completion
 */
export async function cleanupWorkspace(runId: string): Promise<void> {
  const workspacePath = join(WORKSPACE_BASE, runId);
  await rm(workspacePath, { recursive: true, force: true });
}

/**
 * Create a tar.gz archive of a directory
 */
async function createTarGz(sourcePath: string, destPath: string): Promise<void> {
  // Get list of files in the source directory
  const files = await readdir(sourcePath);

  if (files.length === 0) {
    throw new Error("Workspace is empty, nothing to checkpoint");
  }

  await tar.create(
    {
      gzip: true,
      file: destPath,
      cwd: sourcePath,
    },
    files
  );
}

/**
 * Extract a tar.gz archive to a directory
 */
async function extractTarGz(sourcePath: string, destPath: string): Promise<void> {
  await tar.extract({
    file: sourcePath,
    cwd: destPath,
  });
}

/**
 * Upload a file to S3
 */
async function uploadToS3(filePath: string, s3Key: string): Promise<void> {
  const fileStream = createReadStream(filePath);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: "application/gzip",
    })
  );
}

/**
 * Download a file from S3
 */
async function downloadFromS3(s3Key: string, destPath: string): Promise<void> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    })
  );

  if (!response.Body) {
    throw new Error("Empty response from S3");
  }

  const destination = createWriteStream(destPath);

  // Handle the readable stream
  const bodyStream = response.Body as NodeJS.ReadableStream;
  await pipeline(bodyStream, destination);
}
