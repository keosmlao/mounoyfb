-- AlterTable
ALTER TABLE "SyncLog" ADD COLUMN     "doneDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill existing logs before enforcing NOT NULL. This keeps the migration
-- deployable on databases that already contain sync history.
UPDATE "SyncLog"
SET "updatedAt" = COALESCE("finishedAt", "startedAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "SyncLog" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
