-- AlterTable
ALTER TABLE "FbPage" ADD COLUMN     "inboxOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "token" TEXT;

-- CreateTable
CREATE TABLE "FbPost" (
    "id" TEXT NOT NULL,
    "fbPostId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "fromAd" BOOLEAN NOT NULL DEFAULT false,
    "campaignId" TEXT,
    "message" TEXT,
    "permalink" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FbPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FbComment" (
    "id" TEXT NOT NULL,
    "fbCommentId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "parentFbId" TEXT,
    "fromId" TEXT,
    "fromName" TEXT,
    "message" TEXT,
    "attachment" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "fromPage" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" TIMESTAMP(3),
    "assignee" TEXT,
    "leadId" TEXT,
    "commentedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FbComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FbThread" (
    "id" TEXT NOT NULL,
    "fbThreadId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT,
    "personName" TEXT,
    "snippet" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "waitingReply" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" TIMESTAMP(3),
    "assignee" TEXT,
    "leadId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FbThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FbMessage" (
    "id" TEXT NOT NULL,
    "fbMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromPage" BOOLEAN NOT NULL DEFAULT false,
    "fromId" TEXT,
    "fromName" TEXT,
    "text" TEXT,
    "attachment" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FbMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FbPost_fbPostId_key" ON "FbPost"("fbPostId");

-- CreateIndex
CREATE INDEX "FbPost_pageId_idx" ON "FbPost"("pageId");

-- CreateIndex
CREATE INDEX "FbPost_campaignId_idx" ON "FbPost"("campaignId");

-- CreateIndex
CREATE INDEX "FbPost_postedAt_idx" ON "FbPost"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FbComment_fbCommentId_key" ON "FbComment"("fbCommentId");

-- CreateIndex
CREATE INDEX "FbComment_pageId_commentedAt_idx" ON "FbComment"("pageId", "commentedAt");

-- CreateIndex
CREATE INDEX "FbComment_postId_idx" ON "FbComment"("postId");

-- CreateIndex
CREATE INDEX "FbComment_handled_idx" ON "FbComment"("handled");

-- CreateIndex
CREATE UNIQUE INDEX "FbThread_fbThreadId_key" ON "FbThread"("fbThreadId");

-- CreateIndex
CREATE INDEX "FbThread_pageId_lastMessageAt_idx" ON "FbThread"("pageId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "FbThread_handled_idx" ON "FbThread"("handled");

-- CreateIndex
CREATE UNIQUE INDEX "FbMessage_fbMessageId_key" ON "FbMessage"("fbMessageId");

-- CreateIndex
CREATE INDEX "FbMessage_threadId_sentAt_idx" ON "FbMessage"("threadId", "sentAt");

-- AddForeignKey
ALTER TABLE "FbPost" ADD CONSTRAINT "FbPost_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FbPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbPost" ADD CONSTRAINT "FbPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbComment" ADD CONSTRAINT "FbComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FbPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbComment" ADD CONSTRAINT "FbComment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FbPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbComment" ADD CONSTRAINT "FbComment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbThread" ADD CONSTRAINT "FbThread_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FbPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbThread" ADD CONSTRAINT "FbThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FbMessage" ADD CONSTRAINT "FbMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FbThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
