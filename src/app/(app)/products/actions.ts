"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { bool, num0, reqStr, str } from "@/lib/form";

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
  await prisma.product.update({ where: { id }, data: readForm(fd) });
  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(id: string) {
  await requireSession();
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  redirect("/products");
}
