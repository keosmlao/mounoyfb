import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { StatStrip, StatTile } from "@/components/StatTile";
import { daysAgo, formatAgo, formatTimeLao } from "@/lib/date";
import { formatInt } from "@/lib/format";
import { inboxState } from "@/lib/auto-sync";
import { getCannedReplies } from "@/lib/canned";
import { ReplyBox } from "@/components/ReplyBox";
import {
  createLeadFromComment,
  markSelectedHandled,
  pullInboxNow,
  replyComment,
  setCommentHandled,
  toggleCommentHidden,
} from "./actions";

export const dynamic = "force-dynamic";

type Search = {
  tab?: string;
  page?: string;
  status?: string;
  /** ຄົ້ນຫາໃນຂໍ້ຄວາມ ຫຼື ຊື່ຄົນ */
  q?: string;
  /** ຈຳນວນວັນຍ້ອນຫຼັງ ("all" = ບໍ່ຈຳກັດ) */
  days?: string;
  /** ຈຳນວນທີ່ສະແດງ (ໂຫຼດເພີ່ມເທື່ອລະ 100) */
  show?: string;
  /** comment ທີ່ກຳລັງເປີດຢູ່ຊ່ອງຂວາ */
  sel?: string;
};

/** ສະແດງເທື່ອລະຊຸດ — ກ່ອງທີ່ມີ comment ເປັນຮ້ອຍຈະໜັກເກີນຖ້າອອກໝົດ */
const PAGE_SIZE = 100;

/** ຄວາມສຳພັນທີ່ຊ່ອງລາຍລະອຽດຕ້ອງໃຊ້ */
const COMMENT_INCLUDE = {
  page: { select: { name: true } },
  post: {
    select: {
      fromAd: true,
      permalink: true,
      message: true,
      campaign: { select: { id: true, name: true } },
    },
  },
} as const;

