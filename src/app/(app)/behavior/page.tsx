import Link from "next/link";
import { Card, CardHeader, EmptyState, Num, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { DateRangeBar } from "@/components/DateRangeBar";
import { AdviceList } from "@/components/AdviceList";
import { BarList } from "@/components/charts/BarList";
import { resolveRange } from "@/lib/date";
import { loadMoney } from "@/lib/money-server";
import { formatInt, formatPercent } from "@/lib/format";
import { loadBehaviorReport } from "@/lib/behavior-server";
import {
  adviseBehavior,
  hasBehaviorData,
  MIN_LINKED,
  type BehaviorReport,
} from "@/lib/behavior";

export const dynamic = "force-dynamic";

type Search = { from?: string; to?: string; preset?: string };

/** ນາທີ → ຄຳທີ່ອ່ານໄວ */
function minutesLao(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} ນາທີ`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} ຊົ່ວໂມງ`;
  return `${(hours / 24).toFixed(1)} ວັນ`;
}

/**
 * ຄົນທັກ ທຽບກັບ ງົບ ລາຍຊົ່ວໂມງ — ຄຳຖາມຄື "ເງິນລົງຕອນທີ່ຄົນຫວ່າງບໍ່"
 * ຈຶ່ງຕ້ອງເຫັນ 2 ຊຸດຄຽງກັນ ບໍ່ແມ່ນເບິ່ງເທື່ອລະຊຸດ.
 */
