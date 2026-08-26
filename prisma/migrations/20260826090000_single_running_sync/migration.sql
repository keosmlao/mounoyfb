-- If an older deployment allowed overlapping jobs, keep the newest one active
-- and close the rest before adding the invariant.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "startedAt" DESC) AS position
  FROM "SyncLog"
  WHERE "status" = 'RUNNING'
)
UPDATE "SyncLog" AS log
SET
  "status" = 'FAILED',
  "finishedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP,
  "message" = 'ປິດອັດຕະໂນມັດ: ພົບວຽກ sync ຊ້ອນກັນ'
FROM ranked
WHERE log."id" = ranked."id" AND ranked.position > 1;

-- PostgreSQL partial unique index: there can be at most one RUNNING row.
CREATE UNIQUE INDEX "SyncLog_single_running_idx"
ON "SyncLog" ("status")
WHERE "status" = 'RUNNING';
