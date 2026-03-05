/**
 * Code Executor
 * Generates and executes code in sandboxed containers.
 * Supports templates for Google APIs, Apps Script, and custom code.
 */

import {
  type SandboxRuntime,
  type CodeExecutionRequest,
  type CodeExecutionResult,
  type CodeTemplate,
  type ExecutionCredentials,
} from "./types";
import { getSandboxManager } from "./sandbox-manager";

/**
 * Code generation templates for different use cases
 */
export const CODE_TEMPLATES: Record<string, CodeTemplate> = {
  // Node.js Google Sheets template using service account
  "google-sheets-node": {
    runtime: "node",
    name: "Google Sheets (Node.js)",
    description: "Read/write Google Sheets using service account authentication",
    entryPoint: "index.js",
    requiredEnv: ["GOOGLE_SERVICE_ACCOUNT_KEY"],
    dependencies: ["googleapis"],
    template: `/**
 * Auto-generated Google Sheets executor
 * Runtime: Node.js with googleapis SDK
 */
const { google } = require('googleapis');

// Initialize auth from service account
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  try {
    // === GENERATED CODE START ===
    {{GENERATED_CODE}}
    // === GENERATED CODE END ===
  } catch (error) {
    console.error('Execution error:', error.message);
    process.exit(1);
  }
}

main().then(result => {
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
`,
  },

  // Node.js Google Drive template
  "google-drive-node": {
    runtime: "node",
    name: "Google Drive (Node.js)",
    description: "Read/write Google Drive files using service account",
    entryPoint: "index.js",
    requiredEnv: ["GOOGLE_SERVICE_ACCOUNT_KEY"],
    dependencies: ["googleapis"],
    template: `/**
 * Auto-generated Google Drive executor
 * Runtime: Node.js with googleapis SDK
 */
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
  try {
    // === GENERATED CODE START ===
    {{GENERATED_CODE}}
    // === GENERATED CODE END ===
  } catch (error) {
    console.error('Execution error:', error.message);
    process.exit(1);
  }
}

main().then(result => {
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
`,
  },

  // Python Google Sheets template
  "google-sheets-python": {
    runtime: "python",
    name: "Google Sheets (Python)",
    description: "Read/write Google Sheets using Python and service account",
    entryPoint: "main.py",
    requiredEnv: ["GOOGLE_SERVICE_ACCOUNT_KEY"],
    dependencies: ["google-api-python-client", "google-auth"],
    template: `"""
Auto-generated Google Sheets executor
Runtime: Python with Google API client
"""
import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Initialize credentials from service account
creds_json = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_KEY'])
credentials = service_account.Credentials.from_service_account_info(
    creds_json,
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)

sheets = build('sheets', 'v4', credentials=credentials)

def main():
    try:
        # === GENERATED CODE START ===
{{GENERATED_CODE}}
        # === GENERATED CODE END ===
    except Exception as e:
        print(f"Execution error: {e}")
        exit(1)

if __name__ == "__main__":
    result = main()
    if result is not None:
        print(json.dumps(result, indent=2))
`,
  },

  // Apps Script template (requires OAuth)
  "apps-script": {
    runtime: "clasp",
    name: "Google Apps Script",
    description: "Execute custom Apps Script code (requires OAuth setup)",
    entryPoint: "Code.gs",
    requiredEnv: ["GOOGLE_OAUTH_REFRESH_TOKEN"],
    template: `/**
 * Auto-generated Apps Script
 * Deployed via clasp
 */

/**
 * Main entry point for execution
 */
function executeTask() {
  try {
    // === GENERATED CODE START ===
    {{GENERATED_CODE}}
    // === GENERATED CODE END ===
  } catch (error) {
    console.error('Execution error:', error.message);
    throw error;
  }
}

/**
 * Utility: Get active spreadsheet
 */
function getSheet(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  return sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();
}

/**
 * Utility: Read data from range
 */
function readRange(spreadsheetId, range) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  return ss.getRange(range).getValues();
}

/**
 * Utility: Write data to range
 */
function writeRange(spreadsheetId, range, values) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  ss.getRange(range).setValues(values);
}
`,
  },

  // Generic Node.js template
  "generic-node": {
    runtime: "node",
    name: "Generic Node.js",
    description: "Execute arbitrary Node.js code",
    entryPoint: "index.js",
    requiredEnv: [],
    template: `/**
 * Auto-generated Node.js executor
 */

async function main() {
  try {
    // === GENERATED CODE START ===
    {{GENERATED_CODE}}
    // === GENERATED CODE END ===
  } catch (error) {
    console.error('Execution error:', error.message);
    process.exit(1);
  }
}

main().then(result => {
  if (result !== undefined) {
    console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
`,
  },

  // Generic Python template
  "generic-python": {
    runtime: "python",
    name: "Generic Python",
    description: "Execute arbitrary Python code",
    entryPoint: "main.py",
    requiredEnv: [],
    template: `"""
Auto-generated Python executor
"""
import json

def main():
    try:
        # === GENERATED CODE START ===
{{GENERATED_CODE}}
        # === GENERATED CODE END ===
    except Exception as e:
        print(f"Execution error: {e}")
        exit(1)

if __name__ == "__main__":
    result = main()
    if result is not None:
        if isinstance(result, (dict, list)):
            print(json.dumps(result, indent=2))
        else:
            print(result)
`,
  },
};

/**
 * Code Executor class for generating and running sandboxed code
 */
