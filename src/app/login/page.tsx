import type { Metadata } from "next";
import { configuredPassword } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ເຂົ້າສູ່ລະບົບ — FBMONOY",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const ready = Boolean(configuredPassword() && process.env.SESSION_SECRET);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand)] text-base font-bold text-[var(--brand-fg)]">
            f
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold">FBMONOY</span>
            <span className="block text-[0.7rem] text-[var(--fg-subtle)]">
              ຈັດການໂຄສະນາ Facebook
            </span>
          </span>
        </div>

        <div className="card p-5">
          <h1 className="text-sm font-semibold">ເຂົ້າສູ່ລະບົບ</h1>
          <p className="mt-1 mb-4 text-xs text-[var(--fg-muted)]">
            ໃສ່ລະຫັດຜ່ານຂອງທີມເພື່ອເຂົ້າໃຊ້ຂໍ້ມູນໂຄສະນາ
          </p>

          {ready ? (
            <LoginForm next={sp.next ?? ""} />
          ) : (
            <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--warning)]">
              ຍັງບໍ່ໄດ້ຕັ້ງ <code>APP_PASSWORD</code> ຫຼື{" "}
              <code>SESSION_SECRET</code> ໃນໄຟລ໌ <code>.env</code> —
              ຕັ້ງແລ້ວ restart ເຊີບເວີ ຈຶ່ງຈະ login ໄດ້
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[0.7rem] text-[var(--fg-subtle)]">
          ລະຫັດຜ່ານໃຊ້ຮ່ວມກັນທັງທີມ — ປ່ຽນໄດ້ທີ່ APP_PASSWORD ໃນ .env
        </p>
      </div>
    </div>
  );
}
