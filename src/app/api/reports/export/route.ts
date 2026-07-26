import { NextResponse } from "next/server";
import { resolveRange } from "@/lib/date";
import { buildReport, GROUP_BYS, type GroupBy } from "@/lib/report";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "ກຸ່ມ",
  "ຄ່າໂຄສະນາ(ກີບ)",
  "ຄັ້ງທີ່ເຫັນ",
  "ເຂົ້າເຖິງ",
  "ຄລິກ",
  "CTR",
  "CPC(ກີບ)",
  "CPM(ກີບ)",
  "ທັກແຊັດ",
  "ຄ່າຕໍ່ທັກ(ກີບ)",
  "ລາຍຊື່",
  "ອໍເດີ",
  "ຄ່າຕໍ່ອໍເດີ(ກີບ)",
  "ຍອດຂາຍ(ກີບ)",
  "ກຳໄລ(ກີບ)",
  "ROAS",
];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    preset: url.searchParams.get("preset") ?? undefined,
  });
  const byParam = url.searchParams.get("by") ?? "campaign";
  const groupBy = (byParam in GROUP_BYS ? byParam : "campaign") as GroupBy;

  const { rows, totals } = await buildReport(range, groupBy);

  const lines = [
    COLUMNS.join(","),
    ...rows.map((r) =>
      [
        r.label,
        Math.round(r.spendLak),
        r.impressions,
        r.reach,
        r.clicks,
        (r.ctr * 100).toFixed(2),
        Math.round(r.cpc),
        Math.round(r.cpm),
        r.messages,
        Math.round(r.costPerMessage),
        r.leadsCount,
        r.purchases,
        Math.round(r.costPerPurchase),
        Math.round(r.revenue),
        Math.round(r.profit),
        r.roas.toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    ),
    [
      "ລວມທັງໝົດ",
      Math.round(totals.spendLak),
      totals.impressions,
      totals.reach,
      totals.clicks,
      (totals.ctr * 100).toFixed(2),
      Math.round(totals.cpc),
      Math.round(totals.cpm),
      totals.messages,
      Math.round(totals.costPerMessage),
      totals.leadsCount,
      totals.purchases,
      Math.round(totals.costPerPurchase),
      Math.round(totals.revenue),
      Math.round(totals.profit),
      totals.roas.toFixed(2),
    ]
      .map(csvCell)
      .join(","),
  ];

  // BOM ນຳໜ້າ ເພື່ອໃຫ້ Excel ອ່ານພາສາລາວໄດ້ຖືກຕ້ອງ
  const body = `﻿${lines.join("\n")}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fbmonoy-${groupBy}-${range.from}-${range.to}.csv"`,
    },
  });
}
