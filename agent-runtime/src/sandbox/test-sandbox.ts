#!/usr/bin/env npx tsx
/**
 * Test script for the Docker Code Execution Sandbox
 *
 * Usage:
 *   npx tsx agent-runtime/src/sandbox/test-sandbox.ts
 *
 * Prerequisites:
 *   1. Docker must be running
 *   2. Run `npm install` first
 *   3. Optionally build images first: docker-compose build sandbox-node
 */

import { getSandboxManager } from "./sandbox-manager";
import { getCodeExecutor } from "./code-executor";

async function testDockerAvailability() {
  console.log("\n=== Test 1: Docker Availability ===");
  const manager = getSandboxManager();
  const available = await manager.isAvailable();

  if (available) {
    console.log("✓ Docker is available");
  } else {
    console.log("✗ Docker is NOT available - make sure Docker is running");
    return false;
  }
  return true;
}

async function testListRuntimes() {
  console.log("\n=== Test 2: List Available Runtimes ===");
  const manager = getSandboxManager();
  const runtimes = await manager.listAvailableRuntimes();

  for (const { runtime, available } of runtimes) {
    const status = available ? "✓ Ready" : "○ Not installed (will be pulled on first use)";
    console.log(`  ${runtime}: ${status}`);
  }
  return true;
}

async function testListTemplates() {
  console.log("\n=== Test 3: List Code Templates ===");
  const executor = getCodeExecutor();
  const templates = executor.listTemplates();

  for (const template of templates) {
    console.log(`  ${template.name}:`);
    console.log(`    Runtime: ${template.runtime}`);
    console.log(`    Description: ${template.description}`);
    console.log(`    Required: ${template.requiredEnv.join(", ") || "None"}`);
  }
  return true;
}

async function testSimpleNodeExecution() {
  console.log("\n=== Test 4: Simple Node.js Execution ===");
  const manager = getSandboxManager();

  const result = await manager.executeCode({
    executionId: "test-node-1",
    agentRunId: "test-run",
    runtime: "node",
    code: `
      console.log("Hello from sandbox!");
      console.log("Node version:", process.version);
      console.log("Current time:", new Date().toISOString());

      // Test math operations
      const sum = [1, 2, 3, 4, 5].reduce((a, b) => a + b, 0);
      console.log("Sum of 1-5:", sum);

      // Return a result
      process.exit(0);
    `,
    timeoutSeconds: 30,
  });

  console.log(`  Status: ${result.status}`);
  console.log(`  Exit Code: ${result.exitCode}`);
  console.log(`  Duration: ${result.durationMs}ms`);

  if (result.stdout) {
    console.log("  STDOUT:");
    result.stdout.split("\n").forEach(line => console.log(`    ${line}`));
  }

  if (result.stderr) {
    console.log("  STDERR:");
    result.stderr.split("\n").forEach(line => console.log(`    ${line}`));
  }

  return result.status === "completed" && result.exitCode === 0;
}

async function testTemplateExecution() {
  console.log("\n=== Test 5: Template-based Execution ===");
  const executor = getCodeExecutor();

  // Test with generic-node template (no credentials required)
  const result = await executor.execute(
    "test-template-1",
    "test-run",
    "generic-node",
    `
    // Simple data transformation
    const data = [
      { name: "Alice", score: 85 },
      { name: "Bob", score: 92 },
      { name: "Charlie", score: 78 },
    ];

    const average = data.reduce((sum, d) => sum + d.score, 0) / data.length;
    const topScorer = data.reduce((a, b) => a.score > b.score ? a : b);

    return {
      average: average.toFixed(2),
      topScorer: topScorer.name,
      count: data.length,
    };
    `,
    {}, // No credentials needed for generic template
    { timeoutSeconds: 30 }
  );

  console.log(`  Status: ${result.status}`);
  console.log(`  Exit Code: ${result.exitCode}`);
  console.log(`  Duration: ${result.durationMs}ms`);

  if (result.stdout) {
    console.log("  Output:");
    result.stdout.split("\n").forEach(line => console.log(`    ${line}`));
  }

  if (result.stderr) {
    console.log("  Errors:");
    result.stderr.split("\n").forEach(line => console.log(`    ${line}`));
  }

  return result.status === "completed";
}

