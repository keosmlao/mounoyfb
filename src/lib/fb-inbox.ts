import { prisma } from "./prisma";
import { explainFbError, getFbConfig } from "./fb";

/**
 * ກ່ອງຂໍ້ຄວາມຂອງເພຈ — comment ແລະ ແຊັດ (Messenger).
 *
 * **ຄົນລະ token ກັບຝັ່ງໂຄສະນາ.** ການອ່ານ/ຕອບ comment ແລະ ແຊັດ ຕ້ອງໃຊ້
 * *page access token* ຂອງແຕ່ລະເພຈ (ເກັບຢູ່ `FbPage.token`) ບໍ່ແມ່ນ token
 * ຫຼັກໃນໜ້າຕັ້ງຄ່າ. token ຫຼັກໃຊ້ແຕ່ຂໍລາຍການເພຈ ແລະ ຫາໂພສໂຄສະນາ.
 *
 * ສິດທີ່ຕ້ອງມີໃນ token ຫຼັກ: `pages_show_list`, `pages_read_engagement`,
 * `pages_read_user_content` (ອ່ານ comment ຄົນອື່ນ), `pages_manage_engagement`
 * (ຕອບ/ເຊື່ອງ comment), `pages_messaging` (ອ່ານ ແລະ ຕອບແຊັດ).
 *
 * ໂພສໂຄສະນາ (dark post) ບໍ່ຢູ່ໃນໜ້າເພຈ ຈຶ່ງຫາຜ່ານ
 * `creative{effective_object_story_id}` ຂອງແຕ່ລະ ad ແທນ.
 */

const GRAPH = "https://graph.facebook.com";

/** ຈຳກັດປະລິມານຕໍ່ຮອບ ເພື່ອບໍ່ໃຫ້ຊົນ rate limit ຂອງ Facebook */
const LIMITS = {
  postsPerPage: 25,
  adsPerAccount: 300,
  commentsPerPost: 100,
  threadsPerPage: 50,
  messagesPerThread: 25,
};

type GraphError = { message: string; type?: string; code?: number };

/** ດຶງລາຍການພ້ອມໄລ່ໜ້າ ຈົນຄົບ `max` ແຖວ */
async function graphList<T>(
  version: string,
  path: string,
  params: Record<string, string>,
  token: string,
  max: number,
): Promise<T[]> {
  const search = new URLSearchParams({
    ...params,
    access_token: token,
    limit: String(Math.min(max, 100)),
  });
  let url = `${GRAPH}/${version}/${path}?${search.toString()}`;
  const out: T[] = [];

  // ຈຳກັດຈຳນວນໜ້າ ເພື່ອກັນ loop ບໍ່ຮູ້ຈົບ ຖ້າ paging ຜິດປົກກະຕິ
  for (let page = 0; page < 20 && out.length < max; page++) {
    const json = await (async () => {
      const res = await fetch(url, { cache: "no-store" });
      return (await res.json()) as {
        data?: T[];
        paging?: { next?: string };
        error?: GraphError;
      };
    })();

    if (json.error) {
      throw new Error(`Facebook API: ${json.error.message} (code ${json.error.code})`);
    }
    if (json.data) out.push(...json.data);
    if (!json.paging?.next) break;
    url = json.paging.next;
  }

  return out.slice(0, max);
}

/** ອ່ານ object ດຽວ (ບໍ່ແມ່ນລາຍການ) */
async function graphOne<T>(
  version: string,
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${version}/${path}?${search.toString()}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: GraphError };
  if (json.error) {
    throw new Error(`Facebook API: ${json.error.message} (code ${json.error.code})`);
  }
  return json;
}

