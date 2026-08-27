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
    <div className="date-range-bar card mb-2.5 flex flex-wrap items-center gap-2 p-1.5">
      <div className="date-presets flex flex-wrap gap-0.5 rounded-md bg-[var(--surface-2)] p-0.5">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={presetHref(p.key)}
            className={`date-preset ${
              activePreset === p.key ? "date-preset-active" : ""
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form method="get" action={basePath} className="flex flex-wrap items-end gap-1.5 lg:ml-1">
        {keepEntries.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v as string} />
        ))}
        <div>
          <label className="label !text-[0.7rem]">ແຕ່ວັນທີ່</label>
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="field !py-0.5"
          />
        </div>
        <div>
          <label className="label !text-[0.7rem]">ຫາວັນທີ່</label>
          <input type="date" name="to" defaultValue={range.to} className="field !py-0.5" />
        </div>
        <button type="submit" className="btn btn-sm">
          ນຳໃຊ້
        </button>
      </form>

      <p className="ml-auto hidden text-xs text-[var(--fg-muted)] 2xl:block">
        ກຳລັງເບິ່ງ: {formatDateLao(range.from)} — {formatDateLao(range.to)}
      </p>
    </div>
  );
}
