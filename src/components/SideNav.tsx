"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { logout } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badgeKey?: "alerts" | "inbox";
};

type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "ວຽກປະຈຳວັນ",
    items: [
      { href: "/", label: "ໜ້າຫຼັກ", icon: "◈" },
      { href: "/inbox", label: "ຂໍ້ຄວາມ", icon: "✉", badgeKey: "inbox" },
      { href: "/orders", label: "ອໍເດີ", icon: "▧" },
      { href: "/leads", label: "ລູກຄ້າ", icon: "◑" },
      { href: "/campaigns", label: "ແຄມເປນ", icon: "◉" },
      { href: "/analysis", label: "ວິເຄາະ", icon: "◭" },
      { href: "/alerts", label: "ການແຈ້ງເຕືອນ", icon: "⚠", badgeKey: "alerts" },
    ],
  },
  {
    title: "ວຽກເປັນຮອບ",
    items: [
      { href: "/reports", label: "ລາຍງານ", icon: "▤" },
      { href: "/orders/import", label: "ນຳເຂົ້າຍອດຂາຍ", icon: "⤒" },
      { href: "/products", label: "ສິນຄ້າ", icon: "◻" },
      { href: "/ad-accounts", label: "ບັນຊີໂຄສະນາ", icon: "▣" },
      { href: "/fb-pages", label: "ເພຈ Facebook", icon: "⚑" },
    ],
  },
  {
    title: "ລະບົບ",
    items: [{ href: "/settings", label: "ຕັ້ງຄ່າ", icon: "⚙" }],
  },
];

/** 4 ໜ້າທີ່ໃຊ້ຫຼາຍທີ່ສຸດໃນມືຖື — ອັນອື່ນຢູ່ໃນເມນູ ☰ */
const BOTTOM: NavItem[] = [
  { href: "/", label: "ໜ້າຫຼັກ", icon: "◈" },
  { href: "/inbox", label: "ຂໍ້ຄວາມ", icon: "✉", badgeKey: "inbox" },
  { href: "/orders", label: "ອໍເດີ", icon: "▧" },
  { href: "/campaigns", label: "ແຄມເປນ", icon: "◉" },
];

/** ຈື່ວ່າຜູ້ໃຊ້ຫຍໍ້ເມນູໄວ້ບໍ່ — ເປັນຄວາມສະດວກສ່ວນຕົວຂອງແຕ່ລະເຄື່ອງ */
const STORE_KEY = "fbmonoy.nav";
const WIDE = "11rem";
const NARROW = "3.6rem";

/**
 * ຄ່າ "ກວ້າງ/ແຄບ" ຢູ່ໃນ localStorage ບໍ່ແມ່ນໃນ React —
 * ອ່ານຜ່ານ `useSyncExternalStore` ຈຶ່ງບໍ່ຕ້ອງ setState ຕອນ mount
 * ແລະ ແທັບອື່ນທີ່ເປີດຢູ່ກໍ່ຂະຫຍັບຕາມ (event `storage`).
 */
const listeners = new Set<() => void>();

function readNav(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== "narrow";
  } catch {
    // ເບຣົາເຊີບລັອກ storage ໄວ້ — ຖືວ່າກວ້າງ
    return true;
  }
}

function writeNav(wide: boolean) {
  try {
    localStorage.setItem(STORE_KEY, wide ? "wide" : "narrow");
  } catch {}
  for (const listener of listeners) listener();
}

