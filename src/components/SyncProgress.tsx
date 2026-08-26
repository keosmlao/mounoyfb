"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ແຖບຄວາມຄືບໜ້າຂອງການດຶງຂໍ້ມູນທີ່ແລ່ນເບື້ອງຫຼັງ.
 * ດຶງຄ່າໃໝ່ດ້ວຍ router.refresh() ທຸກໆ 3 ວິນາທີ ຈົນກວ່າວຽກຈະຈົບ
 * (ວຽກຈົບແລ້ວ server ຈະບໍ່ສົ່ງ component ນີ້ກັບມາອີກ ຈຶ່ງຢຸດເອງ).
 */
export function SyncProgress({
  doneDays,
  totalDays,
  message,
  startedAt,
}: {
  doneDays: number;
  totalDays: number;
  message: string | null;
  startedAt: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);

  const percent =
    totalDays > 0 ? Math.min(100, Math.round((doneDays / totalDays) * 100)) : 0;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--info-soft)] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--info)]">
          ⏳ ກຳລັງດຶງຂໍ້ມູນຢູ່ເບື້ອງຫຼັງ
        </p>
        <p className="tnum text-xs text-[var(--fg-muted)]">
          {totalDays > 0 ? `${doneDays}/${totalDays} ວັນ · ${percent}%` : "..."}
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[var(--info)] transition-[width] duration-500"
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        {message ?? "ກຳລັງເລີ່ມ..."} · ເລີ່ມ {startedAt}
      </p>
      <p className="mt-0.5 text-[0.7rem] text-[var(--fg-subtle)]">
        ອອກຈາກໜ້ານີ້ໄດ້ — ວຽກຈະແລ່ນຕໍ່ຈົນຈົບ
      </p>
    </div>
  );
}
