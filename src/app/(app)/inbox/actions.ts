"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { reqStr, str } from "@/lib/form";
import { runInboxSync } from "@/lib/auto-sync";
import {
  markCommentsHandled,
  replyToComment,
  sendChatMessage,
  sendPrivateReply,
  setCommentHidden,
  syncPageTokens,
} from "@/lib/fb-inbox";
import { explainFbError } from "@/lib/fb";
import { todayStr, parseDate, daysAgo } from "@/lib/date";
import { findMatchingLead, type LeadCandidate } from "@/lib/lead-match";

/** ດຶງກ່ອງຂໍ້ຄວາມດຽວນີ້ — ລໍຈົນຈົບ ເພາະ 1 ຮອບໃຊ້ເວລາບໍ່ດົນ */
export async function pullInboxNow() {
  await requireSession();
  await runInboxSync();
  revalidatePath("/inbox");
  revalidatePath("/settings");
}

/** ດຶງ page token ຂອງທຸກເພຈທີ່ token ຫຼັກເຂົ້າເຖິງໄດ້ */
export async function linkPages() {
  await requireSession();
  await syncPageTokens();
  revalidatePath("/fb-pages");
  revalidatePath("/inbox");
}

/**
 * ຕອບ comment — `mode=private` ຄືຕອບເຂົ້າ Messenger ຂອງຄົນນັ້ນ (private reply).
 * ຄືນຂໍ້ຄວາມຜິດພາດແທນການ throw ເພື່ອໃຫ້ກ່ອງຕອບສະແດງເອງ ໂດຍໜ້າບໍ່ພັງ.
 */
export async function replyComment(
  commentId: string,
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  await requireSession();
  try {
    const message = reqStr(fd, "message", "ຄຳຕອບ");
    if (str(fd, "mode") === "private") {
      await sendPrivateReply(commentId, message);
    } else {
      await replyToComment(commentId, message);
    }
    revalidatePath("/inbox");
    return null;
  } catch (error) {
    return explainFbError(error);
  }
}

/** ໝາຍທີ່ຕິກໄວ້ວ່າຈັດການແລ້ວ — ໃຊ້ເກັບກວາດ comment ທີ່ຄ້າງເປັນຮ້ອຍ */
export async function markSelectedHandled(fd: FormData) {
  await requireSession();
  const ids = fd.getAll("ids").filter((v): v is string => typeof v === "string");
  await markCommentsHandled(ids, true);
  revalidatePath("/inbox");
}

export async function toggleCommentHidden(commentId: string, hidden: boolean) {
  await requireSession();
  await setCommentHidden(commentId, hidden);
  revalidatePath("/inbox");
}

export async function setCommentHandled(commentId: string, handled: boolean) {
  await requireSession();
  await prisma.fbComment.update({
    where: { id: commentId },
    data: { handled, handledAt: handled ? new Date() : null },
  });
  revalidatePath("/inbox");
}

export async function sendChatReply(threadId: string, fd: FormData) {
  await requireSession();
  await sendChatMessage(threadId, reqStr(fd, "text", "ຂໍ້ຄວາມ"));
  revalidatePath("/inbox");
  revalidatePath(`/inbox/chat/${threadId}`);
}

export async function setThreadHandled(threadId: string, handled: boolean) {
  await requireSession();
  await prisma.fbThread.update({
    where: { id: threadId },
    data: { handled, handledAt: handled ? new Date() : null },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/chat/${threadId}`);
}

/**
 * ເຮັດຄົນທີ່ທັກ/comment ໃຫ້ເປັນ “ລູກຄ້າ” ໃນລະບົບ.
 * ຜູກກັບແຄມເປນທີ່ໂພສນັ້ນຍິງຢູ່ໃຫ້ເລີຍ ຈຶ່ງຮູ້ວ່າລູກຄ້າຄົນນີ້ມາຈາກໂຄສະນາໃດ.
 */
/**
 * ຫາລູກຄ້າເກົ່າທີ່ແມ່ນຄົນດຽວກັນ — ເບິ່ງຍ້ອນຫຼັງ 180 ວັນ.
 * ເກົ່າກວ່ານັ້ນຖືວ່າເປັນລູກຄ້າຄົນລະຮອບ ຄວນນັບເປັນລາຍໃໝ່.
 */
const LEAD_MATCH_DAYS = 180;

async function existingLeadFor(person: {
  fbName: string | null;
  phone?: string | null;
}): Promise<LeadCandidate | null> {
  const candidates = await prisma.lead.findMany({
    where: { createdAt: { gte: daysAgo(LEAD_MATCH_DAYS) } },
    orderBy: { date: "desc" },
    take: 500,
    select: { id: true, name: true, fbName: true, phone: true },
  });
  return findMatchingLead(person, candidates);
}

export async function createLeadFromComment(commentId: string) {
  await requireSession();
  const comment = await prisma.fbComment.findUnique({
    where: { id: commentId },
    include: { post: { select: { campaignId: true } } },
  });
  if (!comment) throw new Error("ບໍ່ພົບ comment ນີ້ແລ້ວ");
  if (comment.leadId) return;

  // ຄົນນີ້ເຄີຍເປັນລູກຄ້າແລ້ວບໍ່ — ຜູກໃສ່ແຖວເກົ່າ ດີກວ່າສ້າງຄົນຊ້ຳ
  const matched = await existingLeadFor({ fbName: comment.fromName });

  const lead =
    matched ??
    (await prisma.lead.create({
      data: {
        date: parseDate(todayStr()),
        name: comment.fromName ?? "ບໍ່ຮູ້ຊື່",
        fbName: comment.fromName,
        channel: "Comment",
        campaignId: comment.post.campaignId,
        note: comment.message,
      },
    }));

  await prisma.fbComment.update({
    where: { id: comment.id },
    data: { leadId: lead.id, handled: true, handledAt: new Date() },
  });

  revalidatePath("/inbox");
  revalidatePath("/leads");
}

export async function createLeadFromThread(threadId: string) {
  await requireSession();
  const thread = await prisma.fbThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new Error("ບໍ່ພົບຫ້ອງແຊັດນີ້ແລ້ວ");
  if (thread.leadId) return;

  // ຄົນທີ່ comment ໄວ້ແລ້ວມາທັກແຊັດຕໍ່ ແມ່ນຄົນດຽວກັນ — ຢ່ານັບສອງ
  const matched = await existingLeadFor({ fbName: thread.personName });

  const lead =
    matched ??
    (await prisma.lead.create({
      data: {
        date: parseDate(todayStr()),
        name: thread.personName ?? "ບໍ່ຮູ້ຊື່",
        fbName: thread.personName,
        channel: "Messenger",
        note: thread.snippet,
      },
    }));

  await prisma.fbThread.update({
    where: { id: thread.id },
    data: { leadId: lead.id },
  });

  revalidatePath("/inbox");
  revalidatePath(`/inbox/chat/${threadId}`);
  revalidatePath("/leads");
}
