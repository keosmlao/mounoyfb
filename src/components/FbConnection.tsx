"use client";

import { useState, useTransition } from "react";
import {
  importFbAssetsAction,
  testFbConnection,
  type FbConnectionState,
} from "@/app/settings/actions";

/**
 * ທົດສອບ token ແລ້ວສະແດງບັນຊີ/ເພຈ ທີ່ເຂົ້າເຖິງໄດ້ ພ້ອມປຸ່ມນຳເຂົ້າ —
 * ຜູ້ໃຊ້ບໍ່ຕ້ອງໄປຫາ act_... ເອງ.
 */
export function FbConnection({ hasToken }: { hasToken: boolean }) {
  const [state, setState] = useState<FbConnectionState>(null);
  const [imported, setImported] = useState<FbConnectionState>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<FbConnectionState>, target: "test" | "import") =>
    startTransition(async () => {
      const result = await fn();
      if (target === "test") {
        setState(result);
        setImported(null);
      } else {
        setImported(result);
      }
    });

  return (
    <div className="border-t border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={pending || !hasToken}
          onClick={() => run(testFbConnection, "test")}
        >
          {pending ? "ກຳລັງກວດ..." : "ທົດສອບການເຊື່ອມຕໍ່"}
        </button>
        {!hasToken ? (
          <span className="text-xs text-[var(--fg-subtle)]">
            ໃສ່ access token ແລ້ວກົດ “ບັນທຶກຄ່າ” ກ່ອນ
          </span>
        ) : null}
      </div>

      {state ? (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            state.ok
              ? "border-[var(--success)] bg-[var(--success-soft)]"
              : "border-[var(--danger)] bg-[var(--danger-soft)]"
          }`}
        >
          <p className="font-medium">
            {state.ok ? "✓" : "⛔"} {state.message}
          </p>
          {state.tokenOwner ? (
            <p className="mt-0.5 text-[var(--fg-muted)]">
              Token ເປັນຂອງ: {state.tokenOwner}
            </p>
          ) : null}
        </div>
      ) : null}

      {state?.accounts?.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-medium">ບັນຊີໂຄສະນາທີ່ພົບ</p>
          <div className="table-wrap border border-[var(--border)]">
            <table className="data">
              <thead>
                <tr>
                  <th>ຊື່</th>
                  <th>Ad Account ID</th>
                  <th>ສະກຸນ</th>
                </tr>
              </thead>
              <tbody>
                {state.accounts.map((a) => (
                  <tr key={a.fbAccountId}>
                    <td>{a.name}</td>
                    <td className="tnum text-[var(--fg-muted)]">{a.fbAccountId}</td>
                    <td>{a.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.pages?.length ? (
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              ເພຈທີ່ພົບ: {state.pages.map((p) => p.name).join(", ")}
            </p>
          ) : state.pagesError ? (
            <p className="mt-2 text-xs text-[var(--fg-subtle)]">
              ດຶງລາຍການເພຈບໍ່ໄດ້ (ຕ້ອງການສິດ pages_show_list) — ບໍ່ກະທົບການດຶງຜົນໂຄສະນາ
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => run(importFbAssetsAction, "import")}
            >
              {pending ? "ກຳລັງນຳເຂົ້າ..." : "ນຳເຂົ້າທັງໝົດ"}
            </button>
            <span className="text-xs text-[var(--fg-subtle)]">
              ຈະຜູກ ID ໃສ່ບັນຊີ/ເພຈທີ່ມີຢູ່ກ່ອນ ແລ້ວຈຶ່ງສ້າງອັນທີ່ຍັງບໍ່ມີ
            </span>
          </div>
        </div>
      ) : null}

      {imported ? (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            imported.ok
              ? "border-[var(--success)] bg-[var(--success-soft)]"
              : "border-[var(--danger)] bg-[var(--danger-soft)]"
          }`}
        >
          {imported.ok ? "✓" : "⛔"} {imported.message}
        </div>
      ) : null}
    </div>
  );
}
