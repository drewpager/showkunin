/**
 * Infer suggested credentials from video AI analysis
 *
 * This parses the analysis text and Computer Use Plan to detect:
 * - URLs that should be parameterized (spreadsheets, repos, etc.)
 * - Environment variables mentioned in the plan
 * - API keys or tokens referenced
 * - Common patterns that need credentials
 */

export interface SuggestedCredential {
  key: string;
  description: string;
  placeholder?: string;
  required: boolean;
}

// Patterns that indicate specific credential needs
const CREDENTIAL_PATTERNS: Array<{
  patterns: RegExp[];
  credential: SuggestedCredential;
}> = [
  // Google Sheets - URL for browser automation
  {
    patterns: [
      /docs\.google\.com\/spreadsheets/i,
      /google\s*sheet/i,
      /spreadsheet/i,
    ],
    credential: {
      key: "SPREADSHEET_URL",
      description: "Google Spreadsheet URL to work with",
      placeholder: "https://docs.google.com/spreadsheets/d/...",
      required: true,
    },
  },
  // Google Sheets API Key - for direct API access (faster, no browser needed)
  {
    patterns: [
      /sheets\.googleapis\.com/i,
      /google\s*sheets?\s*api/i,
    ],
    credential: {
      key: "GOOGLE_SHEETS_API_KEY",
      description: "Google Sheets API key (enables faster API access without browser)",
      placeholder: "AIzaSy...",
      required: false,
    },
  },
  // Google OAuth Token - for authenticated API operations
  {
    patterns: [
      /google\s*oauth/i,
      /google\s*access\s*token/i,
      /authenticated\s*google/i,
    ],
    credential: {
      key: "GOOGLE_ACCESS_TOKEN",
      description: "Google OAuth access token (for write operations)",
      placeholder: "ya29...",
      required: false,
    },
  },
  // GitHub
  {
    patterns: [/github\.com/i, /github\s*repo/i, /git\s*clone/i, /git\s*push/i],
    credential: {
      key: "GITHUB_TOKEN",
      description: "GitHub personal access token for repository access",
      placeholder: "ghp_xxxxxxxxxxxx",
      required: true,
    },
  },
  {
    patterns: [/github\.com\/[\w-]+\/[\w-]+/i],
    credential: {
      key: "GITHUB_REPO_URL",
      description: "GitHub repository URL",
      placeholder: "https://github.com/owner/repo",
      required: true,
    },
  },
  // Notion
  {
    patterns: [/notion\.so/i, /notion\s*page/i, /notion\s*database/i],
    credential: {
      key: "NOTION_TOKEN",
      description: "Notion integration token",
      placeholder: "secret_xxxxxxxxxxxx",
      required: true,
    },
  },
  // Slack
  {
    patterns: [/slack\.com/i, /slack\s*channel/i, /slack\s*message/i],
    credential: {
      key: "SLACK_TOKEN",
      description: "Slack Bot or User OAuth token",
      placeholder: "xoxb-xxxxxxxxxxxx",
      required: true,
    },
  },
  // Generic API
  {
    patterns: [/api[_\s]?key/i, /apikey/i],
    credential: {
      key: "API_KEY",
      description: "API key for external service",
      placeholder: "your-api-key",
      required: true,
    },
  },
  // Database
  {
    patterns: [/database\s*url/i, /postgres/i, /mysql/i, /mongodb/i],
    credential: {
      key: "DATABASE_URL",
      description: "Database connection URL",
      placeholder: "postgresql://user:pass@host:5432/db",
      required: true,
    },
  },
  // AWS
  {
    patterns: [/aws/i, /s3\s*bucket/i, /amazon/i],
    credential: {
      key: "AWS_ACCESS_KEY_ID",
      description: "AWS Access Key ID",
      placeholder: "AKIAIOSFODNN7EXAMPLE",
      required: true,
    },
  },
  // OpenAI
  {
    patterns: [/openai/i, /gpt-?[34]/i, /chatgpt/i],
    credential: {
      key: "OPENAI_API_KEY",
      description: "OpenAI API key",
      placeholder: "sk-xxxxxxxxxxxx",
      required: true,
    },
  },
  // Stripe
  {
    patterns: [/stripe/i, /payment/i],
    credential: {
      key: "STRIPE_SECRET_KEY",
      description: "Stripe secret API key",
      placeholder: "sk_test_xxxxxxxxxxxx",
      required: true,
    },
  },
  // Twilio
  {
    patterns: [/twilio/i, /sms/i, /send\s*text/i],
    credential: {
      key: "TWILIO_AUTH_TOKEN",
      description: "Twilio authentication token",
      placeholder: "your-auth-token",
      required: true,
    },
  },
  // SendGrid / Email
  {
    patterns: [/sendgrid/i, /send\s*email/i, /smtp/i],
    credential: {
      key: "SENDGRID_API_KEY",
      description: "SendGrid API key for sending emails",
      placeholder: "SG.xxxxxxxxxxxx",
      required: true,
    },
  },
  // Airtable
  {
    patterns: [/airtable/i],
    credential: {
      key: "AIRTABLE_API_KEY",
      description: "Airtable API key",
      placeholder: "keyXXXXXXXXXXXXXX",
      required: true,
    },
  },
  // Firebase
  {
    patterns: [/firebase/i, /firestore/i],
    credential: {
      key: "FIREBASE_SERVICE_ACCOUNT",
      description: "Firebase service account JSON (base64 encoded)",
      placeholder: "base64-encoded-json",
      required: true,
    },
  },
  // Vercel
  {
    patterns: [/vercel/i, /vercel\s*deploy/i],
    credential: {
      key: "VERCEL_TOKEN",
      description: "Vercel authentication token",
      placeholder: "your-vercel-token",
      required: true,
    },
  },
];

