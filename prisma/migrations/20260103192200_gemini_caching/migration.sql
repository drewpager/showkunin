-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "fileDeletedAt" TIMESTAMP(3),
ADD COLUMN     "geminiCacheExpiresAt" TIMESTAMP(3),
ADD COLUMN     "geminiCacheName" TEXT,
ADD COLUMN     "solved" BOOLEAN,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "thumbnailUrlExpiresAt" TIMESTAMP(3),
ADD COLUMN     "userContext" TEXT;
