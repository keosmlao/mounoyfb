import { prisma } from "./prisma";
import { getFbConfig, graphErrorOf, graphFetch } from "./fb";

/**
 * ຮູບໃນເພຈ → ສິນຄ້າ.
 *
 * **ລິ້ງຮູບຂອງ Facebook ໝົດອາຍຸ** ແລະ ຮູບຂອງເພຈຕ້ອງໃຊ້ page token ຈຶ່ງຂໍລິ້ງໄດ້ —
 * ຫ້າມສົ່ງລິ້ງ Facebook ໃຫ້ `<img>` ໂດຍກົງ. ໜ້າຈໍໃຊ້ `/api/fb/photo` (ຕອນເລືອກຮູບ)
 * ແລະ `/api/products/[id]/image` (ຮູບຂອງສິນຄ້າ) ຊຶ່ງຂໍລິ້ງໃໝ່ໃຫ້ເອງເມື່ອລິ້ງເກົ່າໃຊ້ບໍ່ໄດ້.
 */

const GRAPH = "https://graph.facebook.com";

/** ຮູບຕໍ່ໜ້າ — ຕາຂ່າຍ 4×6 */
const PHOTOS_PER_PAGE = 24;

/** ຂະໜາດທີ່ເກັບ — ພໍສຳລັບຮູບຫຍໍ້ ແລະ ເບິ່ງໃກ້ ໂດຍບໍ່ໜັກເກີນ */
const TARGET_WIDTH = 720;

type RawImage = { source: string; width: number; height: number };

/** ຮູບທີ່ກວ້າງໃກ້ `TARGET_WIDTH` ທີ່ສຸດ (ບໍ່ນ້ອຍກວ່າ ຖ້າມີ) */
export function pickImage(images: readonly RawImage[] | undefined): string | null {
  if (!images?.length) return null;
  const bigEnough = images.filter((i) => i.width >= TARGET_WIDTH);
  const pool = bigEnough.length ? bigEnough : images;
  return [...pool].sort((a, b) =>
    bigEnough.length ? a.width - b.width : b.width - a.width,
  )[0].source;
}

async function pageAuth(pageId: string) {
  const [page, config] = await Promise.all([
    prisma.fbPage.findUnique({
      where: { id: pageId },
      select: { id: true, fbPageId: true, token: true },
    }),
    getFbConfig(),
  ]);
  if (!page?.token || !page.fbPageId || !config) {
    throw new Error("ເພຈນີ້ຍັງບໍ່ມີ page token — ໄປໜ້າ ເພຈ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook”");
  }
  return { fbPageId: page.fbPageId, token: page.token, version: config.apiVersion };
}

