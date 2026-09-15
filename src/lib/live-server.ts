import { prisma } from "./prisma";
import { explainFbError, getFbConfig, graphErrorOf, graphFetch } from "./fb";
import { formatLak } from "./format";
import {
  ACK_MAX_AGE_MS,
  ACK_PER_MINUTE,
  AUTO_HIDE_MAX_AGE_MS,
  ackMessage,
  classifyLiveComment,
} from "./live-comments";
import {
  allocateClaims,
  buildBills,
  canPrivateReply,
  customerKey,
  parseCf,
  renderSummary,
  singleProductId,
  type Allocation,
  type ClaimState,
} from "./live-cf";

/**
 * ຝັ່ງຖານຂໍ້ມູນ ແລະ Facebook ຂອງລະບົບ CF ຕອນ live.
 * ກົດການອ່ານ/ຈັດຄິວ/ລວມບິນ ຢູ່ `live-cf.ts` (ບໍລິສຸດ · ມີ test ຄຸມ).
 *
 * comment ຂອງ live ເກັບໄວ້ `LiveComment` **ບໍ່ແມ່ນ `FbComment`** — live ດຽວມີຫຼາຍພັນ
 * "CF A1" ຈະຖົມກ່ອງຂໍ້ຄວາມຈົນວຽກອື່ນຈົມ. ລາຍການຈອງຢູ່ `LiveClaim`.
 */

const GRAPH = "https://graph.facebook.com";

/** ຫຼາຍໜ້າຈໍເປີດ live ດຽວກັນ — ດຶງຈາກ Facebook ບໍ່ຖີ່ກວ່ານີ້ */
const POLL_MIN_GAP_MS = 3_000;
/** ໄລ່ຍ້ອນຫຼັງກາຍເວລາຂອງ comment ໃໝ່ສຸດທີ່ເຄີຍເຫັນ — ກັນ comment ມາຊ້າ */
const CURSOR_OVERLAP_MS = 2 * 60_000;
/** 100 comment ຕໍ່ໜ້າ — ເປີດໜ້າຈໍຄືນຫຼັງຫາຍໄປດົນ ກໍ່ຍັງຕາມທັນ 5,000 comment */
const MAX_PAGES = 50;
/** ຂໍ້ຄວາມ Messenger ຍາວໄດ້ບໍ່ເກີນ 2,000 ຕົວ */
const MESSAGE_MAX = 2_000;

type RawComment = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id: string; name?: string };
  parent?: { id: string };
  is_hidden?: boolean;
};

async function graphGet<T>(
  version: string,
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: token });
  const json = await graphFetch<T>(`${GRAPH}/${version}/${path}?${search.toString()}`);
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

async function liveContext(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { page: { select: { id: true, name: true, fbPageId: true, token: true } } },
  });
  if (!session) throw new Error("ບໍ່ພົບ live ນີ້ແລ້ວ");
  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token ໃນໜ້າຕັ້ງຄ່າ");
  if (!session.page.token || !session.page.fbPageId) {
    throw new Error("ເພຈນີ້ຍັງບໍ່ມີ page token — ໄປໜ້າ ເພຈ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook”");
  }
  return {
    session,
    version: config.apiVersion,
    token: session.page.token,
    fbPageId: session.page.fbPageId,
  };
}

// ---------------------------------------------------------- ລາຍການ live ຂອງເພຈ

export type PageLiveVideo = {
  /** id ທີ່ໃຊ້ດຶງ comment (ວິດີໂອ) */
  videoId: string;
  title: string;
  status: string;
  createdAt: Date | null;
  permalink: string | null;
};

/** live ຫຼ້າສຸດຂອງເພຈ — ໃຫ້ຄົນເລືອກຜູກກັບຮອບ live ໂດຍບໍ່ຕ້ອງວາງລິ້ງເອງ */
export async function listPageLiveVideos(pageId: string): Promise<PageLiveVideo[]> {
  const page = await prisma.fbPage.findUnique({
    where: { id: pageId },
    select: { fbPageId: true, token: true },
  });
  const config = await getFbConfig();
  if (!page?.token || !page.fbPageId || !config) return [];

  type RawLive = {
    id: string;
    title?: string;
    description?: string;
    status?: string;
    creation_time?: string;
    permalink_url?: string;
    video?: { id: string };
  };

  try {
    const json = await graphGet<{ data?: RawLive[] }>(
      config.apiVersion,
      `${page.fbPageId}/live_videos`,
      {
        fields: "id,title,description,status,creation_time,permalink_url,video{id}",
        limit: "10",
      },
      page.token,
    );

    return (json.data ?? []).map((live) => ({
      // comment ຢູ່ກັບ object ວິດີໂອ — live ທີ່ຍັງບໍ່ມີວິດີໂອຈຶ່ງໃຊ້ id ຂອງ live ແທນ
      videoId: live.video?.id ?? live.id,
      title: live.title || live.description?.slice(0, 80) || "(ບໍ່ມີຊື່)",
      status: live.status ?? "",
      createdAt: live.creation_time ? new Date(live.creation_time) : null,
      permalink: absoluteLink(live.permalink_url),
    }));
  } catch (error) {
    if (!isLiveApiGated(error)) throw error;
  }

  // `/live_videos` ເປັນ "Live Video API" ທີ່ Facebook ໃຫ້ໃຊ້ສະເພາະຄົນທີ່ມີບົດບາດ
  // ໃນແອັບ (ຫຼື ແອັບຜ່ານ App Review). `/videos` ຂອງເພຈໃຊ້ສິດເພຈທຳມະດາ
  // ແລະ ວິດີໂອ live ກໍ່ຢູ່ໃນນັ້ນ (ມີ `live_status`) — ຈຶ່ງໃຊ້ແທນໄດ້
  type RawVideo = {
    id: string;
    title?: string;
    description?: string;
    created_time?: string;
    permalink_url?: string;
    live_status?: string;
  };
  const json = await graphGet<{ data?: RawVideo[] }>(
    config.apiVersion,
    `${page.fbPageId}/videos`,
    {
      fields: "id,title,description,created_time,permalink_url,live_status",
      limit: "15",
    },
    page.token,
  );

  return (json.data ?? []).map((video) => ({
    videoId: video.id,
    title: video.title || video.description?.slice(0, 80) || "(ບໍ່ມີຊື່)",
    status: video.live_status ?? "VIDEO",
    createdAt: video.created_time ? new Date(video.created_time) : null,
    permalink: absoluteLink(video.permalink_url),
  }));
}

