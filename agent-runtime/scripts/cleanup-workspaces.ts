/**
 * Workspace Cleanup Script
 * Deletes workspace folders older than a specified age
 *
 * Usage:
 *   npx tsx agent-runtime/scripts/cleanup-workspaces.ts          # Dry run (default)
 *   npx tsx agent-runtime/scripts/cleanup-workspaces.ts --delete # Actually delete
 *   npx tsx agent-runtime/scripts/cleanup-workspaces.ts --days 3 # Folders older than 3 days
 */

import { readdir, stat, rm } from "fs/promises";
import { join } from "path";

const WORKSPACE_BASE = process.env.WORKSPACE_BASE ?? join(process.cwd(), "workspace");
const DEFAULT_MAX_AGE_DAYS = 7;

async function cleanupWorkspaces(
  maxAgeDays: number,
  dryRun: boolean
): Promise<{ deleted: string[]; kept: string[]; errors: string[] }> {
  const deleted: string[] = [];
  const kept: string[] = [];
  const errors: string[] = [];

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - maxAgeMs;

  console.log(`\nWorkspace cleanup`);
  console.log(`-----------------`);
  console.log(`Base path: ${WORKSPACE_BASE}`);
  console.log(`Max age: ${maxAgeDays} days`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "DELETE"}\n`);

  let folders: string[];
  try {
    folders = await readdir(WORKSPACE_BASE);
  } catch (error) {
    console.log(`Workspace directory not found: ${WORKSPACE_BASE}`);
    return { deleted, kept, errors };
  }

  for (const folder of folders) {
    const folderPath = join(WORKSPACE_BASE, folder);

    try {
      const stats = await stat(folderPath);

      if (!stats.isDirectory()) {
        continue;
      }

      const ageMs = Date.now() - stats.mtimeMs;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

      if (stats.mtimeMs < cutoffTime) {
        if (dryRun) {
          console.log(`[DRY RUN] Would delete: ${folder} (${ageDays} days old)`);
        } else {
          await rm(folderPath, { recursive: true, force: true });
          console.log(`Deleted: ${folder} (${ageDays} days old)`);
        }
        deleted.push(folder);
      } else {
        kept.push(folder);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${folder}: ${message}`);
      console.error(`Error processing ${folder}: ${message}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  ${dryRun ? "Would delete" : "Deleted"}: ${deleted.length} folders`);
  console.log(`  Kept: ${kept.length} folders`);
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.length}`);
  }

  return { deleted, kept, errors };
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = !args.includes("--delete");
const daysIndex = args.indexOf("--days");
const maxAgeDays = daysIndex !== -1 && args[daysIndex + 1]
  ? parseInt(args[daysIndex + 1], 10)
  : DEFAULT_MAX_AGE_DAYS;

cleanupWorkspaces(maxAgeDays, dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