async function graphGet<T>(version: string, path: string, params: Record<string, string>, token: string) {
  const search = new URLSearchParams({ ...params, access_token: token });
  const json = await graphFetch<T>(`${GRAPH}/${version}/${path}?${search.toString()}`);
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

// ------------------------------------------------------------------ ລາຍການຮູບ

export type PagePhoto = {
  id: string;
  caption: string | null;
  createdAt: Date | null;
};

/**
 * ລິ້ງທີ່ຫາກໍ່ໄດ້ຈາກລາຍການ — ໃຫ້ route ຮູບໃຊ້ກ່ອນ ບໍ່ຕ້ອງຖາມ Facebook ຊ້ຳທຸກຮູບ.
 * ຢູ່ໃນໜ່ວຍຄວາມຈຳຂອງ process ດຽວ ແລະ ໝົດອາຍຸເອງ (ລິ້ງ Facebook ຢູ່ໄດ້ຫຼາຍຊົ່ວໂມງ).
 */
const sourceCache = new Map<string, { url: string; at: number }>();
const CACHE_MS = 30 * 60_000;

function remember(photoId: string, url: string | null) {
  if (!url || !isFacebookCdn(url)) return;
  if (sourceCache.size > 2_000) sourceCache.clear();
  sourceCache.set(photoId, { url, at: Date.now() });
}

export async function listPagePhotos(
  pageId: string,
  after: string | null,
): Promise<{ photos: PagePhoto[]; next: string | null }> {
  const { fbPageId, token, version } = await pageAuth(pageId);

  type RawPhoto = {
    id: string;
    name?: string;
    created_time?: string;
    images?: RawImage[];
    page_story_id?: string;
  };
  const json = await graphGet<{ data?: RawPhoto[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    version,
    `${fbPageId}/photos`,
    {
      type: "uploaded",
      fields: "id,name,created_time,images,page_story_id",
      limit: String(PHOTOS_PER_PAGE),
      ...(after ? { after } : {}),
    },
    token,
  );
  const raw = json.data ?? [];
  for (const photo of raw) remember(photo.id, pickImage(photo.images));

  // ໂພສຫຼາຍຮູບ: ຄຳບັນຍາຍຢູ່ກັບໂພສ ບໍ່ແມ່ນກັບແຕ່ລະຮູບ — ຂໍຂໍ້ຄວາມຂອງໂພສເທື່ອດຽວ
  const storyIds = [...new Set(raw.filter((p) => !p.name && p.page_story_id).map((p) => p.page_story_id!))];
  let messages: Record<string, { message?: string }> = {};
  if (storyIds.length) {
    try {
      messages = await graphGet<Record<string, { message?: string }>>(
        version,
        "",
        { ids: storyIds.join(","), fields: "message" },
        token,
      );
    } catch {
      // ບໍ່ມີຄຳບັນຍາຍ ກໍ່ຍັງເລືອກຮູບໄດ້ — ຄົນພິມຊື່ເອງ
    }
  }

  return {
    photos: raw.map((p) => ({
      id: p.id,
      caption: p.name ?? (p.page_story_id ? (messages[p.page_story_id]?.message ?? null) : null),
      createdAt: p.created_time ? new Date(p.created_time) : null,
    })),
    next: json.paging?.next ? (json.paging.cursors?.after ?? null) : null,
  };
}

/** ໂດເມນຮູບຂອງ Facebook — ລິ້ງອື່ນຫ້າມດຶງຜ່ານເຊີບເວີ (SSRF) */
function isFacebookCdn(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)(fbcdn\.net|facebook\.com|fbsbx\.com)$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** ລິ້ງຮູບປັດຈຸບັນ — `refresh` = ບໍ່ເຊື່ອ cache (ລິ້ງເກົ່າດຶງບໍ່ໄດ້ແລ້ວ) */
export async function photoSource(pageId: string, photoId: string, refresh = false): Promise<string | null> {
  const cached = sourceCache.get(photoId);
  if (!refresh && cached && Date.now() - cached.at < CACHE_MS) return cached.url;

  const { token, version } = await pageAuth(pageId);
  const photo = await graphGet<{ images?: RawImage[] }>(version, photoId, { fields: "images" }, token);
  const url = pickImage(photo.images);
  if (url && !isFacebookCdn(url)) return null;
  remember(photoId, url);
  return url;
}

// ------------------------------------------------------------------ ຮູບຂອງສິນຄ້າ

export type ImageTarget =
  | { kind: "proxy"; url: string; refresh: () => Promise<string | null> }
  | { kind: "redirect"; url: string };

/**
 * ຮູບຂອງສິນຄ້າມາຈາກໃສ.
 * - ມາຈາກເພຈ → ດຶງຜ່ານເຊີບເວີ ພ້ອມຂໍລິ້ງໃໝ່ເມື່ອໝົດອາຍຸ (ແລ້ວບັນທຶກທັບ)
 * - ລິ້ງທີ່ຄົນໃສ່ເອງ → ໃຫ້ browser ໄປເອົາເອງ (redirect) — ບໍ່ດຶງຜ່ານເຊີບເວີ
 *   ເພາະລິ້ງທີ່ຄົນພິມອາດຊີ້ເຂົ້າເຄືອຂ່າຍພາຍໃນ (SSRF)
 */
export async function productImageTarget(productId: string): Promise<ImageTarget | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { imageUrl: true, fbPhotoId: true, photoPageId: true },
  });
  if (!product) return null;

  if (product.fbPhotoId && product.photoPageId) {
    const { fbPhotoId, photoPageId } = product;
    const refresh = async () => {
      const url = await photoSource(photoPageId, fbPhotoId, true);
      if (url) await prisma.product.update({ where: { id: productId }, data: { imageUrl: url } });
      return url;
    };
    // ດຶງຜ່ານເຊີບເວີສະເພາະລິ້ງຂອງ Facebook — ລິ້ງອື່ນໃນຊ່ອງນີ້ຂໍໃໝ່ຈາກ Facebook ແທນ
    const url = isFacebookCdn(product.imageUrl) ? product.imageUrl : await refresh();
    return url ? { kind: "proxy", url, refresh } : null;
  }

  if (product.imageUrl && /^https?:\/\//i.test(product.imageUrl)) {
    return { kind: "redirect", url: product.imageUrl };
  }
  return null;
}
