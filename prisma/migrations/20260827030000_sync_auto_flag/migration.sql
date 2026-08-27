-- AlterTable
-- ແຍກວຽກທີ່ຕົວຕັ້ງເວລາເລີ່ມເອງ ອອກຈາກວຽກທີ່ຄົນກົດ — ແຖວເກົ່າທັງໝົດຖືວ່າຄົນກົດ
ALTER TABLE "SyncLog" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false;
