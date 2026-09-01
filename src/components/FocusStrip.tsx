import Link from "next/link";
import { formatInt } from "@/lib/format";
import { durationLao } from "@/lib/queue";
import type { MoneyFn } from "@/lib/money";
import type { TodayFocus } from "@/lib/today-server";

/**
 * ແຖບ "ດຽວນີ້ຕ້ອງເຮັດຫຍັງ" ຢູ່ຫົວໜ້າຫຼັກ.
 *
 * ຕົວເລກກຳໄລ ແລະ ກຣາຟຂ້າງລຸ່ມບອກ**ອະດີດ** ເຊິ່ງແກ້ຫຍັງບໍ່ໄດ້ແລ້ວ.
 * ແຖບນີ້ບອກສິ່ງທີ່**ຍັງແກ້ທັນ** ຈຶ່ງຢູ່ເທິງສຸດ — ແລະ ທຸກຊ່ອງກົດເຂົ້າໄປ
 * ຫາໜ້າທີ່ລົງມືໄດ້ເລີຍ ບໍ່ແມ່ນສະແດງໄວ້ຊື່ໆ.
 *
 * ຊ່ອງທີ່ບໍ່ມີຫຍັງຕ້ອງເຮັດ ຍັງສະແດງຢູ່ (ບໍ່ເຊື່ອງ) — ຄວາມງຽບຂອງມັນ
 * ຄືຂໍ້ມູນເໝືອນກັນ ແລະ ຕຳແໜ່ງທີ່ຄົງທີ່ເຮັດໃຫ້ຫາໄວກວ່າ.
 */

type Tone = "danger" | "warning" | "success" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  danger: "text-[var(--danger)]",
  warning: "text-[var(--warning)]",
  success: "text-[var(--success)]",
  neutral: "text-[var(--fg)]",
};

function FocusCard({
  href,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col justify-between gap-1 px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
    >
      <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
        {label}
      </p>
      <p className={`text-xl font-bold leading-none ${TONE_CLASS[tone]}`}>
        {value}
      </p>
      <p className="text-2xs text-[var(--fg-muted)]">{sub}</p>
    </Link>
  );
}

export function FocusStrip({
  focus,
  alerts,
  money,
}: {
  focus: TodayFocus;
  /** ຈຳນວນການແຈ້ງເຕືອນທີ່ຕ້ອງລົງມື */
  alerts: number;
  money: MoneyFn;
}) {
  const { queue, campaigns, billing } = focus;

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <FocusCard
        href="/queue"
        label="ຄົນລໍຄຳຕອບ"
        value={formatInt(queue.waiting)}
        sub={
          queue.waiting === 0
            ? "ຕອບຄົບໝົດແລ້ວ"
            : queue.expired > 0
              ? `ໝົດເວລາຕອບແລ້ວ ${formatInt(queue.expired)} · ດ່ວນ ${formatInt(queue.urgent)}`
              : queue.urgent > 0
                ? `ດ່ວນ ${formatInt(queue.urgent)} · ລໍດົນສຸດ ${durationLao(queue.longestWait)}`
                : `ລໍດົນສຸດ ${durationLao(queue.longestWait)}`
        }
        tone={
          queue.expired > 0 || queue.urgent > 0
            ? "danger"
            : queue.waiting > 0
              ? "warning"
              : "success"
        }
      />

      <FocusCard
        href="/playbook"
        label="ແຄມເປນຕ້ອງລົງມື"
        value={formatInt(campaigns.plays.length)}
        sub={
          campaigns.target <= 0
            ? "ຍັງຄິດເປົ້າບໍ່ໄດ້ — ຕ້ອງມີອໍເດີກ່ອນ"
            : campaigns.plays.length === 0
              ? `${formatInt(campaigns.active)} ແຄມເປນ ຢູ່ໃນເກນໝົດ`
              : campaigns.plays
                  .slice(0, 2)
                  .map((p) => p.name)
                  .join(" · ")
        }
        tone={campaigns.plays.length > 0 ? "warning" : "success"}
      />

      <FocusCard
        href="/billing"
        label="ຄ້າງຊຳລະ"
        value={billing.dueLak > 0 ? money(billing.dueLak) : "—"}
        sub={
          billing.stale
            ? "ຂໍ້ມູນເກົ່າ — ດຶງໃໝ່ກ່ອນວາງແຜນຈ່າຍ"
            : billing.owing > 0
              ? `${formatInt(billing.owing)} ບັນຊີທີ່ມີຍອດຄ້າງ`
              : "ບໍ່ມີຍອດຄ້າງ"
        }
        tone={billing.stale ? "warning" : billing.dueLak > 0 ? "neutral" : "success"}
      />

      <FocusCard
        href="/alerts"
        label="ການແຈ້ງເຕືອນ"
        value={formatInt(alerts)}
        sub={alerts === 0 ? "ບໍ່ມີເລື່ອງດ່ວນ" : "ເລື່ອງທີ່ຕ້ອງລົງມື"}
        tone={alerts > 0 ? "danger" : "success"}
      />
    </div>
  );
}
