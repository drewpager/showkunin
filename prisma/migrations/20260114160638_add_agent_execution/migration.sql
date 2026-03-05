-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "TaskCredential" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "TaskCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'pending',
    "agentSessionId" TEXT,
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentRunId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentRunId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "AgentCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskCredential_videoId_idx" ON "TaskCredential"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCredential_videoId_key_key" ON "TaskCredential"("videoId", "key");

-- CreateIndex
CREATE INDEX "AgentRun_videoId_idx" ON "AgentRun"("videoId");

-- CreateIndex
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentLog_agentRunId_idx" ON "AgentLog"("agentRunId");

-- CreateIndex
CREATE INDEX "AgentLog_timestamp_idx" ON "AgentLog"("timestamp");

-- CreateIndex
CREATE INDEX "AgentCheckpoint_agentRunId_idx" ON "AgentCheckpoint"("agentRunId");
