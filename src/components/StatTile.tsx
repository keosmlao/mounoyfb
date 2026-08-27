import type { ReactNode } from "react";
import { formatDelta } from "@/lib/format";

/** ຈຳນວນຊ່ອງໃນຈໍກວ້າງ — ຂຽນເປັນຄລາສເຕັມ ເພາະ Tailwind ອ່ານຊື່ຄລາສຕອນ build */
const COLS: Record<number, string> = {
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
};

/**
 * ແຖບຕົວເລກລວມ — ຊ່ອງຕິດກັນເປັນແຖບດຽວ ບໍ່ແມ່ນກາດລອຍຫ່າງກັນ.
 *
 * ກາດແຍກກັນກິນຄວາມສູງໄປປະມານ 1 ໃນ 3 ໂດຍບໍ່ໄດ້ບອກຫຍັງເພີ່ມ —
 * ຄວາມສູງນັ້ນເອົາໄປໃສ່ແຖວຕາຕະລາງໄດ້ອີກ 3-4 ແຖວ.
 */
export function StatStrip({
  cols = 5,
  children,
  className = "",
}: {
  cols?: 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`stat-strip mb-3 ${COLS[cols] ?? COLS[5]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * ຊ່ອງດຽວໃນແຖບ: ປ້າຍ · ຄ່າ · ການປ່ຽນແປງທຽບຊ່ວງກ່ອນ · sparkline (ທາງເລືອກ)
 * ຄ່າໃຊ້ຕົວເລກແບບ proportional (ບໍ່ໃສ່ tabular-nums) ຕາມມາດຕະຖານ figure ຂະໜາດໃຫຍ່.
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  hint,
  /** true = ຂຶ້ນຄືດີ (ຍອດຂາຍ), false = ຂຶ້ນຄືບໍ່ດີ (ຄ່າຕໍ່ 1 ຄົນທັກ) */
  upIsGood = true,
  spark,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
  upIsGood?: boolean;
  spark?: number[];
}) {
  const delta =
    current !== undefined && previous !== undefined
      ? formatDelta(current, previous)
      : null;

  const deltaColor =
    !delta || delta.direction === "flat"
      ? "text-[var(--fg-subtle)]"
      : (delta.direction === "up") === upIsGood
        ? "text-[var(--success)]"
        : "text-[var(--danger)]";

  return (
    <div className="stat-cell">
      <p className="stat-label" title={label}>
        {label}
      </p>
      <p className="stat-value">{value}</p>
      <div className="stat-foot flex items-end justify-between gap-1.5">
        <span className="min-w-0 truncate">
          {delta ? (
            <span className={`font-medium ${deltaColor}`}>
              {delta.direction === "up"
                ? "▲"
                : delta.direction === "down"
                  ? "▼"
                  : ""}{" "}
              {delta.text}
              <span className="ml-1 font-normal text-[var(--fg-subtle)]">
                ທຽບຊ່ວງກ່ອນ
              </span>
            </span>
          ) : hint ? (
            <span className="text-[var(--fg-subtle)]">{hint}</span>
          ) : null}
        </span>
        {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 56;
  const h = 16;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);

  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");

  const lastX = (values.length - 1) * step;
  const lastY = h - ((values[values.length - 1] - min) / span) * h;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--chart-muted)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="2.5"
        fill="var(--chart-1)"
        stroke="var(--surface)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
