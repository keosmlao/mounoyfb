-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('DRAFT', 'LIVE', 'ENDED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fbCustomerId" TEXT,
ADD COLUMN     "liveSessionId" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifyError" TEXT;

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "LiveStatus" NOT NULL DEFAULT 'DRAFT',
    "fbVideoId" TEXT,
    "permalink" TEXT,
    "note" TEXT,
    "pollAt" TIMESTAMP(3),
    "pollError" TEXT,
    "cursorAt" TIMESTAMP(3),
    "commentsSeen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClaim" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "itemId" TEXT,
    "fbCommentId" TEXT NOT NULL,
    "line" INTEGER NOT NULL DEFAULT 0,
    "fromId" TEXT,
    "fromName" TEXT,
    "message" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "commentedAt" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_fbVideoId_key" ON "LiveSession"("fbVideoId");

-- CreateIndex
CREATE INDEX "LiveSession_status_idx" ON "LiveSession"("status");

-- CreateIndex
CREATE INDEX "LiveSession_date_idx" ON "LiveSession"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LiveItem_sessionId_code_key" ON "LiveItem"("sessionId", "code");

-- CreateIndex
CREATE INDEX "LiveClaim_sessionId_commentedAt_idx" ON "LiveClaim"("sessionId", "commentedAt");

-- CreateIndex
CREATE INDEX "LiveClaim_itemId_idx" ON "LiveClaim"("itemId");

-- CreateIndex
CREATE INDEX "LiveClaim_orderId_idx" ON "LiveClaim"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClaim_fbCommentId_line_key" ON "LiveClaim"("fbCommentId", "line");

-- CreateIndex
CREATE INDEX "Order_liveSessionId_idx" ON "Order"("liveSessionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FbPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveItem" ADD CONSTRAINT "LiveItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveItem" ADD CONSTRAINT "LiveItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClaim" ADD CONSTRAINT "LiveClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClaim" ADD CONSTRAINT "LiveClaim_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LiveItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClaim" ADD CONSTRAINT "LiveClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
