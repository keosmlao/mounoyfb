import Link from "next/link";
import { Card, CardHeader, EmptyState, Num, PageHeader } from "@/components/ui";
import { DateRangeBar } from "@/components/DateRangeBar";
import { AdviceList } from "@/components/AdviceList";
import { resolveRange } from "@/lib/date";
import { loadMoney } from "@/lib/money-server";
import { formatInt, formatPercent } from "@/lib/format";
import { actionable, buildAdvice, waiting } from "@/lib/advice";
import {
  buildAllSegmentReports,
  hasData,
  MIN_MESSAGES_ABS,
  type SegmentReport,
  type SegmentRow,
} from "@/lib/analysis";
import { SEGMENT_DEFS } from "@/lib/segments";
import { SegmentKind } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  to?: string;
  preset?: string;
  kind?: string;
};

/** ແຖບເລືອກມິຕິ */
function KindTabs({
  active,
  params,
}: {
  active: SegmentKind;
  params: Record<string, string>;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {SEGMENT_DEFS.map((d) => {
        const qs = new URLSearchParams({ ...params, kind: d.kind });
        const on = d.kind === active;
        return (
          <Link
            key={d.kind}
            href={`/analysis?${qs}`}
            className={`btn btn-sm ${on ? "btn-primary" : ""}`}
          >
            <span aria-hidden className="mr-1 opacity-80">
              {d.icon}
            </span>
            {d.label}
          </Link>
        );
      })}
    </div>
  );
}

/** ແຖບແນວນອນສະແດງສ່ວນແບ່ງງົບ — ໃຫ້ເຫັນວ່າເງິນໄປລົງບ່ອນໃດ */
function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--chart-1)]"
          style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
        />
      </div>
      <Num>{formatPercent(value)}</Num>
    </div>
  );
}

