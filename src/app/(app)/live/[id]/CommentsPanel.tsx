import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ReplyBox } from "@/components/ReplyBox";
import { LoadMore } from "@/components/LoadMore";
import { getCannedReplies } from "@/lib/canned";
import { canPrivateReply } from "@/lib/live-cf";
import { SPAM_LABEL, type SpamReason } from "@/lib/live-comments";
import { formatTimeLao } from "@/lib/date";
import { formatInt } from "@/lib/format";
import {
  markLiveQuestionsHandled,
  replyLiveCommentAction,
  saveLiveAutomation,
  setLiveCommentHandled,
  toggleLiveCommentHidden,
} from "../actions";

export const COMMENT_TABS = {
  q: "ຄຳຖາມທີ່ຍັງບໍ່ຕອບ",
  cf: "CF",
  all: "ທັງໝົດ",
  hidden: "ກວນ / ເຊື່ອງ",
} as const;
export type CommentTab = keyof typeof COMMENT_TABS;

const PAGE_SIZE = 50;

/**
 * comment ທຸກອັນຂອງ live — ຕອບ, ເຊື່ອງ, ໝາຍວ່າຈັດການແລ້ວ ແລະ ສະວິດອັດຕະໂນມັດ.
 * ຄຳຕອບຂອງເພຈສະແດງຊ້ອນໃຕ້ comment ທີ່ມັນຕອບ ບໍ່ແມ່ນເປັນແຖວແຍກ.
 */
