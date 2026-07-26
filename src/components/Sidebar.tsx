"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string; badgeKey?: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "ພາບລວມ",
    items: [
      { href: "/", label: "ໜ້າຫຼັກ", icon: "▦" },
      { href: "/alerts", label: "ການແຈ້ງເຕືອນ", icon: "⚠", badgeKey: "alerts" },
      { href: "/reports", label: "ລາຍງານ", icon: "▤" },
    ],
  },
  {
    title: "ການຍິງໂຄສະນາ",
    items: [
      { href: "/campaigns", label: "ແຄມເປນ", icon: "◈" },
      { href: "/insights", label: "ບັນທຶກຜົນລາຍວັນ", icon: "✎" },
      { href: "/leads", label: "ລູກຄ້າ", icon: "☺" },
    ],
  },
  {
    title: "ຂໍ້ມູນຫຼັກ",
    items: [
      { href: "/ad-accounts", label: "ບັນຊີໂຄສະນາ", icon: "▣" },
      { href: "/fb-pages", label: "ເພຈ", icon: "⚑" },
      { href: "/products", label: "ສິນຄ້າ", icon: "◻" },
      { href: "/settings", label: "ຕັ້ງຄ່າ", icon: "⚙" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-5 p-3">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="px-2 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                        : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                    }`}
                  >
                    <span aria-hidden className="w-4 text-center opacity-80">
                      {item.icon}
                    </span>
                    {item.label}
                    {item.badgeKey === "alerts" && alertCount > 0 ? (
                      <span className="ml-auto rounded-full bg-[var(--danger-soft)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--danger)]">
                        {alertCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ແຖບເທິງ ສຳລັບຈໍນ້ອຍ */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "✕" : "☰"} ເມນູ
        </button>
      </div>

      {open ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] lg:hidden">
          {nav}
        </div>
      ) : null}

      {/* ແຖບຂ້າງ ສຳລັບຈໍໃຫຍ່ */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] lg:block">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <Brand />
        </div>
        {nav}
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[var(--brand-fg)]">
        f
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">FBMONOY</span>
        <span className="block text-[0.7rem] text-[var(--fg-subtle)]">
          ຈັດການໂຄສະນາ Facebook
        </span>
      </span>
    </Link>
  );
}