function SegmentTable({
  report,
  money,
}: {
  report: SegmentReport;
  money: (lak: number | null | undefined) => string;
}) {
  const { rows, total } = report;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="ຍັງບໍ່ມີຂໍ້ມູນມິຕິນີ້"
        hint="ໄປໜ້າ ຕັ້ງຄ່າ ແລ້ວຕິກ “ຜົນແຍກກຸ່ມ” ຕອນດຶງຂໍ້ມູນ"
      />
    );
  }

  /** ຄົນທັກໜ້ອຍເກີນ = ຕົວເລກຍັງເຊື່ອບໍ່ໄດ້ ຕ້ອງບອກໃຫ້ຮູ້ */
  const floor = Math.max(MIN_MESSAGES_ABS, total.messages * 0.05);

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>ກຸ່ມ</th>
            <th className="num">ຄ່າຕໍ່ 1 ຄົນທັກ</th>
            <th className="num">ທຽບສະເລ່ຍ</th>
            <th className="num">ຄົນທັກ</th>
            <th className="num">ຄ່າໂຄສະນາ</th>
            <th className="num">ສ່ວນແບ່ງງົບ</th>
            <th className="num">CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: SegmentRow) => {
            const thin = r.messages < floor;
            const good = r.messages > 0 && r.costIndex < 0.85;
            const bad = r.messages === 0 || r.costIndex > 1.2;
            return (
              <tr key={r.segKey}>
                <td className="whitespace-nowrap">
                  {r.label}
                  {thin ? (
                    <span
                      className="ml-1.5 text-[0.7rem] text-[var(--fg-subtle)]"
                      title={`ຄົນທັກໜ້ອຍກວ່າ ${Math.ceil(floor)} — ຕົວເລກຍັງແກວ່ງ`}
                    >
                      ຂໍ້ມູນບາງ
                    </span>
                  ) : null}
                </td>
                <td className="num">
                  <Num>{r.messages > 0 ? money(r.costPerMessage) : "—"}</Num>
                </td>
                <td className="num">
                  {r.messages > 0 && r.costIndex > 0 ? (
                    <span
                      className={
                        thin
                          ? "text-[var(--fg-subtle)]"
                          : good
                            ? "text-[var(--success)]"
                            : bad
                              ? "text-[var(--danger)]"
                              : ""
                      }
                    >
                      <Num>{r.costIndex.toFixed(2)}×</Num>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">
                  <Num>{formatInt(r.messages)}</Num>
                </td>
                <td className="num">
                  <Num>{money(r.spendLak)}</Num>
                </td>
                <td className="num">
                  <ShareBar value={r.spendShare} />
                </td>
                <td className="num">
                  <Num>{formatPercent(r.ctr)}</Num>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="font-medium">ລວມ</td>
            <td className="num font-medium">
              <Num>{money(total.costPerMessage)}</Num>
            </td>
            <td className="num">1.00×</td>
            <td className="num font-medium">
              <Num>{formatInt(total.messages)}</Num>
            </td>
            <td className="num font-medium">
              <Num>{money(total.spendLak)}</Num>
            </td>
            <td className="num">100%</td>
            <td className="num">
              <Num>{formatPercent(total.ctr)}</Num>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { money } = await loadMoney();
  const sp = await searchParams;
  const range = resolveRange(sp);

  const kind = (
    sp.kind && sp.kind in SegmentKind ? sp.kind : SegmentKind.AGE_GENDER
  ) as SegmentKind;

  const [reports, advice] = await Promise.all([
    buildAllSegmentReports(range),
    buildAdvice(range),
  ]);

  const active = reports.find((r) => r.def.kind === kind)!;
  const keep = { kind };

  return (
    <>
      <PageHeader
        title="ວິເຄາະ"
        description="ຫາວ່າເງິນລົງໄປບ່ອນໃດແລ້ວຄຸ້ມ ຫຼື ບໍ່ຄຸ້ມ — ວັດດ້ວຍຄ່າຕໍ່ 1 ຄົນທັກ"
      />

      <DateRangeBar
        basePath="/analysis"
        range={range}
        activePreset={sp.preset}
        keep={keep}
      />

      <div className="mt-5 grid gap-5">
        <Card>
          <CardHeader
            title="ຄວນເຮັດຫຍັງຕໍ່"
            subtitle="ຄິດຈາກຂໍ້ມູນຂອງຊ່ວງທີ່ເລືອກ — ທຸກຂໍ້ບອກເຫດຜົນເປັນຕົວເລກໄວ້ໃຫ້ກວດຄືນ"
          />
          <AdviceList advice={actionable(advice)} />
        </Card>

        {waiting(advice).length > 0 ? (
          <Card>
            <CardHeader
              title="ຍັງຕັດສິນບໍ່ໄດ້"
              subtitle="ຂາດຂໍ້ມູນຫຍັງ ແລະ ຕ້ອງເຮັດຫຍັງຈຶ່ງຕັດສິນໄດ້"
            />
            <AdviceList advice={waiting(advice)} />
          </Card>
        ) : null}

        <div>
          <KindTabs active={kind} params={{ from: range.from, to: range.to }} />

          <Card>
            <CardHeader
              title={active.def.label}
              subtitle={active.def.question}
            />
            {hasData(reports) ? (
              <SegmentTable report={active} money={money} />
            ) : (
              <EmptyState
                title="ຍັງບໍ່ໄດ້ດຶງຜົນແຍກກຸ່ມ"
                hint="ໄປໜ້າ ຕັ້ງຄ່າ → ດຶງຂໍ້ມູນຈາກ Facebook → ຕິກ “ຜົນແຍກກຸ່ມ” ແລ້ວກົດດຶງ"
                action={
                  <Link href="/settings" className="btn btn-primary btn-sm">
                    ໄປໜ້າຕັ້ງຄ່າ
                  </Link>
                }
              />
            )}
          </Card>

          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-subtle)]">
            <strong>ທຽບສະເລ່ຍ</strong> ຕ່ຳກວ່າ 1.00× = ຖືກກວ່າສະເລ່ຍ (ດີ) ·
            ສູງກວ່າ 1.00× = ແພງກວ່າສະເລ່ຍ. ແຖວທີ່ໝາຍວ່າ “ຂໍ້ມູນບາງ”
            ມີຄົນທັກໜ້ອຍເກີນຈົນຕົວເລກຍັງແກວ່ງ — ຢ່າຫາກໍ່ຕັດສິນໃຈຈາກມັນ.
            <br />
            ຕົວເລກແຕ່ລະມິຕິຄືຄ່າໂຄສະນາອັນດຽວກັນທີ່ຫັ່ນຄົນລະແບບ —
            ບວກຂ້າມມິຕິບໍ່ໄດ້.
          </p>
        </div>
      </div>
    </>
  );
}
