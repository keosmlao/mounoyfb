import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, EmptyState, Num, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { addDays, formatTimeLao, parseDate, todayStr } from "@/lib/date";
import { formatInt, formatMoney } from "@/lib/format";
import { totalsScope } from "@/lib/scope";
import { loadMoney } from "@/lib/money-server";
import {
  buildBillingSummary,
  FORECAST_DAYS,
  STALE_HOURS,
  type AccountBilling,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

/** ຊ່ວງທີ່ໃຊ້ຫາຄ່າສະເລ່ຍຕໍ່ມື້ — ສັ້ນພໍໃຫ້ສະທ້ອນການຍິງດຽວນີ້ */
const RECENT_DAYS = 7;

export default async function BillingPage() {
  const { money } = await loadMoney();
  const today = todayStr();
  const since = parseDate(addDays(today, -(RECENT_DAYS - 1)));

  const [accounts, allTime, recent, fxSetting] = await Promise.all([
    prisma.adAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.insight.groupBy({
      by: ["adAccountId"],
      where: totalsScope,
      _sum: { spendLak: true, spend: true },
    }),
    prisma.insight.groupBy({
      by: ["adAccountId"],
      where: { ...totalsScope, date: { gte: since } },
      _sum: { spendLak: true },
    }),
    prisma.appSetting.findUnique({ where: { key: "defaultFxRateToLak" } }),
  ]);

  const allTimeMap = new Map(allTime.map((r) => [r.adAccountId, r._sum]));
  const recentMap = new Map(recent.map((r) => [r.adAccountId, r._sum]));

  const input: AccountBilling[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    fbAccountId: a.fbAccountId,
    fundingSource: a.fbFundingSource,
    balance: a.fbBalance,
    amountSpent: a.fbAmountSpent,
    spendCap: a.fbSpendCap,
    billingAt: a.fbBillingAt,
    recentSpendLak: recentMap.get(a.id)?.spendLak ?? 0,
    recentDays: RECENT_DAYS,
    insightSpend: allTimeMap.get(a.id)?.spend ?? 0,
    insightSpendLak: allTimeMap.get(a.id)?.spendLak ?? 0,
  }));

  const summary = buildBillingSummary(
    input,
    Number(fxSetting?.value) || 0,
  );
  const anyStale = summary.rows.some((r) => r.stale);

  return (
    <>
      <PageHeader
        title="ການຊຳລະຄ່າໂຄສະນາ"
        description="ແຍກເງິນທີ່ຈ່າຍແລ້ວ ອອກຈາກທີ່ຍັງຄ້າງ — ເພື່ອຮູ້ວ່າຕ້ອງກຽມເທົ່າໃດ"
        action={
          <Link href="/ad-accounts" className="btn btn-sm">
            ບັນຊີໂຄສະນາ
          </Link>
        }
      />

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            title="ຍັງບໍ່ມີບັນຊີໂຄສະນາ"
            hint="ເພີ່ມບັນຊີກ່ອນ ແລ້ວນຳເຂົ້າຂໍ້ມູນຈາກ Facebook ຈຶ່ງຈະເຫັນຍອດຄ້າງຊຳລະ"
            action={
              <Link href="/ad-accounts" className="btn btn-primary btn-sm">
                ໄປໜ້າບັນຊີໂຄສະນາ
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <StatStrip cols={4}>
            <StatTile
              label="ຄ້າງຊຳລະດຽວນີ້"
              value={money(summary.dueLak)}
              hint={`${formatInt(summary.owing)} ບັນຊີທີ່ມີຍອດຄ້າງ`}
            />
            <StatTile
              label={`ຄາດໃນອີກ ${FORECAST_DAYS} ມື້`}
              value={money(summary.forecast7Lak)}
              hint="ຍອດຄ້າງດຽວນີ້ + ຄ່າສະເລ່ຍຕໍ່ມື້"
            />
            <StatTile
              label="ຈ່າຍໄປແລ້ວ"
              value={money(summary.paidLak)}
              hint="ຕັ້ງແຕ່ເປີດບັນຊີ ຕາມ Facebook"
            />
            <StatTile
              label="ຂໍ້ມູນຫຼ້າສຸດ"
              value={
                summary.oldestAt ? formatTimeLao(summary.oldestAt) : "ຍັງບໍ່ມີ"
              }
              hint={
                !summary.oldestAt
                  ? "ຍັງບໍ່ເຄີຍນຳເຂົ້າ"
                  : anyStale
                    ? `ເກົ່າກວ່າ ${STALE_HOURS} ຊົ່ວໂມງ`
                    : "ໃໝ່ຢູ່"
              }
            />
          </StatStrip>

          {summary.missing > 0 || anyStale ? (
            <Card className="mb-3">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span aria-hidden className="badge-warning rounded px-1.5">
                  ⚠
                </span>
                <span>
                  {summary.missing > 0
                    ? `${formatInt(summary.missing)} ບັນຊີຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນການຊຳລະ`
                    : `ຂໍ້ມູນການຊຳລະດຶງມາເກີນ ${STALE_HOURS} ຊົ່ວໂມງແລ້ວ`}{" "}
                  — ຕົວເລກທີ່ເຫັນອາດບໍ່ກົງກັບຄວາມຈິງ
                </span>
                <Link href="/settings" className="btn btn-sm ml-auto">
                  ໄປດຶງຂໍ້ມູນ
                </Link>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="ແຍກຕາມບັນຊີ"
              subtitle="ຄ້າງຫຼາຍສຸດຂຶ້ນກ່ອນ — ນັ້ນຄືອັນທີ່ຕ້ອງຈ່າຍກ່ອນ"
            />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ບັນຊີ</th>
                    <th>ວິທີຊຳລະ</th>
                    <th className="num">ຄ້າງຊຳລະ</th>
                    <th className="num">ຈ່າຍແລ້ວ</th>
                    <th className="num">ໃຊ້ໄປທັງໝົດ</th>
                    <th className="num">ມື້ລະ</th>
                    <th className="num">ຄາດ {FORECAST_DAYS} ມື້</th>
                    <th className="num">ເພດານ Facebook</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/ad-accounts/${r.id}`} className="link">
                          {r.name}
                        </Link>
                        <span className="ml-1.5 text-2xs text-[var(--fg-subtle)]">
                          {r.currency}
                        </span>
                        {r.stale ? (
                          <span
                            className="ml-1.5 text-2xs text-[var(--warning)]"
                            title={`ດຶງມາເມື່ອ ${formatTimeLao(r.billingAt!)}`}
                          >
                            ຂໍ້ມູນເກົ່າ
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[var(--fg-muted)]">
                        {r.fundingSource ?? "—"}
                      </td>

                      {r.missing ? (
                        <td className="num text-[var(--fg-subtle)]" colSpan={3}>
                          ຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນການຊຳລະ
                        </td>
                      ) : (
                        <>
                          <td className="num">
                            <Num>
                              <span
                                className={
                                  r.dueLak > 0
                                    ? "font-semibold text-[var(--danger)]"
                                    : ""
                                }
                              >
                                {money(r.dueLak)}
                              </span>
                            </Num>
                            <div className="text-2xs text-[var(--fg-subtle)]">
                              {formatMoney(r.balance ?? 0, r.currency)}
                            </div>
                          </td>
                          <td className="num">
                            <Num>{money(r.paidLak)}</Num>
                            <div className="text-2xs text-[var(--fg-subtle)]">
                              {formatMoney(r.paid ?? 0, r.currency)}
                            </div>
                          </td>
                          <td className="num">
                            <Num>
                              {formatMoney(r.amountSpent ?? 0, r.currency)}
                            </Num>
                          </td>
                        </>
                      )}

                      <td className="num">
                        <Num>{r.dailyLak > 0 ? money(r.dailyLak) : "—"}</Num>
                      </td>
                      <td className="num">
                        <Num>{r.missing ? "—" : money(r.forecast7Lak)}</Num>
                      </td>
                      <td className="num">
                        {r.spendCap === null || r.spendCap === 0 ? (
                          <span className="text-[var(--fg-subtle)]">
                            ບໍ່ໄດ້ຕັ້ງ
                          </span>
                        ) : (
                          <>
                            <Num>{formatMoney(r.spendCap, r.currency)}</Num>
                            <div
                              className={`text-2xs ${
                                r.daysToCap !== null && r.daysToCap <= 7
                                  ? "text-[var(--danger)]"
                                  : "text-[var(--fg-subtle)]"
                              }`}
                            >
                              {r.daysToCap === null
                                ? "ຄິດບໍ່ໄດ້"
                                : `ອີກ ${formatInt(r.daysToCap)} ມື້ຮອດເພດານ`}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-medium" colSpan={2}>
                      ລວມ
                    </td>
                    <td className="num font-medium">
                      <Num>{money(summary.dueLak)}</Num>
                    </td>
                    <td className="num font-medium">
                      <Num>{money(summary.paidLak)}</Num>
                    </td>
                    <td className="num text-[var(--fg-subtle)]">—</td>
                    <td className="num" />
                    <td className="num font-medium">
                      <Num>{money(summary.forecast7Lak)}</Num>
                    </td>
                    <td className="num" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-subtle)]">
            ຕົວເລກທັງໝົດມາຈາກ Facebook ໂດຍກົງ (ດຶງພ້ອມ “ນຳເຂົ້າບັນຊີ ແລະ ເພຈ”):{" "}
            <strong>ຄ້າງຊຳລະ</strong> ຄືຍອດທີ່ໃຊ້ໄປແລ້ວແຕ່ຍັງບໍ່ທັນຖືກຮຽກເກັບ ·{" "}
            <strong>ຈ່າຍແລ້ວ</strong> ຄິດຈາກ ໃຊ້ໄປທັງໝົດ − ຄ້າງຊຳລະ ·{" "}
            <strong>ມື້ລະ</strong> ຄືຄ່າໂຄສະນາສະເລ່ຍ {RECENT_DAYS} ມື້ຫຼ້າສຸດ.
            <br />
            ເງິນຂອງບັນຊີຕ່າງສະກຸນຖືກແປງເປັນກີບດ້ວຍອັດຕາທີ່ບັນຊີນັ້ນ
            <strong>ໃຊ້ຈິງ</strong>ໃນຜົນລາຍວັນ ຈຶ່ງລວມກັນໄດ້.
            ບັນຊີແບບເຕີມເງິນລ່ວງໜ້າ Facebook ໃຊ້ຄຳວ່າ balance ຄົນລະຄວາມໝາຍ —
            ໃຫ້ກວດກັບ Ads Manager ອີກເທື່ອກ່ອນໂອນເງິນກ້ອນໃຫຍ່.
          </p>
        </>
      )}
    </>
  );
}
