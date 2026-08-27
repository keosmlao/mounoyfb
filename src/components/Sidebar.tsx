"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badgeKey?: string;
  /** ຄຳອະທິບາຍສັ້ນ — ສະແດງເມື່ອເອົາເມົ້າຊີ້ ເພື່ອບໍ່ໃຫ້ຄົນເດົາເອົາເອງ */
  hint?: string;
};
type NavGroup = { title: string; items: NavItem[] };

/**
 * ຈັດຕາມ **ຄຳຖາມທີ່ຄົນຢາກຮູ້** ບໍ່ແມ່ນຕາມໂຄງສ້າງຖານຂໍ້ມູນ:
 * ມື້ນີ້ຕ້ອງເຮັດຫຍັງ → ຂາຍໄດ້ເທົ່າໃດ → ຍິງຫຍັງຢູ່ → ຂໍ້ມູນຫຼັກ
 */
const NAV: NavGroup[] = [
  {
    title: "ຕັດສິນໃຈ",
    items: [
      { href: "/", label: "ໜ້າຫຼັກ", icon: "◈", hint: "ມື້ນີ້ຕ້ອງເຮັດຫຍັງ" },
      {
        href: "/analysis",
        label: "ວິເຄາະ",
        icon: "◑",
        hint: "ກຸ່ມໃດ ບ່ອນໃດ ເວລາໃດ ຄຸ້ມທີ່ສຸດ",
      },
      {
        href: "/alerts",
        label: "ການແຈ້ງເຕືອນ",
        icon: "⚠",
        badgeKey: "alerts",
        hint: "ງົບເກີນ · ROAS ຕ່ຳ · ລູກຄ້າຄ້າງ",
      },
    ],
  },
  {
    title: "ຍອດຂາຍ",
    items: [
      { href: "/orders", label: "ອໍເດີ", icon: "▧", hint: "ຍອດຂາຍຈິງ ແລະ ກຳໄລ" },
      {
        href: "/orders/import",
        label: "ນຳເຂົ້າຍອດຂາຍ",
        icon: "⤒",
        hint: "ດຶງຈາກ Excel / Google Sheets",
      },
      { href: "/leads", label: "ລູກຄ້າ", icon: "☺", hint: "ຄົນທີ່ທັກເຂົ້າມາ" },
      {
        href: "/inbox",
        label: "ກ່ອງຂໍ້ຄວາມ",
        icon: "✉",
        badgeKey: "inbox",
        hint: "comment ແລະ ແຊັດ ທີ່ຍັງບໍ່ໄດ້ຕອບ",
      },
    ],
  },
  {
    title: "ໂຄສະນາ",
    items: [
      { href: "/campaigns", label: "ແຄມເປນ", icon: "◉", hint: "ສິ່ງທີ່ກຳລັງຍິງຢູ່" },
      { href: "/reports", label: "ລາຍງານ", icon: "▤", hint: "ສະຫຼຸບ + ດາວໂຫຼດ CSV" },
    ],
  },
  {
    title: "ຂໍ້ມູນຫຼັກ",
    items: [
      { href: "/products", label: "ສິນຄ້າ", icon: "◻", hint: "ລາຄາ ແລະ ຕົ້ນທຶນ" },
      { href: "/ad-accounts", label: "ບັນຊີໂຄສະນາ", icon: "▣" },
      { href: "/fb-pages", label: "ເພຈ", icon: "⚑" },
      {
        href: "/settings",
        label: "ຕັ້ງຄ່າ",
        icon: "⚙",
        hint: "ດຶງຂໍ້ມູນ · Facebook token",
      },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /orders/import ເປັນເມນູຂອງມັນເອງ — ບໍ່ຄວນເຮັດໃຫ້ /orders ເຂັ້ມນຳ
  if (href === "/orders") return pathname !== "/orders/import" && pathname.startsWith("/orders");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  alertCount = 0,
  inboxCount = 0,
}: {
  alertCount?: number;
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="nav-group-title px-3 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em]">
            {group.title}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.hint}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                      active
                        ? "nav-link-active font-semibold"
                        : "font-medium"
                    }`}
                  >
                    <span aria-hidden className="nav-icon grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[0.8rem]">
                      {item.icon}
                    </span>
                    {item.label}
                    {item.badgeKey === "alerts" && alertCount > 0 ? (
                      <span className="ml-auto rounded-full bg-[var(--danger-soft)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--danger)]">
                        {alertCount}
                      </span>
                    ) : null}
                    {item.badgeKey === "inbox" && inboxCount > 0 ? (
                      <span className="ml-auto rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--warning)]">
                        {inboxCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <form action={logout} className="sidebar-logout mt-1 border-t pt-3">
        <button
          type="submit"
          className="nav-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
        >
          <span aria-hidden className="nav-icon grid h-7 w-7 place-items-center rounded-lg text-xs">
            ⏻
          </span>
          ອອກຈາກລະບົບ
        </button>
      </form>
    </nav>
  );

  return (
    <>
      {/* ແຖບເທິງ ສຳລັບຈໍນ້ອຍ */}
      <div className="mobile-topbar sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3 lg:hidden">
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
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="ປິດເມນູ"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="sidebar-shell absolute inset-y-0 left-0 w-[min(88vw,20rem)] overflow-y-auto pt-16 shadow-2xl">
            {nav}
          </div>
        </div>
      ) : null}

      {/* ແຖບຂ້າງ ສຳລັບຈໍໃຫຍ່ */}
      <aside className="sidebar-shell sticky top-0 hidden h-dvh w-72 shrink-0 overflow-y-auto lg:block">
        <div className="sidebar-brand border-b px-5 py-5">
          <Brand />
        </div>
        <div className="px-4 pt-4">
          <Link href="/orders" className="sidebar-quick-action flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
            <span className="text-lg leading-none">+</span> ເພີ່ມ Order
          </Link>
        </div>
        {nav}
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl text-base font-black text-white shadow-lg">
        F
      </span>
      <span className="leading-tight">
        <span className="brand-name block text-sm font-bold tracking-[0.06em]">FBMONOY</span>
        <span className="brand-subtitle block text-[0.68rem]">
          ADS OPERATIONS
        </span>
      </span>
    </Link>
  );
}