export type AutoLinkResult =
  | { ok: true; title: string }
  | { ok: false; reason: string };

/**
 * ຜູກຮອບ live ກັບວິດີໂອທີ່ເພຈ **ກຳລັງອອກອາກາດຢູ່** — ຄົນຂາຍບໍ່ຕ້ອງໄປຊອກລິ້ງ.
 * ຜູກໃຫ້ສະເພາະເມື່ອພົບ live ດຽວ; ພົບຫຼາຍອັນ = ໃຫ້ຄົນເລືອກ (ເດົາຜິດ = ເກັບ CF ຜິດວິດີໂອ).
 */
export async function autoLinkCurrentLive(sessionId: string): Promise<AutoLinkResult> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    select: { pageId: true },
  });
  if (!session) return { ok: false, reason: "ບໍ່ພົບ live ນີ້ແລ້ວ" };

  let videos: PageLiveVideo[];
  try {
    videos = await listPageLiveVideos(session.pageId);
  } catch (error) {
    return { ok: false, reason: explainFbError(error) };
  }

  const onAir = videos.filter((v) => v.status === "LIVE");
  if (onAir.length === 0) {
    return {
      ok: false,
      reason:
        "ບໍ່ພົບວິດີໂອທີ່ເພຈກຳລັງ live — ເລີ່ມ live ໃນ Facebook ກ່ອນ (ລໍ 10–20 ວິນາທີຫຼັງອອກອາກາດ) " +
        "ຫຼື ວາງລິ້ງວິດີໂອເອງຢູ່ “ຂໍ້ມູນຮອບ”",
    };
  }
  if (onAir.length > 1) {
    return { ok: false, reason: "ເພຈກຳລັງ live ຫຼາຍກວ່າ 1 ວິດີໂອ — ເລືອກເອງຈາກລາຍການ" };
  }

  const [video] = onAir;
  const taken = await prisma.liveSession.findUnique({
    where: { fbVideoId: video.videoId },
    select: { id: true, title: true },
  });
  if (taken && taken.id !== sessionId) {
    return { ok: false, reason: `ວິດີໂອນີ້ຜູກກັບຮອບ “${taken.title}” ຢູ່ແລ້ວ` };
  }

  await prisma.liveSession.update({
    where: { id: sessionId },
    data: { fbVideoId: video.videoId, permalink: video.permalink, cursorAt: null, pollError: null },
  });
  return { ok: true, title: video.title };
}

/** Facebook ບາງເທື່ອຄືນລິ້ງແບບ "/page/videos/123" ບໍ່ມີໂດເມນ */
function absoluteLink(value: string | undefined): string | null {
  return value ? new URL(value, "https://www.facebook.com").toString() : null;
}

/** code 10 "live-video-api" — endpoint ຂອງ live ຖືກກັນໄວ້ລໍ App Review */
export function isLiveApiGated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("live-video-api");
}

// --------------------------------------------------------------- ດຶງ comment

type ClaimRow = {
  sessionId: string;
  itemId: string | null;
  fbCommentId: string;
  line: number;
  fromId: string | null;
  fromName: string | null;
  message: string | null;
  quantity: number;
  commentedAt: Date;
  cancelled: boolean;
  cancelReason: string | null;
};

type CommentInput = {
  fbCommentId: string;
  fromId: string | null;
  fromName: string | null;
  message: string | null;
  commentedAt: Date;
};

/**
 * ແປງ comment ເປັນແຖວຈອງ. `active` ຄືຊຸດ "ຄົນ:ສິນຄ້າ" ທີ່ຈອງໄວ້ແລ້ວ —
 * ຄົນດຽວກັນ CF ລະຫັດເກົ່າຊ້ຳ (ມັກເພາະຄິດວ່າລະບົບບໍ່ເຫັນ) ຖືກໝາຍວ່າຊ້ຳ
 * ບໍ່ນັບເພີ່ມ ແຕ່ຄົນກົດ "ຄືນ" ໄດ້ຖ້າລູກຄ້າຢາກໄດ້ເພີ່ມແທ້.
 */
