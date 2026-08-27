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
    <div className="login-shell grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
      <section className="login-showcase relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex items-center gap-3">
          <span className="brand-mark grid h-11 w-11 place-items-center rounded-xl text-lg font-black">F</span>
          <div>
            <p className="font-bold tracking-[0.08em]">FBMONOY</p>
            <p className="text-[0.68rem] tracking-[0.16em] text-blue-200">ADS OPERATIONS</p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">From spend to real profit</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.12] tracking-[-0.055em]">
            ຄຸ້ມຄອງ Ads ດ້ວຍ<br />ຍອດຂາຍຈິງ
          </h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
            ເຊື່ອມຄ່າໂຄສະນາ, ຄົນທັກ, Order, ຕົ້ນທຶນ ແລະກຳໄລໄວ້ໃນບ່ອນດຽວ.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm">
            {[
              ["01", "Actual ROAS"],
              ["02", "Order profit"],
              ["03", "Action alerts"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs font-bold text-blue-300">{number}</p>
                <p className="mt-2 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">Built for Lao commerce teams</p>
      </section>

      <section className="grid place-items-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl font-black text-white">F</span>
            <div>
              <p className="font-bold tracking-[0.08em]">FBMONOY</p>
              <p className="text-[0.65rem] tracking-[0.14em] text-[var(--fg-subtle)]">ADS OPERATIONS</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]">Secure workspace</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">ຍິນດີຕ້ອນຮັບ</h2>
            <p className="mb-6 mt-2 text-sm text-[var(--fg-muted)]">
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

          <p className="mt-5 text-center text-[0.7rem] text-[var(--fg-subtle)]">
            ລະຫັດຜ່ານໃຊ້ຮ່ວມກັນທັງທີມ — ປ່ຽນໄດ້ທີ່ APP_PASSWORD ໃນ .env
          </p>
        </div>
      </section>
    </div>
  );
}
