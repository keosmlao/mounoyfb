"use client";

import { useMemo, useState } from "react";
import { formatCompact, formatInt, formatLak } from "@/lib/format";

/**
 * ຮູບແບບການສະແດງຄ່າ — ສົ່ງເປັນ string ບໍ່ແມ່ນ function
 * ເພາະ server component ສົ່ງ function ຂ້າມໄປ client component ບໍ່ໄດ້.
 */
export type ValueFormat = "lak" | "int" | "compact";

const FORMATTERS: Record<ValueFormat, (value: number) => string> = {
  lak: formatLak,
  int: formatInt,
  compact: formatCompact,
};

export type TrendSeries = {
  name: string;
  color: string;
  values: number[];
};

const W = 840;
const H = 260;
const PAD = { top: 12, right: 16, bottom: 26, left: 56 };

/**
 * ກຣາຟເສັ້ນລາຍວັນ — ຮອງຮັບ 1-3 ເສັ້ນ ທີ່ໃຊ້ແກນດຽວກັນ (ໜ່ວຍດຽວກັນເທົ່ານັ້ນ).
 * ມີເສັ້ນເລັງ + tooltip ຕາມມາດຕະຖານ, ແລະ ມີຕາຕະລາງໃຫ້ເປີດເບິ່ງແທນສີ.
 */
export function TrendChart({
  labels,
  series,
  valueFormat = "lak",
  emptyText = "ຍັງບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້",
}: {
  labels: string[];
  series: TrendSeries[];
  valueFormat?: ValueFormat;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const format = FORMATTERS[valueFormat];

  const { ticks, plotW, plotH, xOf, yOf } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const rawMax = Math.max(...all, 0);
    const max = niceMax(rawMax);
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const n = labels.length;
    const xOf = (i: number) =>
      PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yOf = (v: number) => PAD.top + plotH - (max ? (v / max) * plotH : 0);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    return { ticks, plotW, plotH, xOf, yOf };
  }, [labels.length, series]);

  if (labels.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
        {emptyText}
      </p>
    );
  }

  const xLabelEvery = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <div className="p-4">
      {series.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-[var(--fg-muted)]">{s.name}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: "auto" }}
          role="img"
          aria-label={`ກຣາຟລາຍວັນ: ${series.map((s) => s.name).join(", ")}`}
          onMouseLeave={() => setHover(null)}
        >
          {/* ເສັ້ນຕາຂ່າຍ + ປ້າຍແກນ Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--fg-subtle)"
                className="tnum"
              >
                {compact(t)}
              </text>
            </g>
          ))}

          {/* ປ້າຍແກນ X */}
          {labels.map((label, i) =>
            i % xLabelEvery === 0 || i === labels.length - 1 ? (
              <text
                key={label}
                x={xOf(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--fg-subtle)"
              >
                {label}
              </text>
            ) : null,
          )}

          {/* ເສັ້ນເລັງຕອນເອົາເມົ້າຊີ້ */}
          {hover !== null ? (
            <line
              x1={xOf(hover)}
              x2={xOf(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--border-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* ເສັ້ນຂໍ້ມູນ */}
          {series.map((s) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* ຈຸດຢູ່ຕຳແໜ່ງທີ່ຊີ້ */}
          {hover !== null
            ? series.map((s) => (
                <circle
                  key={s.name}
                  cx={xOf(hover)}
                  cy={yOf(s.values[hover] ?? 0)}
                  r="4.5"
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ))
            : null}

          {/* ພື້ນທີ່ຮັບເມົ້າ — ກວ້າງກວ່າຈຸດ ເພື່ອຈັບງ່າຍ */}
          {labels.map((label, i) => (
            <rect
              key={label}
              x={xOf(i) - plotW / Math.max(labels.length - 1, 1) / 2}
              y={PAD.top}
              width={plotW / Math.max(labels.length - 1, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hover !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs shadow-[var(--shadow-md)]"
            style={{
              left: `${(xOf(hover) / W) * 100}%`,
              top: 0,
            }}
          >
            <p className="mb-1 font-medium">{labels[hover]}</p>
            {series.map((s) => (
              <p
                key={s.name}
                className="flex items-center justify-between gap-3 py-0.5"
              >
                <span className="flex items-center gap-1.5 text-[var(--fg-muted)]">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
                <span className="tnum font-medium">
                  {format(s.values[hover] ?? 0)}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-[var(--fg-muted)]">
          ເບິ່ງເປັນຕາຕະລາງ
        </summary>
        <div className="table-wrap mt-2 max-h-72 overflow-y-auto border border-[var(--border)]">
          <table className="data">
            <thead>
              <tr>
                <th>ວັນທີ່</th>
                {series.map((s) => (
                  <th key={s.name} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => (
                <tr key={label}>
                  <td>{label}</td>
                  {series.map((s) => (
                    <td key={s.name} className="num">
                      {format(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** ປັດຂອບເທິງໃຫ້ເປັນຕົວເລກມົນ ເພື່ອໃຫ້ຂີດແກນອ່ານງ່າຍ */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
}
