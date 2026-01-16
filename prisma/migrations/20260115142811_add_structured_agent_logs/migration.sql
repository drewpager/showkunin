-- AlterEnum
ALTER TYPE "AgentRunStatus" ADD VALUE 'paused';

-- AlterTable
ALTER TABLE "AgentLog" ADD COLUMN     "actionType" TEXT,
ADD COLUMN     "stepNumber" INTEGER,
ADD COLUMN     "toolInput" TEXT,
ADD COLUMN     "toolName" TEXT,
ADD COLUMN     "toolOutput" TEXT;
