import { parseDate, type DateRange } from "./date";
import { LeadStatus, OrderStatus } from "@/generated/prisma/enums";

/**
 * ເງື່ອນໄຂການກັ່ນຕອງຂອງໜ້າ Order ແລະ ໜ້າລູກຄ້າ.
 *
 * ຢູ່ບ່ອນດຽວເພາະ **ໜ້າຈໍກັບໄຟລ໌ທີ່ສົ່ງອອກຕ້ອງໄດ້ແຖວອັນດຽວກັນ** —
 * ຖ້າຂຽນເງື່ອນໄຂຄົນລະບ່ອນ ມື້ໜຶ່ງມັນຈະເພື້ອນກັນ ແລ້ວຄົນຈະສົ່ງໄຟລ໌
 * ທີ່ບໍ່ກົງກັບສິ່ງທີ່ຕົນເອງເຫັນອອກໄປໃຫ້ຄົນອື່ນ ໂດຍບໍ່ຮູ້ຕົວ.
 */

export type ListParams = {
  status?: string;
  campaign?: string;
  q?: string;
};

/** ສະຖານະທີ່ຮັບໄດ້ຈາກ URL — ຄ່າຂີ້ເຫຍື້ອຖືວ່າ "ບໍ່ກັ່ນຕອງ" */
export function validOrderStatus(value?: string): OrderStatus | undefined {
  return Object.values(OrderStatus).includes(value as OrderStatus)
    ? (value as OrderStatus)
    : undefined;
}

export function validLeadStatus(value?: string): LeadStatus | undefined {
  return Object.values(LeadStatus).includes(value as LeadStatus)
    ? (value as LeadStatus)
    : undefined;
}

export function orderWhere(range: DateRange, params: ListParams) {
  const q = params.q?.trim();
  const status = validOrderStatus(params.status);

  return {
    date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    ...(status ? { status } : {}),
    ...(params.campaign ? { campaignId: params.campaign } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" as const } },
            // ເບີໂທເປັນຕົວເລກຢູ່ແລ້ວ — ບໍ່ຕ້ອງ insensitive
            { phone: { contains: q } },
            { orderNo: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function leadWhere(range: DateRange, params: ListParams) {
  const q = params.q?.trim();
  const status = validLeadStatus(params.status);

  return {
    date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    ...(status ? { status } : {}),
    ...(params.campaign ? { campaignId: params.campaign } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { fbName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
