"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { parseDate } from "@/lib/date";
import { num, str } from "@/lib/form";
import {
  parseOrderCsv,
  type ParsedOrder,
  type ParseResult,
} from "@/lib/order-import";

/**
 * ນຳເຂົ້າ Order ຈາກ CSV — ເຮັດເປັນ 2 ຂັ້ນສະເໝີ:
 * **ເບິ່ງຕົວຢ່າງກ່ອນ → ຈຶ່ງບັນທຶກ** ເພາະການນຳເຂົ້າຜິດແກ້ຄືນຍາກ
 * ແລະ ຄົນຕ້ອງເຫັນວ່າລະບົບຈັບຄູ່ຄໍລຳຖືກບໍ່ກ່ອນ.
 */

export type ImportState =
  | { phase: "idle" }
  | {
      phase: "preview";
      text: string;
      fxRate: number;
      result: ParseResult;
      /** ແຄມເປນ/ສິນຄ້າທີ່ຊື່ໃນໄຟລ໌ຫາບໍ່ພົບ — ບອກກ່ອນວ່າຈະບໍ່ຖືກຜູກ */
      unknownCampaigns: string[];
      unknownProducts: string[];
    }
  | {
      phase: "done";
      created: number;
      updated: number;
      skipped: number;
      linkedCampaign: number;
    }
  | { phase: "error"; message: string };

/** ອ່ານຕົວໜັງສືຈາກໄຟລ໌ ຫຼື ຈາກຊ່ອງວາງຂໍ້ຄວາມ */
async function readInput(fd: FormData): Promise<string> {
  const pasted = str(fd, "text");
  if (pasted) return pasted;

  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("ໄຟລ໌ໃຫຍ່ເກີນ 5MB — ແບ່ງເປັນຫຼາຍໄຟລ໌ກ່ອນ");
    }
    return await file.text();
  }
  throw new Error("ຍັງບໍ່ໄດ້ເລືອກໄຟລ໌ ຫຼື ວາງຂໍ້ຄວາມ");
}

/** ຂັ້ນ 1 — ອ່ານ ແລ້ວສະແດງໃຫ້ເບິ່ງກ່ອນ */
export async function previewImport(
  _prev: ImportState,
  fd: FormData,
): Promise<ImportState> {
  await requireSession();
  try {
    const text = await readInput(fd);
    const fxRate = str(fd, "currency") === "USD" ? (num(fd, "fxRate") ?? 0) : 0;
    if (str(fd, "currency") === "USD" && fxRate <= 0) {
      return { phase: "error", message: "ໃສ່ອັດຕາແລກປ່ຽນກ່ອນ ຖ້າໄຟລ໌ເປັນໂດລາ" };
    }

    const result = parseOrderCsv(text, { fxRate: fxRate || undefined });

    const [campaigns, products] = await Promise.all([
      prisma.campaign.findMany({ select: { name: true } }),
      prisma.product.findMany({ select: { name: true, sku: true } }),
    ]);
    const campaignNames = new Set(campaigns.map((c) => c.name.toLowerCase()));
    const productNames = new Set(
      products.flatMap((p) =>
        [p.name, p.sku].filter(Boolean).map((v) => (v as string).toLowerCase()),
      ),
    );

    const unknownCampaigns = [
      ...new Set(
        result.orders
          .map((o) => o.campaignName)
          .filter((n): n is string => Boolean(n))
          .filter((n) => !campaignNames.has(n.toLowerCase())),
      ),
    ].slice(0, 10);

    const unknownProducts = [
      ...new Set(
        result.orders
          .map((o) => o.productName)
          .filter((n): n is string => Boolean(n))
          .filter((n) => !productNames.has(n.toLowerCase())),
      ),
    ].slice(0, 10);

    return {
      phase: "preview",
      text,
      fxRate,
      result,
      unknownCampaigns,
      unknownProducts,
    };
  } catch (e) {
    return { phase: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** ຂັ້ນ 2 — ບັນທຶກຈິງ */
export async function confirmImport(
  _prev: ImportState,
  fd: FormData,
): Promise<ImportState> {
  await requireSession();
  try {
    const text = str(fd, "text");
    if (!text) return { phase: "error", message: "ຂໍ້ມູນຫາຍໄປ — ເລີ່ມໃໝ່ອີກເທື່ອ" };

    const fxRate = num(fd, "fxRate") ?? 0;
    const { orders } = parseOrderCsv(text, { fxRate: fxRate || undefined });
    if (orders.length === 0) {
      return { phase: "error", message: "ບໍ່ມີແຖວທີ່ນຳເຂົ້າໄດ້" };
    }

    const [campaigns, products] = await Promise.all([
      prisma.campaign.findMany({ select: { id: true, name: true } }),
      prisma.product.findMany({ select: { id: true, name: true, sku: true } }),
    ]);
    const campaignByName = new Map(
      campaigns.map((c) => [c.name.toLowerCase(), c.id]),
    );
    const productByName = new Map<string, string>();
    for (const p of products) {
      productByName.set(p.name.toLowerCase(), p.id);
      if (p.sku) productByName.set(p.sku.toLowerCase(), p.id);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let linkedCampaign = 0;

    for (const o of orders) {
      const campaignId = o.campaignName
        ? (campaignByName.get(o.campaignName.toLowerCase()) ?? null)
        : null;
      const productId = o.productName
        ? (productByName.get(o.productName.toLowerCase()) ?? null)
        : null;
      if (campaignId) linkedCampaign++;

      const data = {
        date: parseDate(o.date),
        status: o.status,
        customerName: o.customerName,
        phone: o.phone,
        channel: o.channel,
        quantity: o.quantity,
        saleAmount: o.saleAmount,
        productCost: o.productCost,
        shippingCost: o.shippingCost,
        otherCost: o.otherCost,
        refundAmount: o.refundAmount,
        trackingNo: o.trackingNo,
        note: o.note,
        campaignId,
        productId,
      };

      // ມີເລກອໍເດີ = ນຳເຂົ້າຊ້ຳໄດ້ໂດຍບໍ່ເກີດແຖວຊ້ຳ
      if (o.orderNo) {
        const existing = await prisma.order.findUnique({
          where: { orderNo: o.orderNo },
          select: { id: true },
        });
        if (existing) {
          await prisma.order.update({ where: { id: existing.id }, data });
          updated++;
          continue;
        }
        await prisma.order.create({ data: { ...data, orderNo: o.orderNo } });
        created++;
        continue;
      }

      // ບໍ່ມີເລກອໍເດີ — ກັນຊ້ຳດ້ວຍ (ວັນ + ຊື່ + ຍອດ) ເທົ່າທີ່ເຮັດໄດ້
      const dup = await prisma.order.findFirst({
        where: {
          date: data.date,
          customerName: data.customerName,
          saleAmount: data.saleAmount,
        },
        select: { id: true },
      });
      if (dup) {
        skipped++;
        continue;
      }
      await prisma.order.create({ data });
      created++;
    }

    revalidatePath("/orders");
    revalidatePath("/reports");
    revalidatePath("/analysis");
    revalidatePath("/");

    return { phase: "done", created, updated, skipped, linkedCampaign };
  } catch (e) {
    return { phase: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export type { ParsedOrder };