function HourChart({ report }: { report: BehaviorReport }) {
  const maxShare = Math.max(
    ...report.hours.map((h) => Math.max(h.share, h.spendShare ?? 0)),
    0.01,
  );
  const hasSpend = report.hours.some((h) => h.spendShare !== null);

  return (
    <div className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-[var(--fg-muted)]">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2.5 rounded-sm"
            style={{ background: "var(--chart-1)" }}
          />
          ຄົນທັກ
        </span>
        {hasSpend ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2.5 rounded-sm"
              style={{ background: "var(--chart-2)" }}
            />
            ຄ່າໂຄສະນາ
          </span>
        ) : (
          <span>ຍັງບໍ່ໄດ້ດຶງຄ່າໂຄສະນາລາຍຊົ່ວໂມງ — ດຶງ “ຜົນແຍກກຸ່ມ” ໃນໜ້າຕັ້ງຄ່າ</span>
        )}
      </div>

      <div className="table-wrap">
        <div className="flex min-w-[34rem] items-end gap-[3px]">
          {report.hours.map((h) => (
            <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex h-24 w-full items-end justify-center gap-[2px]"
                title={
                  `${String(h.hour).padStart(2, "0")}:00 · ` +
                  `ຄົນທັກ ${formatInt(h.threads)} (${formatPercent(h.share, 0)})` +
                  (h.spendShare !== null
                    ? ` · ງົບ ${formatPercent(h.spendShare, 0)}`
                    : "")
                }
              >
                <span
                  className="w-1/2 rounded-t-sm"
                  style={{
                    height: `${Math.max((h.share / maxShare) * 100, h.threads > 0 ? 3 : 0)}%`,
                    background: "var(--chart-1)",
                  }}
                />
                {hasSpend ? (
                  <span
                    className="w-1/2 rounded-t-sm"
                    style={{
                      height: `${Math.max(((h.spendShare ?? 0) / maxShare) * 100, (h.spendShare ?? 0) > 0 ? 3 : 0)}%`,
                      background: "var(--chart-2)",
                    }}
                  />
                ) : null}
              </div>
              <span className="text-2xs tabular-nums text-[var(--fg-subtle)]">
                {h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function BehaviorPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const [{ money }, report] = await Promise.all([
    loadMoney(),
    loadBehaviorReport(range),
  ]);
  const advice = adviseBehavior(report, money);

  const repliedShare = report.threads > 0 ? report.replied / report.threads : 0;

  return (
    <>
      <PageHeader
        title="ພຶດຕິກຳລູກຄ້າ"
        description="ຄົນທັກມາເວລາໃດ · ເຮົາຕອບໄວປານໃດ · ເຂົາຖາມຫຍັງກ່ອນ — ແລ້ວຄວນຍິງໂຄສະນາແນວໃດ"
      />

      <DateRangeBar
        basePath="/behavior"
        range={range}
        activePreset={sp.preset}
      />

      {!hasBehaviorData(report) ? (
        <Card>
          <EmptyState
            title="ຍັງບໍ່ມີແຊັດ ຫຼື ອໍເດີ ໃນຊ່ວງນີ້"
            hint="ໜ້ານີ້ອ່ານຈາກກ່ອງຂໍ້ຄວາມ ແລະ ອໍເດີຂອງເຮົາເອງ — ດຶງຂໍ້ຄວາມກ່ອນ ຫຼື ເລືອກຊ່ວງວັນທີ່ກວ້າງກວ່ານີ້"
            action={
              <Link href="/inbox" className="btn btn-primary btn-sm">
                ໄປກ່ອງຂໍ້ຄວາມ
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <StatStrip cols={5}>
            <StatTile
              label="ຄົນທັກ (ຫ້ອງແຊັດ)"
              value={formatInt(report.threads)}
              hint="ຫ້ອງທີ່ມີຄົນທັກເຂົ້າມາໃນຊ່ວງນີ້"
            />
            <StatTile
              label="ຕອບແລ້ວ"
              value={formatPercent(repliedShare, 0)}
              hint={`ຍັງບໍ່ໄດ້ຕອບ ${formatInt(report.unanswered)} ຫ້ອງ`}
            />
            <StatTile
              label="ຄ່າກາງເວລາຕອບ"
              value={minutesLao(report.replyMedian)}
              hint="ເຄິ່ງໜຶ່ງຂອງຫ້ອງໄດ້ຕອບໄວກວ່ານີ້"
            />
            <StatTile
              label="ຄ່າໂຄສະນາຕໍ່ 1 ຄົນທັກ"
              value={report.costPerMessage > 0 ? money(report.costPerMessage) : "—"}
              hint="ຈາກຂໍ້ມູນ Facebook ຊ່ວງດຽວກັນ"
            />
            <StatTile
              label="ລູກຄ້າຊື້ຊ້ຳ"
              value={
                report.repeat.customers > 0
                  ? formatPercent(report.repeat.rate, 0)
                  : "—"
              }
              hint={`${formatInt(report.repeat.customers)} ເບີທີ່ສັ່ງໃນຊ່ວງນີ້`}
            />
          </StatStrip>

          <div className="grid gap-3">
            <Card>
              <CardHeader
                title="ຄວນຍິງແນວໃດຕໍ່"
                subtitle="ຄິດຈາກແຊັດ ແລະ ອໍເດີຂອງເຮົາເອງ — ຄົນລະຊຸດກັບຄຳແນະນຳໃນໜ້າວິເຄາະ"
              />
              <AdviceList
                advice={advice}
                emptyHint="ຕ້ອງມີຄົນທັກຫຼາຍພໍລະບົບຈຶ່ງກ້າແນະນຳ — ລໍໃຫ້ມີແຊັດເພີ່ມ ຫຼື ເລືອກຊ່ວງວັນທີ່ກວ້າງກວ່ານີ້"
              />
            </Card>

            <Card>
              <CardHeader
                title="ເວລາທີ່ຄົນທັກເຂົ້າມາ"
                subtitle="ຖ້າແທ່ງຄົນທັກສູງແຕ່ແທ່ງງົບຕ່ຳ ແປວ່າຍິງຜິດເວລາ (ເວລາລາວ)"
              />
              <HourChart report={report} />

              <div className="table-wrap border-t border-[var(--border)]">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ຊ່ວງເວລາ</th>
                      <th className="num">ຄົນທັກ</th>
                      <th className="num">ສ່ວນແບ່ງຄົນທັກ</th>
                      <th className="num">ສ່ວນແບ່ງງົບ</th>
                      <th className="num">ຕອບຊ້າສະເລ່ຍ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bands.map((b) => (
                      <tr key={b.band}>
                        <td className="whitespace-nowrap">{b.band}</td>
                        <td className="num">
                          <Num>{formatInt(b.threads)}</Num>
                        </td>
                        <td className="num">
                          <Num>{formatPercent(b.share, 0)}</Num>
                        </td>
                        <td className="num">
                          <Num>
                            {b.spendShare === null
                              ? "—"
                              : formatPercent(b.spendShare, 0)}
                          </Num>
                        </td>
                        <td className="num">
                          <Num>{minutesLao(b.replyMedian)}</Num>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="ວັນທີ່ຄົນທັກຫຼາຍ"
                  subtitle="ວັນທີ່ຄົນວ່າງ ບໍ່ຄືກັນທຸກຮ້ານ — ເອົາໄປແບ່ງງົບລາຍວັນ"
                />
                <BarList
                  rows={report.weekdays.map((w) => ({
                    key: String(w.weekday),
                    label: w.label,
                    value: w.threads,
                    display: `${formatInt(w.threads)} (${formatPercent(w.share, 0)})`,
                  }))}
                />
              </Card>

              <Card>
                <CardHeader
                  title="ຄຳຖາມທີ່ຄົນທັກມາຖາມ"
                  subtitle="ສິ່ງທີ່ຖາມຊ້ຳກັນ ຄືສິ່ງທີ່ໂຄສະນາຍັງບໍ່ໄດ້ບອກ"
                />
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ຖາມເລື່ອງ</th>
                        <th className="num">ຫ້ອງ</th>
                        <th className="num">ສ່ວນແບ່ງ</th>
                        <th>ຄວນແກ້ແນວໃດ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.intents
                        .filter((i) => i.threads > 0)
                        .map((i) => (
                          <tr key={i.key}>
                            <td className="whitespace-nowrap">{i.label}</td>
                            <td className="num">
                              <Num>{formatInt(i.threads)}</Num>
                            </td>
                            <td className="num">
                              <Num>{formatPercent(i.share, 0)}</Num>
                            </td>
                            <td className="text-xs text-[var(--fg-muted)]">
                              {i.hint}
                            </td>
                          </tr>
                        ))}
                      {report.intents.every((i) => i.threads === 0) ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState
                              title="ຍັງບໍ່ພົບຄຳຖາມທີ່ຮູ້ຈັກ"
                              hint="ລະບົບຫາຈາກຄຳໃນຂໍ້ຄວາມ — ຖ້າຍັງບໍ່ມີແຊັດ ຫຼື ຄົນຖາມດ້ວຍຄຳອື່ນ ຈະບໍ່ຂຶ້ນ"
                            />
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="ຕອບໄວປານໃດ ແລ້ວປິດການຂາຍໄດ້ປານໃດ"
                subtitle={
                  report.linked >= MIN_LINKED
                    ? "ອັດຕາປິດນັບສະເພາະຫ້ອງທີ່ຜູກກັບລູກຄ້າໃນລະບົບແລ້ວ"
                    : `ຜູກແຊັດກັບລູກຄ້າໃນໜ້າຂໍ້ຄວາມແລ້ວຈຶ່ງຄິດອັດຕາປິດໄດ້ (ດຽວນີ້ຜູກແລ້ວ ${formatInt(report.linked)} ຫ້ອງ)`
                }
              />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ຕອບພາຍໃນ</th>
                      <th className="num">ຫ້ອງ</th>
                      <th className="num">ສ່ວນແບ່ງ</th>
                      <th className="num">ຜູກກັບລູກຄ້າ</th>
                      <th className="num">ປິດການຂາຍໄດ້</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.replies.map((b) => (
                      <tr key={b.key}>
                        <td className="whitespace-nowrap">{b.label}</td>
                        <td className="num">
                          <Num>{formatInt(b.threads)}</Num>
                        </td>
                        <td className="num">
                          <Num>{formatPercent(b.share, 0)}</Num>
                        </td>
                        <td className="num">
                          <Num>{formatInt(b.linked)}</Num>
                        </td>
                        <td className="num">
                          <Num>
                            {b.linked > 0
                              ? `${formatPercent(b.orderRate, 0)} (${formatInt(b.ordered)})`
                              : "—"}
                          </Num>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="ຈາກຄົນທັກຮອດຍອດຂາຍ"
                  subtitle="ແຕ່ລະຂັ້ນມາຈາກຄົນລະຕາຕະລາງ — ຂັ້ນທີ່ບໍ່ໄດ້ຜູກກັນຈະເບິ່ງຄືຫຼຸດຫຼາຍເກີນຈິງ"
                />
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ຂັ້ນ</th>
                        <th className="num">ຈຳນວນ</th>
                        <th className="num">ຜ່ານຈາກຂັ້ນກ່ອນ</th>
                        <th>ນັບຈາກ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.funnel.map((s) => (
                        <tr key={s.label}>
                          <td className="whitespace-nowrap">{s.label}</td>
                          <td className="num">
                            <Num>{formatInt(s.value)}</Num>
                          </td>
                          <td className="num">
                            <Num>
                              {s.rate === null ? "—" : formatPercent(s.rate, 0)}
                            </Num>
                          </td>
                          <td className="text-xs text-[var(--fg-subtle)]">
                            {s.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="ທັກແລ້ວດົນປານໃດຈຶ່ງຊື້"
                  subtitle="ບອກວ່າຄວນລໍຈັກວັນກ່ອນຕັດສິນວ່າແຄມເປນນີ້ໃຊ້ບໍ່ໄດ້"
                />
                <BarList
                  rows={report.lag.map((l) => ({
                    key: l.label,
                    label: l.label,
                    value: l.orders,
                    display: `${formatInt(l.orders)} (${formatPercent(l.share, 0)})`,
                  }))}
                  emptyText="ຍັງບໍ່ມີອໍເດີທີ່ຜູກກັບລູກຄ້າ"
                />
                <p className="border-t border-[var(--border)] px-4 py-2 text-xs leading-relaxed text-[var(--fg-subtle)]">
                  ນັບສະເພາະອໍເດີທີ່ຜູກກັບລູກຄ້າໃນລະບົບ (ມີວັນທີ່ທັກ) —
                  ອໍເດີທີ່ບໍ່ໄດ້ຜູກຈະບໍ່ຂຶ້ນຢູ່ນີ້.
                </p>
              </Card>
            </div>

            <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
              ໜ້ານີ້ອ່ານຈາກ<strong>ຂໍ້ມູນຂອງເຮົາເອງ</strong> (ແຊັດ · ລູກຄ້າ ·
              ອໍເດີ) ສ່ວນໜ້າ{" "}
              <Link href="/analysis" className="link">
                ວິເຄາະ
              </Link>{" "}
              ອ່ານຈາກຕົວເລກຂອງ Facebook — ໃຊ້ຄູ່ກັນ: ໜ້ານັ້ນບອກວ່າ
              ເງິນລົງໃສ່ໃຜແລ້ວຄຸ້ມ, ໜ້ານີ້ບອກວ່າ ຄວນຍິງເວລາໃດ ແລະ
              ຄວນແກ້ຫຍັງໃນໂຄສະນາ.
            </p>
          </div>
        </>
      )}
    </>
  );
}
