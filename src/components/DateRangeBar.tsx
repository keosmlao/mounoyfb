import Link from "next/link";
import type { DateRange } from "@/lib/date";
import { formatDateLao } from "@/lib/date";

const PRESETS = [
  { key: "today", label: "ມື້ນີ້" },
  { key: "yesterday", label: "ມື້ວານ" },
  { key: "7d", label: "7 ວັນ" },
  { key: "30d", label: "30 ວັນ" },
  { key: "month", label: "ເດືອນນີ້" },
  { key: "lastMonth", label: "ເດືອນແລ້ວ" },
];

/**
 * ແຖບເລືອກຊ່ວງວັນ — ໃຊ້ form method="get" ເພື່ອບໍ່ຕ້ອງມີ JS ຝັ່ງ client.
 * `keep` ຄືຄ່າ filter ອື່ນທີ່ຢາກຮັກສາໄວ້ຕອນປ່ຽນວັນ.
 */
export function DateRangeBar({
  basePath,
  range,
  activePreset,
  keep = {},
}: {
  basePath: string;
  range: DateRange;
  activePreset?: string;
  keep?: Record<string, string | undefined>;
}) {
  const keepEntries = Object.entries(keep).filter(([, v]) => v);

  const presetHref = (preset: string) => {
    const params = new URLSearchParams({ preset });
    for (const [k, v] of keepEntries) params.set(k, v as string);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="card mb-5 flex flex-wrap items-end gap-3 p-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={presetHref(p.key)}
            className={`btn btn-sm ${
              activePreset === p.key ? "btn-primary" : ""
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {keepEntries.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v as string} />
        ))}
        <div>
          <label className="label">ແຕ່ວັນທີ່</label>
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="field"
          />
        </div>
        <div>
          <label className="label">ຫາວັນທີ່</label>
          <input type="date" name="to" defaultValue={range.to} className="field" />
        </div>
        <button type="submit" className="btn">
          ນຳໃຊ້
        </button>
      </form>

      <p className="ml-auto text-xs text-[var(--fg-muted)]">
        ກຳລັງເບິ່ງ: {formatDateLao(range.from)} — {formatDateLao(range.to)}
      </p>
    </div>
  );
}