function claimRows(
  sessionId: string,
  comment: CommentInput,
  itemByCode: Map<string, string>,
  active: Set<string>,
): ClaimRow[] {
  const parsed = parseCf(comment.message, new Set(itemByCode.keys()));
  if (!parsed.isCf) return [];

  // ເລືອກຊ່ອງເອງ — reparse ສົ່ງແຖວ LiveClaim ທັງແຖວມາ ຖ້າ spread ທັງກ້ອນ
  // `id` ເກົ່າຈະຕິດໄປທຸກແຖວໃໝ່ ແລ້ວ skipDuplicates ຖິ້ມແຖວທີ 2 ຖິ້ມງຽບໆ
  const base = {
    sessionId,
    fbCommentId: comment.fbCommentId,
    fromId: comment.fromId,
    fromName: comment.fromName,
    message: comment.message,
    commentedAt: comment.commentedAt,
  };
  if (parsed.lines.length === 0) {
    return [{ ...base, itemId: null, line: 0, quantity: 1, cancelled: false, cancelReason: null }];
  }

  const person = customerKey(comment.fromId, comment.fromName);
  return parsed.lines.map((line, index) => {
    const itemId = itemByCode.get(line.code)!;
    const key = `${person}:${itemId}`;
    const duplicate = active.has(key);
    active.add(key);
    return {
      ...base,
      itemId,
      line: index,
      quantity: line.quantity,
      cancelled: duplicate,
      cancelReason: duplicate ? "CF ຊ້ຳ" : null,
    };
  });
}

async function activeKeys(sessionId: string): Promise<Set<string>> {
  const rows = await prisma.liveClaim.findMany({
    where: { sessionId, cancelled: false, itemId: { not: null } },
    select: { fromId: true, fromName: true, itemId: true },
  });
  return new Set(rows.map((r) => `${customerKey(r.fromId, r.fromName)}:${r.itemId}`));
}

async function itemCodes(sessionId: string): Promise<Map<string, string>> {
  const items = await prisma.liveItem.findMany({
    where: { sessionId },
    select: { id: true, code: true },
  });
  return new Map(items.map((i) => [i.code, i.id]));
}

export type LivePullResult = {
  skipped: boolean;
  /** ລາຍການຈອງໃໝ່ທີ່ບັນທຶກໃນຮອບນີ້ */
  added: number;
  /** comment ໃໝ່ທັງໝົດ (ລວມອັນທີ່ບໍ່ແມ່ນ CF) */
  comments: number;
  error: string | null;
};

/**
 * ດຶງ comment ໃໝ່ຂອງ live ແລ້ວບັນທຶກ CF.
 *
 * ໄລ່ຈາກໃໝ່ໄປເກົ່າ ຈົນກາຍ comment ໃໝ່ສຸດຂອງຮອບກ່ອນ (ລົບ 2 ນາທີ) —
 * ຈຶ່ງບໍ່ຕ້ອງອ່ານທັງ live ທຸກຮອບ. ແຖວທີ່ມີແລ້ວຖືກຂ້າມດ້ວຍ unique
 * `(fbCommentId, line)` ການດຶງຊ້ຳຈຶ່ງບໍ່ນັບຊ້ຳ.
 *
 * ບໍ່ throw — ຄວາມຜິດພາດເກັບໄວ້ `pollError` ໃຫ້ໜ້າຈໍສະແດງ.
 */
