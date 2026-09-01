import "server-only";

import { prisma } from "./prisma";
import { addDays, laoDayStart, parseDate, toDateInput, type DateRange } from "./date";
import { aggregate } from "./metrics";
import { totalsScope } from "./scope";
import { OrderStatus, SegmentKind } from "@/generated/prisma/enums";
import {
  buildBehaviorReport,
  normalizePhone,
  type BehaviorReport,
  type OrderFact,
  type ThreadFact,
} from "./behavior";

/**
 * ອ່ານຂໍ້ມູນໃຫ້ `behavior.ts` — ແຍກອອກມາເພາະໄຟລ໌ນັ້ນຕ້ອງບໍລິສຸດ (ມີ test ຄຸມ).
 */

/**
 * ຂໍ້ຄວາມຖືກເກັບເປັນ**ເວລາຈິງ** ສ່ວນຊ່ວງວັນທີ່ຜູ້ໃຊ້ເລືອກເປັນ**ວັນລາວ** —
 * ຈຶ່ງຕ້ອງແປງເປັນຂອບເວລາຈິງກ່ອນ ບໍ່ດັ່ງນັ້ນຈະຂາດຄົນທັກຕອນເດິກ 7 ຊົ່ວໂມງທຸກມື້.
 */

/** ດຶງເລີຍປາຍຊ່ວງອອກໄປອີກ ເພື່ອຮູ້ວ່າຄົນທັກມື້ສຸດທ້າຍໄດ້ຮັບການຕອບບໍ່ */
const REPLY_TAIL_MS = 24 * 60 * 60 * 1000;

export async function loadBehaviorReport(
  range: DateRange,
): Promise<BehaviorReport> {
  const start = laoDayStart(range.from);
  const end = laoDayStart(addDays(range.to, 1));
  const tailEnd = new Date(end.getTime() + REPLY_TAIL_MS);
  const from = parseDate(range.from);
  const to = parseDate(range.to);

  const [messages, threadRows, orderRows, leads, hourRows, insights, priorRows] =
    await Promise.all([
      prisma.fbMessage.findMany({
        where: { sentAt: { gte: start, lt: tailEnd } },
        select: { threadId: true, fromPage: true, sentAt: true, text: true },
        orderBy: { sentAt: "asc" },
      }),
      prisma.fbThread.findMany({
        where: { lastMessageAt: { gte: start } },
        select: { id: true, leadId: true },
      }),
      prisma.order.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          date: true,
          status: true,
          phone: true,
          lead: { select: { date: true } },
        },
      }),
      prisma.lead.count({ where: { date: { gte: from, lte: to } } }),
      prisma.segmentInsight.findMany({
        where: { kind: SegmentKind.HOUR, date: { gte: from, lte: to } },
        select: { segKey: true, spendLak: true },
      }),
      prisma.insight.findMany({
        where: { ...totalsScope, date: { gte: from, lte: to } },
        select: { spendLak: true, messages: true },
      }),
      // ເບີທີ່ເຄີຍສັ່ງກ່ອນຊ່ວງນີ້ — ໃຊ້ແຍກ "ລູກຄ້າເກົ່າ" ອອກຈາກ "ຄົນໃໝ່"
      prisma.order.findMany({
        where: { date: { lt: from }, phone: { not: null } },
        select: { phone: true },
        distinct: ["phone"],
      }),
    ]);

  // ---- ຫ້ອງແຊັດ: ຄົນທັກຄັ້ງທຳອິດໃນຊ່ວງ ແລະ ການຕອບຄັ້ງທຳອິດຫຼັງຈາກນັ້ນ
  const leadOf = new Map(threadRows.map((t) => [t.id, t.leadId]));

  type Draft = {
    firstInboundAt: Date | null;
    firstReplyAt: Date | null;
    texts: string[];
  };
  const drafts = new Map<string, Draft>();

  for (const m of messages) {
    const d = drafts.get(m.threadId) ?? {
      firstInboundAt: null,
      firstReplyAt: null,
      texts: [],
    };

    if (!m.fromPage) {
      // ຂໍ້ຄວາມທ້າຍຊ່ວງທີ່ດຶງມາເພື່ອຫາຄຳຕອບ ບໍ່ນັບເປັນຄົນທັກໃໝ່
      if (m.sentAt < end) {
        if (!d.firstInboundAt) d.firstInboundAt = m.sentAt;
        if (m.text) d.texts.push(m.text);
      }
    } else if (d.firstInboundAt && !d.firstReplyAt) {
      d.firstReplyAt = m.sentAt;
    }

    drafts.set(m.threadId, d);
  }

  const orderedLeads = await orderedLeadIds(
    [...drafts.keys()]
      .map((id) => leadOf.get(id))
      .filter((id): id is string => Boolean(id)),
  );

  const threads: ThreadFact[] = [];
  for (const [id, d] of drafts) {
    if (!d.firstInboundAt) continue;
    const leadId = leadOf.get(id) ?? null;
    threads.push({
      id,
      firstInboundAt: d.firstInboundAt,
      firstReplyAt: d.firstReplyAt,
      texts: d.texts,
      leadId,
      ordered: leadId ? orderedLeads.has(leadId) : false,
    });
  }

  // ---- ອໍເດີ
  const orders: OrderFact[] = orderRows.map((o) => ({
    day: toDateInput(o.date),
    leadDay: o.lead ? toDateInput(o.lead.date) : null,
    delivered: o.status === OrderStatus.DELIVERED,
    phone: o.phone,
  }));

  // ---- ຄ່າໂຄສະນາລາຍຊົ່ວໂມງ (segKey ຂອງມິຕິ HOUR ຄື "07")
  const spendByHour = new Array(24).fill(0) as number[];
  for (const row of hourRows) {
    const hour = Number(row.segKey);
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
      spendByHour[hour] += row.spendLak;
    }
  }

  const priorPhones = new Set<string>();
  for (const row of priorRows) {
    const phone = normalizePhone(row.phone);
    if (phone) priorPhones.add(phone);
  }

  return buildBehaviorReport({
    threads,
    orders,
    leads,
    costPerMessage: aggregate(insights).costPerMessage,
    spendByHour: hourRows.length > 0 ? spendByHour : null,
    priorPhones,
  });
}

/** ລູກຄ້າຄົນໃດມີອໍເດີແລ້ວ — ນັບທຸກຊ່ວງເວລາ ບໍ່ພຽງແຕ່ຊ່ວງທີ່ເບິ່ງ */
async function orderedLeadIds(leadIds: string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const rows = await prisma.order.findMany({
    where: { leadId: { in: [...new Set(leadIds)] } },
    select: { leadId: true },
    distinct: ["leadId"],
  });
  return new Set(
    rows.map((r) => r.leadId).filter((id): id is string => Boolean(id)),
  );
}
