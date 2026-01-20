# Spec Requirements

## Agent Executor
1. The agent should evaluate the request first, determine authorization and authentication requirements second, and then proceed with implementing the request.
2. If browser interaction is required to solve the task, the agent should use the browserbase manager to create a session and manage session state.

## Browerbase & Live Link Viewer
1. When the agent executor creates a session, it should return the live link URL and the user should be able to view the session in the iframe or new tab.
2. If the user cancels the session, the agent executor should close any browserbase sessions that were started by the agent executor and update the agent run status to "canceled".
3. If authorization is required, the login screen should be displayed in the iframe or new tab.

## Implementation backup plan
1. If a scalable automation isn't possible, can the goal be completed with a different approach?

---

# Bug Investigation (2026-01-19)

## Issue 1: Live Link Viewer Never Displayed

### Root Cause
Session ID extraction from Stagehand MCP tool results was likely failing silently because:
1. The `extractSessionIdFromToolResult()` function looks for specific patterns
2. If Stagehand MCP returns session ID in an unexpected format, extraction fails
3. Without a session ID, `getSessionDebugInfo()` is never called → no live view URL

### Fix Applied
- Added extensive debug logging to `extractSessionIdFromToolResult()` (lines 873-936)
- Added Pattern 5 to check for nested `{ session: { id: "xxx" } }` format
- Added debug logs for all Stagehand tool calls to see what's being returned
- Logs will appear in agent-runtime console: `[Session Detection]`, `[Session Extraction]`, `[Stagehand Debug]`

### How to Diagnose
1. Run a test task and watch the agent-runtime logs
2. Look for `[Stagehand Debug] Tool called: mcp__stagehand__browserbase_session_create`
3. Look for `[Session Detection] Content preview:` to see what format Stagehand returns
4. If `[Session Extraction] No patterns matched`, add a new pattern matching the actual format

---

## Issue 2: Authentication Not Detected

### Root Cause
1. **Pre-execution auth check was NEVER called** - `detectAuthRequirements()` existed in `auth-detector.ts` but was never invoked
2. **Runtime detection was too weak** - relied on finding auth keywords in tool results, which might not contain them
3. **Agent proceeded blindly** - without pre-checking URLs, it would try to automate and hit login walls

### Fix Applied
- Added import for `detectAuthRequirements` from `auth-detector.ts` (line 33)
- Added pre-execution auth check (lines 320-360) that runs BEFORE Stagehand starts
- This check analyzes browser URLs in the task classification to detect auth-required services
- Logs warnings like: `Pre-execution auth check: google authentication required`
- Added debug logging for runtime auth detection

### Flow Now
1. Task classification identifies browser URLs (e.g., `sheets.google.com`)
2. Pre-execution check calls `detectAuthRequirements(urls)`
3. If auth required, logs a warning and checks for existing authenticated context
4. Agent proceeds - if no context exists, will pause when hitting login page
5. Runtime detection still active as backup

---

## Next Steps
1. **Test with a Google Sheets task** to verify pre-execution auth detection works
2. **Watch logs** for `[Session Detection]` to diagnose live view issue
3. If session ID still not extracted, update `extractSessionIdFromToolResult()` with the correct pattern