export async function pullLiveComments(
  sessionId: string,
  { force = false }: { force?: boolean } = {},
): Promise<LivePullResult> {
  // ຈອງສິດດຶງແບບ atomic — ຄົນເປີດຫຼາຍແທັບ ຫຼື ຕົວຕັ້ງເວລາ ຈະບໍ່ດຶງຊ້ອນກັນ
  const gate = await prisma.liveSession.updateMany({
    where: {
      id: sessionId,
      fbVideoId: { not: null },
      ...(force ? {} : { status: "LIVE" }),
      OR: [{ pollAt: null }, { pollAt: { lt: new Date(Date.now() - POLL_MIN_GAP_MS) } }],
    },
    data: { pollAt: new Date() },
  });
  if (gate.count === 0) return { skipped: true, added: 0, comments: 0, error: null };

  try {
    const { session, version, token, fbPageId } = await liveContext(sessionId);
    const stopBefore = session.cursorAt
      ? session.cursorAt.getTime() - CURSOR_OVERLAP_MS
      : null;

    const search = new URLSearchParams({
      fields: "id,message,created_time,from,parent{id},is_hidden",
      order: "reverse_chronological",
      filter: "stream", // ລວມຄຳຕອບໃຕ້ comment ນຳ
      live_filter: "no_filter",
      limit: "100",
      access_token: token,
    });
    let url: string | undefined =
      `${GRAPH}/${version}/${session.fbVideoId}/comments?${search.toString()}`;

    const raw: RawComment[] = [];
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const json: { data?: RawComment[]; paging?: { next?: string } } =
        await graphFetch<{ data?: RawComment[]; paging?: { next?: string } }>(url).then(
          (res) => {
            if (res.error) throw graphErrorOf(res.error);
            return res;
          },
        );
      const batch = json.data ?? [];
      raw.push(...batch);

      const oldest = batch.at(-1)?.created_time;
      if (stopBefore !== null && oldest && new Date(oldest).getTime() < stopBefore) break;
      url = json.paging?.next;
    }

    // comment ທີ່ເຄີຍບັນທຶກແລ້ວ — ບໍ່ອ່ານ CF ຊ້ຳ ແລະ ບໍ່ທັບສະຖານະວຽກຂອງຄົນ
    const seen = new Set(
      (
        await prisma.liveComment.findMany({
          where: { fbCommentId: { in: raw.map((c) => c.id) } },
          select: { fbCommentId: true },
        })
      ).map((r) => r.fbCommentId),
    );
    const fresh = raw
      .filter((c) => !seen.has(c.id))
      .sort((a, b) => (a.created_time ?? "").localeCompare(b.created_time ?? ""));

    const itemByCode = await itemCodes(sessionId);
    const codes = new Set(itemByCode.keys());
    const active = await activeKeys(sessionId);

    const commentRows = fresh.map((c) => {
      const fromPage = c.from?.id === fbPageId;
      const isCf = !fromPage && parseCf(c.message, codes).isCf;
      const kind = classifyLiveComment(c.message, isCf);
      return {
        sessionId,
        fbCommentId: c.id,
        parentFbId: c.parent?.id ?? null,
        fromId: c.from?.id ?? null,
        fromName: c.from?.name ?? null,
        message: c.message ?? null,
        commentedAt: c.created_time ? new Date(c.created_time) : new Date(),
        fromPage,
        isCf,
        isQuestion: !fromPage && kind.question,
        spam: fromPage ? null : kind.spam,
        hidden: c.is_hidden ?? false,
        // ສຽງຂອງເພຈເອງບໍ່ແມ່ນວຽກຄ້າງ
        handled: fromPage,
        handledAt: fromPage ? new Date() : null,
      };
    });

    const claimRowsToSave = commentRows
      .filter((c) => !c.fromPage)
      .flatMap((c) => claimRows(sessionId, c, itemByCode, active));

    const [savedComments, created] = await prisma.$transaction([
      prisma.liveComment.createMany({ data: commentRows, skipDuplicates: true }),
      prisma.liveClaim.createMany({ data: claimRowsToSave, skipDuplicates: true }),
    ]);

    const newest = raw.reduce<number>(
      (max, c) => Math.max(max, c.created_time ? new Date(c.created_time).getTime() : 0),
      session.cursorAt?.getTime() ?? 0,
    );

    await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        pollError: null,
        cursorAt: newest ? new Date(newest) : null,
        commentsSeen: { increment: savedComments.count },
      },
    });

    // ຕອບຮັບ CF / ເຊື່ອງ comment ກວນ — ລົ້ມກໍ່ບໍ່ໃຫ້ການເກັບ CF ລົ້ມນຳ
    const automation = await runLiveAutomation(session, { version, token })
      .then(() => null)
      .catch((error: unknown) => explainFbError(error));

    return {
      skipped: false,
      added: created.count,
      comments: savedComments.count,
      error: typeof automation === "string" ? automation : null,
    };
  } catch (error) {
    const message = explainFbError(error);
    await prisma.liveSession
      .update({ where: { id: sessionId }, data: { pollError: message } })
      .catch(() => {});
    return { skipped: false, added: 0, comments: 0, error: message };
  }
}

// ------------------------------------------------ ຕອບຮັບ CF / ເຊື່ອງ comment ກວນ

type Graph = { version: string; token: string };

