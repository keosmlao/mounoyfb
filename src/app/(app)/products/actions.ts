"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bool, num0, reqStr, str } from "@/lib/form";
import { photoSource } from "@/lib/fb-photos";
import { explainFbError } from "@/lib/fb";

function readForm(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ສິນຄ້າ"),
    sku: str(fd, "sku"),
    price: num0(fd, "price"),
    cost: num0(fd, "cost"),
    imageUrl: str(fd, "imageUrl"),
    active: bool(fd, "active"),
    note: str(fd, "note"),
  };
}

export async function createProduct(fd: FormData) {
  await requireSession();
  await prisma.product.create({ data: readForm(fd) });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, fd: FormData) {
  await requireSession();
  const current = await prisma.product.findUnique({ where: { id }, select: { fbPhotoId: true } });
  const { imageUrl, ...rest } = readForm(fd);
  await prisma.product.update({
    where: { id },
    // ຮູບຈາກເພຈ: ຟອມບໍ່ມີຊ່ອງລິ້ງຮູບ — ຢ່າທັບລິ້ງທີ່ລະບົບເກັບໄວ້
    data: current?.fbPhotoId ? rest : { ...rest, imageUrl },
  });
  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(id: string) {
  await requireSession();
  const removed = await prisma.product.delete({ where: { id } });
  await recordAudit("product.delete", removed.name);
  revalidatePath("/products");
  redirect("/products");
}

/**
 * ສ້າງສິນຄ້າຈາກຮູບໃນເພຈ — ຊື່/ລາຄາ ມາຈາກຟອມທີ່ຄົນກວດແລ້ວ (ຮ່າງຈາກຄຳບັນຍາຍ).
 * ຄືນຂໍ້ຄວາມແທນການ throw ເພາະໜ້ານີ້ມີຫຼາຍຟອມ — ຮູບດຽວລົ້ມບໍ່ຄວນພັງທັງໜ້າ.
 */
export async function createProductFromPhoto(
  pageId: string,
  photoId: string,
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  await requireSession();
  try {
    const existing = await prisma.product.findUnique({
      where: { fbPhotoId: photoId },
      select: { name: true },
    });
    if (existing) return `ຮູບນີ້ເປັນສິນຄ້າ “${existing.name}” ແລ້ວ`;

    const sku = str(fd, "sku");
    if (sku && (await prisma.product.findUnique({ where: { sku }, select: { id: true } }))) {
      return `SKU ${sku} ມີແລ້ວ`;
    }

    await prisma.product.create({
      data: {
        name: reqStr(fd, "name", "ຊື່ສິນຄ້າ"),
        sku,
        price: num0(fd, "price"),
        cost: num0(fd, "cost"),
        active: true,
        fbPhotoId: photoId,
        photoPageId: pageId,
        // ລິ້ງນີ້ໝົດອາຍຸໄດ້ — route ຮູບຈະຂໍໃໝ່ໃຫ້ເອງ
        imageUrl: await photoSource(pageId, photoId).catch(() => null),
      },
    });
    revalidatePath("/products");
    revalidatePath("/products/from-page");
    return null;
  } catch (error) {
    return explainFbError(error);
  }
}

/** ເອົາຮູບຈາກເພຈອອກ — ກັບໄປໃສ່ລິ້ງຮູບເອງໄດ້ */
export async function unlinkProductPhoto(id: string) {
  await requireSession();
  await prisma.product.update({
    where: { id },
    data: { fbPhotoId: null, photoPageId: null, imageUrl: null },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}
