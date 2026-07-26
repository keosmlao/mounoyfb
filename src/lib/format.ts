const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

const int = nf(0, 0);
const two = nf(2, 2);

/** ຈຳນວນເຕັມ ມີຈຸດຄັ່ນຫຼັກພັນ */
export function formatInt(value: number | null | undefined): string {
  return int.format(Math.round(value ?? 0));
}

/** ເງິນກີບ — ບໍ່ມີເສດ */
export function formatLak(value: number | null | undefined): string {
  return `${int.format(Math.round(value ?? 0))} ₭`;
}

/** ເງິນຕາມສະກຸນຂອງບັນຊີໂຄສະນາ (USD ມີ 2 ຕຳແໜ່ງ, LAK ບໍ່ມີເສດ) */
export function formatMoney(
  value: number | null | undefined,
  currency = "USD",
): string {
  const v = value ?? 0;
  if (currency === "LAK") return formatLak(v);
  const symbol = currency === "USD" ? "$" : currency === "THB" ? "฿" : "";
  return symbol ? `${symbol}${two.format(v)}` : `${two.format(v)} ${currency}`;
}

/** ຫຍໍ້ຕົວເລກໃຫຍ່: 12500 → 12.5K, 3400000 → 3.4M */
export function formatCompact(value: number | null | undefined): string {
  const v = value ?? 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${nf(0, 1).format(v / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${nf(0, 1).format(v / 1_000_000)}M`;
  if (abs >= 1_000) return `${nf(0, 1).format(v / 1_000)}K`;
  return int.format(v);
}

/** ອັດຕາສ່ວນ: 0.0234 → "2.34%" */
export function formatPercent(
  value: number | null | undefined,
  digits = 2,
): string {
  return `${nf(0, digits).format((value ?? 0) * 100)}%`;
}

/** ຄ່າປ່ຽນແປງທຽບຊ່ວງກ່ອນ: +12.4% / -8.1% / — */
export function formatDelta(
  current: number,
  previous: number,
): { text: string; direction: "up" | "down" | "flat" } {
  if (!previous) return { text: "—", direction: "flat" };
  const diff = (current - previous) / Math.abs(previous);
  if (Math.abs(diff) < 0.0005) return { text: "0%", direction: "flat" };
  return {
    text: `${diff > 0 ? "+" : ""}${nf(0, 1).format(diff * 100)}%`,
    direction: diff > 0 ? "up" : "down",
  };
}

/** ຫານແບບປອດໄພ — ຕົວຫານ 0 ຄືນ 0 ແທນ Infinity/NaN */
export function safeDiv(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}
