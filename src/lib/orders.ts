import type { OrderStatus } from "@/generated/prisma/enums";
import { safeDiv } from "./format";

export type OrderFinancialRow = {
  status: OrderStatus;
  saleAmount: number;
  productCost: number;
  shippingCost: number;
  otherCost: number;
  refundAmount: number;
};

export type OrderTotals = {
  orders: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  returned: number;
  cancelled: number;
  grossSales: number;
  refunds: number;
  netRevenue: number;
  productCost: number;
  fulfillmentCost: number;
  orderMargin: number;
};

export type OrderEconomics = OrderTotals & {
  adSpend: number;
  contributionProfit: number;
  actualRoas: number;
  costPerDeliveredOrder: number;
  returnRate: number;
};

export const EMPTY_ORDER_TOTALS: OrderTotals = {
  orders: 0,
  pending: 0,
  confirmed: 0,
  shipped: 0,
  delivered: 0,
  returned: 0,
  cancelled: 0,
  grossSales: 0,
  refunds: 0,
  netRevenue: 0,
  productCost: 0,
  fulfillmentCost: 0,
  orderMargin: 0,
};

/**
 * ແປງ Order 1 ແຖວເປັນຕົວເລກການເງິນທີ່ນັບໄດ້.
 * - ຍອດຂາຍ/ຕົ້ນທຶນສິນຄ້ານັບສະເພາະ DELIVERED.
 * - ຄ່າສົ່ງ/ຄ່າອື່ນນັບຕັ້ງແຕ່ SHIPPED ເພາະເປັນເງິນທີ່ເສຍໄປແລ້ວ,
 *   ລວມທັງ RETURNED. ຖ້າມີຄ່າເສຍຫາຍຈາກຕີກັບ ໃຫ້ໃສ່ otherCost.
 */
export function orderTotals(row: OrderFinancialRow): OrderTotals {
  const out = { ...EMPTY_ORDER_TOTALS, orders: 1 };
  out[row.status.toLowerCase() as Lowercase<OrderStatus>] = 1;

  const delivered = row.status === "DELIVERED";
  const fulfillmentIncurred = ["SHIPPED", "DELIVERED", "RETURNED"].includes(
    row.status,
  );

  if (delivered) {
    out.grossSales = Math.max(0, row.saleAmount);
    out.refunds = Math.min(out.grossSales, Math.max(0, row.refundAmount));
    out.netRevenue = out.grossSales - out.refunds;
    out.productCost = Math.max(0, row.productCost);
  }
  if (fulfillmentIncurred) {
    out.fulfillmentCost = Math.max(0, row.shippingCost) + Math.max(0, row.otherCost);
  }
  out.orderMargin = out.netRevenue - out.productCost - out.fulfillmentCost;
  return out;
}

const TOTAL_KEYS = Object.keys(EMPTY_ORDER_TOTALS) as (keyof OrderTotals)[];

export function sumOrderTotals(rows: Iterable<OrderFinancialRow>): OrderTotals {
  const out = { ...EMPTY_ORDER_TOTALS };
  for (const row of rows) {
    const one = orderTotals(row);
    for (const key of TOTAL_KEYS) out[key] += one[key];
  }
  return out;
}

export function addOrderTotals(a: OrderTotals, b: OrderTotals): OrderTotals {
  const out = { ...EMPTY_ORDER_TOTALS };
  for (const key of TOTAL_KEYS) out[key] = a[key] + b[key];
  return out;
}

export function deriveOrderEconomics(
  totals: OrderTotals,
  adSpend: number,
): OrderEconomics {
  return {
    ...totals,
    adSpend,
    contributionProfit: totals.orderMargin - adSpend,
    actualRoas: safeDiv(totals.netRevenue, adSpend),
    costPerDeliveredOrder: safeDiv(adSpend, totals.delivered),
    returnRate: safeDiv(totals.returned, totals.delivered + totals.returned),
  };
}

export function aggregateOrders(
  rows: Iterable<OrderFinancialRow>,
  adSpend = 0,
): OrderEconomics {
  return deriveOrderEconomics(sumOrderTotals(rows), adSpend);
}

export function groupOrderTotals<T extends OrderFinancialRow>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, OrderTotals> {
  const grouped = new Map<string, OrderTotals>();
  for (const row of rows) {
    const key = keyOf(row);
    grouped.set(
      key,
      addOrderTotals(grouped.get(key) ?? EMPTY_ORDER_TOTALS, orderTotals(row)),
    );
  }
  return grouped;
}

// ------------------------------------------------ ບິນຫຼາຍສິນຄ້າ → ລາຍງານຕາມສິນຄ້າ

export type OrderLine = {
  productId: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
};

export type ProductShare<T> = {
  productId: string | null;
  productName: string | null;
  row: T;
};

/**
 * ແບ່ງບິນທີ່ມີຫຼາຍສິນຄ້າ (ບິນຈາກ live) ອອກເປັນແຖວຕໍ່ສິນຄ້າ ສຳລັບລາຍງານ "ຕາມສິນຄ້າ".
 *
 * ເງິນທຸກຊ່ອງ (ຍອດຂາຍ, ຕົ້ນທຶນ, ຄ່າສົ່ງ, ເງິນຄືນ) ແບ່ງຕາມ**ສັດສ່ວນມູນຄ່າ**ຂອງແຕ່ລະສິນຄ້າ
 * ໃນບິນ (ລາຄາ × ຈຳນວນ) — ບິນທີ່ມູນຄ່າເປັນ 0 ແບ່ງຕາມຈຳນວນຊິ້ນ. ບິນ 1 ບິນຈຶ່ງຖືກນັບ
 * ເປັນ "1 Order" ຢູ່ທຸກສິນຄ້າທີ່ມັນມີ — **ຍອດລວມທັງລາຍງານຕ້ອງຄິດຈາກບິນເດີມ ບໍ່ແມ່ນຈາກນີ້**.
 *
 * ບິນທີ່ມີສິນຄ້າດຽວ (ຫຼື ບໍ່ມີລາຍການ) ຄືນຕົວເດີມ.
 */
export function splitOrderByProduct<T extends OrderFinancialRow>(
  order: T,
  lines: readonly OrderLine[],
): ProductShare<T>[] | null {
  const groups = new Map<string, { productId: string | null; productName: string | null; value: number; qty: number }>();
  for (const line of lines) {
    const key = line.productId ?? "none";
    const g = groups.get(key) ?? { productId: line.productId, productName: line.productName, value: 0, qty: 0 };
    g.value += Math.max(0, line.quantity * line.unitPrice);
    g.qty += Math.max(0, line.quantity);
    groups.set(key, g);
  }
  if (groups.size <= 1) return null;

  const totalValue = [...groups.values()].reduce((s, g) => s + g.value, 0);
  const totalQty = [...groups.values()].reduce((s, g) => s + g.qty, 0);

  return [...groups.values()].map((g) => {
    const share = totalValue > 0 ? g.value / totalValue : safeDiv(g.qty, totalQty);
    return {
      productId: g.productId,
      productName: g.productName,
      row: {
        ...order,
        saleAmount: order.saleAmount * share,
        productCost: order.productCost * share,
        shippingCost: order.shippingCost * share,
        otherCost: order.otherCost * share,
        refundAmount: order.refundAmount * share,
      },
    };
  });
}
