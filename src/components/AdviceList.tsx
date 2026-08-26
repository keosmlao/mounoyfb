import Link from "next/link";
import { adviceTone, type Advice } from "@/lib/advice";
import { EmptyState } from "./ui";

/**
 * ລາຍການຄຳແນະນຳ — ຫົວຂໍ້ບອກສິ່ງທີ່ຄວນເຮັດ, ໃຕ້ນັ້ນຄືເຫດຜົນເປັນຕົວເລກ
 * ເພື່ອໃຫ້ຄົນກວດຄືນໄດ້ ບໍ່ຕ້ອງເຊື່ອລະບົບແບບຫຼັບຕາ.
 */
export function AdviceList({
  advice,
  emptyHint,
}: {
  advice: Advice[];
  emptyHint?: string;
}) {
  if (advice.length === 0) {
    return (
      <EmptyState
        title="ຍັງບໍ່ມີຄຳແນະນຳ"
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
        const tone = adviceTone(a.kind);
        const body = (
          <div className="flex gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs badge-${tone.tone}`}
            >
              {tone.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className={`mr-1.5 text-xs text-[var(--${tone.tone})]`}>
                  {tone.label}
                </span>
                {a.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
                {a.reason}
              </p>
              {a.impact ? (
                <p className="mt-1 text-xs leading-relaxed text-[var(--fg-subtle)]">
                  → {a.impact}
                </p>
              ) : null}
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
