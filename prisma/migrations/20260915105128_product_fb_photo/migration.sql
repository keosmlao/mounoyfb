-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fbPhotoId" TEXT,
ADD COLUMN     "photoPageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_fbPhotoId_key" ON "Product"("fbPhotoId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_photoPageId_fkey" FOREIGN KEY ("photoPageId") REFERENCES "FbPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

