-- AlterTable
ALTER TABLE "AdAccount" ADD COLUMN     "fbAmountSpent" DOUBLE PRECISION,
ADD COLUMN     "fbBalance" DOUBLE PRECISION,
ADD COLUMN     "fbBillingAt" TIMESTAMP(3),
ADD COLUMN     "fbBusinessName" TEXT,
ADD COLUMN     "fbFundingSource" TEXT,
ADD COLUMN     "fbSpendCap" DOUBLE PRECISION;
