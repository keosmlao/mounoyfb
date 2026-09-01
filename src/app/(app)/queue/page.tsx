import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Num, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { SubmitButton } from "@/components/SubmitButton";
import { currentUser } from "@/lib/auth-server";
import { daysAgo, formatTimeLao } from "@/lib/date";
import { formatInt } from "@/lib/format";
import {
  AUTO_REPLY_SECONDS,
  buildQueue,
  durationLao,
  REPLY_WINDOW_HOURS,
  summarize,
  URGENCY_LABEL,
  type ThreadInput,
} from "@/lib/queue";
import { visibleText } from "@/lib/fb-attachment";
import { claimThread, releaseThread } from "./actions";

export const dynamic = "force-dynamic";

/**
 * ຫ້ອງທີ່ບໍ່ມີຂໍ້ຄວາມມາເກີນ 3 ວັນ ຕອບບໍ່ໄດ້ອີກແລ້ວ (ໜ້າຕ່າງ 24 ຊົ່ວໂມງ)
 * ຈຶ່ງບໍ່ຕ້ອງດຶງມາຄິດ — ກັນລາຍການຍາວຈົນຊ້າ
 */
const LOOKBACK_DAYS = 3;

type Search = { filter?: string };

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [me, threads] = await Promise.all([
    currentUser(),
    prisma.fbThread.findMany({
      where: { handled: false, lastMessageAt: { gte: daysAgo(LOOKBACK_DAYS) } },
      select: {
        id: true,
        personName: true,
        snippet: true,
        assignee: true,
        handled: true,
        leadId: true,
        page: { select: { name: true } },
        // ຂໍ້ຄວາມພໍໃຫ້ຮູ້ວ່າໃຜເວົ້າສຸດທ້າຍ ແລະ ບອດຕອບໄປແລ້ວບໍ່
        messages: {
          orderBy: { sentAt: "asc" },
          take: 40,
          select: { fromPage: true, sentAt: true },
        },
      },
    }),
  ]);

  const input: ThreadInput[] = threads.map((t) => ({
    id: t.id,
    personName: t.personName,
    pageName: t.page.name,
    snippet: t.snippet,
    assignee: t.assignee,
    handled: t.handled,
    leadId: t.leadId,
    messages: t.messages,
  }));

  const all = buildQueue(input);
  const summary = summarize(all);

  const filter = sp.filter === "mine" || sp.filter === "free" ? sp.filter : "all";
  const rows = all.filter((r) =>
    filter === "mine"
      ? me !== null && r.assignee === me.displayName
      : filter === "free"
        ? !r.assignee
        : true,
  );

  const tabs = [
    { key: "all", label: `ທັງໝົດ (${formatInt(summary.total)})` },
    { key: "free", label: `ຍັງບໍ່ມີຄົນຮັບ (${formatInt(summary.unassigned)})` },
    { key: "mine", label: "ຂອງຂ້ອຍ" },
  ];

  return (
    <>
      <PageHeader
        title="ຄິວວຽກ"
        description={`ຄົນທີ່ທັກມາແລ້ວຍັງບໍ່ມີຄົນຕອບ — ຮຽງຄົນທີ່ລໍດົນສຸດຂຶ້ນກ່ອນ`}
        action={
          <Link href="/inbox?tab=chats" className="btn btn-sm">
            ກ່ອງຂໍ້ຄວາມ
          </Link>
        }
      />

      <StatStrip cols={4}>
        <StatTile
          label="ລໍຄົນຕອບຢູ່"
          value={formatInt(summary.total)}
          hint={`ໃນ ${LOOKBACK_DAYS} ວັນຫຼ້າສຸດ`}
        />
        <StatTile
          label="ດ່ວນ"
          value={formatInt(summary.urgent)}
          hint="ເຫຼືອບໍ່ຮອດ 2 ຊົ່ວໂມງ"
          upIsGood={false}
        />
        <StatTile
          label="ໝົດເວລາຕອບແລ້ວ"
          value={formatInt(summary.expired)}
          hint={`ເກີນ ${REPLY_WINDOW_HOURS} ຊົ່ວໂມງ — Facebook ບໍ່ໃຫ້ສົ່ງອີກ`}
          upIsGood={false}
        />
        <StatTile
          label="ລໍດົນສຸດ"
          value={summary.total > 0 ? durationLao(summary.longestWait) : "—"}
          hint="ຄົນນີ້ຄວນໄດ້ຮັບການຕອບກ່ອນ"
          upIsGood={false}
        />
      </StatStrip>

      {summary.autoRepliedOnly > 0 ? (
        <Card className="mb-3">
          <div className="px-4 py-3 text-sm leading-relaxed">
            <span aria-hidden className="badge-warning mr-1.5 rounded px-1.5">
              ⚠
            </span>
            <strong>
              {formatInt(summary.autoRepliedOnly)} ຫ້ອງມີແຕ່ຂໍ້ຄວາມຕອບອັດຕະໂນມັດ
            </strong>{" "}
            — ບອດຕອບໄປແລ້ວແຕ່ຍັງບໍ່ມີຄົນເບິ່ງ. ໃນກ່ອງຂໍ້ຄວາມຫ້ອງເຫຼົ່ານີ້ຈະຂຶ້ນວ່າ
            “ຕອບແລ້ວ” ຈຶ່ງເບິ່ງບໍ່ອອກ — ບ່ອນນີ້ນັບການຕອບທີ່ໄວກວ່າ{" "}
            {AUTO_REPLY_SECONDS} ວິນາທີວ່າເປັນບອດ ບໍ່ນັບເປັນຄົນ.
          </div>
        </Card>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/queue" : `/queue?filter=${t.key}`}
            className={`btn btn-sm ${filter === t.key ? "btn-primary" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title="ຄົນທີ່ລໍຢູ່"
          subtitle={
            me
              ? `ເຂົ້າໃນນາມ ${me.displayName} — ກົດ “ຮັບວຽກ” ເພື່ອບອກຄົນອື່ນວ່າເຈົ້າກຳລັງເບິ່ງຫ້ອງນີ້`
              : "ຍັງໃຊ້ລະຫັດຜ່ານຮ່ວມກັນ — ສ້າງບັນຊີຜູ້ໃຊ້ຢູ່ໜ້າ ຕັ້ງຄ່າ ຈຶ່ງແບ່ງວຽກກັນໄດ້"
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title={
              summary.total === 0
                ? "ບໍ່ມີໃຜລໍຢູ່ — ຕອບຄົບໝົດແລ້ວ"
                : "ບໍ່ມີຫ້ອງທີ່ກົງກັບຕົວກັ່ນຕອງນີ້"
            }
            hint={
              summary.total === 0
                ? `ນັບສະເພາະຫ້ອງທີ່ຍັງບໍ່ໄດ້ໝາຍວ່າຈັດການແລ້ວ ໃນ ${LOOKBACK_DAYS} ວັນຫຼ້າສຸດ`
                : "ລອງເບິ່ງແທັບ ທັງໝົດ"
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ລູກຄ້າ</th>
                  <th>ເພຈ</th>
                  <th>ຖາມມາວ່າ</th>
                  <th className="num">ລໍມາແລ້ວ</th>
                  <th className="num">ເຫຼືອເວລາ</th>
                  <th>ຜູ້ຮັບຜິດຊອບ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = URGENCY_LABEL[r.urgency];
                  const mine = me !== null && r.assignee === me.displayName;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/inbox/chat/${r.id}`} className="link">
                          {r.personName ?? "ບໍ່ຮູ້ຊື່"}
                        </Link>
                        {r.autoRepliedOnly ? (
                          <span
                            className="ml-1.5 text-2xs text-[var(--warning)]"
                            title={`ມີແຕ່ຂໍ້ຄວາມທີ່ຕອບພາຍໃນ ${AUTO_REPLY_SECONDS} ວິນາທີ`}
                          >
                            ບອດຕອບ
                          </span>
                        ) : null}
                        {r.leadId ? (
                          <span className="ml-1.5 text-2xs text-[var(--fg-subtle)]">
                            ເປັນລູກຄ້າແລ້ວ
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-[var(--fg-muted)]">
                        {r.pageName}
                      </td>
                      <td className="max-w-[18rem] truncate text-[var(--fg-muted)]">
                        {visibleText(r.snippet, []) ?? "—"}
                      </td>
                      <td className="num whitespace-nowrap">
                        <Num>{durationLao(r.waitedMinutes)}</Num>
                        <div className="text-2xs text-[var(--fg-subtle)]">
                          {formatTimeLao(r.waitingSince)}
                        </div>
                      </td>
                      <td className="num whitespace-nowrap">
                        <Badge tone={u.tone as "danger"}>{u.text}</Badge>
                        {r.minutesLeft > 0 ? (
                          <div className="text-2xs text-[var(--fg-subtle)]">
                            {durationLao(r.minutesLeft)}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">
                        {r.assignee ? (
                          <span className={mine ? "font-medium" : ""}>
                            {r.assignee}
                          </span>
                        ) : (
                          <span className="text-[var(--fg-subtle)]">—</span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap">
                        {r.assignee ? (
                          <form action={releaseThread.bind(null, r.id)}>
                            <SubmitButton className="btn btn-sm" pendingText="...">
                              ປ່ອຍວຽກ
                            </SubmitButton>
                          </form>
                        ) : me ? (
                          <form action={claimThread.bind(null, r.id)}>
                            <SubmitButton className="btn btn-sm" pendingText="...">
                              ຮັບວຽກ
                            </SubmitButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs leading-relaxed text-[var(--fg-subtle)]">
        Facebook ໃຫ້ຕອບພາຍໃນ <strong>{REPLY_WINDOW_HOURS} ຊົ່ວໂມງ</strong>
        ນັບຈາກຂໍ້ຄວາມສຸດທ້າຍຂອງລູກຄ້າ — ເກີນນັ້ນສົ່ງບໍ່ໄດ້ອີກຕະຫຼອດໄປ
        ຈຶ່ງເປັນເສັ້ນຕາຍຈິງ ບໍ່ແມ່ນເປົ້າໝາຍພາຍໃນ.
        <br />
        ຫ້ອງຈະຫຼຸດອອກຈາກຄິວເມື່ອ<strong>ມີຄົນຕອບ</strong> ຫຼື
        ກົດ “ປິດວຽກນີ້” ໃນໜ້າແຊັດ — ຂໍ້ຄວາມທີ່ຕອບໄວກວ່າ {AUTO_REPLY_SECONDS}{" "}
        ວິນາທີບໍ່ນັບ ເພາະຖືວ່າເປັນການຕອບອັດຕະໂນມັດ.
      </p>
    </>
  );
}
