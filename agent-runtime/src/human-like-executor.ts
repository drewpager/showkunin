/**
 * Human-like Execution Patterns
 * System prompts and configuration for browser automation that mimics human behavior
 */

/**
 * Configuration for human-like timing
 */
export interface HumanLikeConfig {
  minDelayMs: number;
  maxDelayMs: number;
  typingDelayMs: number;
  verifyAfterAction: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
}

export const DEFAULT_HUMAN_CONFIG: HumanLikeConfig = {
  minDelayMs: 500,
  maxDelayMs: 2000,
  typingDelayMs: 50,
  verifyAfterAction: true,
  retryOnFailure: true,
  maxRetries: 3,
};

/**
 * Core human-like interaction guidelines
 */
export const HUMAN_LIKE_SYSTEM_PROMPT = `
## Human-like Interaction Guidelines

When automating browser tasks, follow these human-like patterns for reliable execution:

### 1. Timing and Pacing
- Wait 500-2000ms between major actions (page navigation, form submission, dialog handling)
- Wait 100-500ms between minor actions (clicks, field focus)
- Use browser_wait_for to wait for elements/text to appear before interacting
- Never rush through sequences - real users take time to read and react

### 2. Verification Pattern
After every significant action, verify it worked:
1. Perform action (click, type, navigate)
2. Wait briefly (browser_wait_for or explicit delay)
3. Take browser_snapshot to verify the expected result
4. If verification fails, retry up to 3 times before reporting error

### 3. Error Recovery
- If an element isn't found, wait 1-2 seconds and try again
- If a page doesn't load, try refreshing once
- If unexpected content appears, capture a snapshot and report clearly
- If login is required unexpectedly, stop and report "Authentication required"

### 4. Natural Interaction Flow
- Navigate to pages directly via URL when possible
- Use keyboard shortcuts (Tab between fields, Enter to submit)
- Scroll to elements before interacting with them
- Read error messages and respond appropriately

### 5. State Management
- Before starting, take an initial snapshot to understand current state
- Track what page/state you're in throughout execution
- If the browser appears stuck, try refreshing the page
- Save progress at checkpoints for long tasks
`;

/**
 * Google Sheets specific automation guidance
 */
export const GOOGLE_SHEETS_GUIDANCE = `
## Google Sheets Automation

### Navigation
1. Navigate to the full spreadsheet URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}
2. Wait for the sheet to fully load (look for the toolbar and cell grid)
3. Use browser_snapshot to understand the current page structure

### Cell Selection
- Cells are identified by aria-labels like "A1, value, Editing" or "B2, Empty"
- Click on a cell using its ref from the snapshot
- After clicking, the cell should show focus (usually a blue border)

### Data Entry
1. Click on target cell
2. Wait for cell to be focused (verify with snapshot)
3. Use browser_type to enter data
4. For formulas, start with "=" (e.g., "=SUM(A1:A10)")
5. Press Enter (browser_press_key) to confirm entry

### Navigation Between Cells
- Tab key: Move to next cell right
- Enter key: Move to next cell down
- Shift+Tab: Move to previous cell
- Arrow keys: Move in that direction

### Verification
- After data entry, take a snapshot to verify the value appears correctly
- Check for any error indicators (red triangles, formula errors)
- Verify formulas calculate correctly

### Common Issues
- If cell appears read-only, check if sheet is protected
- If changes don't save, look for connection error indicators
- If formatting is lost, the sheet may be in "Plain text" mode
`;

/**
 * OAuth and authentication handling guidance
 */
export const AUTH_HANDLING_GUIDANCE = `
## Authentication Handling

### Detecting Login Requirements
- Check URL for "accounts.google.com", "login", "signin", "auth"
- Look for login forms (email/password fields)
- Check for "Sign in" or "Log in" buttons in snapshots

### When Authentication is Needed
1. STOP - Do not attempt to enter credentials directly
2. Take a snapshot to document the login requirement
3. Report clearly: "Authentication required for [service]. The browser is showing a login page."
4. If browser session cookies were provided, they should already be injected

### Google Services Specifics
- Google may require 2FA which cannot be automated
- CAPTCHA challenges cannot be automated
- If session cookies are fresh, login should be automatic

### Handling Auth Popups
- Watch for OAuth consent screens
- Report any permission request dialogs
- Do not auto-approve permissions
`;

/**
 * Build the complete system prompt based on task classification
 */
export function buildBrowserSystemPrompt(options: {
  includeGoogleSheets?: boolean;
  includeAuthHandling?: boolean;
  includeHttpApi?: boolean;
}): string {
  const { includeGoogleSheets, includeAuthHandling, includeHttpApi } = options;

  let prompt = HUMAN_LIKE_SYSTEM_PROMPT;

  if (includeGoogleSheets) {
    prompt += "\n" + GOOGLE_SHEETS_GUIDANCE;
  }

  if (includeAuthHandling) {
    prompt += "\n" + AUTH_HANDLING_GUIDANCE;
  }

  if (includeHttpApi) {
    // Import dynamically to avoid circular deps
    prompt += `
## API Alternative

For some tasks, using the API directly may be faster than browser automation.
If credentials like GOOGLE_SHEETS_API_KEY are available, consider using curl commands
for read/write operations instead of browser navigation.

Check available environment variables with: env | grep -i api
`;
  }

  return prompt;
}

/**
 * Detect if task involves Google services
 */
export function involvesGoogleServices(urls: string[], analysis: string): boolean {
  const googlePatterns = [
    /google\.com/i,
    /docs\.google\.com/i,
    /sheets\.google\.com/i,
    /drive\.google\.com/i,
    /googleapis\.com/i,
  ];

  const urlMatch = urls.some((url) =>
    googlePatterns.some((pattern) => pattern.test(url))
  );

  const analysisMatch = googlePatterns.some((pattern) => pattern.test(analysis));

  return urlMatch || analysisMatch;
}

/**
 * Detect if task likely requires authentication
 */
export function likelyRequiresAuth(urls: string[], analysis: string): boolean {
  // Services that typically require login
  const authRequiredPatterns = [
    /google\.com/i,
    /github\.com\/(?!.*\/blob)/i, // GitHub but not blob URLs
    /notion\.so/i,
    /slack\.com/i,
    /trello\.com/i,
    /airtable\.com/i,
    /monday\.com/i,
    /asana\.com/i,
    /jira/i,
    /confluence/i,
  ];

  const authKeywords = [
    /login/i,
    /sign\s*in/i,
    /authenticate/i,
    /credentials/i,
    /dashboard/i,
    /my\s+account/i,
    /profile/i,
  ];

  const urlMatch = urls.some((url) =>
    authRequiredPatterns.some((pattern) => pattern.test(url))
  );

  const analysisMatch = authKeywords.some((pattern) => pattern.test(analysis));

  return urlMatch || analysisMatch;
}
