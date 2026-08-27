"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { reqStr } from "@/lib/form";
import { runInboxSync } from "@/lib/auto-sync";
import {
  replyToComment,
  sendChatMessage,
  setCommentHidden,
  syncPageTokens,
} from "@/lib/fb-inbox";
import { todayStr, parseDate } from "@/lib/date";

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

export async function replyComment(commentId: string, fd: FormData) {
  await requireSession();
  await replyToComment(commentId, reqStr(fd, "message", "ຄຳຕອບ"));
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
export async function createLeadFromComment(commentId: string) {
  await requireSession();
  const comment = await prisma.fbComment.findUnique({
    where: { id: commentId },
    include: { post: { select: { campaignId: true } } },
  });
  if (!comment) throw new Error("ບໍ່ພົບ comment ນີ້ແລ້ວ");
  if (comment.leadId) return;

  const lead = await prisma.lead.create({
    data: {
      date: parseDate(todayStr()),
      name: comment.fromName ?? "ບໍ່ຮູ້ຊື່",
      fbName: comment.fromName,
      channel: "Comment",
      campaignId: comment.post.campaignId,
      note: comment.message,
    },
  });

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

  const lead = await prisma.lead.create({
    data: {
      date: parseDate(todayStr()),
      name: thread.personName ?? "ບໍ່ຮູ້ຊື່",
      fbName: thread.personName,
      channel: "Messenger",
      note: thread.snippet,
    },
  });

  await prisma.fbThread.update({
    where: { id: thread.id },
    data: { leadId: lead.id },
  });

  revalidatePath("/inbox");
  revalidatePath(`/inbox/chat/${threadId}`);
  revalidatePath("/leads");
}
