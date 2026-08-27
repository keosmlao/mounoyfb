import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatAgo, formatTimeLao } from "@/lib/date";
import {
  createLeadFromThread,
  sendChatReply,
  setThreadHandled,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const thread = await prisma.fbThread.findUnique({
    where: { id },
    include: {
      page: { select: { name: true } },
      lead: { select: { id: true, name: true } },
      // ເກົ່າ → ໃໝ່ ອ່ານຕາມລຳດັບການສົນທະນາ
      messages: { orderBy: { sentAt: "asc" }, take: 200 },
    },
  });
  if (!thread) notFound();

  const send = sendChatReply.bind(null, thread.id);
  const handle = setThreadHandled.bind(null, thread.id, !thread.handled);
  const toLead = createLeadFromThread.bind(null, thread.id);

  return (
    <>
      <PageHeader
        title={thread.personName ?? "ບໍ່ຮູ້ຊື່"}
        description={`ແຊັດຜ່ານເພຈ ${thread.page.name}`}
        action={
          <Link href="/inbox?tab=chats" className="btn btn-sm">
            ← ກັບກ່ອງຂໍ້ຄວາມ
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader
            title="ການສົນທະນາ"
            subtitle={`${thread.messages.length} ຂໍ້ຄວາມລ່າສຸດ`}
            action={
              thread.waitingReply ? (
                <Badge tone="warning">ລໍຄຳຕອບ</Badge>
              ) : (
                <Badge tone="success">ຕອບແລ້ວ</Badge>
              )
            }
          />

          {thread.messages.length === 0 ? (
            <EmptyState
              title="ຍັງບໍ່ໄດ້ດຶງຂໍ້ຄວາມ"
              hint="ກົດ “ດຶງດຽວນີ້” ຢູ່ໜ້າກ່ອງຂໍ້ຄວາມ"
            />
          ) : (
            <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-4">
              {thread.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                    msg.fromPage
                      ? "self-end bg-[var(--brand)] text-white"
                      : "self-start bg-[var(--surface-2)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {msg.text || (msg.attachment ? `[${msg.attachment}]` : "—")}
                  </p>
                  <p
                    className={`mt-1 text-[0.68rem] ${
                      msg.fromPage ? "text-white/70" : "text-[var(--fg-subtle)]"
                    }`}
                  >
                    {msg.fromPage ? "ເພຈ" : (msg.fromName ?? "ລູກຄ້າ")} ·{" "}
                    {formatTimeLao(msg.sentAt)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <form
            action={send}
            className="flex flex-wrap gap-2 border-t border-[var(--border)] p-4"
          >
            <input
              name="text"
              required
              className="field min-w-0 flex-1"
              placeholder="ພິມຂໍ້ຄວາມ..."
            />
            <SubmitButton className="btn btn-primary" pendingText="ກຳລັງສົ່ງ...">
              ສົ່ງ
            </SubmitButton>
            <p className="w-full text-xs text-[var(--fg-subtle)]">
              Facebook ໃຫ້ຕອບພາຍໃນ 24 ຊົ່ວໂມງ ນັບຈາກຂໍ້ຄວາມສຸດທ້າຍຂອງລູກຄ້າ —
              ເກີນນັ້ນການສົ່ງຈະຖືກປະຕິເສດ
            </p>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="ຂໍ້ມູນຫ້ອງນີ້" />
          <dl className="grid gap-3 p-4 text-sm">
            <div>
              <dt className="text-xs text-[var(--fg-subtle)]">ຂໍ້ຄວາມສຸດທ້າຍ</dt>
              <dd>
                {formatAgo(thread.lastMessageAt)}{" "}
                <span className="text-xs text-[var(--fg-subtle)]">
                  ({formatTimeLao(thread.lastMessageAt)})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--fg-subtle)]">ຈຳນວນຂໍ້ຄວາມທັງໝົດ</dt>
              <dd className="tnum">{thread.messageCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--fg-subtle)]">ຍັງບໍ່ໄດ້ອ່ານ</dt>
              <dd className="tnum">{thread.unreadCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--fg-subtle)]">ລູກຄ້າໃນລະບົບ</dt>
              <dd>
                {thread.lead ? (
                  <Link href={`/leads/${thread.lead.id}`} className="link">
                    {thread.lead.name}
                  </Link>
                ) : (
                  "ຍັງບໍ່ໄດ້ສ້າງ"
                )}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] p-4">
            <form action={handle}>
              <SubmitButton className="btn btn-sm" pendingText="...">
                {thread.handled ? "ເປີດຄືນ" : "ປິດວຽກນີ້"}
              </SubmitButton>
            </form>
            {thread.lead ? null : (
              <form action={toLead}>
                <SubmitButton className="btn btn-sm" pendingText="...">
                  ເຮັດເປັນລູກຄ້າ
                </SubmitButton>
              </form>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
