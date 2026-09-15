"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, requireAdmin, requireSession } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bool, int0, num, reqDate, reqStr, str } from "@/lib/form";
import {
  BOOST_CAP_KEY,
  createLiveBoost,
  refreshLiveBoost,
  setLiveBoostRunning,
} from "@/lib/live-boost-server";
import { pullLiveStats } from "@/lib/live-stats-server";
import { formatInt } from "@/lib/format";
import { explainFbError } from "@/lib/fb";
import { extractVideoId, normalizeCode } from "@/lib/live-cf";
import {
  autoLinkCurrentLive,
  createLiveBills,
  pullLiveComments,
  replyLiveComment,
  reparseUnmatched,
  sendLiveSummaries,
  setLiveCommentHidden,
} from "@/lib/live-server";

function revalidateLive(id?: string) {
  revalidatePath("/live");
  if (id) revalidatePath(`/live/${id}`);
}

function revalidateOrderViews() {
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/reports");
}

/** ລິ້ງ/id ວິດີໂອທີ່ຄົນວາງ — ວາງມາແຕ່ອ່ານບໍ່ອອກ ຕ້ອງບອກ ບໍ່ແມ່ນປະວ່າງງຽບໆ */
function readVideo(fd: FormData): { fbVideoId: string | null; permalink: string | null } {
  const raw = str(fd, "video");
  if (!raw) return { fbVideoId: null, permalink: null };
  const fbVideoId = extractVideoId(raw);
  if (!fbVideoId) {
    throw new Error("ອ່ານ id ວິດີໂອຈາກລິ້ງນີ້ບໍ່ອອກ — ວາງລິ້ງແບບ facebook.com/.../videos/<ເລກ> ຫຼື ເລືອກຈາກລາຍການ live");
  }
  return { fbVideoId, permalink: raw.startsWith("http") ? raw : null };
}

export async function createLive(fd: FormData) {
  await requireSession();
  const live = await prisma.liveSession.create({
    data: {
      pageId: reqStr(fd, "pageId", "ເພຈ"),
      title: reqStr(fd, "title", "ຊື່ຮອບ live"),
      date: reqDate(fd, "date", "ວັນທີ່"),
      ...readVideo(fd),
    },
  });
  revalidateLive();
  redirect(`/live/${live.id}`);
}

export async function updateLive(id: string, fd: FormData) {
  await requireSession();
  const video = str(fd, "video") ? readVideo(fd) : {};
  await prisma.liveSession.update({
    where: { id },
    data: {
      title: reqStr(fd, "title", "ຊື່ຮອບ live"),
      date: reqDate(fd, "date", "ວັນທີ່"),
      note: str(fd, "note"),
      ...video,
    },
  });
  revalidateLive(id);
}

/** ຜູກວິດີໂອທີ່ເລືອກຈາກລາຍການ live ຂອງເພຈ */
export async function linkLiveVideo(id: string, videoId: string, permalink: string | null) {
  await requireSession();
  await prisma.liveSession.update({
    where: { id },
    // ປ່ຽນວິດີໂອ = ເລີ່ມໄລ່ comment ໃໝ່
    data: { fbVideoId: videoId, permalink, cursorAt: null, pollError: null },
  });
  revalidateLive(id);
}

/**
 * ເລີ່ມເກັບ CF — ຍັງບໍ່ໄດ້ຜູກວິດີໂອ = ຫາວິດີໂອທີ່ເພຈກຳລັງ live ໃຫ້ເອງ.
 * ຄືນຂໍ້ຄວາມແທນການ throw ເພາະ "ຍັງບໍ່ພົບ live" ເປັນເລື່ອງປົກກະຕິ (ກົດໄວກວ່າ Facebook)
 */
export async function startLive(id: string, _prev: string | null): Promise<string | null> {
  await requireSession();
  const live = await prisma.liveSession.findUnique({
    where: { id },
    select: { fbVideoId: true },
  });
  if (!live) return "ບໍ່ພົບ live ນີ້ແລ້ວ";

  let linked: string | null = null;
  if (!live.fbVideoId) {
    const found = await autoLinkCurrentLive(id);
    if (!found.ok) return found.reason;
    linked = found.title;
  }

  await prisma.liveSession.update({ where: { id }, data: { status: "LIVE" } });
  const pulled = await pullLiveComments(id, { force: true });
  revalidateLive(id);
  if (pulled.error) return pulled.error;
  return linked ? `ຜູກກັບ live “${linked}” ແລ້ວ — ເລີ່ມເກັບ CF` : null;
}

