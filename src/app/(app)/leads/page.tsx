import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { StatStrip, StatTile } from "@/components/StatTile";
import { DateRangeBar } from "@/components/DateRangeBar";
import { LoadMore } from "@/components/LoadMore";
import { createLead, setLeadStatus } from "./actions";
import { formatDateLao, parseDate, resolveRange, todayStr } from "@/lib/date";
import { formatInt, formatPercent, safeDiv } from "@/lib/format";
import {
  LEAD_CHANNELS,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  options,
} from "@/lib/labels";
import type { LeadStatus } from "@/generated/prisma/enums";
import { leadWhere } from "@/lib/list-filters";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  to?: string;
  preset?: string;
  status?: string;
  campaign?: string;
  /** ຄົ້ນຫາຕາມຊື່ / ເບີໂທ / ຊື່ໃນ Facebook */
  q?: string;
  /** ຈຳນວນທີ່ສະແດງ (ໂຫຼດເພີ່ມເທື່ອລະ 100) */
  show?: string;
};

const PAGE_SIZE = 100;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { money } = await loadMoney();
  const sp = await searchParams;
  const range = resolveRange(sp);

  // ເພດານ 2000 ໄວ້ກັນຄົນແກ້ ?show= ໃນ URL ຈົນດຶງທັງຖານຂໍ້ມູນອອກມາ
  const limit = Math.min(Number(sp.show) || PAGE_SIZE, 2000);
  const search = sp.q?.trim();

  // ເງື່ອນໄຂອັນດຽວກັບທີ່ປຸ່ມ “ສົ່ງອອກ CSV” ໃຊ້ — ຢູ່ `list-filters.ts`
  const where = leadWhere(range, {
    status: sp.status,
    campaign: sp.campaign,
    q: search,
  });

  const [leads, matching, campaigns, products, statusCounts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        campaign: { select: { id: true, name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.lead.count({ where }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { date: { gte: parseDate(range.from), lte: parseDate(range.to) } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const countOf = (s: LeadStatus) =>
    statusCounts.find((r) => r.status === s)?._count._all ?? 0;
  const total = statusCounts.reduce((n, r) => n + r._count._all, 0);
  const won = countOf("WON");
  const wonAmount = statusCounts.find((r) => r.status === "WON")?._sum.amount ?? 0;

  /** ຕົວກັ່ນຕອງທີ່ເລືອກໄວ້ ໃນຮູບແບບ query string — ໃຊ້ຮ່ວມກັບປຸ່ມສົ່ງອອກ */
  const filterParams = () => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (sp.status) params.set("status", sp.status);
    if (sp.campaign) params.set("campaign", sp.campaign);
    if (search) params.set("q", search);
    return params;
  };
  const exportHref = `/api/leads/export?${filterParams().toString()}`;

  /** ລິ້ງ “ໂຫຼດເພີ່ມ” — ຮັກສາຊ່ວງວັນ ແລະ ຕົວກັ່ນຕອງທີ່ເລືອກໄວ້ */
  const showHref = (show: number) => {
    const params = filterParams();
    if (sp.preset) params.set("preset", sp.preset);
    params.set("show", String(show));
    return `/leads?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="ລູກຄ້າຈາກໂຄສະນາ"
        description="ຕິດຕາມຄົນທີ່ທັກເຂົ້າມາ ຈົນເຖິງປິດການຂາຍ"
        action={
          <a href={exportHref} className="btn">
            ⤓ ສົ່ງອອກ CSV
          </a>
        }
      />

      <DateRangeBar
        basePath="/leads"
        range={range}
        activePreset={sp.preset}
        keep={{ status: sp.status, campaign: sp.campaign, q: search }}
      />

      <StatStrip cols={4}>
        <StatTile label="ລູກຄ້າທັງໝົດ" value={formatInt(total)} hint="ໃນຊ່ວງທີ່ເລືອກ" />
        <StatTile
          label="ຍັງບໍ່ໄດ້ຕິດຕໍ່"
          value={formatInt(countOf("NEW"))}
          hint="ຕ້ອງຕິດຕາມດ່ວນ"
        />
        <StatTile
          label="ປິດການຂາຍໄດ້"
          value={formatInt(won)}
          hint={`ອັດຕາປິດ ${formatPercent(safeDiv(won, total), 1)}`}
        />
        <StatTile label="ຍອດຂາຍລວມ" value={money(wonAmount)} hint="ຈາກລູກຄ້າທີ່ປິດແລ້ວ" />
      </StatStrip>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          <Card>
            <form
              method="get"
              action="/leads"
              className="filter-bar flex flex-wrap items-end gap-3 p-3"
            >
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
              <div>
                <label className="label">ຄົ້ນຫາ</label>
                <input
                  name="q"
                  defaultValue={search ?? ""}
                  className="field"
                  placeholder="ຊື່, ເບີໂທ, ຊື່ໃນ FB"
                />
              </div>
              <div>
                <label className="label">ສະຖານະ</label>
                <select name="status" defaultValue={sp.status ?? ""} className="field">
                  <option value="">ທັງໝົດ</option>
                  {options(LEAD_STATUS_LABEL).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ແຄມເປນ</label>
                <select
                  name="campaign"
                  defaultValue={sp.campaign ?? ""}
                  className="field"
                >
                  <option value="">ທັງໝົດ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn">
                ກັ່ນຕອງ
              </button>
              {sp.status || sp.campaign || search ? (
                <Link href="/leads" className="btn btn-sm">
                  ລ້າງ
                </Link>
              ) : null}
            </form>
          </Card>

          <Card>
            <CardHeader
              title="ລາຍຊື່ລູກຄ້າ"
              subtitle={`ພົບ ${formatInt(matching)} ຄົນ ໃນຊ່ວງ ແລະ ຕົວກັ່ນຕອງທີ່ເລືອກ`}
            />
            {leads.length === 0 ? (
              <EmptyState
                title="ບໍ່ພົບລູກຄ້າ"
                hint={
                  search
                    ? `ບໍ່ພົບໃຜທີ່ກົງກັບ “${search}” — ລອງຂະຫຍາຍຊ່ວງວັນ ຫຼື ລ້າງຕົວກັ່ນຕອງ`
                    : "ເພີ່ມລູກຄ້າຢູ່ຟອມທາງຂວາ ຫຼື ຂະຫຍາຍຊ່ວງວັນ"
                }
              />
            ) : (
              <div className="table-wrap max-h-[36rem] overflow-y-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ວັນທີ່</th>
                      <th>ຊື່</th>
                      <th>ເບີໂທ</th>
                      <th>ຊ່ອງທາງ</th>
                      <th>ແຄມເປນ</th>
                      <th className="num">ຍອດຊື້</th>
                      <th>ສະຖານະ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const changeStatus = setLeadStatus.bind(null, lead.id);
                      return (
                        <tr key={lead.id}>
                          <td className="whitespace-nowrap">
                            {formatDateLao(lead.date)}
                          </td>
                          <td className="font-medium">{lead.name}</td>
                          <td className="tnum whitespace-nowrap">
                            {lead.phone ?? "—"}
                          </td>
                          <td className="text-xs">{lead.channel ?? "—"}</td>
                          <td className="max-w-44 truncate text-xs">
                            {lead.campaign ? (
                              <Link
                                href={`/campaigns/${lead.campaign.id}`}
                                className="link"
                              >
                                {lead.campaign.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="num">
                            {lead.amount ? money(lead.amount) : "—"}
                          </td>
                          <td>
                            <form action={changeStatus} className="flex gap-1">
                              <select
                                name="status"
                                defaultValue={lead.status}
                                className="field !py-1 !text-xs"
                              >
                                {options(LEAD_STATUS_LABEL).map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="btn btn-sm">
                                ✓
                              </button>
                            </form>
                            <div className="mt-1">
                              <Badge tone={LEAD_STATUS_TONE[lead.status]}>
                                {LEAD_STATUS_LABEL[lead.status]}
                              </Badge>
                            </div>
                          </td>
                          <td className="num">
                            <Link href={`/leads/${lead.id}`} className="btn btn-sm">
                              ແກ້ໄຂ
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {leads.length > 0 ? (
              <LoadMore
                shown={leads.length}
                total={matching}
                step={PAGE_SIZE}
                href={showHref}
              />
            ) : null}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມລູກຄ້າ" />
          <form action={createLead} className="grid gap-3 p-3">
            <Field label="ວັນທີ່ *">
              <input
                name="date"
                type="date"
                required
                defaultValue={todayStr()}
                className="field"
              />
            </Field>
            <Field label="ຊື່ລູກຄ້າ *">
              <input name="name" required className="field" />
            </Field>
            <Field label="ເບີໂທ">
              <input name="phone" className="field" placeholder="020 xx xxx xxx" />
            </Field>
            <Field label="ຊື່ໃນ Facebook">
              <input name="fbName" className="field" />
            </Field>
            <Field label="ຊ່ອງທາງ">
              <select name="channel" defaultValue="Messenger" className="field">
                {LEAD_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ແຄມເປນທີ່ມາ">
              <select name="campaignId" defaultValue="" className="field">
                <option value="">— ບໍ່ລະບຸ —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ສິນຄ້າທີ່ສົນໃຈ">
              <select name="productId" defaultValue="" className="field">
                <option value="">— ບໍ່ລະບຸ —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ສະຖານະ">
              <select name="status" defaultValue="NEW" className="field">
                {options(LEAD_STATUS_LABEL).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ຍອດຊື້ (ກີບ)" hint="ໃສ່ເມື່ອປິດການຂາຍໄດ້">
              <input
                name="amount"
                type="number"
                min="0"
                step="1000"
                defaultValue={0}
                className="field"
              />
            </Field>
            <Field label="ຜູ້ຮັບຜິດຊອບ">
              <input name="assignee" className="field" />
            </Field>
            <SubmitButton>ເພີ່ມລູກຄ້າ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