async function graphPost<T>(
  version: string,
  path: string,
  body: Record<string, string>,
  token: string,
): Promise<T> {
  const res = await fetch(`${GRAPH}/${version}/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: token }).toString(),
  });
  const json = (await res.json()) as T & { error?: GraphError };
  if (json.error) {
    throw new Error(`Facebook API: ${json.error.message} (code ${json.error.code})`);
  }
  return json;
}

function when(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// ------------------------------------------------------------ token ຂອງເພຈ

export type PageTokenResult = {
  linked: number;
  created: number;
  missing: string[];
};

/**
 * ດຶງລາຍການເພຈທີ່ token ຫຼັກເຂົ້າເຖິງໄດ້ ພ້ອມ *page token* ຂອງແຕ່ລະເພຈ
 * ແລ້ວເກັບໃສ່ `FbPage.token` — ເພຈທີ່ຍັງບໍ່ມີໃນລະບົບຈະຖືກສ້າງໃຫ້.
 *
 * token ບໍ່ຖືກສົ່ງອອກໜ້າຈໍຈັກເທື່ອ — ຄືນແຕ່ຈຳນວນ.
 */
export async function syncPageTokens(): Promise<PageTokenResult> {
  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token ໃນໜ້າຕັ້ງຄ່າ");

  type RawPage = {
    id: string;
    name?: string;
    category?: string;
    access_token?: string;
  };
  const fields = "id,name,category,access_token";

  let raw = await graphList<RawPage>(
    config.apiVersion,
    "me/accounts",
    { fields },
    config.accessToken,
    100,
  );
  if (raw.length === 0) {
    raw = await graphList<RawPage>(
      config.apiVersion,
      "me/assigned_pages",
      { fields },
      config.accessToken,
      100,
    );
  }

  let linked = 0;
  let created = 0;
  const missing: string[] = [];

  for (const page of raw) {
    if (!page.access_token) {
      // ບໍ່ໄດ້ token = token ຫຼັກຂາດສິດ ຫຼື ບໍ່ໄດ້ເປັນແອັດມິນຂອງເພຈນັ້ນ
      missing.push(page.name ?? page.id);
      continue;
    }

    const existing = await prisma.fbPage.findUnique({
      where: { fbPageId: page.id },
    });
    if (existing) {
      await prisma.fbPage.update({
        where: { id: existing.id },
        data: {
          token: page.access_token,
          category: existing.category ?? page.category ?? null,
        },
      });
      linked++;
    } else {
      await prisma.fbPage.create({
        data: {
          fbPageId: page.id,
          name: page.name ?? page.id,
          category: page.category ?? null,
          token: page.access_token,
        },
      });
      created++;
    }
  }

  return { linked, created, missing };
}

// ------------------------------------------------------------------- ດຶງໂພສ

type PageRow = { id: string; fbPageId: string | null; token: string | null };

/** ໂພສທຳມະດາໃນໜ້າເພຈ */
async function pullPagePosts(version: string, page: PageRow): Promise<number> {
  type RawPost = {
    id: string;
    message?: string;
    permalink_url?: string;
    created_time?: string;
  };

  const posts = await graphList<RawPost>(
    version,
    `${page.fbPageId}/posts`,
    { fields: "id,message,permalink_url,created_time" },
    page.token!,
    LIMITS.postsPerPage,
  );

  for (const post of posts) {
    await prisma.fbPost.upsert({
      where: { fbPostId: post.id },
      create: {
        fbPostId: post.id,
        pageId: page.id,
        message: post.message ?? null,
        permalink: post.permalink_url ?? null,
        postedAt: when(post.created_time),
      },
      update: {
        message: post.message ?? null,
        permalink: post.permalink_url ?? null,
        postedAt: when(post.created_time),
      },
    });
  }

  return posts.length;
}

/**
 * ໂພສທີ່ຖືກໃຊ້ຍິງໂຄສະນາ — ຫາຜ່ານ ad ຂອງແຕ່ລະບັນຊີ.
 * `effective_object_story_id` ມາໃນຮູບແບບ "<pageId>_<postId>" ຈຶ່ງແຍກເອົາເພຈໄດ້.
 */
async function pullAdPosts(version: string, token: string): Promise<number> {
  const accounts = await prisma.adAccount.findMany({
    where: { fbAccountId: { not: null } },
    select: { fbAccountId: true },
  });
  const pages = await prisma.fbPage.findMany({
    where: { fbPageId: { not: null }, inboxOn: true },
    select: { id: true, fbPageId: true },
  });
  const pageByFbId = new Map(pages.map((p) => [p.fbPageId!, p.id]));
  if (pageByFbId.size === 0) return 0;

  const campaigns = await prisma.campaign.findMany({
    where: { fbCampaignId: { not: null } },
    select: { id: true, fbCampaignId: true },
  });
  const campaignByFbId = new Map(campaigns.map((c) => [c.fbCampaignId!, c.id]));

  type RawAd = {
    id: string;
    campaign_id?: string;
    creative?: { effective_object_story_id?: string };
  };

  let found = 0;
  for (const account of accounts) {
    // ເອົາສະເພາະ ad ທີ່ຍັງມີຊີວິດ — ໂພສເກົ່າທີ່ຢຸດຍິງແລ້ວມັກບໍ່ມີ comment ໃໝ່
    const ads = await graphList<RawAd>(
      version,
      `${account.fbAccountId}/ads`,
      {
        fields: "id,campaign_id,creative{effective_object_story_id}",
        effective_status: '["ACTIVE","PAUSED"]',
      },
      token,
      LIMITS.adsPerAccount,
    );

    for (const ad of ads) {
      const storyId = ad.creative?.effective_object_story_id;
      if (!storyId) continue;
      const pageId = pageByFbId.get(storyId.split("_")[0]);
      if (!pageId) continue; // ໂພສຂອງເພຈທີ່ບໍ່ໄດ້ຕິດຕາມ

      const campaignId = ad.campaign_id
        ? (campaignByFbId.get(ad.campaign_id) ?? null)
        : null;

      await prisma.fbPost.upsert({
        where: { fbPostId: storyId },
        create: { fbPostId: storyId, pageId, fromAd: true, campaignId },
        update: { fromAd: true, ...(campaignId ? { campaignId } : {}) },
      });
      found++;
    }
  }

  return found;
}


/**
 * ຕື່ມລາຍລະອຽດຂອງໂພສທີ່ຫາໄດ້ຈາກ ad — ຕອນ upsert ຮູ້ແຕ່ id ຂອງມັນ.
 * ດຶງດ້ວຍ page token ເພາະໂພສໂຄສະນາອ່ານໄດ້ສະເພາະຄົນຂອງເພຈນັ້ນ.
 */
async function fillPostDetails(version: string, page: PageRow): Promise<void> {
  const posts = await prisma.fbPost.findMany({
    where: { pageId: page.id, permalink: null },
    orderBy: { createdAt: "desc" },
    take: LIMITS.postsPerPage,
    select: { id: true, fbPostId: true },
  });

  for (const post of posts) {
    try {
      const detail = await graphOne<{
        message?: string;
        permalink_url?: string;
        created_time?: string;
      }>(
        version,
        post.fbPostId,
        { fields: "message,permalink_url,created_time" },
        page.token!,
      );
      await prisma.fbPost.update({
        where: { id: post.id },
        data: {
          message: detail.message ?? null,
          permalink: detail.permalink_url ?? null,
          postedAt: when(detail.created_time),
        },
      });
    } catch {
      // ໂພສຖືກລຶບ ຫຼື ບໍ່ມີສິດເບິ່ງ — ຂ້າມໄປ ຢ່າໃຫ້ລົ້ມທັງເພຈ
    }
  }
}

// ---------------------------------------------------------------- ດຶງ comment

type RawComment = {
  id: string;
  message?: string;
  created_time?: string;
  like_count?: number;
  is_hidden?: boolean;
  from?: { id: string; name?: string };
  parent?: { id: string };
  attachment?: { type?: string; url?: string };
};

/** ບັນທຶກ comment ລົງຖານຂໍ້ມູນ — ຄືນ true ຖ້າເປັນແຖວໃໝ່ */
async function saveComment(
  raw: RawComment,
  post: { id: string; pageId: string },
  fbPageId: string,
): Promise<boolean> {
  const fromPage = raw.from?.id === fbPageId;
  const commentedAt = when(raw.created_time) ?? new Date();
  const attachment = raw.attachment?.url ?? raw.attachment?.type ?? null;

  const existing = await prisma.fbComment.findUnique({
    where: { fbCommentId: raw.id },
    select: { id: true },
  });

  const shared = {
    message: raw.message ?? null,
    attachment,
    likeCount: raw.like_count ?? 0,
    hidden: raw.is_hidden ?? false,
    fromName: raw.from?.name ?? null,
    fromId: raw.from?.id ?? null,
  };

  if (existing) {
    // ຢ່າແຕະ handled/leadId — ນັ້ນເປັນວຽກຂອງຄົນ ບໍ່ແມ່ນຂອງ Facebook
    await prisma.fbComment.update({ where: { id: existing.id }, data: shared });
    return false;
  }

  await prisma.fbComment.create({
    data: {
      ...shared,
      fbCommentId: raw.id,
      postId: post.id,
      pageId: post.pageId,
      parentFbId: raw.parent?.id ?? null,
      fromPage,
      // ສຽງຂອງເພຈເອງບໍ່ແມ່ນວຽກຄ້າງ — ໝາຍວ່າຈັດການແລ້ວແຕ່ຕົ້ນ
      handled: fromPage,
      handledAt: fromPage ? new Date() : null,
      commentedAt,
    },
  });
  return true;
}

async function pullComments(
  version: string,
  page: PageRow,
  post: { id: string; fbPostId: string },
): Promise<number> {
  const comments = await graphList<RawComment>(
    version,
    `${post.fbPostId}/comments`,
    {
      fields:
        "id,message,created_time,like_count,is_hidden,from,parent{id},attachment{type,url}",
      filter: "stream", // ລວມຄຳຕອບໃຕ້ comment ນຳ
      order: "reverse_chronological",
    },
    page.token!,
    LIMITS.commentsPerPost,
  );

  let fresh = 0;
  for (const raw of comments) {
    if (await saveComment(raw, { id: post.id, pageId: page.id }, page.fbPageId!)) {
      fresh++;
    }
  }
  return fresh;
}

// ------------------------------------------------------------------ ດຶງແຊັດ

type RawParticipant = { id: string; name?: string; email?: string };
type RawThread = {
  id: string;
  updated_time?: string;
  message_count?: number;
  unread_count?: number;
  snippet?: string;
  participants?: { data?: RawParticipant[] };
};
type RawMessage = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id: string; name?: string };
  attachments?: { data?: { mime_type?: string; name?: string }[] };
};

async function pullThreads(
  version: string,
  page: PageRow,
): Promise<{ threads: number; messages: number }> {
  const raw = await graphList<RawThread>(
    version,
    `${page.fbPageId}/conversations`,
    {
      fields: "id,updated_time,message_count,unread_count,snippet,participants",
      platform: "messenger",
    },
    page.token!,
    LIMITS.threadsPerPage,
  );

  let messages = 0;

  for (const conv of raw) {
    const lastMessageAt = when(conv.updated_time) ?? new Date();
    const person = conv.participants?.data?.find((p) => p.id !== page.fbPageId);

    const existing = await prisma.fbThread.findUnique({
      where: { fbThreadId: conv.id },
      select: { id: true, lastMessageAt: true },
    });

    const thread = existing
      ? await prisma.fbThread.update({
          where: { id: existing.id },
          data: {
            snippet: conv.snippet ?? null,
            messageCount: conv.message_count ?? 0,
            unreadCount: conv.unread_count ?? 0,
            personName: person?.name ?? null,
            psid: person?.id ?? null,
            lastMessageAt,
          },
        })
      : await prisma.fbThread.create({
          data: {
            fbThreadId: conv.id,
            pageId: page.id,
            psid: person?.id ?? null,
            personName: person?.name ?? null,
            snippet: conv.snippet ?? null,
            messageCount: conv.message_count ?? 0,
            unreadCount: conv.unread_count ?? 0,
            lastMessageAt,
          },
        });

    // ຫ້ອງທີ່ບໍ່ມີຫຍັງໃໝ່ ບໍ່ຕ້ອງດຶງຂໍ້ຄວາມຄືນ — ປະຢັດໂຄຕ້າ API
    if (existing && existing.lastMessageAt.getTime() >= lastMessageAt.getTime()) {
      continue;
    }

    const rawMessages = await graphList<RawMessage>(
      version,
      `${conv.id}/messages`,
      { fields: "id,message,created_time,from,attachments{mime_type,name}" },
      page.token!,
      LIMITS.messagesPerThread,
    );

    for (const msg of rawMessages) {
      const fromPage = msg.from?.id === page.fbPageId;
      const attach = msg.attachments?.data?.[0];
      await prisma.fbMessage.upsert({
        where: { fbMessageId: msg.id },
        create: {
          fbMessageId: msg.id,
          threadId: thread.id,
          fromPage,
          fromId: msg.from?.id ?? null,
          fromName: msg.from?.name ?? null,
          text: msg.message || null,
          attachment: attach ? (attach.name ?? attach.mime_type ?? "ໄຟລ໌ແນບ") : null,
          sentAt: when(msg.created_time) ?? lastMessageAt,
        },
        update: {},
      });
      messages++;
    }

    await refreshThreadState(thread.id);
  }

  return { threads: raw.length, messages };
}

/** ອັບເດດວ່າຫ້ອງນີ້ຍັງລໍຄຳຕອບຢູ່ບໍ່ — ອີງຂໍ້ຄວາມສຸດທ້າຍໃນຫ້ອງ */
export async function refreshThreadState(threadId: string): Promise<void> {
  const last = await prisma.fbMessage.findFirst({
    where: { threadId },
    orderBy: { sentAt: "desc" },
    select: { fromPage: true },
  });
  if (!last) return;
  await prisma.fbThread.update({
    where: { id: threadId },
    data: { waitingReply: !last.fromPage },
  });
}

// ------------------------------------------------------------------ ດຶງທັງໝົດ

export type InboxSyncResult = {
  posts: number;
  comments: number;
  threads: number;
  messages: number;
  errors: string[];
};

/**
 * ດຶງ comment ແລະ ແຊັດ ຂອງທຸກເພຈທີ່ເປີດຕິດຕາມໄວ້.
 * ເພຈໃດລົ້ມ ກໍ່ບັນທຶກຂໍ້ຜິດພາດໄວ້ ແລ້ວໄປເພຈຕໍ່ໄປ — ບໍ່ໃຫ້ເພຈດຽວລົ້ມທັງຮອບ.
 */
export async function syncInbox(): Promise<InboxSyncResult> {
  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token ໃນໜ້າຕັ້ງຄ່າ");

  const result: InboxSyncResult = {
    posts: 0,
    comments: 0,
    threads: 0,
    messages: 0,
    errors: [],
  };
  // ເກັບໄວ້ແຍກ label ກັບ ຂໍ້ຄວາມ ເພື່ອຮວມອັນທີ່ຊ້ຳກັນຕອນທ້າຍ
  const failures: { label: string; message: string }[] = [];

  // ຫາໂພສໂຄສະນາກ່ອນ — ໃຊ້ token ຫຼັກ (ຝັ່ງໂຄສະນາ) ບໍ່ແມ່ນ token ຂອງເພຈ
  try {
    await pullAdPosts(config.apiVersion, config.accessToken);
  } catch (error) {
    failures.push({ label: "ໂພສໂຄສະນາ", message: explainFbError(error) });
  }

  const pages = await prisma.fbPage.findMany({
    where: { inboxOn: true, token: { not: null }, fbPageId: { not: null } },
    select: { id: true, name: true, fbPageId: true, token: true },
  });

  for (const page of pages) {
    // ຝັ່ງ comment ກັບ ຝັ່ງແຊັດ ໃຊ້ສິດຄົນລະຊຸດ — ແຍກກັນໄວ້
    // ຈຶ່ງດຶງແຊັດໄດ້ ເຖິງວ່າ token ຈະຂາດສິດອ່ານ comment ກໍ່ຕາມ
    try {
      result.posts += await pullPagePosts(config.apiVersion, page);
      // ໂພສໂຄສະນາທີ່ຫາໄດ້ຈາກ ad ຍັງບໍ່ມີຂໍ້ຄວາມ/ລິ້ງ — ຕື່ມໃຫ້ຄົບກ່ອນ
      await fillPostDetails(config.apiVersion, page);

      const posts = await prisma.fbPost.findMany({
        where: { pageId: page.id },
        orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
        take: LIMITS.postsPerPage,
        select: { id: true, fbPostId: true },
      });
      for (const post of posts) {
        result.comments += await pullComments(config.apiVersion, page, post);
      }
    } catch (error) {
      failures.push({ label: `${page.name} (comment)`, message: explainFbError(error) });
    }

    try {
      const chat = await pullThreads(config.apiVersion, page);
      result.threads += chat.threads;
      result.messages += chat.messages;
    } catch (error) {
      failures.push({ label: `${page.name} (ແຊັດ)`, message: explainFbError(error) });
    }
  }

  // ຫຼາຍເພຈມັກລົ້ມດ້ວຍເຫດຜົນອັນດຽວກັນ (ເຊັ່ນ token ຂາດສິດ) —
  // ຮວມໃຫ້ເປັນແຖວດຽວ ຈຶ່ງອ່ານອອກວ່າຕ້ອງແກ້ຫຍັງ ບໍ່ແມ່ນເຫັນຂໍ້ຄວາມຊ້ຳ 3 ເທື່ອ
  const byMessage = new Map<string, string[]>();
  for (const failure of failures) {
    byMessage.set(failure.message, [
      ...(byMessage.get(failure.message) ?? []),
      failure.label,
    ]);
  }
  result.errors = [...byMessage].map(
    ([message, labels]) => `${labels.join(", ")} — ${message}`,
  );

  return result;
}

// -------------------------------------------------------------------- ຕອບກັບ

/** ອ່ານ token ຂອງເພຈ — ບໍ່ມີແລ້ວບອກວິທີແກ້ໄປເລີຍ */
async function pageToken(pageId: string) {
  const page = await prisma.fbPage.findUnique({
    where: { id: pageId },
    select: { id: true, name: true, fbPageId: true, token: true },
  });
  if (!page?.token || !page.fbPageId) {
    throw new Error(
      "ເພຈນີ້ຍັງບໍ່ມີ page token — ໄປໜ້າ ເພຈ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook”",
    );
  }
  return page as PageRow & { name: string };
}

/**
 * ຕອບ comment — Facebook ຈະສ້າງ comment ໃໝ່ໃຕ້ comment ນັ້ນ.
 * ບັນທຶກຄຳຕອບລົງຖານຂໍ້ມູນເລີຍ ຈຶ່ງເຫັນທັນທີໂດຍບໍ່ຕ້ອງລໍຮອບດຶງຕໍ່ໄປ.
 */
export async function replyToComment(commentId: string, message: string) {
  const comment = await prisma.fbComment.findUnique({
    where: { id: commentId },
    include: { post: { select: { id: true } } },
  });
  if (!comment) throw new Error("ບໍ່ພົບ comment ນີ້ແລ້ວ");

  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token");
  const page = await pageToken(comment.pageId);

  const posted = await graphPost<{ id: string }>(
    config.apiVersion,
    `${comment.fbCommentId}/comments`,
    { message },
    page.token!,
  );

  await prisma.fbComment.create({
    data: {
      fbCommentId: posted.id,
      postId: comment.postId,
      pageId: comment.pageId,
      parentFbId: comment.fbCommentId,
      fromId: page.fbPageId,
      fromName: page.name,
      message,
      fromPage: true,
      handled: true,
      handledAt: new Date(),
      commentedAt: new Date(),
    },
  });

  await prisma.fbComment.update({
    where: { id: comment.id },
    data: { handled: true, handledAt: new Date() },
  });
}

/** ເຊື່ອງ / ເອົາອອກຈາກທີ່ເຊື່ອງ — ໃຊ້ກັບ comment ກວນ */
export async function setCommentHidden(commentId: string, hidden: boolean) {
  const comment = await prisma.fbComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new Error("ບໍ່ພົບ comment ນີ້ແລ້ວ");

  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token");
  const page = await pageToken(comment.pageId);

  await graphPost(
    config.apiVersion,
    comment.fbCommentId,
    { is_hidden: hidden ? "true" : "false" },
    page.token!,
  );

  await prisma.fbComment.update({
    where: { id: comment.id },
    data: { hidden },
  });
}

/**
 * ສົ່ງຂໍ້ຄວາມຕອບໃນແຊັດ.
 *
 * Facebook ອະນຸຍາດໃຫ້ຕອບພາຍໃນ **24 ຊົ່ວໂມງ** ນັບຈາກຂໍ້ຄວາມສຸດທ້າຍຂອງລູກຄ້າ
 * (standard messaging window) — ເກີນນັ້ນ API ຈະປະຕິເສດ ແລະ ເຮົາສົ່ງຂໍ້ຄວາມ
 * ນັ້ນຄືນໃຫ້ຜູ້ໃຊ້ເຫັນຕາມຈິງ.
 */
export async function sendChatMessage(threadId: string, text: string) {
  const thread = await prisma.fbThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new Error("ບໍ່ພົບຫ້ອງແຊັດນີ້ແລ້ວ");
  if (!thread.psid) {
    throw new Error("ບໍ່ຮູ້ຜູ້ຮັບຂອງຫ້ອງນີ້ — ລອງດຶງກ່ອງຂໍ້ຄວາມໃໝ່ອີກຄັ້ງ");
  }

  const config = await getFbConfig();
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token");
  const page = await pageToken(thread.pageId);

  const sent = await graphPost<{ message_id?: string }>(
    config.apiVersion,
    `${page.fbPageId}/messages`,
    {
      recipient: JSON.stringify({ id: thread.psid }),
      messaging_type: "RESPONSE",
      message: JSON.stringify({ text }),
    },
    page.token!,
  );

  await prisma.fbMessage.create({
    data: {
      // ບາງກໍລະນີ API ບໍ່ຄືນ message_id — ໃຊ້ຄ່າຊົ່ວຄາວ ບໍ່ໃຫ້ຊ້ຳກັບຂອງຈິງ
      fbMessageId: sent.message_id ?? `local_${threadId}_${Date.now()}`,
      threadId: thread.id,
      fromPage: true,
      fromId: page.fbPageId,
      fromName: page.name,
      text,
      sentAt: new Date(),
    },
  });

  await prisma.fbThread.update({
    where: { id: thread.id },
    data: {
      waitingReply: false,
      handled: true,
      handledAt: new Date(),
      snippet: text.slice(0, 120),
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });
}