async function graphPostForm<T>(graph: Graph, path: string, body: Record<string, string>): Promise<T> {
  const json = await graphFetch<T>(`${GRAPH}/${graph.version}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: graph.token }).toString(),
  });
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

/**
 * ວຽກອັດຕະໂນມັດຫຼັງດຶງ comment ແຕ່ລະຮອບ (ຕາມສະວິດຂອງຮອບ live).
 *
 * ທຸກລາຍການ "ຈອງສິດ" ດ້ວຍ `updateMany … where ackedAt/autoHideAt: null` ກ່ອນຮ້ອງ
 * Facebook — ຮອບດຶງທີ່ຊ້ອນກັນ (ຫຼາຍແທັບ + ຕົວຕັ້ງເວລາ) ຈຶ່ງບໍ່ຕອບຊ້ຳ.
 * ລົ້ມແລ້ວບໍ່ລອງໃໝ່ — ຕອບຊ້ຳໃສ່ລູກຄ້າແຍ່ກວ່າບໍ່ໄດ້ຕອບ.
 */
async function runLiveAutomation(
  session: { id: string; autoAck: boolean; autoHide: boolean },
  graph: Graph,
): Promise<void> {
  const now = Date.now();

  if (session.autoHide) {
    const spam = await prisma.liveComment.findMany({
      where: {
        sessionId: session.id,
        spam: { not: null },
        hidden: false,
        fromPage: false,
        autoHideAt: null,
        commentedAt: { gte: new Date(now - AUTO_HIDE_MAX_AGE_MS) },
      },
      orderBy: { commentedAt: "asc" },
      take: 10,
      select: { id: true, fbCommentId: true },
    });
    for (const row of spam) {
      const lock = await prisma.liveComment.updateMany({
        where: { id: row.id, autoHideAt: null },
        data: { autoHideAt: new Date() },
      });
      if (lock.count === 0) continue;
      await graphPostForm(graph, row.fbCommentId, { is_hidden: "true" });
      await prisma.liveComment.update({ where: { id: row.id }, data: { hidden: true } });
    }
  }

  if (!session.autoAck) return;

  const recentAcks = await prisma.liveComment.count({
    where: { sessionId: session.id, ackedAt: { gte: new Date(now - 60_000) } },
  });
  const budget = Math.min(5, ACK_PER_MINUTE - recentAcks);
  if (budget <= 0) return;

  const pending = await prisma.liveComment.findMany({
    where: {
      sessionId: session.id,
      isCf: true,
      fromPage: false,
      ackedAt: null,
      commentedAt: { gte: new Date(now - ACK_MAX_AGE_MS) },
    },
    orderBy: { commentedAt: "asc" },
    take: budget,
    select: { id: true, fbCommentId: true },
  });
  if (pending.length === 0) return;

  // ສະຖານະຄິວຕ້ອງຄິດຈາກທຸກລາຍການຂອງ live ບໍ່ແມ່ນສະເພາະ comment ທີ່ຈະຕອບ
  const [items, claims] = await Promise.all([
    prisma.liveItem.findMany({ where: { sessionId: session.id }, select: { id: true, code: true, stock: true } }),
    prisma.liveClaim.findMany({ where: { sessionId: session.id } }),
  ]);
  const allocation = allocateClaims(
    items,
    claims.map((c) => ({ ...c, ordered: c.orderId !== null })),
  );
  const codeOf = new Map(items.map((i) => [i.id, i.code]));

  for (const row of pending) {
    const lock = await prisma.liveComment.updateMany({
      where: { id: row.id, ackedAt: null },
      data: { ackedAt: new Date() },
    });
    if (lock.count === 0) continue;

    const text = ackMessage(
      claims
        .filter((c) => c.fbCommentId === row.fbCommentId)
        .sort((a, b) => a.line - b.line)
        .map((c) => ({
          code: c.itemId ? (codeOf.get(c.itemId) ?? null) : null,
          quantity: c.quantity,
          state: allocation.state.get(c.id) ?? "UNMATCHED",
          position: allocation.queue.get(c.id),
        })),
    );
    if (!text) continue;

    try {
      await replyAsPage(session.id, row.fbCommentId, text, graph);
    } catch (error) {
      await prisma.liveComment.update({
        where: { id: row.id },
        data: { ackError: explainFbError(error) },
      });
      throw error;
    }
  }
}

/** ຕອບໃຕ້ comment ໃນນາມເພຈ ແລ້ວບັນທຶກຄຳຕອບໄວ້ເລີຍ (ບໍ່ຕ້ອງລໍຮອບດຶງ) */
async function replyAsPage(sessionId: string, parentFbId: string, message: string, graph: Graph) {
  const posted = await graphPostForm<{ id: string }>(graph, `${parentFbId}/comments`, { message });
  const page = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    select: { page: { select: { fbPageId: true, name: true } } },
  });
  await prisma.liveComment.createMany({
    data: [
      {
        sessionId,
        fbCommentId: posted.id,
        parentFbId,
        fromId: page?.page.fbPageId ?? null,
        fromName: page?.page.name ?? null,
        message,
        commentedAt: new Date(),
        fromPage: true,
        handled: true,
        handledAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
}

async function commentContext(commentId: string) {
  const comment = await prisma.liveComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new Error("ບໍ່ພົບ comment ນີ້ແລ້ວ");
  const { version, token, fbPageId } = await liveContext(comment.sessionId);
  return { comment, graph: { version, token }, fbPageId };
}

/**
 * ຕອບ comment ຈາກກະດານ live — `private` = ຕອບເຂົ້າ Messenger ຂອງຄົນນັ້ນ.
 * private reply ໃຊ້ໄດ້ 1 ເທື່ອຕໍ່ comment — ບັນທຶກໄວ້ ສະຫຼຸບຍອດຈະໄດ້ຂ້າມ comment ນີ້.
 */
export async function replyLiveComment(
  commentId: string,
  message: string,
  mode: "public" | "private",
): Promise<void> {
  const { comment, graph, fbPageId } = await commentContext(commentId);
  if (comment.fromPage) throw new Error("ອັນນີ້ເປັນຄຳຕອບຂອງເພຈເອງ");

  if (mode === "private") {
    if (comment.privateRepliedAt) {
      throw new Error("comment ນີ້ຕອບເຂົ້າ Messenger ໄປແລ້ວ — Facebook ໃຫ້ 1 ເທື່ອຕໍ່ comment");
    }
    if (!canPrivateReply(comment.commentedAt)) {
      throw new Error("comment ນີ້ເກົ່າກວ່າ 7 ວັນ — Facebook ບໍ່ໃຫ້ຕອບເຂົ້າ Messenger ແລ້ວ");
    }
    await graphPostForm(graph, `${fbPageId}/messages`, {
      recipient: JSON.stringify({ comment_id: comment.fbCommentId }),
      message: JSON.stringify({ text: message }),
    });
    await prisma.liveComment.update({
      where: { id: comment.id },
      data: { privateRepliedAt: new Date(), handled: true, handledAt: new Date() },
    });
    return;
  }

  await replyAsPage(comment.sessionId, comment.fbCommentId, message, graph);
  await prisma.liveComment.update({
    where: { id: comment.id },
    data: { handled: true, handledAt: new Date() },
  });
}

export async function setLiveCommentHidden(commentId: string, hidden: boolean): Promise<string> {
  const { comment, graph } = await commentContext(commentId);
  await graphPostForm(graph, comment.fbCommentId, { is_hidden: hidden ? "true" : "false" });
  await prisma.liveComment.update({ where: { id: comment.id }, data: { hidden } });
  return comment.sessionId;
}

/** ຕົວຕັ້ງເວລາເບື້ອງຫຼັງ — ເກັບ CF ຕໍ່ ເຖິງບໍ່ມີໃຜເປີດໜ້າ live ໄວ້ */
export async function pullActiveLives(): Promise<void> {
  const lives = await prisma.liveSession.findMany({
    where: { status: "LIVE", fbVideoId: { not: null } },
    select: { id: true },
  });
  for (const live of lives) await pullLiveComments(live.id);
}

/**
 * ອ່ານ CF ທີ່ລະຫັດບໍ່ຮູ້ຈັກຄືນ — ເອີ້ນຫຼັງເພີ່ມ/ແກ້ລະຫັດສິນຄ້າ
 * (ລູກຄ້າມັກ CF ລະຫັດທີ່ຮ້ານຫາກໍ່ປະກາດ ກ່ອນຄົນຈະທັນເພີ່ມໃສ່ລະບົບ)
 */
export async function reparseUnmatched(sessionId: string): Promise<number> {
  const rows = await prisma.liveClaim.findMany({
    where: { sessionId, itemId: null, orderId: null, cancelled: false },
    orderBy: { commentedAt: "asc" },
  });
  if (rows.length === 0) return 0;

  const itemByCode = await itemCodes(sessionId);
  const active = await activeKeys(sessionId);
  let matched = 0;

  for (const row of rows) {
    const next = claimRows(sessionId, row, itemByCode, active);
    if (next.length === 0 || next.every((r) => r.itemId === null)) continue;
    await prisma.$transaction([
      prisma.liveClaim.delete({ where: { id: row.id } }),
      prisma.liveClaim.createMany({ data: next, skipDuplicates: true }),
    ]);
    matched++;
  }
  return matched;
}

// ------------------------------------------------------------------ ກະດານ

export async function loadLiveBoard(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      page: { select: { id: true, name: true, token: true } },
      items: { include: { product: { select: { name: true, imageUrl: true, fbPhotoId: true } } } },
      claims: { orderBy: { commentedAt: "desc" } },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          customerName: true,
          fbCustomerId: true,
          saleAmount: true,
          status: true,
          notifiedAt: true,
          notifyError: true,
        },
      },
    },
  });
  if (!session) return null;

  const items = [...session.items].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );
  const allocation: Allocation = allocateClaims(
    items,
    session.claims.map((c) => ({ ...c, ordered: c.orderId !== null })),
  );
  const itemById = new Map(items.map((i) => [i.id, i]));
  const stateOf = (id: string): ClaimState => allocation.state.get(id) ?? "UNMATCHED";

  // ຍອດຕໍ່ຄົນ — ລວມທັງອັນທີ່ອອກບິນແລ້ວ ແລະ ຍັງບໍ່ອອກ
  const reserved = session.claims.filter(
    (c) => stateOf(c.id) === "RESERVED" && c.itemId && itemById.has(c.itemId),
  );
  const bills = buildBills(reserved.map((c) => ({ ...c, item: itemById.get(c.itemId!)! })));
  const waitingBy = new Map<string, number>();
  for (const c of session.claims) {
    if (stateOf(c.id) !== "WAITLIST") continue;
    const key = customerKey(c.fromId, c.fromName);
    waitingBy.set(key, (waitingBy.get(key) ?? 0) + c.quantity);
  }
  const unbilled = new Set(
    reserved.filter((c) => c.orderId === null).map((c) => customerKey(c.fromId, c.fromName)),
  );

  const { token, ...page } = session.page;
  return {
    // ຫ້າມສົ່ງ page token ອອກໜ້າຈໍ — ບອກແຕ່ວ່າມີບໍ່
    session: { ...session, page: { ...page, hasToken: Boolean(token) } },
    items,
    allocation,
    stateOf,
    bills: bills.map((bill) => ({
      ...bill,
      waiting: waitingBy.get(bill.key) ?? 0,
      unbilled: unbilled.has(bill.key),
    })),
    unbilledCustomers: unbilled.size,
  };
}

// ---------------------------------------------------------------- ອອກບິນ

export type BillResult = { created: number; appended: number };

/**
 * ອອກບິນໃຫ້ລາຍການທີ່ຈອງໄດ້ ແລະ ຍັງບໍ່ມີບິນ — ກົດຊ້ຳໄດ້ປອດໄພ.
 *
 * ຄົນທີ່ມີບິນຂອງ live ນີ້ຢູ່ແລ້ວ ແລະ ບິນນັ້ນຍັງ "ລໍຢືນຢັນ" ແລະ ຍັງບໍ່ໄດ້ສົ່ງ
 * ສະຫຼຸບຍອດ = ເພີ່ມລາຍການໃສ່ບິນເກົ່າ. ນອກນັ້ນອອກບິນໃໝ່ ເພາະບິນເກົ່າ
 * ລູກຄ້າເຫັນຍອດແລ້ວ ຫຼື ກຳລັງຈັດສົ່ງ — ປ່ຽນຍອດຢູ່ລັບຫຼັງຈະເກີດເລື່ອງ.
 */
export async function createLiveBills(sessionId: string): Promise<BillResult> {
  const board = await loadLiveBoard(sessionId);
  if (!board) throw new Error("ບໍ່ພົບ live ນີ້ແລ້ວ");
  const { session, items, stateOf } = board;
  if (session.status === "LIVE") {
    throw new Error("ຢຸດເກັບ CF ກ່ອນ ຈຶ່ງອອກບິນ — ບໍ່ດັ່ງນັ້ນຄິວຍັງປ່ຽນຢູ່");
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const pending = session.claims.filter(
    (c) =>
      c.orderId === null &&
      c.itemId !== null &&
      itemById.has(c.itemId) &&
      stateOf(c.id) === "RESERVED",
  );
  const bills = buildBills(pending.map((c) => ({ ...c, item: itemById.get(c.itemId!)! })));

  const result: BillResult = { created: 0, appended: 0 };

  for (const bill of bills) {
    const lines = bill.lines.map((line) => ({
      productId: line.productId,
      code: line.code,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
    }));

    await prisma.$transaction(async (tx) => {
      const open = await tx.order.findFirst({
        where: {
          liveSessionId: session.id,
          status: "PENDING",
          notifiedAt: null,
          ...(bill.fromId
            ? { fbCustomerId: bill.fromId }
            : { fbCustomerId: null, customerName: bill.fromName }),
        },
        include: { items: true },
      });

      let orderId: string;
      if (open) {
        for (const line of lines) {
          const same = open.items.find(
            (i) => i.code === line.code && i.unitPrice === line.unitPrice,
          );
          if (same) {
            await tx.orderItem.update({
              where: { id: same.id },
              data: { quantity: { increment: line.quantity } },
            });
          } else {
            await tx.orderItem.create({ data: { ...line, orderId: open.id } });
          }
        }
        const all = [...open.items, ...lines];
        await tx.order.update({
          where: { id: open.id },
          data: {
            quantity: { increment: bill.quantity },
            saleAmount: { increment: bill.saleAmount },
            productCost: { increment: bill.productCost },
            productId: singleProductId(all),
          },
        });
        orderId = open.id;
        result.appended++;
      } else {
        const order = await tx.order.create({
          data: {
            date: session.date,
            customerName: bill.fromName,
            channel: "Live",
            quantity: bill.quantity,
            saleAmount: bill.saleAmount,
            productCost: bill.productCost,
            productId: singleProductId(lines),
            note: `Live: ${session.title}`,
            liveSessionId: session.id,
            fbCustomerId: bill.fromId,
            items: { create: lines },
          },
        });
        orderId = order.id;
        result.created++;
      }

      await tx.liveClaim.updateMany({
        where: { id: { in: bill.claimIds }, orderId: null },
        data: { orderId },
      });
    });
  }

  return result;
}

// ------------------------------------------------------- ສົ່ງສະຫຼຸບຍອດ

export type NotifyResult = { sent: number; failed: number; remaining: number };

/** ຈຳກັດຕໍ່ການກົດ 1 ເທື່ອ — 1 ຄົນ = 1-3 request ແລະ ຄົນກົດຕ້ອງລໍຈົນຈົບ */
export const NOTIFY_PER_RUN = 40;

/**
 * ສົ່ງສະຫຼຸບຍອດຫາລູກຄ້າທາງ private reply (ຕອບ comment CF ຂອງເຂົາເຂົ້າ Messenger).
 *
 * Facebook ໃຫ້ຕອບແບບນີ້ **1 ເທື່ອຕໍ່ 1 comment ພາຍໃນ 7 ວັນ** ຈຶ່ງລອງ comment
 * ໃໝ່ສຸດຂອງຄົນນັ້ນກ່ອນ ຖ້າຖືກປະຕິເສດ (ເຊັ່ນ comment ນັ້ນເຄີຍຖືກຕອບແລ້ວ)
 * ຈຶ່ງລອງ comment ຖັດໄປ. ໃຊ້ Send API (`recipient.comment_id`) ຊຶ່ງເປັນ
 * ວິທີປັດຈຸບັນຂອງ Facebook ແທນ `/{comment}/private_replies` ທີ່ເລີກໃຊ້ແລ້ວ.
 */
export async function sendLiveSummaries(
  sessionId: string,
  template: string,
): Promise<NotifyResult> {
  const { session, version, token, fbPageId } = await liveContext(sessionId);

  const where = { liveSessionId: session.id, notifiedAt: null, status: { not: "CANCELLED" as const } };
  const orders = await prisma.order.findMany({
    where,
    // ອັນທີ່ບໍ່ເຄີຍລອງກ່ອນ — ບໍ່ດັ່ງນັ້ນບິນທີ່ລົ້ມຖາວອນຈະກັນຄົນອື່ນຢູ່ຫົວແຖວທຸກຮອບ
    orderBy: [{ notifyError: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: NOTIFY_PER_RUN,
    include: {
      items: true,
      liveClaims: {
        orderBy: { commentedAt: "desc" },
        select: { fbCommentId: true, commentedAt: true },
      },
    },
  });

  const result: NotifyResult = { sent: 0, failed: 0, remaining: 0 };

  for (const order of orders) {
    const text = renderSummary(
      template,
      {
        name: order.customerName,
        lines: order.items.map((i) => ({ ...i, code: i.code ?? "" })),
        total: order.saleAmount,
      },
      // ຂໍ້ຄວາມຫາລູກຄ້າເປັນກີບສະເໝີ — ບໍ່ຂຶ້ນກັບສະກຸນທີ່ຄົນເລືອກເບິ່ງໃນໜ້າຈໍ
      formatLak,
    ).slice(0, MESSAGE_MAX);

    // comment ທີ່ຄົນຂາຍຕອບເຂົ້າ Messenger ໄປແລ້ວ ໃຊ້ຊ້ຳບໍ່ໄດ້ (1 ເທື່ອຕໍ່ comment)
    const used = new Set(
      (
        await prisma.liveComment.findMany({
          where: {
            fbCommentId: { in: order.liveClaims.map((c) => c.fbCommentId) },
            privateRepliedAt: { not: null },
          },
          select: { fbCommentId: true },
        })
      ).map((c) => c.fbCommentId),
    );
    const targets = [...new Set(
      order.liveClaims
        .filter((c) => canPrivateReply(c.commentedAt) && !used.has(c.fbCommentId))
        .map((c) => c.fbCommentId),
    )].slice(0, 3);

    let error: string | null =
      targets.length === 0
        ? "ບໍ່ມີ comment ທີ່ຕອບເຂົ້າ Messenger ໄດ້ (ເກົ່າກວ່າ 7 ວັນ ຫຼື ຕອບໄປແລ້ວ) — ຕ້ອງທັກເອງ"
        : null;

    for (const commentId of targets) {
      try {
        const json = await graphFetch<{ message_id?: string }>(
          `${GRAPH}/${version}/${fbPageId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              recipient: JSON.stringify({ comment_id: commentId }),
              message: JSON.stringify({ text }),
              access_token: token,
            }).toString(),
          },
        );
        if (json.error) throw graphErrorOf(json.error);
        await prisma.liveComment.updateMany({
          where: { fbCommentId: commentId },
          data: { privateRepliedAt: new Date() },
        });
        error = null;
        break;
      } catch (e) {
        error = explainFbError(e);
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: error
        ? { notifyError: error }
        : { notifiedAt: new Date(), notifyError: null },
    });
    if (error) result.failed++;
    else result.sent++;
  }

  // ອັນທີ່ລົ້ມຍັງນັບເປັນ "ຍັງບໍ່ໄດ້ສົ່ງ" — ກົດອີກເທື່ອຈະລອງໃໝ່
  result.remaining = await prisma.order.count({ where });
  return result;
}

