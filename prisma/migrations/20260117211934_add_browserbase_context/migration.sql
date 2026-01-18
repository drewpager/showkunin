-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "browserbaseSessionId" TEXT,
ADD COLUMN     "liveViewUrl" TEXT;

-- CreateTable
CREATE TABLE "BrowserbaseContext" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserbaseContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserbaseContext_userId_idx" ON "BrowserbaseContext"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserbaseContext_userId_provider_key" ON "BrowserbaseContext"("userId", "provider");
