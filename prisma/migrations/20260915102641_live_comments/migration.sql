-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "autoAck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoHide" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LiveComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fbCommentId" TEXT NOT NULL,
    "parentFbId" TEXT,
    "fromId" TEXT,
    "fromName" TEXT,
    "message" TEXT,
    "commentedAt" TIMESTAMP(3) NOT NULL,
    "fromPage" BOOLEAN NOT NULL DEFAULT false,
    "isCf" BOOLEAN NOT NULL DEFAULT false,
    "isQuestion" BOOLEAN NOT NULL DEFAULT false,
    "spam" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" TIMESTAMP(3),
    "privateRepliedAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),
    "ackError" TEXT,
    "autoHideAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveComment_fbCommentId_key" ON "LiveComment"("fbCommentId");

-- CreateIndex
CREATE INDEX "LiveComment_sessionId_commentedAt_idx" ON "LiveComment"("sessionId", "commentedAt");

-- CreateIndex
CREATE INDEX "LiveComment_parentFbId_idx" ON "LiveComment"("parentFbId");

-- AddForeignKey
ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
