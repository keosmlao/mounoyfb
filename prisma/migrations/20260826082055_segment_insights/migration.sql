-- CreateEnum
CREATE TYPE "SegmentKind" AS ENUM ('AGE_GENDER', 'PLATFORM', 'REGION', 'HOUR');

-- CreateTable
CREATE TABLE "SegmentInsight" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "SegmentKind" NOT NULL,
    "segKey" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fxRateToLak" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spendLak" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "leadsCount" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegmentInsight_kind_date_idx" ON "SegmentInsight"("kind", "date");

-- CreateIndex
CREATE INDEX "SegmentInsight_campaignId_kind_idx" ON "SegmentInsight"("campaignId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentInsight_date_kind_segKey_campaignId_key" ON "SegmentInsight"("date", "kind", "segKey", "campaignId");

-- AddForeignKey
ALTER TABLE "SegmentInsight" ADD CONSTRAINT "SegmentInsight_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentInsight" ADD CONSTRAINT "SegmentInsight_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