/** ລິ້ງແທັບ/ຕົວກັ່ນຕອງ — ຮັກສາຄ່າອື່ນທີ່ເລືອກໄວ້ */
function href(sp: Search, patch: Search) {
  const next = { ...sp, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/inbox?${query}` : "/inbox";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "chats" ? "chats" : "comments";
  const showAll = sp.status === "all";
  const limit = Math.min(Number(sp.show) || PAGE_SIZE, 1000);

  const pageFilter = sp.page ? { pageId: sp.page } : {};

  // ກັ່ນຕອງຕາມວັນ — ຄ່າຕັ້ງຕົ້ນເບິ່ງ 30 ວັນຫຼ້າສຸດ ເພາະ comment ເກົ່າກວ່ານັ້ນ
  // ຕອບໄປກໍ່ບໍ່ທັນການແລ້ວ (ແລະ Facebook ຫ້າມຕອບເຂົ້າແຊັດເກີນ 7 ວັນ)
  const days = sp.days === "all" ? null : Number(sp.days) || 30;
  const since = days ? daysAgo(days) : null;

  const search = sp.q?.trim();
  const textFilter = search
    ? {
        OR: [
          { message: { contains: search, mode: "insensitive" as const } },
          { fromName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const commentWhere = {
    ...pageFilter,
    ...textFilter,
    ...(since ? { commentedAt: { gte: since } } : {}),
    // ສຽງຂອງເພຈເອງບໍ່ແມ່ນວຽກ — ເຫັນໄດ້ຕອນເປີດ "ທັງໝົດ"
    ...(showAll ? {} : { handled: false, fromPage: false }),
  };

  const [
    pages,
    state,
    openComments,
    waitingThreads,
    comments,
    threads,
    matching,
    canned,
    selected,
  ] = await Promise.all([
    prisma.fbPage.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, token: true, inboxOn: true },
    }),
    inboxState(),
    prisma.fbComment.count({ where: { handled: false, fromPage: false } }),
    prisma.fbThread.count({ where: { waitingReply: true, handled: false } }),
    tab === "comments"
      ? prisma.fbComment.findMany({
          where: commentWhere,
          orderBy: { commentedAt: "desc" },
          take: limit,
          include: COMMENT_INCLUDE,
        })
      : Promise.resolve([]),
    tab === "chats"
      ? prisma.fbThread.findMany({
          where: {
            ...pageFilter,
            ...(showAll ? {} : { handled: false }),
          },
          orderBy: { lastMessageAt: "desc" },
          take: limit,
          include: {
            page: { select: { name: true } },
            lead: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
    tab === "comments"
      ? prisma.fbComment.count({ where: commentWhere })
      : Promise.resolve(0),
    getCannedReplies(),
    // ດຶງແຍກຕ່າງຫາກ ບໍ່ໄດ້ຫາໃນລາຍການ — ພໍໝາຍວ່າ “ຈັດການແລ້ວ” ອັນນັ້ນຈະຕົກ
    // ນອກຕົວກັ່ນຕອງທັນທີ ແຕ່ຍັງຄວນຄ້າງຢູ່ຊ່ອງຂວາໃຫ້ຕອບຕໍ່ໄດ້
    sp.sel && tab === "comments"
      ? prisma.fbComment.findUnique({
          where: { id: sp.sel },
          include: COMMENT_INCLUDE,
        })
      : Promise.resolve(null),
  ]);

  const linked = pages.filter((p) => p.token && p.inboxOn).length;

  return (
    <>
      <PageHeader
        title="ກ່ອງຂໍ້ຄວາມ"
        description="comment ແລະ ແຊັດຂອງທຸກເພຈ — ຕອບໄດ້ຈາກບ່ອນນີ້ເລີຍ"
        action={
          <form action={pullInboxNow}>
            <SubmitButton pendingText="ກຳລັງດຶງ...">ດຶງດຽວນີ້</SubmitButton>
          </form>
        }
      />

      {linked === 0 ? (
        <Card className="mb-3">
          <EmptyState
            title="ຍັງບໍ່ມີເພຈທີ່ພ້ອມດຶງ"
            hint="ໄປໜ້າ ເພຈ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook” ເພື່ອເອົາ page token ກ່ອນ — token ຫຼັກໃນໜ້າຕັ້ງຄ່າໃຊ້ໄດ້ແຕ່ຝັ່ງໂຄສະນາ"
            action={
              <Link href="/fb-pages" className="btn btn-primary">
                ໄປໜ້າ ເພຈ
              </Link>
            }
          />
        </Card>
      ) : null}

      <StatStrip cols={4}>
        <StatTile
          label="comment ຄ້າງຕອບ"
          value={formatInt(openComments)}
          hint="ຍັງບໍ່ໄດ້ໝາຍວ່າຈັດການແລ້ວ"
        />
        <StatTile
          label="ແຊັດລໍຄຳຕອບ"
          value={formatInt(waitingThreads)}
          hint="ລູກຄ້າເວົ້າສຸດທ້າຍ"
        />
        <StatTile
          label="ເພຈທີ່ຕິດຕາມ"
          value={formatInt(linked)}
          hint={`ທັງໝົດ ${pages.length} ເພຈ`}
        />
        <StatTile
          label="ດຶງຫຼ້າສຸດ"
          value={state.syncedAt ? formatAgo(state.syncedAt) : "ຍັງບໍ່ເຄີຍ"}
          hint={
            state.settings.enabled
              ? `ອັດຕະໂນມັດທຸກໆ ${state.settings.everyMin} ນາທີ`
              : "ອັດຕະໂນມັດປິດຢູ່ (ຕັ້ງໄດ້ໃນໜ້າຕັ້ງຄ່າ)"
          }
        />
      </StatStrip>

      {state.error ? (
        <div className="card mb-3 border-l-4 border-l-[var(--danger)] p-3 text-sm">
          <p className="font-medium text-[var(--danger)]">ການດຶງຮອບຫຼ້າສຸດມີບັນຫາ</p>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{state.error}</p>
        </div>
      ) : null}

      {/* ແຖບເຄື່ອງມືແຖວດຽວ — ແທັບ, ຕົວກັ່ນຕອງ ແລະ ຄຳສັ່ງລວມ ຢູ່ນຳກັນໝົດ
          (ກ່ອນນີ້ເປັນ 3 ກາດຊ້ອນກັນ ກິນຄວາມສູງກ່ອນຮອດເນື້ອຫາ) */}
      <Card className="mb-2.5">
        <div className="filter-bar flex flex-wrap items-center gap-1.5 p-1.5">
          <div className="seg">
            <Link
              href={href(sp, { tab: undefined, sel: undefined })}
              className={`seg-item${tab === "comments" ? " seg-item-active" : ""}`}
            >
              comment
            </Link>
            <Link
              href={href(sp, { tab: "chats", sel: undefined })}
              className={`seg-item${tab === "chats" ? " seg-item-active" : ""}`}
            >
              ແຊັດ
            </Link>
          </div>

          <Link
            href={href(sp, { status: showAll ? undefined : "all" })}
            className={`btn btn-sm${showAll ? " btn-primary" : ""}`}
          >
            {showAll ? "ທັງໝົດ" : "ສະເພາະທີ່ຍັງຄ້າງ"}
          </Link>

          <form
            method="get"
            action="/inbox"
            className="flex flex-wrap items-center gap-1.5"
          >
            {tab === "chats" ? <input type="hidden" name="tab" value="chats" /> : null}
            {showAll ? <input type="hidden" name="status" value="all" /> : null}
            {tab === "comments" ? (
              <>
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="ຄົ້ນຫາຂໍ້ຄວາມ / ຊື່"
                  className="field w-40"
                />
                <select
                  name="days"
                  defaultValue={sp.days ?? "30"}
                  className="field w-auto"
                >
                  <option value="7">7 ວັນ</option>
                  <option value="30">30 ວັນ</option>
                  <option value="90">90 ວັນ</option>
                  <option value="all">ທຸກເວລາ</option>
                </select>
              </>
            ) : null}
            <select
              name="page"
              defaultValue={sp.page ?? ""}
              className="field w-auto"
            >
              <option value="">ທຸກເພຈ</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm">
              ກັ່ນຕອງ
            </button>
            {sp.q || sp.page || sp.days ? (
              <Link href={href({}, { tab: sp.tab })} className="btn btn-sm">
                ລ້າງ
              </Link>
            ) : null}
          </form>

          {tab === "comments" && comments.length > 0 ? (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="tnum text-xs text-[var(--fg-muted)]">
                {formatInt(comments.length)} / {formatInt(matching)}
              </span>
              <button type="submit" form="bulk" className="btn btn-sm">
                ໝາຍທີ່ເລືອກວ່າຈັດການແລ້ວ
              </button>
              {matching > comments.length ? (
                <Link
                  href={href(sp, { show: String(comments.length + PAGE_SIZE) })}
                  className="btn btn-sm"
                >
                  ໂຫຼດເພີ່ມ{" "}
                  {formatInt(Math.min(PAGE_SIZE, matching - comments.length))}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {tab === "comments" ? (
        comments.length === 0 && !selected ? (
          <Card>
            <EmptyState
              title={showAll ? "ຍັງບໍ່ມີ comment" : "ບໍ່ມີ comment ຄ້າງ"}
              hint="ກົດ “ດຶງດຽວນີ້” ຢູ່ມຸມຂວາເທິງ ເພື່ອດຶງອັນໃໝ່ຈາກ Facebook"
            />
          </Card>
        ) : (
          <>
            {/* ຟອມຫວ່າງໆ ໄວ້ໃຫ້ checkbox ໃນແຕ່ລະແຖວອ້າງເຖິງດ້ວຍ form="bulk"
                — HTML ຫ້າມຟອມຊ້ອນຟອມ ຈຶ່ງບໍ່ຄຸມທັງຕາຕະລາງໄວ້ */}
            <form action={markSelectedHandled} id="bulk" />

            <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_30rem]">
              {/* ຈໍແຄບ: ເລືອກອັນໃດແລ້ວ ໃຫ້ເຫັນແຕ່ຄຳຕອບ ບໍ່ຕ້ອງເລື່ອນຫາ */}
              <Card className={selected ? "hidden xl:block" : ""}>
                <div className="table-wrap max-h-[36rem] overflow-y-auto">
                  <table className="data">
                    <thead>
                      <tr>
                        <th className="w-7" />
                        <th>ຄົນຂຽນ</th>
                        <th>ຂໍ້ຄວາມ</th>
                        <th>ເວລາ</th>
                        <th>ສະຖານະ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comments.map((comment) => (
                        <tr
                          key={comment.id}
                          className={comment.id === sp.sel ? "row-sel" : ""}
                        >
                          <td>
                            {comment.handled ? null : (
                              <input
                                type="checkbox"
                                name="ids"
                                value={comment.id}
                                form="bulk"
                                aria-label={`ເລືອກ comment ຂອງ ${comment.fromName ?? "ບໍ່ຮູ້ຊື່"}`}
                                className="h-3.5 w-3.5 align-middle"
                              />
                            )}
                          </td>
                          <td className="max-w-32">
                            <Link
                              href={href(sp, { sel: comment.id })}
                              className="link block truncate font-medium"
                            >
                              {comment.fromName ?? "ບໍ່ຮູ້ຊື່"}
                            </Link>
                            <span className="block truncate text-[0.7rem] text-[var(--fg-subtle)]">
                              {comment.page.name}
                            </span>
                          </td>
                          <td className="max-w-[28rem]">
                            <Link
                              href={href(sp, { sel: comment.id })}
                              className="block truncate text-[var(--fg)]"
                            >
                              {comment.message || (
                                <span className="text-[var(--fg-subtle)]">
                                  {comment.attachment ? "[ໄຟລ໌ແນບ]" : "(ບໍ່ມີຂໍ້ຄວາມ)"}
                                </span>
                              )}
                            </Link>
                          </td>
                          <td
                            className="whitespace-nowrap text-[0.72rem] text-[var(--fg-muted)]"
                            title={formatTimeLao(comment.commentedAt)}
                          >
                            {formatAgo(comment.commentedAt)}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-0.5">
                              {comment.post.fromAd ? (
                                <Badge tone="info">ໂຄສະນາ</Badge>
                              ) : null}
                              {comment.hidden ? (
                                <Badge tone="warning">ເຊື່ອງ</Badge>
                              ) : null}
                              {comment.handled ? (
                                <Badge tone="success">ແລ້ວ</Badge>
                              ) : null}
                              {comment.leadId ? (
                                <Badge tone="success">ລູກຄ້າ</Badge>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ຊ່ອງຕອບ — ມີກ່ອງພິມອັນດຽວໃນໜ້າ ບໍ່ແມ່ນອັນລະ comment */}
              <Card
                className={`${selected ? "" : "hidden xl:block"} xl:sticky xl:top-3`}
              >
                {selected ? (
                  <CommentDetail
                    comment={selected}
                    canned={canned}
                    backHref={href(sp, { sel: undefined })}
                  />
                ) : (
                  <EmptyState
                    title="ເລືອກ comment ເພື່ອຕອບ"
                    hint="ກົດຊື່ ຫຼື ຂໍ້ຄວາມຢູ່ຕາຕະລາງເບື້ອງຊ້າຍ"
                  />
                )}
              </Card>
            </div>
          </>
        )
      ) : threads.length === 0 ? (
        <Card>
          <EmptyState
            title={showAll ? "ຍັງບໍ່ມີຫ້ອງແຊັດ" : "ບໍ່ມີແຊັດຄ້າງ"}
            hint="ກົດ “ດຶງດຽວນີ້” ຢູ່ມຸມຂວາເທິງ ເພື່ອດຶງຈາກ Facebook"
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="ຫ້ອງແຊັດ" subtitle={`ສະແດງ ${threads.length} ຫ້ອງ`} />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ຄົນທັກ</th>
                  <th>ເພຈ</th>
                  <th>ຂໍ້ຄວາມລ່າສຸດ</th>
                  <th className="num">ຂໍ້ຄວາມ</th>
                  <th>ເວລາ</th>
                  <th>ສະຖານະ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {threads.map((thread) => (
                  <tr key={thread.id}>
                    <td className="font-medium">
                      <Link href={`/inbox/chat/${thread.id}`} className="link">
                        {thread.personName ?? "ບໍ່ຮູ້ຊື່"}
                      </Link>
                    </td>
                    <td className="text-xs">{thread.page.name}</td>
                    <td className="max-w-72 truncate text-xs text-[var(--fg-muted)]">
                      {thread.snippet ?? "—"}
                    </td>
                    <td className="num">{formatInt(thread.messageCount)}</td>
                    <td
                      className="whitespace-nowrap text-xs"
                      title={formatTimeLao(thread.lastMessageAt)}
                    >
                      {formatAgo(thread.lastMessageAt)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {thread.waitingReply ? (
                          <Badge tone="warning">ລໍຄຳຕອບ</Badge>
                        ) : (
                          <Badge tone="success">ຕອບແລ້ວ</Badge>
                        )}
                        {thread.handled ? <Badge>ປິດແລ້ວ</Badge> : null}
                        {thread.lead ? <Badge tone="success">ລູກຄ້າ</Badge> : null}
                      </div>
                    </td>
                    <td className="num">
                      <Link href={`/inbox/chat/${thread.id}`} className="btn btn-sm">
                        ເປີດ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

/** ຊ່ອງຂວາ: comment ເຕັມ + ບ່ອນທີ່ມັນມາ + ກ່ອງຕອບ + ຄຳສັ່ງ */
function CommentDetail({
  comment,
  canned,
  backHref,
}: {
  comment: {
    id: string;
    fromName: string | null;
    message: string | null;
    attachment: string | null;
    commentedAt: Date;
    parentFbId: string | null;
    hidden: boolean;
    handled: boolean;
    fromPage: boolean;
    leadId: string | null;
    page: { name: string };
    post: {
      fromAd: boolean;
      permalink: string | null;
      message: string | null;
      campaign: { id: string; name: string } | null;
    };
  };
  canned: string[];
  backHref: string;
}) {
  const reply = replyComment.bind(null, comment.id);
  const handle = setCommentHandled.bind(null, comment.id, !comment.handled);
  const hide = toggleCommentHidden.bind(null, comment.id, !comment.hidden);
  const toLead = createLeadFromComment.bind(null, comment.id);

  return (
    <div className="p-3">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-semibold">{comment.fromName ?? "ບໍ່ຮູ້ຊື່"}</p>
        <span
          className="text-xs text-[var(--fg-subtle)]"
          title={formatTimeLao(comment.commentedAt)}
        >
          {formatAgo(comment.commentedAt)} · {comment.page.name}
        </span>
        <Link href={backHref} className="btn btn-sm ml-auto xl:hidden">
          ← ລາຍການ
        </Link>
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {comment.post.fromAd ? (
          <Badge tone="info">ໂພສໂຄສະນາ</Badge>
        ) : (
          <Badge>ໂພສເພຈ</Badge>
        )}
        {comment.parentFbId ? <Badge>ຄຳຕອບ</Badge> : null}
        {comment.hidden ? <Badge tone="warning">ເຊື່ອງໄວ້</Badge> : null}
        {comment.handled ? <Badge tone="success">ຈັດການແລ້ວ</Badge> : null}
        {comment.leadId ? <Badge tone="success">ເປັນລູກຄ້າແລ້ວ</Badge> : null}
      </div>

      <p className="whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-sm">
        {comment.message || (
          <span className="text-[var(--fg-subtle)]">
            {comment.attachment ? "[ໄຟລ໌ແນບ]" : "(ບໍ່ມີຂໍ້ຄວາມ)"}
          </span>
        )}
      </p>

      <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
        ໃນໂພສ: {comment.post.message?.slice(0, 90) ?? "(ບໍ່ມີຂໍ້ຄວາມ)"}
        {comment.post.campaign ? (
          <>
            {" · "}
            <Link href={`/campaigns/${comment.post.campaign.id}`} className="link">
              {comment.post.campaign.name}
            </Link>
          </>
        ) : null}
      </p>

      <ReplyBox
        action={reply}
        canned={canned}
        canPrivateReply={!comment.fromPage}
      />

      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2">
        <form action={handle}>
          <SubmitButton className="btn btn-sm" pendingText="...">
            {comment.handled ? "ເອົາອອກຈາກຈັດການແລ້ວ" : "ໝາຍວ່າຈັດການແລ້ວ"}
          </SubmitButton>
        </form>
        <form action={hide}>
          <SubmitButton className="btn btn-sm" pendingText="...">
            {comment.hidden ? "ເອົາອອກຈາກທີ່ເຊື່ອງ" : "ເຊື່ອງ comment"}
          </SubmitButton>
        </form>
        {comment.leadId ? (
          <Link href={`/leads/${comment.leadId}`} className="btn btn-sm">
            ເບິ່ງລູກຄ້າ
          </Link>
        ) : (
          <form action={toLead}>
            <SubmitButton className="btn btn-sm" pendingText="...">
              ເຮັດເປັນລູກຄ້າ
            </SubmitButton>
          </form>
        )}
        {comment.post.permalink ? (
          <a
            href={comment.post.permalink}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm"
          >
            ເປີດໃນ Facebook
          </a>
        ) : null}
      </div>
    </div>
  );
}
