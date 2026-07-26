import { safeDiv } from "./format";

/** ຕົວເລກດິບທີ່ລວມມາຈາກຕາຕະລາງ Insight */
export type Totals = {
  spendLak: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  messages: number;
  leadsCount: number;
  purchases: number;
  revenue: number;
  videoViews: number;
};

/** ຕົວເລກທີ່ຄິດຕໍ່ຈາກ Totals */
export type Derived = Totals & {
  ctr: number; // ອັດຕາຄລິກ
  cpc: number; // ຄ່າຕໍ່ 1 ຄລິກ (ກີບ)
  cpm: number; // ຄ່າຕໍ່ 1,000 ຄັ້ງທີ່ເຫັນ (ກີບ)
  costPerMessage: number; // ຄ່າຕໍ່ 1 ຄົນທັກ (ກີບ)
  costPerLead: number; // ຄ່າຕໍ່ 1 ລາຍຊື່ (ກີບ)
  costPerPurchase: number; // ຄ່າຕໍ່ 1 ອໍເດີ (ກີບ)
  roas: number; // ຍອດຂາຍ ÷ ຄ່າໂຄສະນາ
  profit: number; // ຍອດຂາຍ − ຄ່າໂຄສະນາ (ກີບ)
  frequency: number; // ຄວາມຖີ່ທີ່ຄົນເຫັນຊ້ຳ
  convRate: number; // ອັດຕາປິດ: ອໍເດີ ÷ ຄົນທັກ
};

export const EMPTY_TOTALS: Totals = {
  spendLak: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  linkClicks: 0,
  messages: 0,
  leadsCount: 0,
  purchases: 0,
  revenue: 0,
  videoViews: 0,
};

const KEYS = Object.keys(EMPTY_TOTALS) as (keyof Totals)[];

/** ບວກແຖວ Insight (ຫຼື object ໃດກໍ່ໄດ້ທີ່ມີຊ່ອງດຽວກັນ) ເຂົ້າກັນ */
export function sumTotals(rows: Iterable<Partial<Totals>>): Totals {
  const out = { ...EMPTY_TOTALS };
  for (const row of rows) {
    for (const key of KEYS) out[key] += row[key] ?? 0;
  }
  return out;
}

/** ຄິດຕົວຊີ້ວັດທັງໝົດຈາກຍອດລວມ */
export function derive(t: Totals): Derived {
  return {
    ...t,
    ctr: safeDiv(t.clicks, t.impressions),
    cpc: safeDiv(t.spendLak, t.clicks),
    cpm: safeDiv(t.spendLak, t.impressions) * 1000,
    costPerMessage: safeDiv(t.spendLak, t.messages),
    costPerLead: safeDiv(t.spendLak, t.leadsCount),
    costPerPurchase: safeDiv(t.spendLak, t.purchases),
    roas: safeDiv(t.revenue, t.spendLak),
    profit: t.revenue - t.spendLak,
    frequency: safeDiv(t.impressions, t.reach),
    convRate: safeDiv(t.purchases, t.messages),
  };
}

/** ລວມ + ຄິດຕໍ່ ໃນຂັ້ນຕອນດຽວ */
export function aggregate(rows: Iterable<Partial<Totals>>): Derived {
  return derive(sumTotals(rows));
}

/**
 * ຈັດກຸ່ມແຖວຕາມ key ໃດໜຶ່ງ ແລ້ວລວມຍອດແຕ່ລະກຸ່ມ.
 * ໃຊ້ຈັດອັນດັບແຄມເປນ / ແຕ້ມກຣາຟລາຍວັນ.
 */
export function groupTotals<T extends Partial<Totals>>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = map.get(key) ?? { ...EMPTY_TOTALS };
    for (const k of KEYS) current[k] += row[k] ?? 0;
    map.set(key, current);
  }
  return map;
}