// ---------------------------------------------------------------- ວິເຄາະ

/** live ກ່ອນໜ້າຂອງເພຈດຽວກັນທີ່ເອົາມາທຽບ */
const PAST_LIVES = 10;

/** ຍອດຈອງຂອງ live 1 ຮອບ — ຄິດຄືກັບກະດານ (ຈັດຄິວໃໝ່) ບໍ່ແມ່ນນັບ CF ດິບ */
function reservedValueOf(
  items: { id: string; stock: number | null; price: number }[],
  claims: Parameters<typeof allocateClaims>[1],
): number {
  const allocation = allocateClaims(items, claims);
  return items.reduce((sum, item) => sum + (allocation.items.get(item.id)?.reserved ?? 0) * item.price, 0);
}

export async function loadLiveAnalysis(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      page: { select: { name: true } },
      items: true,
      claims: true,
      comments: {
        select: {
          fbCommentId: true,
          parentFbId: true,
          fromId: true,
          fromName: true,
          fromPage: true,
          message: true,
          commentedAt: true,
          isCf: true,
          isQuestion: true,
          handled: true,
        },
      },
      orders: {
        select: {
          status: true,
          saleAmount: true,
          productCost: true,
          shippingCost: true,
          otherCost: true,
          refundAmount: true,
          notifiedAt: true,
        },
      },
      stats: { orderBy: { at: "asc" } },
      boosts: { select: { spend: true, budget: true, budgetLak: true, reach: true } },
    },
  });
  if (!session) return null;

  const pastSessions = await prisma.liveSession.findMany({
    where: {
      pageId: session.pageId,
      id: { not: session.id },
      status: "ENDED",
      date: { lte: session.date },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: PAST_LIVES,
    include: {
      items: { select: { id: true, stock: true, price: true } },
      claims: true,
      stats: { orderBy: { at: "desc" }, take: 1, select: { viewers: true } },
    },
  });

  const toAlloc = <T extends { orderId: string | null }>(claims: T[]) =>
    claims.map((c) => ({ ...c, ordered: c.orderId !== null }));

  return {
    session,
    input: {
      comments: session.comments,
      claims: toAlloc(session.claims),
      items: session.items,
      orders: session.orders,
      past: pastSessions
        // live ທີ່ບໍ່ມີ CF ເລີຍ (ຕັ້ງໄວ້ແລ້ວບໍ່ໄດ້ live) ດຶງຄ່າສະເລ່ຍລົງຜິດໆ
        .filter((p) => p.claims.length > 0)
        .map((p) => ({
          reservedValue: reservedValueOf(p.items, toAlloc(p.claims)),
          cfCustomers: new Set(p.claims.map((c) => customerKey(c.fromId, c.fromName))).size,
          viewers: p.stats[0]?.viewers ?? null,
        })),
      autoAck: session.autoAck,
      stats: session.stats,
      boosts: session.boosts,
    },
  };
}
