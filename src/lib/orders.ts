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