export async function setLiveStatus(id: string, status: "DRAFT" | "LIVE" | "ENDED") {
  await requireSession();
  const live = await prisma.liveSession.findUnique({
    where: { id },
    select: { fbVideoId: true },
  });
  if (!live) throw new Error("ບໍ່ພົບ live ນີ້ແລ້ວ");
  if (status === "LIVE" && !live.fbVideoId) {
    throw new Error("ຜູກວິດີໂອ live ກ່ອນ ຈຶ່ງເລີ່ມເກັບ CF ໄດ້");
  }
  await prisma.liveSession.update({ where: { id }, data: { status } });
  // ເລີ່ມແລ້ວດຶງທັນທີ — ບໍ່ຕ້ອງລໍຮອບທຳອິດຂອງໜ້າຈໍ
  if (status !== "DRAFT") await pullLiveComments(id, { force: true });
  revalidateLive(id);
}

export async function pullLiveNow(id: string) {
  await requireSession();
  await pullLiveComments(id, { force: true });
  revalidateLive(id);
}

export async function deleteLive(id: string) {
  await requireSession();
  const removed = await prisma.liveSession.delete({ where: { id } });
  await recordAudit("live.delete", removed.title);
  revalidateLive();
  redirect("/live");
}

// ------------------------------------------------------------------ ສິນຄ້າ

/**
 * ເພີ່ມ/ແກ້ສິນຄ້າໃນ live. ເລືອກສິນຄ້າໃນລະບົບແລ້ວປະຊື່/ລາຄາ/ຕົ້ນທຶນວ່າງ
 * = ເອົາຈາກສິນຄ້ານັ້ນ. ບັນທຶກແລ້ວອ່ານ CF ທີ່ລະຫັດບໍ່ຮູ້ຈັກຄືນໃໝ່.
 */
export async function saveLiveItem(sessionId: string, fd: FormData) {
  await requireSession();
  const itemId = str(fd, "itemId");
  const code = normalizeCode(reqStr(fd, "code", "ລະຫັດ"));
  if (!code) throw new Error("ລະຫັດຕ້ອງເປັນຕົວອັກສອນອັງກິດ ຫຼື ຕົວເລກ");

  const productId = str(fd, "productId");
  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId } })
    : null;
  if (productId && !product) throw new Error("ບໍ່ພົບສິນຄ້າທີ່ເລືອກ");

  const name = str(fd, "name") ?? product?.name;
  if (!name) throw new Error("ໃສ່ຊື່ສິນຄ້າ ຫຼື ເລືອກສິນຄ້າໃນລະບົບ");

  const stockRaw = str(fd, "stock");
  const data = {
    code,
    productId,
    name,
    price: num(fd, "price") ?? product?.price ?? 0,
    cost: num(fd, "cost") ?? product?.cost ?? 0,
    // ວ່າງ = ບໍ່ຈຳກັດ
    stock: stockRaw === null ? null : Math.max(0, int0(fd, "stock")),
  };

  const clash = await prisma.liveItem.findUnique({
    where: { sessionId_code: { sessionId, code } },
    select: { id: true },
  });
  if (clash && clash.id !== itemId) throw new Error(`ລະຫັດ ${code} ມີໃນ live ນີ້ແລ້ວ`);

  if (itemId) {
    await prisma.liveItem.update({ where: { id: itemId }, data });
  } else {
    await prisma.liveItem.create({ data: { ...data, sessionId } });
  }

  await reparseUnmatched(sessionId);
  revalidateLive(sessionId);
}

export async function deleteLiveItem(itemId: string) {
  await requireSession();
  const item = await prisma.liveItem.findUnique({
    where: { id: itemId },
    select: { sessionId: true, _count: { select: { claims: { where: { orderId: { not: null } } } } } },
  });
  if (!item) return;
  if (item._count.claims > 0) {
    throw new Error("ສິນຄ້ານີ້ອອກບິນໄປແລ້ວ — ລຶບບໍ່ໄດ້ (ແກ້ຢູ່ Order ແທນ)");
  }
  // CF ຂອງລະຫັດນີ້ກາຍເປັນ "ອ່ານລະຫັດບໍ່ອອກ" (onDelete: SetNull) ບໍ່ຫາຍໄປ
  await prisma.liveItem.delete({ where: { id: itemId } });
  revalidateLive(item.sessionId);
}

// ------------------------------------------------------------------- ລາຍການ CF

