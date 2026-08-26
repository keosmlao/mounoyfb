import "server-only";

import { prisma } from "./prisma";
import {
  DEFAULT_FX_RATE,
  makeMoney,
  type DisplayCurrency,
  type MoneyFn,
} from "./money";

/**
 * ອ່ານຄ່າຕັ້ງສະກຸນເງິນຈາກຖານຂໍ້ມູນ — ແຍກອອກຈາກ `money.ts`
 * ເພາະ client component (ກຣາຟ) ຕ້ອງໃຊ້ `makeMoney` ໄດ້ໂດຍບໍ່ດຶງ prisma ຕິດໄປນຳ.
 */
export type MoneyContext = {
  money: MoneyFn;
  currency: DisplayCurrency;
  /** ອັດຕາທີ່ໃຊ້ແປງ — ສົ່ງໃຫ້ client component ທີ່ຈັດຮູບແບບເອງ */
  rate: number;
};

/** ເອີ້ນເທື່ອດຽວຕໍ່ໜ້າ */
export async function loadMoney(): Promise<MoneyContext> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ["displayCurrency", "defaultFxRateToLak"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const currency: DisplayCurrency =
    map.get("displayCurrency") === "USD" ? "USD" : "LAK";
  const rate = Number(map.get("defaultFxRateToLak")) || DEFAULT_FX_RATE;

  return { money: makeMoney(currency, rate), currency, rate };
}
