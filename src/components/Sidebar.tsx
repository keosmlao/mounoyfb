"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
        label: "ເຕືອນ",
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
        label: "ນຳເຂົ້າ",
        icon: "⤒",
        hint: "ດຶງຈາກ Excel / Google Sheets",
      },
      { href: "/leads", label: "ລູກຄ້າ", icon: "☺", hint: "ຄົນທີ່ທັກເຂົ້າມາ" },
      {
        href: "/inbox",
        label: "ຂໍ້ຄວາມ",
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
      { href: "/ad-accounts", label: "ບັນຊີ", icon: "▣" },
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

/** 4 ໜ້າທີ່ເປີດເລື້ອຍທີ່ສຸດໃນມືຖື — ອັນອື່ນຢູ່ໃນເມນູ ☰ */
const BOTTOM: NavItem[] = [
  { href: "/", label: "ໜ້າຫຼັກ", icon: "◈" },
  { href: "/inbox", label: "ຂໍ້ຄວາມ", icon: "✉", badgeKey: "inbox" },
  { href: "/orders", label: "ອໍເດີ", icon: "▧" },
  { href: "/campaigns", label: "ແຄມເປນ", icon: "◉" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /orders/import ເປັນເມນູຂອງມັນເອງ — ບໍ່ຄວນເຮັດໃຫ້ /orders ເຂັ້ມນຳ
  if (href === "/orders") return pathname !== "/orders/import" && pathname.startsWith("/orders");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const STORAGE_KEY = "fbmonoy-nav-wide";

/**
 * ການນຳທາງຫຼັກ — ຮອງຮັບ 2 ແບບການໃຊ້ງານທີ່ຕ່າງກັນ:
 *
 * **ຄອມ/ໂນ້ຕບຸກ** (lg ຂຶ້ນໄປ): ເມນູຂ້າງເຕັມ, ກົດ « ຫຍໍ້ເປັນແຖບໄອຄອນໄດ້
 * ເມື່ອຢາກໄດ້ພື້ນທີ່ໃຫ້ຕາຕະລາງກວ້າງ — ຈື່ການເລືອກໄວ້ໃນເຄື່ອງນັ້ນ.
 *
 * **ໂທລະສັບ** (ນ້ອຍກວ່າ lg): ແຖບລຸ່ມຈໍ 5 ປຸ່ມທີ່ໃຊ້ເລື້ອຍທີ່ສຸດ (ນິ້ວໂປ້ເອື້ອມເຖິງ)
 * ບວກປຸ່ມ ☰ ເປີດເມນູເຕັມສຳລັບໜ້າທີ່ເຫຼືອ.
 */
export function Sidebar({
  alertCount = 0,
  inboxCount = 0,
}: {
  alertCount?: number;
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(true);

  // ອ່ານຄ່າທີ່ຈື່ໄວ້ຫຼັງ hydrate — ບໍ່ອ່ານຕອນ render ທຳອິດ ບໍ່ດັ່ງນັ້ນ HTML
  // ຈາກເຊີບເວີກັບຈາກເບຣົາເຊີຈະບໍ່ຕົງກັນ
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setWide(saved === "1");
    } catch {
      // ເບຣົາເຊີບລັອກ storage ໄວ້ — ໃຊ້ຄ່າຕັ້ງຕົ້ນໄປ
    }
  }, []);

  function toggleWide() {
    setWide((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        // ບໍ່ຈື່ໄດ້ກໍ່ບໍ່ເປັນຫຍັງ — ຍັງໃຊ້ໄດ້ໃນຮອບນີ້
      }
      return !v;
    });
  }

  const badgeOf = (key?: string) =>
    key === "alerts" ? alertCount : key === "inbox" ? inboxCount : 0;

  /** ເມນູ 1 ຊຸດ — `expanded` ບອກວ່າສະແດງປ້າຍຄຳຢູ່ຂ້າງ (ເຕັມ) ຫຼື ລຸ່ມໄອຄອນ (ແຖບ) */
  const nav = (expanded: boolean) => (
    <nav className="flex flex-col gap-4 px-2.5 py-3">
      {NAV.map((group) => (
        <div key={group.title}>
          {expanded ? (
            <p className="nav-group-title px-3 pb-2 text-[0.7rem] font-bold">
              {group.title}
            </p>
          ) : (
            <div className="mx-3 mb-2 border-t border-[var(--sidebar-border)]" />
          )}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = badgeOf(item.badgeKey);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.hint ?? item.label}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`nav-link relative flex rounded-xl ${
                      expanded
                        ? "min-h-11 items-center gap-3 px-3 py-2.5 text-[0.95rem]"
                        : "min-h-16 flex-col items-center justify-center gap-1 px-1 py-2"
                    } ${active ? "nav-link-active font-semibold" : "font-medium"}`}
                  >
                    <span
                      aria-hidden
                      className="nav-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[0.95rem]"
                    >
                      {item.icon}
                    </span>
                    <span
                      className={expanded ? "" : "text-[0.68rem] leading-none"}
                    >
                      {item.label}
                    </span>
                    {count > 0 ? (
                      <span
                        className={`nav-count ${
                          expanded
                            ? "ml-auto"
                            : "absolute right-2 top-1.5 px-1.5"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
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
      {/* ແຖບເທິງ ສຳລັບຈໍນ້ອຍ (ໂທລະສັບ / ແທັບເລັດແນວຕັ້ງ) */}
      <div className="mobile-topbar sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "✕" : "☰"} ເມນູ
        </button>
      </div>

      {/* ແຖບລຸ່ມ — ໜ້າທີ່ໃຊ້ເລື້ອຍທີ່ສຸດ ຢູ່ບ່ອນທີ່ນິ້ວໂປ້ເອື້ອມເຖິງ */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 flex lg:hidden">
        {BOTTOM.map((item) => {
          const active = isActive(pathname, item.href);
          const count = badgeOf(item.badgeKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`bottom-nav-item ${active ? "bottom-nav-active" : ""}`}
            >
              <span aria-hidden className="relative text-lg leading-none">
                {item.icon}
                {count > 0 ? (
                  <span className="nav-count absolute -right-3 -top-2 scale-90">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bottom-nav-item"
          aria-label="ເປີດເມນູທັງໝົດ"
        >
          <span aria-hidden className="text-lg leading-none">
            ☰
          </span>
          ເມນູ
        </button>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="ປິດເມນູ"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="sidebar-shell absolute inset-y-0 left-0 w-[min(84vw,19rem)] overflow-y-auto pt-16 shadow-2xl">
            {nav(true)}
            <LogoutButton expanded />
          </div>
        </div>
      ) : null}

      {/* ແຖບຂ້າງ ສຳລັບແທັບເລັດ/ຄອມ */}
      <aside
        className={`sidebar-shell sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto lg:flex ${
          wide ? "w-64" : "w-[5.5rem]"
        }`}
      >
        <div
          className={`sidebar-brand flex items-center border-b py-4 ${
            wide ? "px-4" : "justify-center px-2"
          }`}
        >
          <Brand compact={!wide} />
        </div>

        <div className={wide ? "px-4 pt-4" : "px-2.5 pt-3"}>
          <Link
            href="/orders"
            title="ເພີ່ມ Order"
            className={`sidebar-quick-action flex w-full items-center justify-center gap-2 rounded-xl font-semibold ${
              wide ? "px-4 py-3 text-sm" : "h-12 text-xl"
            }`}
          >
            <span className="leading-none">+</span>
            {wide ? "ເພີ່ມ Order" : null}
          </Link>
        </div>

        {nav(wide)}

        <div className="mt-auto flex flex-col gap-1 px-2.5 pb-3">
          <button
            type="button"
            onClick={toggleWide}
            title={wide ? "ຫຍໍ້ເມນູ" : "ຂະຫຍາຍເມນູ"}
            className="nav-link flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium"
          >
            <span aria-hidden>{wide ? "«" : "»"}</span>
            {wide ? "ຫຍໍ້ເມນູ" : null}
          </button>
          <LogoutButton expanded={wide} />
        </div>
      </aside>
    </>
  );
}

function LogoutButton({ expanded }: { expanded: boolean }) {
  return (
    <form action={logout} className="px-0">
      <button
        type="submit"
        title="ອອກຈາກລະບົບ"
        className="nav-link flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium"
      >
        <span aria-hidden>⏻</span>
        {expanded ? "ອອກຈາກລະບົບ" : null}
      </button>
    </form>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black text-white shadow-lg">
        F
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="brand-name block text-sm font-bold tracking-[0.06em]">
            FBMONOY
          </span>
          <span className="brand-subtitle block text-[0.68rem]">
            ADS OPERATIONS
          </span>
        </span>
      )}
    </Link>
  );
}
