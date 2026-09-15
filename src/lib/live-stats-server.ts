import { prisma } from "./prisma";
import { explainFbError, getFbConfig, graphErrorOf, graphFetch } from "./fb";

/**
 * ຍອດຄົນເບິ່ງຂອງ live ຈາກ video insights ຂອງ Facebook.
 *
 * - token: page token ຂອງເພຈ (ຕ້ອງມີສິດ `read_insights`)
 * - ເກັບເປັນຈຸດໆ (`LiveStat`) ລະຫວ່າງ live ທຸກ 5 ນາທີ ແລະ ຫຼັງ live ເມື່ອເປີດໜ້າວິເຄາະ
 * - **ບໍ່ມີ "ຄົນເບິ່ງພ້ອມກັນ"** — ຄ່ານັ້ນຢູ່ Live Video API ທີ່ Facebook ກັນໄວ້ລໍ App Review
 *   (code 10) ຈຶ່ງໃຊ້ຍອດສະສົມແທນ
 * - Facebook ອັບເດດ insights ຊ້າກວ່າຄວາມຈິງ ຫຼາຍນາທີ ຫາ ຫຼາຍຊົ່ວໂມງ
 */

const GRAPH = "https://graph.facebook.com";

/** ບໍ່ດຶງຖີ່ກວ່ານີ້ຕໍ່ live — insights ບໍ່ໄດ້ປ່ຽນໄວປານນັ້ນ */
const STAT_GAP_MS = 5 * 60_000;
/** ຫຼັງ live ຈົບ ຍັງອັບເດດຕໍ່ຈົນເທົ່ານີ້ (ຄົນເບິ່ງຍ້ອນຫຼັງ + Facebook ຄິດຊ້າ) */
const FOLLOW_UP_DAYS = 7;

const METRICS = {
  views: "total_video_views",
  viewers: "total_video_views_unique",
  avgWatchMs: "total_video_avg_time_watched",
  totalWatchMs: "total_video_view_total_time",
  impressions: "total_video_impressions_unique",
  reactions: "total_video_reactions_by_type_total",
} as const;
type MetricKey = keyof typeof METRICS;

type RawInsight = { name: string; values?: { value?: number | Record<string, number> }[] };

function numberOf(value: number | Record<string, number> | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  // reactions ມາເປັນ { like: 3, love: 1 } — ລວມເປັນຈຳນວນດຽວ
  return Object.values(value).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

async function fetchInsights(version: string, videoId: string, token: string, metrics: string[]) {
  const search = new URLSearchParams({ metric: metrics.join(","), access_token: token });
  const json = await graphFetch<{ data?: RawInsight[] }>(
    `${GRAPH}/${version}/${videoId}/video_insights?${search.toString()}`,
  );
  if (json.error) throw graphErrorOf(json.error);
  return json.data ?? [];
}

export type StatPullResult = { saved: boolean; error: string | null };

/**
 * ດຶງຍອດຄົນເບິ່ງ 1 ຈຸດ. ຮ້ອງທຸກ metric ພ້ອມກັນກ່ອນ — ຖ້າ Facebook ບໍ່ຮູ້ຈັກ
 * metric ໃດ (ຕ່າງກັນຕາມຊະນິດວິດີໂອ) ມັນປະຕິເສດທັງກ້ອນ ຈຶ່ງລອງທີລະອັນແທນ.
 */
export async function pullLiveStats(sessionId: string, { force = false } = {}): Promise<StatPullResult> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    select: {
      fbVideoId: true,
      page: { select: { token: true } },
      stats: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
    },
  });
  if (!session?.fbVideoId || !session.page.token) {
    return { saved: false, error: session?.fbVideoId ? "ເພຈນີ້ຍັງບໍ່ມີ page token" : null };
  }
  const last = session.stats[0]?.at;
  if (!force && last && Date.now() - last.getTime() < STAT_GAP_MS) return { saved: false, error: null };

  const config = await getFbConfig();
  if (!config) return { saved: false, error: "ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token" };

  const names = Object.values(METRICS);
  let rows: RawInsight[] = [];
  let firstError: unknown = null;
  try {
    rows = await fetchInsights(config.apiVersion, session.fbVideoId, session.page.token, names);
  } catch (error) {
    firstError = error;
    const each = await Promise.allSettled(
      names.map((m) => fetchInsights(config.apiVersion, session.fbVideoId!, session.page.token!, [m])),
    );
    rows = each.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  const byName = new Map(rows.map((r) => [r.name, numberOf(r.values?.[0]?.value)]));
  const values = Object.fromEntries(
    (Object.keys(METRICS) as MetricKey[]).map((key) => [key, byName.get(METRICS[key]) ?? null]),
  ) as Record<MetricKey, number | null>;

  if (Object.values(values).every((v) => v === null)) {
    return { saved: false, error: firstError ? explainStatsError(firstError) : "Facebook ຍັງບໍ່ມີຂໍ້ມູນຄົນເບິ່ງຂອງວິດີໂອນີ້" };
  }

  await prisma.liveStat.create({
    data: {
      sessionId,
      views: values.views === null ? null : Math.round(values.views),
      viewers: values.viewers === null ? null : Math.round(values.viewers),
      avgWatchMs: values.avgWatchMs === null ? null : Math.round(values.avgWatchMs),
      totalWatchMs: values.totalWatchMs,
      impressions: values.impressions === null ? null : Math.round(values.impressions),
      reactions: values.reactions === null ? null : Math.round(values.reactions),
    },
  });
  return { saved: true, error: null };
}

function explainStatsError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/read_insights/i.test(message)) {
    return "token ຂາດສິດ read_insights — ສ້າງ token ໃໝ່ໃຫ້ມີສິດນີ້ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook” ອີກເທື່ອ";
  }
  return explainFbError(error);
}

/** ຕົວຕັ້ງເວລາ: live ທີ່ກຳລັງອອກອາກາດ ແລະ live ທີ່ຫາກໍ່ຈົບບໍ່ເກີນ 7 ວັນ */
export async function pullRecentLiveStats(): Promise<void> {
  const since = new Date(Date.now() - FOLLOW_UP_DAYS * 86_400_000);
  const lives = await prisma.liveSession.findMany({
    where: {
      fbVideoId: { not: null },
      OR: [{ status: "LIVE" }, { status: "ENDED", updatedAt: { gte: since } }],
    },
    select: { id: true, status: true },
  });
  for (const live of lives) {
    // live ທີ່ຈົບແລ້ວ ບໍ່ຕ້ອງຖີ່ — ທຸກ 6 ຊົ່ວໂມງພໍ
    if (live.status === "ENDED") {
      const last = await prisma.liveStat.findFirst({
        where: { sessionId: live.id },
        orderBy: { at: "desc" },
        select: { at: true },
      });
      if (last && Date.now() - last.at.getTime() < 6 * 3_600_000) continue;
    }
    await pullLiveStats(live.id);
  }
}
