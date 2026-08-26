import Link from "next/link";
import {
  ADVICE_TONE,
  CONFIDENCE_LABEL,
  type Advice,
  type Confidence,
} from "@/lib/advice-types";
import { EmptyState } from "./ui";

/**
 * ລາຍການຄຳແນະນຳ — ທຸກຂໍ້ຕ້ອງບອກ 3 ຢ່າງ:
 * ເຮັດຫຍັງ (ຫົວຂໍ້) · ເປັນຫຍັງ (ຕົວເລກ) · ເຊື່ອໄດ້ຫຼາຍປານໃດ (ຄວາມໝັ້ນໃຈ + ຂໍ້ມູນທີ່ໃຊ້)
 */

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "bg-[var(--success-soft)] text-[var(--success)]",
  medium: "bg-[var(--warning-soft)] text-[var(--warning)]",
  low: "bg-[var(--surface-2)] text-[var(--fg-subtle)]",
};

export function AdviceList({
  advice,
  emptyTitle = "ຍັງບໍ່ມີຄຳແນະນຳ",
  emptyHint,
}: {
  advice: Advice[];
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (advice.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        hint={
          emptyHint ??
          "ຕ້ອງມີຂໍ້ມູນຫຼາຍພໍລະບົບຈຶ່ງກ້າແນະນຳ — ດຶງຂໍ້ມູນເພີ່ມ ຫຼື ລໍໃຫ້ໂຄສະນາແລ່ນອີກສອງສາມວັນ"
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {advice.map((a) => {
        const tone = ADVICE_TONE[a.kind];
        const body = (
          <div className="flex gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs badge-${tone.tone}`}
            >
              {tone.icon}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`text-xs text-[var(--${tone.tone})]`}>
                  {tone.label}
                </span>
                <p className="text-sm font-medium">{a.title}</p>
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${CONFIDENCE_STYLE[a.confidence]}`}
                  title="ອີງຈາກວ່າຂໍ້ມູນທີ່ໃຊ້ຕັດສິນມີຫຼາຍກວ່າຂັ້ນຕ່ຳຈັກເທົ່າ"
                >
                  {CONFIDENCE_LABEL[a.confidence]}
                </span>
              </div>

              <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
                {a.reason}
              </p>

              {a.impact ? (
                <p className="mt-1 text-xs leading-relaxed text-[var(--fg-subtle)]">
                  → {a.impact}
                </p>
              ) : null}

              <p className="mt-1.5 text-[0.7rem] text-[var(--fg-subtle)]">
                ຄິດຈາກ: {a.sample}
              </p>
            </div>
          </div>
        );

        return (
          <li key={a.id}>
            {a.href ? (
              <Link
                href={a.href}
                className="block transition-colors hover:bg-[var(--surface-2)]"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