export class CodeExecutor {
  /**
   * Generate code from a template
   */
  generateCode(
    templateName: string,
    generatedCode: string,
    additionalContext?: Record<string, string>
  ): { code: string; runtime: SandboxRuntime; entryPoint: string } {
    const template = CODE_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(CODE_TEMPLATES).join(", ")}`);
    }

    // Replace placeholder with generated code
    let code = template.template.replace("{{GENERATED_CODE}}", generatedCode);

    // Replace any additional context placeholders
    if (additionalContext) {
      for (const [key, value] of Object.entries(additionalContext)) {
        code = code.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
    }

    return {
      code,
      runtime: template.runtime,
      entryPoint: template.entryPoint,
    };
  }

  /**
   * Execute generated code in a sandbox
   */
  async execute(
    executionId: string,
    agentRunId: string,
    templateName: string,
    generatedCode: string,
    credentials: ExecutionCredentials,
    options?: {
      timeoutSeconds?: number;
      additionalFiles?: Record<string, string>;
      additionalContext?: Record<string, string>;
    }
  ): Promise<CodeExecutionResult> {
    // Generate the full code from template
    const { code, runtime, entryPoint } = this.generateCode(
      templateName,
      generatedCode,
      options?.additionalContext
    );

    // Build environment variables from credentials
    const env: Record<string, string> = {};
    if (credentials.googleServiceAccountKey) {
      env.GOOGLE_SERVICE_ACCOUNT_KEY = credentials.googleServiceAccountKey;
    }
    if (credentials.googleOAuthRefreshToken) {
      env.GOOGLE_OAUTH_REFRESH_TOKEN = credentials.googleOAuthRefreshToken;
    }
    if (credentials.additional) {
      Object.assign(env, credentials.additional);
    }

    // Validate required environment variables
    const template = CODE_TEMPLATES[templateName];
    for (const requiredVar of template.requiredEnv) {
      if (!env[requiredVar]) {
        return {
          executionId,
          status: "failed",
          stdout: "",
          stderr: `Missing required environment variable: ${requiredVar}`,
          exitCode: 1,
          durationMs: 0,
          error: `Missing required credential: ${requiredVar}`,
        };
      }
    }

    // Create execution request
    const request: CodeExecutionRequest = {
      executionId,
      agentRunId,
      runtime,
      code,
      entryPoint,
      env,
      timeoutSeconds: options?.timeoutSeconds,
      additionalFiles: options?.additionalFiles,
    };

    // Execute in sandbox
    const sandboxManager = getSandboxManager();
    return sandboxManager.executeCode(request);
  }

  /**
   * Execute raw code without a template
   */
  async executeRaw(
    executionId: string,
    agentRunId: string,
    runtime: SandboxRuntime,
    code: string,
    credentials: ExecutionCredentials,
    options?: {
      entryPoint?: string;
      timeoutSeconds?: number;
      additionalFiles?: Record<string, string>;
    }
  ): Promise<CodeExecutionResult> {
    // Build environment variables from credentials
    const env: Record<string, string> = {};
    if (credentials.googleServiceAccountKey) {
      env.GOOGLE_SERVICE_ACCOUNT_KEY = credentials.googleServiceAccountKey;
    }
    if (credentials.googleOAuthRefreshToken) {
      env.GOOGLE_OAUTH_REFRESH_TOKEN = credentials.googleOAuthRefreshToken;
    }
    if (credentials.additional) {
      Object.assign(env, credentials.additional);
    }

    const request: CodeExecutionRequest = {
      executionId,
      agentRunId,
      runtime,
      code,
      entryPoint: options?.entryPoint,
      env,
      timeoutSeconds: options?.timeoutSeconds,
      additionalFiles: options?.additionalFiles,
    };

    const sandboxManager = getSandboxManager();
    return sandboxManager.executeCode(request);
  }

  /**
   * List available code templates
   */
  listTemplates(): Array<{
    name: string;
    displayName: string;
    runtime: SandboxRuntime;
    description: string;
    requiredEnv: string[];
  }> {
    return Object.entries(CODE_TEMPLATES).map(([name, template]) => ({
      name,
      displayName: template.name,
      runtime: template.runtime,
      description: template.description,
      requiredEnv: template.requiredEnv,
    }));
  }

  /**
   * Get a specific template
   */
  getTemplate(name: string): CodeTemplate | undefined {
    return CODE_TEMPLATES[name];
  }

  /**
   * Suggest a template based on task description
   */
  suggestTemplate(taskDescription: string): string | null {
    const lower = taskDescription.toLowerCase();

    // Google Sheets patterns
    if (
      lower.includes("spreadsheet") ||
      lower.includes("google sheets") ||
      lower.includes("sheets api")
    ) {
      // Prefer Node.js for Sheets tasks
      return "google-sheets-node";
    }

    // Google Drive patterns
    if (lower.includes("google drive") || lower.includes("drive api")) {
      return "google-drive-node";
    }

    // Apps Script patterns
    if (
      lower.includes("apps script") ||
      lower.includes("macro") ||
      lower.includes("custom function") ||
      lower.includes("trigger")
    ) {
      return "apps-script";
    }

    // Python preferences
    if (lower.includes("python") || lower.includes("pandas") || lower.includes("numpy")) {
      if (lower.includes("sheets") || lower.includes("spreadsheet")) {
        return "google-sheets-python";
      }
      return "generic-python";
    }

    // Default to Node.js for general tasks
    if (lower.includes("node") || lower.includes("javascript")) {
      return "generic-node";
    }

    return null;
  }
}

// Singleton instance
let codeExecutorInstance: CodeExecutor | undefined;

/**
 * Get the code executor instance
 */
export function getCodeExecutor(): CodeExecutor {
  if (!codeExecutorInstance) {
    codeExecutorInstance = new CodeExecutor();
  }
  return codeExecutorInstance;
}