async function editableClaim(claimId: string) {
  const claim = await prisma.liveClaim.findUnique({
    where: { id: claimId },
    select: { sessionId: true, orderId: true },
  });
  if (!claim) throw new Error("ບໍ່ພົບລາຍການນີ້ແລ້ວ");
  if (claim.orderId) throw new Error("ລາຍການນີ້ອອກບິນແລ້ວ — ແກ້ຢູ່ Order ແທນ");
  return claim;
}

export async function setClaimCancelled(claimId: string, cancelled: boolean) {
  await requireSession();
  const claim = await editableClaim(claimId);
  await prisma.liveClaim.update({
    where: { id: claimId },
    data: { cancelled, cancelReason: cancelled ? "ຍົກເລີກໂດຍຮ້ານ" : null },
  });
  revalidateLive(claim.sessionId);
}

/** ເລືອກສິນຄ້າ/ຈຳນວນໃຫ້ CF ທີ່ລະບົບອ່ານບໍ່ອອກ ຫຼື ອ່ານຜິດ */
export async function assignClaim(claimId: string, fd: FormData) {
  await requireSession();
  const claim = await editableClaim(claimId);
  const itemId = reqStr(fd, "itemId", "ສິນຄ້າ");
  const item = await prisma.liveItem.findFirst({
    where: { id: itemId, sessionId: claim.sessionId },
    select: { id: true },
  });
  if (!item) throw new Error("ບໍ່ພົບສິນຄ້ານີ້ໃນ live");
  await prisma.liveClaim.update({
    where: { id: claimId },
    data: {
      itemId,
      quantity: Math.max(1, int0(fd, "quantity")),
      cancelled: false,
      cancelReason: null,
    },
  });
  revalidateLive(claim.sessionId);
}

// ------------------------------------------------------ ອອກບິນ / ແຈ້ງລູກຄ້າ

export async function billLive(id: string, _prev: string | null): Promise<string | null> {
  await requireSession();
  try {
    const result = await createLiveBills(id);
    revalidateLive(id);
    revalidateOrderViews();
    if (result.created + result.appended === 0) return "ບໍ່ມີລາຍການທີ່ຕ້ອງອອກບິນເພີ່ມ";
    return `ອອກບິນໃໝ່ ${formatInt(result.created)} · ເພີ່ມໃສ່ບິນເກົ່າ ${formatInt(result.appended)}`;
  } catch (error) {
    return explainFbError(error);
  }
}

export async function notifyLive(
  id: string,
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  await requireSession();
  try {
    const template = reqStr(fd, "template", "ຂໍ້ຄວາມ");
    if (!template.includes("{items}") && !template.includes("{total}")) {
      return "ຂໍ້ຄວາມຕ້ອງມີ {items} ຫຼື {total} — ບໍ່ດັ່ງນັ້ນລູກຄ້າບໍ່ເຫັນຍອດ";
    }
    const result = await sendLiveSummaries(id, template);
    await recordAudit(
      "live.notify",
      id,
      `ສົ່ງສຳເລັດ ${result.sent} · ລົ້ມ ${result.failed}`,
    );
    revalidateLive(id);
    revalidatePath("/orders");
    return (
      `ສົ່ງສຳເລັດ ${formatInt(result.sent)} ຄົນ` +
      (result.failed ? ` · ລົ້ມ ${formatInt(result.failed)}` : "") +
      (result.remaining ? ` · ຍັງເຫຼືອ ${formatInt(result.remaining)} (ກົດອີກເທື່ອ)` : "")
    );
  } catch (error) {
    return explainFbError(error);
  }
}

// ------------------------------------------------------------ comment ໃນ live

/** ກ່ອງຕອບ (ReplyBox) — ຄືນຂໍ້ຄວາມຜິດພາດແທນການ throw ໜ້າຈໍຈຶ່ງບໍ່ພັງ */
export async function replyLiveCommentAction(
  commentId: string,
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  await requireSession();
  try {
    const message = reqStr(fd, "message", "ຄຳຕອບ");
    await replyLiveComment(commentId, message, str(fd, "mode") === "private" ? "private" : "public");
    const row = await prisma.liveComment.findUnique({ where: { id: commentId }, select: { sessionId: true } });
    revalidateLive(row?.sessionId);
    return null;
  } catch (error) {
    return explainFbError(error);
  }
}

export async function toggleLiveCommentHidden(commentId: string, hidden: boolean) {
  await requireSession();
  const sessionId = await setLiveCommentHidden(commentId, hidden);
  revalidateLive(sessionId);
}

