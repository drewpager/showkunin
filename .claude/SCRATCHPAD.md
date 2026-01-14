     Overview

     Integrate the Claude Agent SDK to enable actual execution of
     automations from screencast recordings. Currently, the system analyzes
      videos and generates Computer Use Plans, but cannot execute them
     (button disabled at VideoAnalysis.tsx:588).

     User Goals

     1. Execute automations from analyzed screencasts using Claude Agent
     SDK
     2. Per-task credentials - isolated environment variables for each task
      (important for sharing)
     3. Full computer use - both browser automation AND API/CLI operations
     4. File checkpointing - ability to revert AI changes
     5. MVP approach - basic execution first, advanced credential
     management later

     Architecture

     Component Structure

     Next.js App (Vercel)
       ↓ Creates AgentRun record (status: pending)
       ↓ Stores encrypted TaskCredentials
     PostgreSQL Database (Shared)
       ↓ Polling every 10s
     Agent Runtime Service (Docker Container on VPS)
       ↓ Initializes Claude Agent SDK
       ↓ Downloads video + analysis from S3
       ↓ Injects per-task credentials
       ↓ Executes Computer Use Plan
       ↓ Streams logs back to DB

     Why This Architecture?

     - Database-based job queue: Simple polling (every 10s) for MVP, no
     complex infrastructure
     - Separate agent runtime: Avoids Vercel 60s timeout, enables
     long-running tasks
     - Docker container: Easy deployment, workspace isolation, security
     sandboxing
     - Shared PostgreSQL: Next.js and Agent Runtime both access same
     database

     Database Schema Changes

     Add to /prisma/schema.prisma:

     New Models

     // Per-task encrypted credentials
     model TaskCredential {
       id        String   @id @default(cuid())
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt
       videoId   String
       video     Video    @relation(fields: [videoId], references: [id],
     onDelete: Cascade)
       key       String   // e.g., "GITHUB_TOKEN"
       value     String   @db.Text // AES-256-GCM encrypted

       @@index([videoId])
       @@unique([videoId, key])
     }

     // Execution tracking
     model AgentRun {
       id             String         @id @default(cuid())
       createdAt      DateTime       @default(now())
       updatedAt      DateTime       @updatedAt
       videoId        String
       video          Video          @relation(fields: [videoId],
     references: [id], onDelete: Cascade)
       userId         String
       user           User           @relation(fields: [userId],
     references: [id], onDelete: Cascade)
       status         AgentRunStatus @default(pending)
       agentSessionId String?
       exitCode       Int?
       errorMessage   String?        @db.Text
       startedAt      DateTime?
       completedAt    DateTime?
       logs           AgentLog[]
       checkpoints    AgentCheckpoint[]

       @@index([videoId])
       @@index([userId])
       @@index([status])
     }

     enum AgentRunStatus {
       pending
       running
       completed
       failed
       cancelled
     }

     // Real-time logs
     model AgentLog {
       id         String   @id @default(cuid())
       createdAt  DateTime @default(now())
       agentRunId String
       agentRun   AgentRun @relation(fields: [agentRunId], references:
     [id], onDelete: Cascade)
       level      String   // info, error, debug
       message    String   @db.Text
       timestamp  DateTime @default(now())

       @@index([agentRunId])
       @@index([timestamp])
     }

     // File checkpoints for rollback
     model AgentCheckpoint {
       id          String   @id @default(cuid())
       createdAt   DateTime @default(now())
       agentRunId  String
       agentRun    AgentRun @relation(fields: [agentRunId], references:
     [id], onDelete: Cascade)
       s3Key       String   // S3 location of checkpoint tar.gz
       description String?

       @@index([agentRunId])
     }

     Extend Existing Models

     model Video {
       // ... existing fields ...
       credentials TaskCredential[]
       agentRuns   AgentRun[]
     }

     model User {
       // ... existing fields ...
       agentRuns   AgentRun[]
     }

     Files Modified and Created

     1. /prisma/schema.prisma
       - Add 4 new models: TaskCredential, AgentRun, AgentLog,
     AgentCheckpoint
       - Add AgentRunStatus enum
       - Extend Video and User models with relations
     2. /src/server/api/routers/video.ts (~1,252 lines → ~1,450 lines)
       - Add executeAutomation mutation - creates AgentRun + stores
     encrypted credentials
       - Add getAgentRun query - fetch run status + logs for UI
       - Add getAgentRuns query - list all runs for a video
       - Add cancelAgentRun mutation - cancel running execution
       - Add restoreCheckpoint mutation - rollback to checkpoint
     3. /src/components/VideoAnalysis.tsx (~807 lines → ~950 lines)
       - Remove disabled={true} from button (line 588)
       - Add credential input modal (simple text inputs for MVP)
       - Add <AgentRunMonitor /> component for status/logs display
       - Wire up executeAutomation mutation
     4. /package.json
       - Add dependency: @anthropic-ai/claude-agent-sdk
     5. /agent-runtime/package.json (NEW)
       - Separate Node.js service for agent execution
       - Dependencies: @anthropic-ai/claude-agent-sdk, @prisma/client,
     @aws-sdk/client-s3
     6. /agent-runtime/src/index.ts (NEW - ~150 lines)
       - Main polling loop - checks DB every 10s for pending AgentRuns
       - Orchestrates job processing
       - Error handling and retries
     7. /agent-runtime/src/agent-executor.ts (NEW - ~300 lines)
       - Initialize Claude Agent SDK
       - Download video from S3
       - Parse Computer Use Plan from aiAnalysis field
       - Build system prompt from video + analysis
       - Execute automation via Agent SDK
       - Handle session management
     8. /agent-runtime/src/credential-manager.ts (NEW - ~100 lines)
       - Decrypt TaskCredentials using AES-256-GCM
       - Inject into process environment for agent execution
       - Encryption/decryption utilities
     9. /agent-runtime/src/checkpoint-manager.ts (NEW - ~150 lines)
       - Create file system snapshots before execution
       - Tar/gzip workspace directory
       - Upload checkpoint to S3
       - Restore from checkpoint on user request
     10. /agent-runtime/src/log-streamer.ts (NEW - ~80 lines)
       - Stream logs from Agent SDK to AgentLog table
       - Format log messages
       - Handle different log levels
     11. /agent-runtime/Dockerfile (NEW - ~30 lines)
       - Containerize agent runtime
       - Non-root user for security
       - Volume mount for workspace isolation
     12. /src/components/AgentRunMonitor.tsx (NEW - ~400 lines)
       - Real-time log viewer (polls getAgentRun query)
       - Status indicator (pending/running/completed/failed)
       - Checkpoint management UI
       - Cancel/retry buttons
     13. /src/utils/encryption.ts (NEW - ~50 lines)
       - Shared encryption helpers (used by Next.js when storing
     credentials)
       - AES-256-GCM encrypt/decrypt functions
     14. /docker-compose.yml (NEW - ~50 lines)
       - Local development orchestration
       - PostgreSQL + Next.js + Agent Runtime
       - Shared database access

     Execution Flow

     1. User clicks "Implement Automation" → Opens credential input modal
     2. User enters credentials (e.g., GITHUB_TOKEN, API_KEY) → Submits
     3. Frontend calls executeAutomation mutation → Sends videoId +
     credentials
     4. tRPC handler (video.ts):
       - Validates user owns video
       - Encrypts credentials with AES-256-GCM
       - Stores in TaskCredential table
       - Creates AgentRun record with status: 'pending'
       - Returns runId to frontend
     5. Frontend shows <AgentRunMonitor /> → Polls getAgentRun query every
     3s
     6. Agent Runtime polling loop (runs every 10s):
       - Queries for AgentRun where status = 'pending'
       - Picks oldest run, marks as status: 'running'
     7. Agent Executor initializes:
       - Downloads video from S3
       - Parses Computer Use Plan from video.aiAnalysis
       - Decrypts TaskCredentials
       - Creates pre-execution checkpoint → uploads to S3
     8. Claude Agent SDK execution:
       - Initializes with video context + analysis as system prompt
       - Injects credentials into environment
       - Executes Computer Use Plan (browser automation + CLI operations)
       - Streams logs to AgentLog table in real-time
     9. Completion:
       - Update AgentRun.status to 'completed' or 'failed'
       - Create final checkpoint
       - Frontend shows completion status + logs

     Security Considerations

     Credential Encryption

     - AES-256-GCM encryption for TaskCredential.value
     - Encryption key stored in ENCRYPTION_KEY env var (Agent Runtime only)
     - Never send decrypted credentials to frontend

     Workspace Isolation

     - Each run gets dedicated /workspace/{runId} directory
     - Docker volume mounts for file system isolation
     - Cleaned up after execution completes

     Authorization

     - Only video owner can execute automation
     - Validate ownership before creating AgentRun
     - Per-task credentials isolated from other users

     Implementation Phases

     Phase 1: Database Schema (Week 1)

     1. Update schema.prisma with new models
     2. Generate migration (without applying): npx prisma migrate dev 
     --create-only --name add-agent-execution
     3. Review generated SQL in
     /prisma/migrations/{timestamp}_add-agent-execution/migration.sql
     4. (Optional) Backup database: pg_dump $DATABASE_URL > backup.sql
     5. Apply migration: npx prisma migrate dev
     6. Generate Prisma client: npx prisma generate
     7. Test manual record creation

     Phase 2: Agent Runtime Skeleton (Week 1-2)

     1. Create /agent-runtime/ directory structure
     2. Implement polling loop (status updates only, no SDK yet)
     3. Create Dockerfile
     4. Test database connectivity from runtime

     Phase 3: Credential Management (Week 2)

     1. Implement encryption utilities (/src/utils/encryption.ts)
     2. Add executeAutomation mutation to video.ts
     3. Build credential input UI in VideoAnalysis.tsx
     4. Test credential storage/retrieval

     Phase 4: Agent SDK Integration (Week 2-3)

     1. Install @anthropic-ai/claude-agent-sdk
     2. Implement agent initialization in agent-executor.ts
     3. Parse Computer Use Plan from aiAnalysis field
     4. Test execution with simple plan (no video context yet)

     Phase 5: Video Context Integration (Week 3)

     1. Pass video URL to Agent SDK
     2. Include AI analysis in system prompt
     3. Test with real screencast videos
     4. Validate agent understands context

     Phase 6: Log Streaming & Monitoring (Week 3-4)

     1. Implement log streamer to database
     2. Create AgentRunMonitor.tsx component
     3. Add real-time polling in frontend
     4. Test log display

     Phase 7: Checkpointing (Week 4)

     1. Implement checkpoint creation before execution
     2. Upload to S3
     3. Add restore functionality
     4. Test rollback

     Phase 8: Polish & Testing (Week 4-5)

     1. Error handling improvements
     2. Retry logic for failed runs
     3. Rate limiting per user
     4. End-to-end testing

     Verification Steps

     After Implementation

     1. Test Credential Storage:
       - Enter GitHub token in UI
       - Verify encrypted value in database
       - Confirm decryption in agent runtime
     2. Test Basic Execution:
       - Record screencast showing simple workflow (e.g., "Open GitHub
     repo")
       - Analyze video to generate Computer Use Plan
       - Click "Implement Automation"
       - Verify AgentRun created with status: 'pending'
       - Confirm agent runtime picks up job → status: 'running'
       - Watch logs stream in real-time
       - Verify completion → status: 'completed'
     3. Test Browser Automation:
       - Record workflow involving web interactions
       - Execute automation
       - Verify agent can control browser (clicks, form fills, navigation)
     4. Test API/CLI Operations:
       - Record workflow involving terminal commands or API calls
       - Execute automation
       - Verify agent can run commands and make API requests
     5. Test Checkpointing:
       - Execute automation that modifies files
       - Create checkpoint
       - Restore from checkpoint
       - Verify files reverted to original state
     6. Test Error Handling:
       - Trigger execution with invalid credentials
       - Verify status: 'failed' with error message
       - Check logs for helpful debugging info
     7. Test Sharing Isolation:
       - Share task publicly
       - Verify other users cannot see credentials
       - Confirm they must provide own credentials to execute
