/**
 * Task Classifier
 * Detects task type from Computer Use Plan and AI analysis to determine
 * which MCP servers should be enabled for execution.
 */

export type TaskType = "browser" | "file" | "mixed" | "api" | "code_execution";

export interface TaskClassification {
  primaryType: TaskType;
  requiresBrowser: boolean;
  requiresFiles: boolean;
  requiresApi: boolean;
  requiresCodeExecution: boolean;
  browserUrls: string[];
  apiUrls: string[];
  suggestedMcpServers: string[];
  preferApiOverBrowser: boolean;
  detectedServices: string[];
  suggestedCodeTemplate: string | null;
}

interface ComputerUsePlan {
  task_description?: string;
  steps?: Array<{
    action: string;
    coordinate?: [number, number];
    text?: string;
    description?: string;
  }>;
}

// Browser action keywords from Computer Use Plans
const BROWSER_ACTIONS = [
  "click",
  "type",
  "scroll",
  "wait",
  "navigate",
  "hover",
  "select",
  "drag",
  "screenshot",
];

// Patterns that indicate browser automation is needed
const BROWSER_PATTERNS = [
  /google\s*sheets?/i,
  /spreadsheet/i,
  /browser/i,
  /chrome|firefox|safari|edge/i,
  /web\s*page/i,
  /click.*button/i,
  /fill.*form/i,
  /navigate.*to/i,
  /open.*url/i,
  /docs\.google\.com/i,
  /sheets\.google\.com/i,
  /drive\.google\.com/i,
  /gmail\.com/i,
  /login.*page/i,
  /web\s*app/i,
  /dashboard/i,
  /portal/i,
];

// URL patterns for browser tasks (excluding API/code URLs)
const BROWSER_URL_PATTERNS = [
  /https?:\/\/docs\.google\.com/i,
  /https?:\/\/sheets\.google\.com/i,
  /https?:\/\/drive\.google\.com/i,
  /https?:\/\/mail\.google\.com/i,
  /https?:\/\/[^/]*\.(com|org|net|io)\/(?!api|v\d)/i, // Web pages, not APIs
];

// URLs that are typically accessed via code/API, not browser
const CODE_URL_PATTERNS = [
  /github\.com\/.*\/blob/i,
  /api\./i,
  /\/api\//i,
  /localhost:\d+\/api/i,
];

// API URL patterns (can be accessed programmatically)
const API_URL_PATTERNS = [
  /sheets\.googleapis\.com/i,
  /www\.googleapis\.com/i,
  /api\.github\.com/i,
  /api\.notion\.com/i,
  /api\.slack\.com/i,
  /api\.[^/]+\.com/i,
];

// Patterns that indicate code execution in a sandbox is needed
const CODE_EXECUTION_PATTERNS = [
  /apps?\s*script/i,
  /custom\s*function/i,
  /run.*code/i,
  /execute.*script/i,
  /spreadsheet.*(formula|macro)/i,
  /complex\s*(calculation|logic|transform)/i,
  /batch\s*(process|update|operation)/i,
  /data\s*(transform|process|manipulat)/i,
  /automat.*script/i,
  /programmat.*access/i,
  /api\s*call.*google/i,
  /service\s*account/i,
];

// Services that have both browser and API access
const DUAL_ACCESS_SERVICES: Record<string, { pattern: RegExp; apiEnvKey: string }> = {
  google_sheets: {
    pattern: /sheets\.google\.com|docs\.google\.com\/spreadsheets/i,
    apiEnvKey: "GOOGLE_SERVICE_ACCOUNT_KEY",
  },
  github: {
    pattern: /github\.com/i,
    apiEnvKey: "GITHUB_TOKEN",
  },
  notion: {
    pattern: /notion\.so/i,
    apiEnvKey: "NOTION_TOKEN",
  },
};

/**
 * Options for task classification
 */
export interface ClassificationOptions {
  /** Force code execution mode (skip browser automation) */
  forceCodeExecution?: boolean;
}

/**
 * Classify a task based on its Computer Use Plan and AI analysis
 */
