import { formatDelta } from "@/lib/format";

/**
 * Stat tile: ປ້າຍ · ຄ່າ · ການປ່ຽນແປງທຽບຊ່ວງກ່ອນ · sparkline (ທາງເລືອກ)
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
    <div className="card stat-tile group relative overflow-hidden p-4">
      <p className="text-[0.78rem] font-medium text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1.5 text-[1.55rem] font-semibold leading-none tracking-[-0.03em]">{value}</p>
      <div className="mt-2.5 flex min-h-5 items-end justify-between gap-2">
        <div>
          {delta ? (
            <span className={`text-xs font-medium ${deltaColor}`}>
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
            <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>
          ) : null}
        </div>
        {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 22;
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
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill="var(--chart-1)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
    </svg>
  );
}
