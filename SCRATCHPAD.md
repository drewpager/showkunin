# Browser Automation & API Integration Plan

## Overview

Enhance the agent SDK implementation to support browser-based tasks (Google Sheets), handle authentication/authorization, and enable HTTP API interactions.

---

## Current Architecture (Summary)

| Component | File | Purpose |
|-----------|------|---------|
| Agent Executor | `agent-runtime/src/agent-executor.ts` | Main execution logic with Claude Agent SDK |
| MCP Config | `agent-runtime/src/mcp-config.ts` | Dynamic MCP server provisioning (Playwright) |
| Task Classifier | `agent-runtime/src/task-classifier.ts` | Detects browser vs file tasks |
| Credentials | `agent-runtime/src/credential-manager.ts` | AES-256-GCM encryption/decryption |
| Checkpoints | `agent-runtime/src/checkpoint-manager.ts` | S3-backed state recovery |

**Existing MCP Tools**: `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_screenshot`, `browser_fill_form`

---

## Implementation Plan

### 1. Google Sheets Browser Automation

**Approach**: Use existing Playwright MCP with enhanced system prompts

**Changes to `agent-runtime/src/agent-executor.ts`**:
- Add Google Sheets-specific guidance to system prompt
- Include cell selection patterns (aria-labels like "A1, Cell")
- Add wait strategies for sheet loading
- Include formula entry guidance (prefix with "=")

**System Prompt Addition**:
```
## Google Sheets Automation
1. Navigate to full spreadsheet URL
2. Wait for load, then browser_snapshot to understand structure
3. Click cells using refs from snapshot (cells have aria-labels)
4. Use browser_type for data entry
5. Use Tab/Enter keys to navigate between cells
6. Verify changes with snapshot after entry
```

### 2. Authentication/Authorization Strategy

**Recommended: Browser Session Persistence**

**New File**: `agent-runtime/src/session-manager.ts`
- Store encrypted browser cookies per user/provider
- Inject cookies before navigation in Playwright
- Support Google, GitHub, and other OAuth providers

**New Prisma Model**:
```prisma
model BrowserSession {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // 'google', 'github'
  sessionData String   @db.Text // Encrypted cookies JSON
  expiresAt   DateTime
  @@unique([userId, provider])
}
```

**Authentication Flow**:
1. User completes OAuth in UI (existing NextAuth flow)
2. Capture session cookies and store encrypted
3. On agent run, inject cookies before browser navigation
4. If session expired, agent reports "authentication required"

**Security**:
- AES-256-GCM encryption (existing infrastructure)
- 24-48 hour session expiry
- Domain-scoped cookies only
- Audit logging for session usage

### 3. MCP Server for HTTP PUT/PATCH

**New File**: `agent-runtime/src/http-mcp-server.ts`

**Tools to implement**:

1. **`http_request`** - Generic HTTP client
   - Methods: GET, POST, PUT, PATCH, DELETE
   - Headers and body support
   - Timeout configuration
   - Returns status, headers, body

2. **`google_sheets_api`** - Direct Sheets API access
   - Operations: get, update, append, clear
   - Uses GOOGLE_SHEETS_API_KEY or GOOGLE_ACCESS_TOKEN
   - Bypasses browser for API-capable tasks

**Integration in `mcp-config.ts`**:
```typescript
"http-api": {
  type: "sdk", // In-process MCP server
  server: httpMcpServer,
}
```

**Credential Inference Updates** (`src/utils/credential-inference.ts`):
- Add GOOGLE_SHEETS_API_KEY pattern
- Add GOOGLE_ACCESS_TOKEN for OAuth tokens
- Add pattern for browser session cookies

### 4. Human-like Task Execution

**New File**: `agent-runtime/src/human-like-executor.ts`

**Patterns to implement**:
- Variable timing (500-2000ms between actions)
- Verification after each action (snapshot → check → proceed)
- Retry on failure (up to 3 attempts)
- Error reporting (capture snapshot + describe issue)

**System Prompt Updates**:
```
## Human-like Interaction
1. Wait 500-2000ms between major actions
2. Verify with snapshot after clicks
3. Retry if element not found (wait + retry, max 3x)
4. Report CAPTCHAs or unexpected dialogs immediately
5. Scroll to elements before interaction
```

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add BrowserSession model |
| `agent-runtime/src/session-manager.ts` | Create | Session storage/retrieval |
| `agent-runtime/src/http-mcp-server.ts` | Create | HTTP and Sheets API tools |
| `agent-runtime/src/human-like-executor.ts` | Create | Timing and verification patterns |
| `agent-runtime/src/mcp-config.ts` | Modify | Add http-api server |
| `agent-runtime/src/agent-executor.ts` | Modify | Enhanced system prompts |
| `src/utils/credential-inference.ts` | Modify | New credential patterns |

---

## Decisions Made

### Browser vs API for Google Sheets: **Both Equally**

| Method | When to Use |
|--------|-------------|
| **Browser (Playwright)** | Complex UI interactions, authenticated-only sheets, visual workflows |
| **API (Sheets REST)** | Bulk data operations, automated pipelines, when API credentials available |

**Implementation**: Task classifier decides based on:
- If GOOGLE_SHEETS_API_KEY provided → prefer API
- If sheet requires login and no API key → use browser
- If task involves complex UI (charts, formatting) → use browser

### OAuth Capture Method: **Headed Browser Session**

**Flow**:
1. Before agent execution, detect if authentication needed
2. Launch Playwright in headed (visible) mode
3. Navigate to Google login page
4. User completes OAuth manually in the visible browser
5. Capture cookies after successful login
6. Store encrypted cookies for future runs
7. Continue automation in headless mode

**Implementation in `mcp-config.ts`**:
```typescript
"playwright-headed": {
  type: "stdio",
  command: "npx",
  args: ["-y", "@anthropic-ai/mcp-server-playwright"], // No --headless flag
  env: { DISPLAY: process.env.DISPLAY ?? ":0" },
}
```

---

## Verification Plan

1. **Unit Tests**: Credential encryption, task classification, MCP tool responses
2. **Integration Tests**:
   - Session injection → browser navigation → authenticated page access
   - HTTP MCP → Google Sheets API → data modification
3. **E2E Test**: Full flow - create video → analyze → execute automation → verify in Google Sheets

---

## Implementation Order

1. **Headed Browser MCP Config** - Add `playwright-headed` server for OAuth flows
2. **Session Manager** - Store/retrieve encrypted browser cookies
3. **HTTP MCP Server** - Enable API-based operations (GET/POST/PUT/PATCH)
4. **Human-like Prompts** - Improve browser automation reliability
5. **Task Classifier Updates** - Smart API vs browser routing
6. **Credential Inference Updates** - Detect API key vs browser session needs

---

## Notes

- Existing Playwright MCP supports most browser operations
- Security model (AES-256-GCM) is production-ready
- Task classifier already detects Google Sheets patterns
- Headed browser requires DISPLAY env var (works on desktop, needs X11 forwarding in Docker)
