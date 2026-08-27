import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { StatTile } from "@/components/StatTile";
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
};

/** ສະແດງເທື່ອລະຊຸດ — ກ່ອງທີ່ມີ comment ເປັນຮ້ອຍຈະໜັກເກີນຖ້າອອກໝົດ */
const PAGE_SIZE = 100;

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
            include: {
              page: { select: { name: true } },
              post: {
                select: {
                  fromAd: true,
                  permalink: true,
                  message: true,
                  campaign: { select: { id: true, name: true } },
                },
              },
            },
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
        <Card className="mb-5">
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      {state.error ? (
        <div className="card mb-5 border-l-4 border-l-[var(--danger)] p-4 text-sm">
          <p className="font-medium text-[var(--danger)]">ການດຶງຮອບຫຼ້າສຸດມີບັນຫາ</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{state.error}</p>
        </div>
      ) : null}

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex gap-1">
            <Link
              href={href(sp, { tab: undefined })}
              className={`btn btn-sm${tab === "comments" ? " btn-primary" : ""}`}
            >
              comment
            </Link>
            <Link
              href={href(sp, { tab: "chats" })}
              className={`btn btn-sm${tab === "chats" ? " btn-primary" : ""}`}
            >
              ແຊັດ
            </Link>
          </div>

          <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />

          <Link
            href={href(sp, { status: showAll ? undefined : "all" })}
            className={`btn btn-sm${showAll ? " btn-primary" : ""}`}
          >
            {showAll ? "ທັງໝົດ" : "ສະເພາະທີ່ຍັງຄ້າງ"}
          </Link>

          <form method="get" action="/inbox" className="ml-auto flex flex-wrap items-end gap-2">
            {tab === "chats" ? <input type="hidden" name="tab" value="chats" /> : null}
            {showAll ? <input type="hidden" name="status" value="all" /> : null}
            {tab === "comments" ? (
              <>
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="ຄົ້ນຫາຂໍ້ຄວາມ / ຊື່"
                  className="field w-44"
                />
                <select name="days" defaultValue={sp.days ?? "30"} className="field">
                  <option value="7">7 ວັນຫຼ້າສຸດ</option>
                  <option value="30">30 ວັນຫຼ້າສຸດ</option>
                  <option value="90">90 ວັນຫຼ້າສຸດ</option>
                  <option value="all">ທຸກເວລາ</option>
                </select>
              </>
            ) : null}
            <select name="page" defaultValue={sp.page ?? ""} className="field">
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
        </div>
      </Card>

      {tab === "comments" ? (
        comments.length === 0 ? (
          <Card>
            <EmptyState
              title={showAll ? "ຍັງບໍ່ມີ comment" : "ບໍ່ມີ comment ຄ້າງ"}
              hint="ກົດ “ດຶງດຽວນີ້” ຢູ່ມຸມຂວາເທິງ ເພື່ອດຶງອັນໃໝ່ຈາກ Facebook"
            />
          </Card>
        ) : (
          <div className="grid gap-3">
            {/* ຟອມຫວ່າງໆ ໄວ້ໃຫ້ checkbox ໃນແຕ່ລະກາດອ້າງເຖິງດ້ວຍ form="bulk"
                — HTML ຫ້າມຟອມຊ້ອນຟອມ ຈຶ່ງບໍ່ຄຸມທັງລາຍການໄວ້ */}
            <form action={markSelectedHandled} id="bulk" />

            <Card className="flex flex-wrap items-center gap-3 p-3">
              <p className="text-sm text-[var(--fg-muted)]">
                ສະແດງ {comments.length} ຈາກ {matching} ອັນ
              </p>
              <button
                type="submit"
                form="bulk"
                className="btn btn-sm ml-auto"
              >
                ໝາຍທີ່ເລືອກວ່າຈັດການແລ້ວ
              </button>
              {matching > comments.length ? (
                <Link
                  href={href(sp, { show: String(comments.length + PAGE_SIZE) })}
                  className="btn btn-sm"
                >
                  ໂຫຼດເພີ່ມ {Math.min(PAGE_SIZE, matching - comments.length)} ອັນ
                </Link>
              ) : null}
            </Card>

            {comments.map((comment) => {
              const reply = replyComment.bind(null, comment.id);
              const handle = setCommentHandled.bind(
                null,
                comment.id,
                !comment.handled,
              );
              const hide = toggleCommentHidden.bind(
                null,
                comment.id,
                !comment.hidden,
              );
              const toLead = createLeadFromComment.bind(null, comment.id);

              return (
                <Card key={comment.id} className="p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {comment.handled ? null : (
                      <input
                        type="checkbox"
                        name="ids"
                        value={comment.id}
                        form="bulk"
                        aria-label={`ເລືອກ comment ຂອງ ${comment.fromName ?? "ບໍ່ຮູ້ຊື່"}`}
                        className="h-4 w-4 self-center"
                      />
                    )}
                    <p className="text-sm font-semibold">
                      {comment.fromName ?? "ບໍ່ຮູ້ຊື່"}
                    </p>
                    <span className="text-xs text-[var(--fg-subtle)]">
                      {formatAgo(comment.commentedAt)} · {comment.page.name}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-1">
                      {comment.post.fromAd ? (
                        <Badge tone="info">ໂພສໂຄສະນາ</Badge>
                      ) : (
                        <Badge>ໂພສເພຈ</Badge>
                      )}
                      {comment.parentFbId ? <Badge>ຄຳຕອບ</Badge> : null}
                      {comment.hidden ? <Badge tone="warning">ເຊື່ອງໄວ້</Badge> : null}
                      {comment.handled ? (
                        <Badge tone="success">ຈັດການແລ້ວ</Badge>
                      ) : null}
                      {comment.leadId ? <Badge tone="success">ເປັນລູກຄ້າແລ້ວ</Badge> : null}
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {comment.message || (
                      <span className="text-[var(--fg-subtle)]">
                        {comment.attachment ? "[ໄຟລ໌ແນບ]" : "(ບໍ່ມີຂໍ້ຄວາມ)"}
                      </span>
                    )}
                  </p>

                  <p className="mt-1.5 truncate text-xs text-[var(--fg-subtle)]">
                    ໃນໂພສ: {comment.post.message?.slice(0, 90) ?? "(ບໍ່ມີຂໍ້ຄວາມ)"}
                    {comment.post.campaign ? (
                      <>
                        {" · "}
                        <Link
                          href={`/campaigns/${comment.post.campaign.id}`}
                          className="link"
                        >
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

                  <div className="mt-2 flex flex-wrap gap-2">
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
                </Card>
              );
            })}
          </div>
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
          <CardHeader
            title="ຫ້ອງແຊັດ"
            subtitle={`ສະແດງ ${threads.length} ຫ້ອງ (ສູງສຸດ 100)`}
          />
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
                      {thread.personName ?? "ບໍ່ຮູ້ຊື່"}
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
