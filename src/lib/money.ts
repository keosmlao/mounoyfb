/**
 * ສະກຸນເງິນທີ່ **ສະແດງ** ໃນໜ້າຈໍ.
 *
 * ຂໍ້ມູນໃນຖານຂໍ້ມູນຍັງເກັບເປັນ **ກີບ** ຄືເກົ່າສະເໝີ (`spendLak`, `revenue`)
 * ເພາະຍອດຂາຍໃນລາວເປັນກີບ ແລະ ອັດຕາແລກປ່ຽນປ່ຽນທຸກວັນ —
 * ຖ້າເກັບເປັນໂດລາຈະທຽບຂ້າມວັນບໍ່ໄດ້. ໄຟລ໌ນີ້ແປງຕອນສະແດງເທົ່ານັ້ນ
 * ຈຶ່ງສະຫຼັບໄປມາໄດ້ໂດຍບໍ່ເສຍປະຫວັດ.
 */

export const DISPLAY_CURRENCIES = ["LAK", "USD"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const DISPLAY_CURRENCY_LABEL: Record<DisplayCurrency, string> = {
  LAK: "ກີບ (₭)",
  USD: "ໂດລາ ($)",
};

/** ຮັບຄ່າ**ເປັນກີບ** ຄືນເປັນຂໍ້ຄວາມຕາມສະກຸນທີ່ເລືອກສະແດງ */
export type MoneyFn = (lak: number | null | undefined) => string;

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd3 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export const DEFAULT_FX_RATE = 21_700;

/**
 * ສ້າງຕົວຈັດຮູບແບບ. ຄ່າໂດລານ້ອຍໆ (ເຊັ່ນ ຄ່າຕໍ່ 1 ຄົນທັກ) ຕ້ອງມີ 3 ຕຳແໜ່ງ
 * ບໍ່ດັ່ງນັ້ນ $0.065 ຈະກາຍເປັນ $0.07 ແລ້ວປຽບທຽບກຸ່ມກັນບໍ່ອອກ.
 */
export function makeMoney(currency: DisplayCurrency, rate: number): MoneyFn {
  if (currency === "LAK") {
    return (v) => `${int.format(Math.round(v ?? 0))} ₭`;
  }
  const fx = rate > 0 ? rate : DEFAULT_FX_RATE;
  return (v) => {
    const usd = (v ?? 0) / fx;
    const abs = Math.abs(usd);
    if (abs > 0 && abs < 0.1) return `$${usd3.format(usd)}`;
    return `$${usd2.format(usd)}`;
  };
}
