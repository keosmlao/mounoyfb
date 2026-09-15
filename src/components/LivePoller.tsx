"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** ດຶງ CF ໃໝ່ຖີ່ປານນີ້ — ຄົນຂາຍຕ້ອງເຫັນຍອດຂຶ້ນທັນໃນ live */
const POLL_MS = 4_000;
/** ບໍ່ມີ CF ໃໝ່ກໍ່ຍັງໂຫຼດໜ້າຄືນເປັນໄລຍະ — ຄົນອື່ນອາດຍົກເລີກ/ແກ້ຈາກເຄື່ອງອື່ນ */
const REFRESH_ANYWAY_MS = 30_000;

/**
 * ຕົວອັບເດດກະດານ live — ຮ້ອງ `/api/live/[id]/poll` ແລ້ວ `router.refresh()`
 * ສະເພາະເມື່ອມີ CF ຫຼື comment ໃໝ່. server ບໍ່ສົ່ງ component ນີ້ມາເມື່ອຢຸດເກັບແລ້ວ ຈຶ່ງຢຸດເອງ.
 */
export function LivePoller({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ at: Date | null; error: string | null }>({
    at: null,
    error: null,
  });
  const lastRefresh = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    lastRefresh.current = Date.now();

    const tick = async () => {
      // ແທັບທີ່ບໍ່ໄດ້ເບິ່ງຢູ່ບໍ່ຕ້ອງດຶງ — ຕົວຕັ້ງເວລາຝັ່ງເຊີບເວີເກັບ CF ຕໍ່ໃຫ້ຢູ່ແລ້ວ
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/live/${sessionId}/poll`, {
            method: "POST",
            cache: "no-store",
          });
          const json = (await res.json()) as {
            added?: number;
            comments?: number;
            error?: string | null;
            skipped?: boolean;
          };
          if (!stopped) {
            setStatus((old) => ({
              at: json.skipped ? old.at : new Date(),
              error: res.ok ? (json.error ?? null) : (json.error ?? `HTTP ${res.status}`),
            }));
          }
          const due = Date.now() - lastRefresh.current > REFRESH_ANYWAY_MS;
          if ((json.added ?? 0) > 0 || (json.comments ?? 0) > 0 || due) {
            lastRefresh.current = Date.now();
            router.refresh();
          }
        } catch {
          if (!stopped) setStatus((old) => ({ ...old, error: "ຕໍ່ເຊີບເວີບໍ່ໄດ້ — ຈະລອງໃໝ່" }));
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, 500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sessionId, router]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-[var(--danger-soft)] px-4 py-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--danger)]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--danger)]" aria-hidden />
        ກຳລັງເກັບ CF
      </span>
      <span className="tnum text-xs text-[var(--fg-muted)]">
        {status.at
          ? `ດຶງຫຼ້າສຸດ ${status.at.toLocaleTimeString("en-GB", { hour12: false })} · ທຸກ ${POLL_MS / 1000} ວິນາທີ`
          : "ກຳລັງເລີ່ມ..."}
      </span>
      {status.error ? (
        <span className="text-xs text-[var(--danger)]">{status.error}</span>
      ) : null}
    </div>
  );
}