async function testTimeoutHandling() {
  console.log("\n=== Test 6: Timeout Handling ===");
  const manager = getSandboxManager();

  const result = await manager.executeCode({
    executionId: "test-timeout-1",
    agentRunId: "test-run",
    runtime: "node",
    code: `
      console.log("Starting long operation...");
      // This should timeout
      while (true) {
        // Infinite loop
      }
    `,
    timeoutSeconds: 5, // Short timeout for testing
  });

  console.log(`  Status: ${result.status}`);
  console.log(`  Exit Code: ${result.exitCode}`);
  console.log(`  Duration: ${result.durationMs}ms`);

  const passed = result.status === "timeout";
  console.log(`  ${passed ? "✓" : "✗"} Timeout was ${passed ? "correctly" : "NOT"} triggered`);

  return passed;
}

async function testErrorHandling() {
  console.log("\n=== Test 7: Error Handling ===");
  const manager = getSandboxManager();

  const result = await manager.executeCode({
    executionId: "test-error-1",
    agentRunId: "test-run",
    runtime: "node",
    code: `
      console.log("About to throw an error...");
      throw new Error("Intentional test error");
    `,
    timeoutSeconds: 30,
  });

  console.log(`  Status: ${result.status}`);
  console.log(`  Exit Code: ${result.exitCode}`);

  if (result.stderr) {
    console.log("  Error output (expected):");
    result.stderr.split("\n").slice(0, 5).forEach(line => console.log(`    ${line}`));
  }

  const passed = result.status === "failed" && result.exitCode !== 0;
  console.log(`  ${passed ? "✓" : "✗"} Error was ${passed ? "correctly" : "NOT"} caught`);

  return passed;
}

async function testGoogleSheetsTemplate() {
  console.log("\n=== Test 8: Google Sheets Template (Dry Run) ===");
  const executor = getCodeExecutor();

  // Just test code generation, not execution (no credentials)
  try {
    const { code, runtime, entryPoint } = executor.generateCode(
      "google-sheets-node",
      `
      const spreadsheetId = "test-spreadsheet-id";
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:B10',
      });
      return response.data.values;
      `
    );

    console.log(`  Generated code for runtime: ${runtime}`);
    console.log(`  Entry point: ${entryPoint}`);
    console.log(`  Code length: ${code.length} characters`);
    console.log("  ✓ Template generation successful");

    // Verify the template structure
    const hasAuth = code.includes("google.auth.GoogleAuth");
    const hasSheets = code.includes("google.sheets");
    console.log(`  ${hasAuth ? "✓" : "✗"} Contains GoogleAuth setup`);
    console.log(`  ${hasSheets ? "✓" : "✗"} Contains Sheets API setup`);

    return hasAuth && hasSheets;
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    return false;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Docker Code Sandbox Test Suite           ║");
  console.log("╚════════════════════════════════════════════╝");

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Docker availability (required for other tests)
  const dockerAvailable = await testDockerAvailability();
  results.push({ name: "Docker Availability", passed: dockerAvailable });

  if (!dockerAvailable) {
    console.log("\n⚠️  Docker is not available. Skipping container tests.");
    console.log("   Make sure Docker Desktop is running and try again.");

    // Still run non-Docker tests
    results.push({ name: "List Templates", passed: await testListTemplates() });
    results.push({ name: "Google Sheets Template", passed: await testGoogleSheetsTemplate() });
  } else {
    // Run all tests
    results.push({ name: "List Runtimes", passed: await testListRuntimes() });
    results.push({ name: "List Templates", passed: await testListTemplates() });
    results.push({ name: "Simple Node Execution", passed: await testSimpleNodeExecution() });
    results.push({ name: "Template Execution", passed: await testTemplateExecution() });
    results.push({ name: "Timeout Handling", passed: await testTimeoutHandling() });
    results.push({ name: "Error Handling", passed: await testErrorHandling() });
    results.push({ name: "Google Sheets Template", passed: await testGoogleSheetsTemplate() });
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   Test Results Summary                     ║");
  console.log("╚════════════════════════════════════════════╝");

  let passed = 0;
  let failed = 0;

  for (const { name, passed: testPassed } of results) {
    const status = testPassed ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${status}  ${name}`);
    if (testPassed) passed++;
    else failed++;
  }

  console.log(`\n  Total: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
