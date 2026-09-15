-- CreateTable
CREATE TABLE "LiveBoost" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "fbCampaignId" TEXT,
    "fbAdSetId" TEXT,
    "fbCreativeId" TEXT,
    "fbAdId" TEXT,
    "budget" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "budgetLak" DOUBLE PRECISION NOT NULL,
    "hours" INTEGER NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "effectiveStatus" TEXT,
    "reviewNote" TEXT,
    "spend" DOUBLE PRECISION,
    "reach" INTEGER,
    "impressions" INTEGER,
    "checkedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStat" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER,
    "viewers" INTEGER,
    "avgWatchMs" INTEGER,
    "totalWatchMs" DOUBLE PRECISION,
    "impressions" INTEGER,
    "reactions" INTEGER,

    CONSTRAINT "LiveStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveBoost_fbCampaignId_key" ON "LiveBoost"("fbCampaignId");

-- CreateIndex
CREATE INDEX "LiveBoost_sessionId_idx" ON "LiveBoost"("sessionId");

-- CreateIndex
CREATE INDEX "LiveStat_sessionId_at_idx" ON "LiveStat"("sessionId", "at");

-- AddForeignKey
ALTER TABLE "LiveBoost" ADD CONSTRAINT "LiveBoost_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBoost" ADD CONSTRAINT "LiveBoost_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStat" ADD CONSTRAINT "LiveStat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

