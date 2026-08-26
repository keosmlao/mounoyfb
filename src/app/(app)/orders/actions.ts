"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { enumVal, int0, num, reqDate, str } from "@/lib/form";
import { OrderStatus } from "@/generated/prisma/enums";

const STATUSES = Object.values(OrderStatus);

function nonNegative(value: number | null, label: string): number | null {
  if (value === null) return null;
  if (value < 0) throw new Error(`${label} ຕ້ອງບໍ່ຕິດລົບ`);
  return value;
}

async function readOrderForm(fd: FormData) {
  const leadId = str(fd, "leadId");
  let productId = str(fd, "productId");
  let campaignId = str(fd, "campaignId");
  const quantity = Math.max(1, int0(fd, "quantity"));

  const lead = leadId
    ? await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          name: true,
          phone: true,
          channel: true,
          productId: true,
          campaignId: true,
          adSetId: true,
          adId: true,
        },
      })
    : null;
  if (leadId && !lead) throw new Error("ບໍ່ພົບລູກຄ້າທີ່ເລືອກ");

  productId ??= lead?.productId ?? null;
  campaignId ??= lead?.campaignId ?? null;

  const [product, campaign] = await Promise.all([
    productId
      ? prisma.product.findUnique({
          where: { id: productId },
          select: { price: true, cost: true },
        })
      : null,
    campaignId
      ? prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { id: true, productId: true },
        })
      : null,
  ]);
  if (productId && !product) throw new Error("ບໍ່ພົບສິນຄ້າທີ່ເລືອກ");
  if (campaignId && !campaign) throw new Error("ບໍ່ພົບແຄມເປນທີ່ເລືອກ");

  // ຖ້າເລືອກແຄມເປນແຕ່ບໍ່ເລືອກສິນຄ້າ ໃຫ້ຮັບສິນຄ້າຈາກແຄມເປນ.
  if (!productId && campaign?.productId) {
    productId = campaign.productId;
  }
  const inferredProduct =
    !product && productId
      ? await prisma.product.findUnique({
          where: { id: productId },
          select: { price: true, cost: true },
        })
      : product;

  const enteredSale = nonNegative(num(fd, "saleAmount"), "ຍອດຂາຍ");
  const enteredProductCost = nonNegative(num(fd, "productCost"), "ຕົ້ນທຶນສິນຄ້າ");
  const shippingCost = nonNegative(num(fd, "shippingCost"), "ຄ່າສົ່ງ") ?? 0;
  const otherCost = nonNegative(num(fd, "otherCost"), "ຄ່າອື່ນ") ?? 0;
  const refundAmount = nonNegative(num(fd, "refundAmount"), "ເງິນຄືນ") ?? 0;
  const saleAmount = enteredSale ?? (inferredProduct?.price ?? 0) * quantity;
  const productCost =
    enteredProductCost ?? (inferredProduct?.cost ?? 0) * quantity;
  const status = enumVal(fd, "status", STATUSES, OrderStatus.PENDING);

  if (status === "DELIVERED" && saleAmount <= 0) {
    throw new Error("Order ຮັບສຳເລັດຕ້ອງມີຍອດຂາຍຫຼາຍກວ່າ 0");
  }
  if (refundAmount > saleAmount) {
    throw new Error("ເງິນຄືນຕ້ອງບໍ່ຫຼາຍກວ່າຍອດຂາຍ");
  }

  const customerName = str(fd, "customerName") ?? lead?.name;
  if (!customerName) throw new Error('ຕ້ອງໃສ່ "ຊື່ລູກຄ້າ"');

  return {
    orderNo: str(fd, "orderNo"),
    date: reqDate(fd, "date", "ວັນທີ່"),
    status,
    customerName,
    phone: str(fd, "phone") ?? lead?.phone ?? null,
    channel: str(fd, "channel") ?? lead?.channel ?? null,
    quantity,
    saleAmount,
    productCost,
    shippingCost,
    otherCost,
    refundAmount,
    trackingNo: str(fd, "trackingNo"),
    note: str(fd, "note"),
    leadId,
    productId,
    campaignId,
    adSetId: lead?.adSetId ?? null,
    adId: lead?.adId ?? null,
  };
}

function revalidateOrderViews() {
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/alerts");
  revalidatePath("/campaigns");
}

export async function createOrder(fd: FormData) {
  await requireSession();
  await prisma.order.create({ data: await readOrderForm(fd) });
  revalidateOrderViews();
  redirect("/orders");
}

export async function updateOrder(id: string, fd: FormData) {
  await requireSession();
  await prisma.order.update({ where: { id }, data: await readOrderForm(fd) });
  revalidateOrderViews();
  redirect("/orders");
}

export async function setOrderStatus(id: string, fd: FormData) {
  await requireSession();
  const status = enumVal(fd, "status", STATUSES, OrderStatus.PENDING);
  const order = await prisma.order.findUnique({
    where: { id },
    select: { saleAmount: true },
  });
  if (!order) throw new Error("ບໍ່ພົບ Order");
  if (status === "DELIVERED" && order.saleAmount <= 0) {
    throw new Error("ຕ້ອງໃສ່ຍອດຂາຍກ່ອນປ່ຽນເປັນຮັບສຳເລັດ");
  }
  await prisma.order.update({ where: { id }, data: { status } });
  revalidateOrderViews();
}

export async function deleteOrder(id: string) {
  await requireSession();
  await prisma.order.delete({ where: { id } });
  revalidateOrderViews();
  redirect("/orders");
}