export function classifyTask(
  plan: ComputerUsePlan | null,
  aiAnalysis: string | null,
  availableCredentials?: string[],
  options?: ClassificationOptions
): TaskClassification {
  const analysis = aiAnalysis ?? "";
  const credentials = availableCredentials ?? [];
  const forceCodeExecution = options?.forceCodeExecution ?? false;

  // Check for browser actions in plan steps
  const hasBrowserSteps = plan?.steps?.some((step) =>
    BROWSER_ACTIONS.includes(step.action.toLowerCase())
  ) ?? false;

  // Check for browser patterns in analysis text
  const hasBrowserContext = BROWSER_PATTERNS.some((pattern) =>
    pattern.test(analysis)
  );

  // Check for code execution patterns
  const hasCodeExecutionContext = CODE_EXECUTION_PATTERNS.some((pattern) =>
    pattern.test(analysis)
  );

  // Extract URLs from analysis
  const allUrls = extractUrls(analysis);

  // Filter to browser-relevant URLs
  const browserUrls = allUrls.filter((url) => {
    // Exclude code/API URLs
    if (CODE_URL_PATTERNS.some((p) => p.test(url))) {
      return false;
    }
    // Include if matches browser URL pattern
    return BROWSER_URL_PATTERNS.some((p) => p.test(url));
  });

  // Filter to API-relevant URLs
  const apiUrls = allUrls.filter((url) =>
    API_URL_PATTERNS.some((p) => p.test(url))
  );

  // Detect which services are involved
  const detectedServices: string[] = [];
  for (const [serviceName, { pattern }] of Object.entries(DUAL_ACCESS_SERVICES)) {
    if (pattern.test(analysis) || allUrls.some((url) => pattern.test(url))) {
      detectedServices.push(serviceName);
    }
  }

  // Check if we have API credentials for detected services
  const hasApiCredentials = detectedServices.some((service) => {
    const serviceConfig = DUAL_ACCESS_SERVICES[service];
    return serviceConfig && credentials.includes(serviceConfig.apiEnvKey);
  });

  // Check for OAuth credentials (needed for Apps Script)
  const hasOAuthCredentials = credentials.includes("GOOGLE_OAUTH_REFRESH_TOKEN");

  // Determine if code execution should be used
  // Prefer code execution when:
  // 1. Force flag is set (test mode)
  // 2. Apps Script is explicitly requested + OAuth available
  // 3. Complex logic/calculations + service account available
  // 4. Batch processing + API credentials available
  const requiresCodeExecution = forceCodeExecution || (hasCodeExecutionContext && (hasApiCredentials || hasOAuthCredentials));

  // Suggest code template based on task
  let suggestedCodeTemplate: string | null = null;
  if (requiresCodeExecution) {
    if (/apps?\s*script/i.test(analysis) && hasOAuthCredentials) {
      suggestedCodeTemplate = "apps-script";
    } else if (detectedServices.includes("google_sheets") && hasApiCredentials) {
      suggestedCodeTemplate = "google-sheets-node";
    } else if (/python/i.test(analysis)) {
      suggestedCodeTemplate = "google-sheets-python";
    } else if (hasApiCredentials || forceCodeExecution) {
      // Default to generic-node when forced or when we have credentials
      suggestedCodeTemplate = "generic-node";
    }
  }

  // Determine if API can be used instead of browser
  const requiresApi = apiUrls.length > 0 || hasApiCredentials;
  const preferApiOverBrowser = (hasApiCredentials && !hasBrowserSteps) || requiresCodeExecution;

  // Determine if browser is required
  const requiresBrowser = (hasBrowserSteps || hasBrowserContext || browserUrls.length > 0) && !preferApiOverBrowser;

  // File operations are always included as they're the base tools
  const requiresFiles = true;

  // Determine primary type
  let primaryType: TaskType = "file";
  if (requiresCodeExecution) {
    primaryType = "code_execution";
  } else if (preferApiOverBrowser && requiresApi) {
    primaryType = "api";
  } else if (requiresBrowser && requiresFiles) {
    // Check if it's primarily browser-focused
    const browserSignals = [
      hasBrowserSteps,
      hasBrowserContext,
      browserUrls.length > 0,
    ].filter(Boolean).length;

    primaryType = browserSignals >= 2 ? "browser" : "mixed";
  } else if (requiresBrowser) {
    primaryType = "browser";
  } else if (requiresApi) {
    primaryType = "api";
  }

  // Suggest MCP servers based on requirements
  // Use Stagehand (Browserbase) for browser tasks - provides cloud browser with Live View
  // Note: Playwright fallback disabled - it spawns a local browser which bypasses Browserbase
  const suggestedMcpServers: string[] = [];
  if (requiresCodeExecution) {
    // Code sandbox: run generated code in isolated Docker containers
    suggestedMcpServers.push("code-sandbox");
  } else if (preferApiOverBrowser && detectedServices.includes("google_sheets")) {
    // Google Sheets API mode: bypass browser entirely using service account
    suggestedMcpServers.push("gsheets");
  } else if (requiresBrowser) {
    // Stagehand: AI-powered browser automation via Browserbase cloud
    // This enables Live View and persistent auth contexts
    suggestedMcpServers.push("stagehand");
    // Playwright fallback DISABLED - uncomment below to re-enable local browser fallback
    // suggestedMcpServers.push("playwright");
  }

  return {
    primaryType,
    requiresBrowser,
    requiresFiles,
    requiresApi,
    requiresCodeExecution,
    browserUrls,
    apiUrls,
    suggestedMcpServers,
    preferApiOverBrowser,
    detectedServices,
    suggestedCodeTemplate,
  };
}

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s"'<>\])+]+/gi;
  const matches = text.match(urlPattern) ?? [];

  // Clean up trailing punctuation
  return matches.map((url) => url.replace(/[.,;:!?)]+$/, ""));
}

/**
 * Format classification for logging
 */
export function formatClassification(classification: TaskClassification): string {
  return [
    `Type: ${classification.primaryType}`,
    `Browser: ${classification.requiresBrowser ? "yes" : "no"}`,
    `API: ${classification.requiresApi ? "yes" : "no"}`,
    `CodeExec: ${classification.requiresCodeExecution ? "yes" : "no"}`,
    classification.preferApiOverBrowser ? "Prefer API" : null,
    classification.suggestedCodeTemplate
      ? `Template: ${classification.suggestedCodeTemplate}`
      : null,
    classification.browserUrls.length > 0
      ? `Browser URLs: ${classification.browserUrls.slice(0, 3).join(", ")}${classification.browserUrls.length > 3 ? "..." : ""}`
      : null,
    classification.apiUrls.length > 0
      ? `API URLs: ${classification.apiUrls.slice(0, 2).join(", ")}${classification.apiUrls.length > 2 ? "..." : ""}`
      : null,
    classification.detectedServices.length > 0
      ? `Services: ${classification.detectedServices.join(", ")}`
      : null,
    classification.suggestedMcpServers.length > 0
      ? `MCP: ${classification.suggestedMcpServers.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
}