export async function CommentsPanel({
  session,
  tab,
  show,
}: {
  session: { id: string; autoAck: boolean; autoHide: boolean };
  tab: CommentTab;
  show: number;
}) {
  const base = { sessionId: session.id, fromPage: false, parentFbId: null };
  const where = {
    q: { ...base, isQuestion: true, handled: false },
    cf: { ...base, isCf: true },
    all: { ...base },
    hidden: { sessionId: session.id, fromPage: false, OR: [{ hidden: true }, { spam: { not: null } }] },
  }[tab];

  const [rows, total, counts, canned] = await Promise.all([
    prisma.liveComment.findMany({
      where,
      orderBy: { commentedAt: "desc" },
      take: show,
    }),
    prisma.liveComment.count({ where }),
    Promise.all([
      prisma.liveComment.count({ where: { ...base, isQuestion: true, handled: false } }),
      prisma.liveComment.count({ where: { ...base, isCf: true } }),
      prisma.liveComment.count({ where: base }),
      prisma.liveComment.count({
        where: { sessionId: session.id, fromPage: false, OR: [{ hidden: true }, { spam: { not: null } }] },
      }),
    ]),
    getCannedReplies(),
  ]);

  // ຄຳຕອບຂອງເພຈ ແລະ ຂອງຄົນອື່ນໃຕ້ comment ທີ່ສະແດງຢູ່
  const replies = rows.length
    ? await prisma.liveComment.findMany({
        where: { parentFbId: { in: rows.map((r) => r.fbCommentId) } },
        orderBy: { commentedAt: "asc" },
        select: { id: true, parentFbId: true, fromName: true, fromPage: true, message: true },
      })
    : [];
  const repliesOf = new Map<string, typeof replies>();
  for (const reply of replies) {
    repliesOf.set(reply.parentFbId!, [...(repliesOf.get(reply.parentFbId!) ?? []), reply]);
  }

  const countOf: Record<CommentTab, number> = {
    q: counts[0],
    cf: counts[1],
    all: counts[2],
    hidden: counts[3],
  };
  const href = (t: CommentTab, n?: number) =>
    `/live/${session.id}?c=${t}${n ? `&cshow=${n}` : ""}#comments`;

  return (
    <Card id="comments">
      <CardHeader
        title="comment ໃນ live"
        subtitle="ຕອບ ຫຼື ເຊື່ອງໄດ້ຈາກບ່ອນນີ້ — ບໍ່ປົນກັບກ່ອງຂໍ້ຄວາມຫຼັກ"
        action={
          tab === "q" && countOf.q > 0 ? (
            <form action={markLiveQuestionsHandled.bind(null, session.id)}>
              <SubmitButton className="btn btn-sm" pendingText="...">ໝາຍທຸກຄຳຖາມວ່າຈັດການແລ້ວ</SubmitButton>
            </form>
          ) : null
        }
      />

      <form
        action={saveLiveAutomation.bind(null, session.id)}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] px-4 py-2.5 text-sm"
      >
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="autoAck" defaultChecked={session.autoAck} />
          ຕອບຮັບ CF ອັດຕະໂນມັດ
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="autoHide" defaultChecked={session.autoHide} />
          ເຊື່ອງ comment ທີ່ມີລິ້ງ/ເບີໂທ
        </label>
        <SubmitButton className="btn btn-sm" pendingText="...">ບັນທຶກ</SubmitButton>
        <p className="w-full text-2xs text-[var(--fg-subtle)]">
          ຕອບຮັບສະເພາະ CF ໃໝ່ (5 ນາທີຫຼ້າສຸດ) ບໍ່ເກີນ 20 ຄັ້ງ/ນາທີ ກັນ Facebook ເຫັນເປັນ spam ·
          ການເຊື່ອງບໍ່ລຶບ — ເຈົ້າຂອງ comment ຍັງເຫັນ ແຕ່ຄົນອື່ນບໍ່ເຫັນ (ກັນເບີໂທລູກຄ້າຫຼຸດ ແລະ ຮ້ານອື່ນມາຝາກລິ້ງ)
        </p>
      </form>

      <nav className="flex flex-wrap gap-1 border-b border-[var(--border)] px-3 py-2">
        {(Object.keys(COMMENT_TABS) as CommentTab[]).map((t) => (
          <Link
            key={t}
            href={href(t)}
            className={`btn btn-sm ${t === tab ? "btn-primary" : ""}`}
            aria-current={t === tab ? "page" : undefined}
          >
            {COMMENT_TABS[t]} · {formatInt(countOf[t])}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "q" ? "ບໍ່ມີຄຳຖາມຄ້າງ" : "ຍັງບໍ່ມີ comment"}
          hint={tab === "q" ? "ຄຳຖາມເຊັ່ນ ລາຄາ / ຂະໜາດ / ຄ່າສົ່ງ ຈະມາຢູ່ບ່ອນນີ້" : undefined}
        />
      ) : (
        <ul className="max-h-[48rem] divide-y divide-[var(--border)] overflow-y-auto">
          {rows.map((c) => {
            const threads = repliesOf.get(c.fbCommentId) ?? [];
            const pageReplied = threads.some((r) => r.fromPage);
            return (
              <li key={c.id} className={`px-4 py-2.5 ${c.hidden ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{c.fromName ?? "ບໍ່ຮູ້ຊື່"}</span>
                  <span className="tnum text-xs text-[var(--fg-subtle)]">{formatTimeLao(c.commentedAt)}</span>
                  {c.isCf ? <Badge tone="info">CF</Badge> : null}
                  {c.isQuestion ? <Badge tone="warning">ຄຳຖາມ</Badge> : null}
                  {c.spam ? <Badge tone="danger">{SPAM_LABEL[c.spam as SpamReason] ?? c.spam}</Badge> : null}
                  {c.hidden ? <Badge tone="neutral">ເຊື່ອງແລ້ວ</Badge> : null}
                  {pageReplied ? <Badge tone="success">ຕອບແລ້ວ</Badge> : null}
                  {c.privateRepliedAt ? <Badge tone="success">ຕອບເຂົ້າ Messenger ແລ້ວ</Badge> : null}
                  {c.ackError ? <Badge tone="danger">ຕອບຮັບບໍ່ໄດ້</Badge> : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.message}</p>
                {c.ackError ? <p className="text-2xs text-[var(--danger)]">{c.ackError}</p> : null}

                {threads.length > 0 ? (
                  <ul className="mt-1.5 grid gap-1 border-l-2 border-[var(--border)] pl-3">
                    {threads.map((r) => (
                      <li key={r.id} className="text-xs">
                        <span className={r.fromPage ? "font-semibold text-[var(--info)]" : "font-medium"}>
                          {r.fromPage ? "ເພຈ" : (r.fromName ?? "ບໍ່ຮູ້ຊື່")}:
                        </span>{" "}
                        <span className="whitespace-pre-wrap text-[var(--fg-muted)]">{r.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
                  <details className="min-w-0 flex-1">
                    <summary className="btn btn-sm inline-flex cursor-pointer list-none">ຕອບ</summary>
                    <ReplyBox
                      action={replyLiveCommentAction.bind(null, c.id)}
                      canned={canned}
                      canPrivateReply={!c.privateRepliedAt && canPrivateReply(c.commentedAt)}
                    />
                  </details>
                  <form action={toggleLiveCommentHidden.bind(null, c.id, !c.hidden)}>
                    <SubmitButton className="btn btn-sm" pendingText="...">
                      {c.hidden ? "ເລີກເຊື່ອງ" : "ເຊື່ອງ"}
                    </SubmitButton>
                  </form>
                  <form action={setLiveCommentHandled.bind(null, c.id, !c.handled)}>
                    <SubmitButton className="btn btn-sm" pendingText="...">
                      {c.handled ? "ຍັງບໍ່ຈັດການ" : "ຈັດການແລ້ວ"}
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 ? (
        <LoadMore shown={rows.length} total={total} step={PAGE_SIZE} href={(n) => href(tab, n)} />
      ) : null}
    </Card>
  );
}

export function commentTab(value: string | undefined): CommentTab {
  return value && value in COMMENT_TABS ? (value as CommentTab) : "q";
}

export const COMMENT_PAGE_SIZE = PAGE_SIZE;
