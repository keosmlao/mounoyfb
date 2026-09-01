-- AlterTable
ALTER TABLE "FbComment" ADD COLUMN     "attachmentLink" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "FbMessage" ADD COLUMN     "attachments" JSONB;

-- ຂອງເກົ່າ: ຊ່ອງ attachment ຂອງ comment ເກັບ "url ຫຼື type" ປົນກັນ.
-- ອັນທີ່ເປັນລິ້ງແມ່ນລິ້ງເປີດເບິ່ງທີ່ Facebook (ບໍ່ແມ່ນຮູບ) — ຍ້າຍໄປຊ່ອງມັນ
-- ແລ້ວປະ type ວ່າງໄວ້ ຮອບດຶງຕໍ່ໄປຈະຕື່ມທັງ type ແລະ ຮູບໃຫ້ເອງ.
UPDATE "FbComment"
SET "attachmentLink" = "attachment", "attachment" = NULL
WHERE "attachment" LIKE 'http%';