// Extract environment variable references from text
const ENV_VAR_PATTERNS = [
  /\$\{?([A-Z][A-Z0-9_]+)\}?/g, // ${VAR_NAME} or $VAR_NAME
  /process\.env\.([A-Z][A-Z0-9_]+)/g, // process.env.VAR_NAME
  /env\s*\[\s*["']([A-Z][A-Z0-9_]+)["']\s*\]/g, // env["VAR_NAME"]
  /getenv\s*\(\s*["']([A-Z][A-Z0-9_]+)["']\s*\)/g, // getenv("VAR_NAME")
];

/**
 * Parse AI analysis and infer suggested credentials
 */
export function inferCredentials(aiAnalysis: string | null): SuggestedCredential[] {
  if (!aiAnalysis) return [];

  const suggestions: Map<string, SuggestedCredential> = new Map();

  // Check for known patterns
  for (const { patterns, credential } of CREDENTIAL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(aiAnalysis)) {
        suggestions.set(credential.key, credential);
        break;
      }
    }
  }

  // Extract explicit environment variable references
  for (const pattern of ENV_VAR_PATTERNS) {
    const matches = aiAnalysis.matchAll(pattern);
    for (const match of matches) {
      const varName = match[1];
      if (varName && !suggestions.has(varName)) {
        // Skip common non-credential env vars
        const skipVars = ["NODE_ENV", "PATH", "HOME", "USER", "PWD", "SHELL"];
        if (!skipVars.includes(varName)) {
          suggestions.set(varName, {
            key: varName,
            description: `Environment variable referenced in the automation`,
            required: true,
          });
        }
      }
    }
  }

  // Extract URLs that might need to be parameterized
  const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
  const urls = aiAnalysis.match(urlPattern) ?? [];
  for (const url of urls) {
    // Check if URL contains identifiers that should be parameterized
    if (url.includes("docs.google.com/spreadsheets/d/") && !suggestions.has("SPREADSHEET_ID")) {
      suggestions.set("SPREADSHEET_ID", {
        key: "SPREADSHEET_ID",
        description: "Google Spreadsheet ID (from URL)",
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        required: true,
      });
    }
    if (url.includes("github.com") && url.match(/github\.com\/[\w-]+\/[\w-]+/) && !suggestions.has("GITHUB_REPO_URL")) {
      suggestions.set("GITHUB_REPO_URL", {
        key: "GITHUB_REPO_URL",
        description: "GitHub repository URL",
        placeholder: url,
        required: true,
      });
    }
  }

  return Array.from(suggestions.values());
}

/**
 * Check if this is a shared task (user doesn't own the video)
 * and customize the credential suggestions accordingly
 */
export function getCredentialPromptMessage(
  isOwner: boolean,
  suggestedCredentials: SuggestedCredential[]
): string {
  if (!isOwner) {
    return `This automation was shared with you. Please provide your own credentials to run it. The original creator's credentials are not shared for security.`;
  }

  if (suggestedCredentials.length > 0) {
    return `Based on the analysis, this automation may need the following credentials. You can add, modify, or remove them as needed.`;
  }

  return `Add any environment variables the automation may need (e.g., API keys, tokens). These are encrypted and stored securely.`;
}
