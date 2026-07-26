import Link from "next/link";

export type BarRow = {
  key: string;
  label: string;
  href?: string;
  value: number;
  /** ຂໍ້ຄວາມທີ່ສະແດງແທນຄ່າດິບ ເຊັ່ນ "1,250,000 ₭" */
  display: string;
  /** ບັນທັດຮອງໃຕ້ຊື່ */
  sub?: string;
};

/**
 * ແຖບແນວນອນຈັດອັນດັບ — ຊຸດຂໍ້ມູນດຽວ ຈຶ່ງໃຊ້ສີດຽວ (ບໍ່ຕ້ອງມີ legend).
 * ຄ່າຕິດປ້າຍໄວ້ທຸກແຖວ ເພາະເປັນລາຍການສັ້ນ ແລະ ອ່ານຄູ່ກັບຊື່ໂດຍກົງ.
 */
export function BarList({
  rows,
  emptyText = "ຍັງບໍ່ມີຂໍ້ມູນ",
}: {
  rows: BarRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
        {emptyText}
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="flex flex-col gap-3 p-4">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm">
              {row.href ? (
                <Link href={row.href} className="link">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
              {row.sub ? (
                <span className="ml-2 text-xs text-[var(--fg-subtle)]">
                  {row.sub}
                </span>
              ) : null}
            </span>
            <span className="tnum shrink-0 text-sm font-medium">
              {row.display}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                background: "var(--chart-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
