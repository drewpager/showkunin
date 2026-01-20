/**
 * Auth Detector
 * Detects authentication requirements from URLs and task descriptions
 */

export interface AuthRequirement {
  required: boolean;
  provider: string;
  reason: string;
  canSkip: boolean;
}

// URL patterns that indicate authentication is required
const AUTH_URL_PATTERNS: Record<string, { regex: RegExp; provider: string; reason: string; canSkip: boolean }[]> = {
  google: [
    { regex: /accounts\.google\.com/i, provider: "google", reason: "Google account login page", canSkip: false },
    { regex: /docs\.google\.com/i, provider: "google", reason: "Google Docs requires sign-in", canSkip: false },
    { regex: /sheets\.google\.com/i, provider: "google", reason: "Google Sheets requires sign-in", canSkip: false },
    { regex: /drive\.google\.com/i, provider: "google", reason: "Google Drive requires sign-in", canSkip: false },
    { regex: /mail\.google\.com/i, provider: "google", reason: "Gmail requires sign-in", canSkip: false },
    { regex: /calendar\.google\.com/i, provider: "google", reason: "Google Calendar requires sign-in", canSkip: false },
    { regex: /script\.google\.com/i, provider: "google", reason: "Google Apps Script requires sign-in", canSkip: false },
    { regex: /console\.cloud\.google\.com/i, provider: "google", reason: "Google Cloud Console requires sign-in", canSkip: false },
  ],
  github: [
    { regex: /github\.com\/login/i, provider: "github", reason: "GitHub login page", canSkip: false },
    { regex: /github\.com\/settings/i, provider: "github", reason: "GitHub settings require sign-in", canSkip: false },
    { regex: /github\.com\/.*\/settings/i, provider: "github", reason: "Repository settings require sign-in", canSkip: false },
  ],
  microsoft: [
    { regex: /login\.microsoftonline\.com/i, provider: "microsoft", reason: "Microsoft account login", canSkip: false },
    { regex: /login\.live\.com/i, provider: "microsoft", reason: "Microsoft Live login", canSkip: false },
    { regex: /office\.com/i, provider: "microsoft", reason: "Microsoft Office requires sign-in", canSkip: false },
    { regex: /outlook\.com/i, provider: "microsoft", reason: "Outlook requires sign-in", canSkip: false },
    { regex: /sharepoint\.com/i, provider: "microsoft", reason: "SharePoint requires sign-in", canSkip: false },
  ],
  facebook: [
    { regex: /facebook\.com\/login/i, provider: "facebook", reason: "Facebook login page", canSkip: false },
  ],
  twitter: [
    { regex: /twitter\.com\/login/i, provider: "twitter", reason: "Twitter login page", canSkip: false },
    { regex: /x\.com\/login/i, provider: "twitter", reason: "X login page", canSkip: false },
  ],
  linkedin: [
    { regex: /linkedin\.com\/login/i, provider: "linkedin", reason: "LinkedIn login page", canSkip: false },
    { regex: /linkedin\.com\/uas/i, provider: "linkedin", reason: "LinkedIn authentication", canSkip: false },
  ],
  slack: [
    { regex: /slack\.com\/signin/i, provider: "slack", reason: "Slack sign-in page", canSkip: false },
    { regex: /app\.slack\.com/i, provider: "slack", reason: "Slack app requires sign-in", canSkip: false },
  ],
  notion: [
    { regex: /notion\.so\/login/i, provider: "notion", reason: "Notion login page", canSkip: false },
  ],
  atlassian: [
    { regex: /id\.atlassian\.com/i, provider: "atlassian", reason: "Atlassian login page", canSkip: false },
    { regex: /.*\.atlassian\.net/i, provider: "atlassian", reason: "Jira/Confluence requires sign-in", canSkip: false },
  ],
};

// Public URL patterns that typically don't require auth
const PUBLIC_URL_PATTERNS = [
  /github\.com\/[^/]+\/[^/]+$/i,  // Public repo main page
  /github\.com\/[^/]+\/[^/]+\/(blob|tree|issues|pulls)/i,  // Public repo pages
  /.*\.github\.io/i,  // GitHub Pages
  /google\.com\/search/i,  // Google Search
];

/**
 * Detect if URLs require authentication
 */
export function detectAuthRequirements(urls: string[]): AuthRequirement {
  // Check if any URL is a known public pattern
  const hasPublicUrl = urls.some((url) =>
    PUBLIC_URL_PATTERNS.some((pattern) => pattern.test(url))
  );

  // Check all URLs against auth patterns
  for (const url of urls) {
    for (const category of Object.values(AUTH_URL_PATTERNS)) {
      for (const pattern of category) {
        if (pattern.regex.test(url)) {
          return {
            required: true,
            provider: pattern.provider,
            reason: pattern.reason,
            canSkip: hasPublicUrl,  // Can skip if there are also public URLs
          };
        }
      }
    }
  }

  return {
    required: false,
    provider: "none",
    reason: "No authentication required",
    canSkip: true,
  };
}

/**
 * Get human-readable provider name
 */
export function getProviderDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    google: "Google",
    github: "GitHub",
    microsoft: "Microsoft",
    facebook: "Facebook",
    twitter: "X (Twitter)",
    linkedin: "LinkedIn",
    slack: "Slack",
    notion: "Notion",
    atlassian: "Atlassian (Jira/Confluence)",
    generic: "the target website",
  };
  return displayNames[provider] ?? provider;
}

/**
 * Check if a provider is known/supported
 */
export function isKnownProvider(provider: string): boolean {
  return Object.keys(AUTH_URL_PATTERNS).includes(provider) || provider === "generic";
}

/**
 * Get all URLs that match a specific provider
 */
export function getUrlsForProvider(urls: string[], provider: string): string[] {
  const patterns = AUTH_URL_PATTERNS[provider];
  if (!patterns) return [];

  return urls.filter((url) =>
    patterns.some((pattern) => pattern.regex.test(url))
  );
}