export async function setLiveCommentHandled(commentId: string, handled: boolean) {
  await requireSession();
  const row = await prisma.liveComment.update({
    where: { id: commentId },
    data: { handled, handledAt: handled ? new Date() : null },
    select: { sessionId: true },
  });
  revalidateLive(row.sessionId);
}

/** ໝາຍຄຳຖາມທັງໝົດທີ່ເຫັນຢູ່ວ່າຈັດການແລ້ວ — ຫຼັງ live ມັກຄ້າງເປັນຮ້ອຍ */
export async function markLiveQuestionsHandled(sessionId: string) {
  await requireSession();
  await prisma.liveComment.updateMany({
    where: { sessionId, isQuestion: true, handled: false },
    data: { handled: true, handledAt: new Date() },
  });
  revalidateLive(sessionId);
}

export async function saveLiveAutomation(sessionId: string, fd: FormData) {
  await requireSession();
  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { autoAck: bool(fd, "autoAck"), autoHide: bool(fd, "autoHide") },
  });
  revalidateLive(sessionId);
}

// ------------------------------------------------------------------ boost live

/** ເພດານງົບຕໍ່ການ boost 1 ເທື່ອ (ກີບ) — ສະເພາະ ADMIN ເພາະເປັນເພດານຂອງເງິນຈິງ */
export async function saveBoostCap(sessionId: string, fd: FormData) {
  await requireAdmin();
  const value = num(fd, "cap");
  if (value === null || value <= 0) throw new Error("ເພດານຕ້ອງເປັນຕົວເລກຫຼາຍກວ່າ 0 (ກີບ)");
  await prisma.appSetting.upsert({
    where: { key: BOOST_CAP_KEY },
    create: { key: BOOST_CAP_KEY, value: String(Math.round(value)) },
    update: { value: String(Math.round(value)) },
  });
  await recordAudit("live.boost.cap", null, `${Math.round(value)} ກີບ`);
  revalidateLive(sessionId);
}

export async function createBoostAction(
  sessionId: string,
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  await requireSession();
  try {
    const gender = str(fd, "gender");
    const user = await currentUser();
    await createLiveBoost(
      sessionId,
      {
        adAccountId: reqStr(fd, "adAccountId", "ບັນຊີໂຄສະນາ"),
        budget: num(fd, "budget") ?? 0,
        hours: int0(fd, "hours"),
        ageMin: int0(fd, "ageMin"),
        ageMax: int0(fd, "ageMax"),
        gender: gender === "male" || gender === "female" ? gender : "all",
      },
      user?.displayName ?? null,
    );
    await recordAudit("live.boost", sessionId, `${num(fd, "budget")} · ${int0(fd, "hours")} ຊົ່ວໂມງ`);
    revalidateLive(sessionId);
    return "ສ້າງແລ້ວ — ຢຸດໄວ້ຢູ່ ກວດງົບ/ກຸ່ມເປົ້າໝາຍ ແລ້ວກົດ “ຍິງ”";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function runBoostAction(
  boostId: string,
  running: boolean,
  _prev: string | null,
): Promise<string | null> {
  await requireSession();
  try {
    await setLiveBoostRunning(boostId, running);
    const boost = await prisma.liveBoost.findUnique({ where: { id: boostId }, select: { sessionId: true } });
    await recordAudit("live.boost.status", boostId, running ? "ACTIVE" : "PAUSED");
    revalidateLive(boost?.sessionId);
    return running ? "ຍິງແລ້ວ — Facebook ອາດກວດໂຄສະນາກ່ອນ 5–30 ນາທີ" : "ຢຸດແລ້ວ";
  } catch (error) {
    return explainFbError(error);
  }
}

export async function refreshBoostAction(boostId: string) {
  await requireSession();
  await refreshLiveBoost(boostId);
  const boost = await prisma.liveBoost.findUnique({ where: { id: boostId }, select: { sessionId: true } });
  revalidateLive(boost?.sessionId);
}

// ------------------------------------------------------------ ຍອດຄົນເບິ່ງ

export async function refreshLiveStatsAction(sessionId: string, _prev: string | null): Promise<string | null> {
  await requireSession();
  const result = await pullLiveStats(sessionId, { force: true });
  revalidateLive(sessionId);
  revalidatePath(`/live/${sessionId}/report`);
  return result.error ?? (result.saved ? "ອັບເດດຍອດຄົນເບິ່ງແລ້ວ" : null);
}