function subscribeNav(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /orders/import ເປັນເມນູຂອງມັນເອງ — ບໍ່ຄວນເຮັດໃຫ້ /orders ເຂັ້ມນຳ
  if (href === "/orders") {
    return pathname !== "/orders/import" && pathname.startsWith("/orders");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * ການນຳທາງຫຼັກ — ແຖບຂ້າງທີ່ **ຫຍໍ້/ຂະຫຍາຍໄດ້ດ້ວຍປຸ່ມ ☰**.
 *
 * ກວ້າງ (11rem) = ເຫັນຄຳເຕັມ ຫາເມນູໄດ້ໄວ ·
 * ແຄບ (3.6rem) = ຄືນຄວາມກວ້າງໃຫ້ຕາຕະລາງເວລາເບິ່ງລາຍງານ.
 * ຄ່າທີ່ເລືອກຖືກຈື່ໄວ້ໃນເຄື່ອງ ຈຶ່ງບໍ່ຕ້ອງກົດຄືນທຸກເທື່ອທີ່ເປີດ.
 *
 * ຄວາມກວ້າງຄຸມດ້ວຍຕົວແປ CSS `--rail` ຢູ່ `<html>` ຈຶ່ງບໍ່ຕ້ອງສົ່ງ state
 * ໄປໃຫ້ layout — ພື້ນທີ່ເນື້ອຫາຂະຫຍັບຕາມເອງ.
 *
 * ມືຖືໃຊ້ແຖບລຸ່ມຈໍ (ນິ້ວໂປ້ເອື້ອມເຖິງ) ບວກເມນູ ☰ ສຳລັບໜ້າທີ່ເຫຼືອ.
 */
export function SideNav({
  alertCount = 0,
  inboxCount = 0,
  userName = null,
}: {
  alertCount?: number;
  inboxCount?: number;
  /** ຊື່ຄົນທີ່ login ຢູ່ — null = ຍັງໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນ */
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  // ຝັ່ງເຊີບເວີບໍ່ຮູ້ຄ່າທີ່ຈື່ໄວ້ — ຖືວ່າກວ້າງ ແລ້ວສະຄຣິບລຸ່ມສຸດແກ້ໃຫ້ທັນກ່ອນ paint
  const wide = useSyncExternalStore(subscribeNav, readNav, () => true);

  useEffect(() => {
    document.documentElement.style.setProperty("--rail", wide ? WIDE : NARROW);
  }, [wide]);

  // ປິດແຜ່ນເມນູດ້ວຍ Esc — ຄາດຫວັງໄດ້ຕາມມາດຕະຖານ
  useEffect(() => {
    if (!sheet) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheet(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet]);

  const countOf = (key?: "alerts" | "inbox") =>
    key === "alerts" ? alertCount : key === "inbox" ? inboxCount : 0;

  return (
    <>
      {/* ຄອມ: ແຖບຂ້າງ */}
      <aside className={`rail hidden lg:flex${wide ? " rail-wide" : ""}`}>
        <div className="rail-top">
          <button
            type="button"
            onClick={() => writeNav(!wide)}
            className="rail-burger"
            aria-label={wide ? "ຫຍໍ້ເມນູ" : "ຂະຫຍາຍເມນູ"}
            aria-expanded={wide}
            title={wide ? "ຫຍໍ້ເມນູ" : "ຂະຫຍາຍເມນູ"}
          >
            ☰
          </button>
          {wide ? (
            <Link href="/" className="rail-brand-name">
              FBMONOY
            </Link>
          ) : null}
        </div>

        <nav className="rail-scroll">
          {GROUPS.map((group) => (
            <div key={group.title} className="rail-group">
              {wide ? <p className="rail-group-title">{group.title}</p> : null}
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = countOf(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`rail-item ${active ? "rail-item-active" : ""}`}
                  >
                    <span aria-hidden className="rail-icon">
                      {item.icon}
                    </span>
                    <span className="rail-label">{item.label}</span>
                    {count > 0 ? (
                      <span className="nav-count">
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="rail-group">
            {userName && wide ? (
              <p className="rail-group-title" title={userName}>
                ເຂົ້າໃນນາມ {userName}
              </p>
            ) : null}
            <form action={logout}>
              <button
                type="submit"
                className="rail-item"
                title={userName ? `ອອກຈາກລະບົບ (${userName})` : "ອອກຈາກລະບົບ"}
              >
                <span aria-hidden className="rail-icon">
                  ⏻
                </span>
                <span className="rail-label">ອອກຈາກລະບົບ</span>
              </button>
            </form>
          </div>
        </nav>
      </aside>

      {/* ມືຖື: ແຖບເທິງ */}
      <header className="topbar lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="btn btn-sm"
          aria-label="ເປີດເມນູ"
        >
          ☰
        </button>
        <Link href="/" className="brand-name text-sm">
          FBMONOY
        </Link>
        <Link href="/orders" className="btn btn-primary btn-sm ml-auto">
          + Order
        </Link>
      </header>

      {/* ມືຖື: ແຜ່ນເມນູເຕັມ */}
      {sheet ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="ປິດເມນູ"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setSheet(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-[var(--border-strong)] bg-[var(--surface)] p-2 pb-8">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-1.5">
                <p className="rail-group-title">{group.title}</p>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const count = countOf(item.badgeKey);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheet(false)}
                      className={`nav-menu-item ${active ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]" : ""}`}
                    >
                      <span aria-hidden className="w-4 text-center">
                        {item.icon}
                      </span>
                      {item.label}
                      {count > 0 ? (
                        <span className="nav-count ml-auto">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
            <form action={logout} className="border-t border-[var(--border)] pt-1">
              {userName ? (
                <p className="rail-group-title">ເຂົ້າໃນນາມ {userName}</p>
              ) : null}
              <button type="submit" className="nav-menu-item">
                <span aria-hidden className="w-4 text-center">
                  ⏻
                </span>
                ອອກຈາກລະບົບ
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* ມືຖື: ແຖບລຸ່ມຈໍ — ໜ້າທີ່ໃຊ້ຫຼາຍທີ່ສຸດ ຢູ່ບ່ອນນິ້ວໂປ້ເອື້ອມເຖິງ */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 flex lg:hidden">
        {BOTTOM.map((item) => {
          const active = isActive(pathname, item.href);
          const count = countOf(item.badgeKey);
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
          onClick={() => setSheet(true)}
          className="bottom-nav-item"
          aria-label="ເປີດເມນູທັງໝົດ"
        >
          <span aria-hidden className="text-lg leading-none">
            ☰
          </span>
          ເມນູ
        </button>
      </nav>

      {/* ບໍ່ໃຫ້ໜ້າຈໍກະພິບເປັນເມນູກວ້າງກ່ອນ ຖ້າຜູ້ໃຊ້ຫຍໍ້ໄວ້ —
          ແລ່ນກ່ອນ React ຮອດ ຈຶ່ງຕັ້ງຄວາມກວ້າງໄດ້ທັນຕັ້ງແຕ່ paint ທຳອິດ */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem(${JSON.stringify(STORE_KEY)})==="narrow")document.documentElement.style.setProperty("--rail",${JSON.stringify(NARROW)})}catch(e){}`,
        }}
      />
    </>
  );
}
