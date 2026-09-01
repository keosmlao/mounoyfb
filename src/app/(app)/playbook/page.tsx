import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Num, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { addDays, parseDate, todayStr, type DateRange } from "@/lib/date";
import { formatInt, formatPercent } from "@/lib/format";
import { aggregate } from "@/lib/metrics";
import { totalsScope } from "@/lib/scope";
import { loadMoney } from "@/lib/money-server";
import { orderEconomics } from "@/lib/advice-rules";
import {
  ACTION_LABEL,
  buildTarget,
  DECIDE_DAYS,
  LEARNING_DAYS,
  MIN_MESSAGES,
  planAll,
  setupSteps,
  STAGE_LABEL,
  suggestDailyBudget,
} from "@/lib/playbook";
import { EntityStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** ຊ່ວງທີ່ໃຊ້ຄິດເປົ້າ — ຍາວພໍໃຫ້ມີອໍເດີພຽງພໍ ແຕ່ບໍ່ເກົ່າຈົນບໍ່ສະທ້ອນປັດຈຸບັນ */
const TARGET_DAYS = 30;

function ageInDays(start: Date | null, createdAt: Date, today: string): number {
  const from = (start ?? createdAt).toISOString().slice(0, 10);
  const diff =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000;
  return Math.max(0, Math.floor(diff));
}

export default async function PlaybookPage() {
  const { money } = await loadMoney();
  const today = todayStr();
  const range: DateRange = { from: addDays(today, -(TARGET_DAYS - 1)), to: today };

  const [econ, insights, campaigns] = await Promise.all([
    orderEconomics(range),
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      select: { spendLak: true, messages: true, campaignId: true, date: true },
    }),
    prisma.campaign.findMany({
      where: { status: EntityStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        startDate: true,
        createdAt: true,
        dailyBudget: true,
      },
    }),
  ]);

  const messages = aggregate(insights).messages;
  const target = buildTarget({
    marginPerOrder: econ?.marginPerOrder ?? 0,
    orders: econ?.delivered ?? 0,
    messages,
  });

  // ຕົວເລກຂອງແຕ່ລະແຄມເປນ — ນັບສະເພາະຊ່ວງທີ່ເບິ່ງ ຄືກັບເປົ້າ
  const byCampaign = new Map<string, { spendLak: number; messages: number }>();
  for (const row of insights) {
    if (!row.campaignId) continue;
    const cur = byCampaign.get(row.campaignId) ?? { spendLak: 0, messages: 0 };
    cur.spendLak += row.spendLak;
    cur.messages += row.messages;
    byCampaign.set(row.campaignId, cur);
  }

  const plans = planAll(
    campaigns.map((c) => {
      const stat = byCampaign.get(c.id) ?? { spendLak: 0, messages: 0 };
      return {
        id: c.id,
        name: c.name,
        ageDays: ageInDays(c.startDate, c.createdAt, today),
        messages: stat.messages,
        spendLak: stat.spendLak,
        dailyBudget: c.dailyBudget,
      };
    }),
    target,
    money,
  );

  const steps = setupSteps(target, money);
  const todo = plans.filter(
    (p) => p.action === "cut" || p.action === "scale" || p.action === "creative",
  );

  return (
    <>
      <PageHeader
        title="ວິທີຍິງ ແລະ ບໍລິຫານແຄມເປນ"
        description="ກົດການຕັດສິນໃຈທີ່ຄິດຈາກຕົວເລກຈິງຂອງຮ້ານ — ບໍ່ແມ່ນຄູ່ມືທົ່ວໄປ"
        action={
          <Link href="/campaigns" className="btn btn-sm">
            ໄປໜ້າແຄມເປນ
          </Link>
        }
      />

      <StatStrip cols={4}>
        <StatTile
          label="ຄ່າຕໍ່ຄົນທັກທີ່ຮັບໄດ້"
          value={target.costPerMessage > 0 ? money(target.costPerMessage) : "—"}
          hint="ຈ່າຍແພງກວ່ານີ້ = ຂາດທຶນ"
        />
        <StatTile
          label="ກຳໄລຕໍ່ອໍເດີ"
          value={target.marginPerOrder > 0 ? money(target.marginPerOrder) : "—"}
          hint={`ຈາກອໍເດີທີ່ສົ່ງສຳເລັດ ${TARGET_DAYS} ວັນ`}
        />
        <StatTile
          label="ອັດຕາປິດການຂາຍ"
          value={target.closeRate > 0 ? formatPercent(target.closeRate, 1) : "—"}
          hint={`${formatInt(econ?.delivered ?? 0)} ອໍເດີ ÷ ${formatInt(messages)} ຄົນທັກ`}
        />
        <StatTile
          label="ງົບຕ່ຳສຸດ/ວັນ"
          value={
            suggestDailyBudget(target) > 0
              ? money(suggestDailyBudget(target))
              : "—"
          }
          hint="ໜ້ອຍກວ່ານີ້ຈະຮູ້ຜົນຊ້າເກີນ"
        />
      </StatStrip>

      <div className="grid gap-3">
        <Card>
          <CardHeader
            title="ຕົວເລກທີ່ຄຸມທຸກຢ່າງ"
            subtitle="ຖ້າຈື່ໄດ້ອັນດຽວ ໃຫ້ຈື່ອັນນີ້"
          />
          {target.missing ? (
            <EmptyState
              title="ຍັງຄິດເປົ້າບໍ່ໄດ້"
              hint={target.missing}
              action={
                <Link href="/orders" className="btn btn-primary btn-sm">
                  ໄປໃສ່ອໍເດີ
                </Link>
              }
            />
          ) : (
            <div className="px-4 py-3 text-sm leading-relaxed">
              <p className="font-medium">
                ກຳໄລຕໍ່ອໍເດີ {money(target.marginPerOrder)} ×
                ອັດຕາປິດການຂາຍ {formatPercent(target.closeRate, 1)} ={" "}
                <span className="text-[var(--brand)]">
                  {money(target.costPerMessage)} ຕໍ່ 1 ຄົນທັກ
                </span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
                ໝາຍຄວາມວ່າ: ທຸກຄົນທີ່ທັກເຂົ້າມາ ເຮົາຈ່າຍໄດ້ສູງສຸດ{" "}
                {money(target.costPerMessage)}. ຈ່າຍແພງກວ່ານີ້ ເຖິງຍອດຂາຍຈະຂຶ້ນ
                ກໍ່ຂາດທຶນ. ຖ້າຢາກຈ່າຍໄດ້ແພງຂຶ້ນ ມີ 2 ທາງ —
                ເພີ່ມກຳໄລຕໍ່ອໍເດີ (ຂຶ້ນລາຄາ / ຫຼຸດຕົ້ນທຶນ / ຂາຍພ່ວງ) ຫຼື
                ເພີ່ມອັດຕາປິດ (ຕອບໄວຂຶ້ນ · ຄັດຄົນທັກໃຫ້ຕົງກຸ່ມກວ່າ) —
                ບໍ່ແມ່ນທົນຈ່າຍແພງຂຶ້ນ.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="ຄຳສັ່ງມື້ນີ້"
            subtitle={
              todo.length > 0
                ? `${formatInt(todo.length)} ແຄມເປນຕ້ອງລົງມື — ອັນອື່ນປະໄວ້ຄືເກົ່າ`
                : "ຄິດຈາກອາຍຸແຄມເປນ ແລະ ຄ່າຕໍ່ຄົນທັກທຽບເປົ້າ"
            }
          />
          {plans.length === 0 ? (
            <EmptyState
              title="ຍັງບໍ່ມີແຄມເປນທີ່ເປີດຢູ່"
              hint="ເປີດແຄມເປນກ່ອນ ແລ້ວລະບົບຈະບອກວ່າແຕ່ລະມື້ຄວນເຮັດຫຍັງກັບມັນ"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ແຄມເປນ</th>
                    <th className="num">ອາຍຸ</th>
                    <th>ຂັ້ນຕອນ</th>
                    <th className="num">ຄ່າຕໍ່ຄົນທັກ</th>
                    <th className="num">ທຽບເປົ້າ</th>
                    <th>ຄຳສັ່ງ</th>
                    <th>ເປັນຫຍັງ ແລະ ຕ້ອງເຮັດຫຍັງ</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const tone = ACTION_LABEL[p.action];
                    return (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap font-medium">
                          <Link href={`/campaigns/${p.id}`} className="link">
                            {p.name}
                          </Link>
                        </td>
                        <td className="num">
                          <Num>{formatInt(p.ageDays)} ວັນ</Num>
                        </td>
                        <td className="whitespace-nowrap text-[var(--fg-muted)]">
                          {STAGE_LABEL[p.stage]}
                        </td>
                        <td className="num">
                          <Num>
                            {p.messages > 0 ? money(p.costPerMessage) : "—"}
                          </Num>
                        </td>
                        <td className="num">
                          {p.index > 0 ? (
                            <Num>
                              <span
                                className={
                                  p.index > 1.4
                                    ? "text-[var(--danger)]"
                                    : p.index < 0.72
                                      ? "text-[var(--success)]"
                                      : ""
                                }
                              >
                                {p.index.toFixed(2)}×
                              </span>
                            </Num>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge tone={tone.tone as "danger"}>{tone.text}</Badge>
                        </td>
                        <td className="text-xs leading-relaxed">
                          <span className="text-[var(--fg-muted)]">
                            {p.reason}
                          </span>
                          <br />
                          <span className="text-[var(--fg-subtle)]">
                            → {p.next}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="ຂັ້ນຕອນຕັ້ງແຄມເປນໃໝ່"
            subtitle="ຕົວເລກໃນນີ້ຄິດຈາກຂໍ້ມູນຮ້ານເຈົ້າເອງ ບໍ່ແມ່ນຄ່າມາດຕະຖານທົ່ວໄປ"
          />
          <ol className="divide-y divide-[var(--border)]">
            {steps.map((s) => (
              <li key={s.title} className="px-4 py-2.5">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
                  {s.detail}
                </p>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader
            title="ຈັງຫວະການຕັດສິນໃຈ"
            subtitle="ເວລາເປັນກົດ ບໍ່ແມ່ນຄວາມຮູ້ສຶກ"
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ອາຍຸແຄມເປນ</th>
                  <th>ຂັ້ນຕອນ</th>
                  <th>ເຮັດຫຍັງໄດ້ / ບໍ່ໄດ້</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="whitespace-nowrap">0–{LEARNING_DAYS - 1} ວັນ</td>
                  <td className="whitespace-nowrap">{STAGE_LABEL.learning}</td>
                  <td className="text-xs leading-relaxed">
                    <strong>ຫ້າມແຕະຫຍັງເລີຍ</strong> — ແກ້ງົບ, ປ່ຽນກຸ່ມເປົ້າໝາຍ
                    ຫຼື ປິດ-ເປີດ ຈະເຮັດໃຫ້ Facebook ເລີ່ມຮຽນຮູ້ໃໝ່
                    ແລ້ວເງິນທີ່ຈ່າຍໄປແລ້ວເສຍລ້າ
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">
                    {LEARNING_DAYS}–{DECIDE_DAYS - 1} ວັນ
                  </td>
                  <td className="whitespace-nowrap">{STAGE_LABEL.testing}</td>
                  <td className="text-xs leading-relaxed">
                    ແພງກວ່າເປົ້າ = <strong>ປ່ຽນຮູບ/ຂໍ້ຄວາມກ່ອນ</strong> ຢ່າຫາກໍ່ຕັດ
                    — ຮູບເປັນຕົ້ນເຫດໄດ້ຫຼາຍກວ່າກຸ່ມເປົ້າໝາຍ
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">{DECIDE_DAYS}+ ວັນ</td>
                  <td className="whitespace-nowrap">{STAGE_LABEL.deciding}</td>
                  <td className="text-xs leading-relaxed">
                    ພິສູດພຽງພໍແລ້ວ — ຄຸ້ມກວ່າເປົ້າຊັດເຈນ{" "}
                    <strong>ເພີ່ມງົບເທື່ອລະບໍ່ເກີນ 30%</strong> ·
                    ແພງກວ່າເປົ້າຊັດເຈນ <strong>ຕັດ</strong> ແລ້ວຍ້າຍງົບໄປອັນທີ່ຄຸ້ມ
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">ທຸກຊ່ວງ</td>
                  <td className="whitespace-nowrap text-[var(--fg-muted)]">
                    ຂໍ້ມູນບາງ
                  </td>
                  <td className="text-xs leading-relaxed">
                    ຄົນທັກຍັງບໍ່ຮອດ {MIN_MESSAGES} ຄົນ ={" "}
                    <strong>ຍັງຕັດສິນບໍ່ໄດ້</strong> —
                    ຕົວເລກຈາກຄົນທັກ 3–4 ຄົນຄືຄວາມບັງເອີນ ບໍ່ແມ່ນຜົນ
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          ໜ້ານີ້ບອກວ່າ <strong>ຄວນເຮັດຫຍັງກັບແຄມເປນ</strong> ·{" "}
          <Link href="/analysis" className="link">
            ວິເຄາະ
          </Link>{" "}
          ບອກວ່າ <strong>ພາຍໃນແຄມເປນ ກຸ່ມໃດຄຸ້ມ</strong> ·{" "}
          <Link href="/behavior" className="link">
            ພຶດຕິກຳລູກຄ້າ
          </Link>{" "}
          ບອກວ່າ <strong>ຄວນຍິງເວລາໃດ ແລະ ແກ້ຫຍັງໃນໂຄສະນາ</strong>.
          ຕົວເລກເປົ້າຄິດຈາກ {TARGET_DAYS} ວັນຫຼ້າສຸດ ຈຶ່ງຂະຫຍັບຕາມຄວາມຈິງເອງ.
        </p>
      </div>
    </>
  );
}
