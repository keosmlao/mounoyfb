"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  badgeKey?: "alerts" | "inbox";
};

/**
 * ໜ້າທີ່ເປີດເລື້ອຍ — ຢູ່ແຖບເທິງໂດຍກົງ.
 * ຈັດຕາມລຳດັບການເຮັດວຽກ: ເບິ່ງພາບລວມ → ຕອບລູກຄ້າ → ບັນທຶກຍອດ → ເບິ່ງໂຄສະນາ
 */
const PRIMARY: NavItem[] = [
  { href: "/", label: "ໜ້າຫຼັກ" },
  { href: "/inbox", label: "ຂໍ້ຄວາມ", badgeKey: "inbox" },
  { href: "/orders", label: "ອໍເດີ" },
  { href: "/leads", label: "ລູກຄ້າ" },
  { href: "/campaigns", label: "ແຄມເປນ" },
  { href: "/analysis", label: "ວິເຄາະ" },
  { href: "/alerts", label: "ເຕືອນ", badgeKey: "alerts" },
];

/** ໜ້າທີ່ເປີດນານໆເທື່ອ — ຢູ່ໃນເມນູ ⋯ ບໍ່ໃຫ້ແຖບເທິງແໜ້ນເກີນ */
const MORE: NavItem[] = [
  { href: "/reports", label: "ລາຍງານ", icon: "▤" },
  { href: "/orders/import", label: "ນຳເຂົ້າຍອດຂາຍ", icon: "⤒" },
  { href: "/products", label: "ສິນຄ້າ", icon: "◻" },
  { href: "/ad-accounts", label: "ບັນຊີໂຄສະນາ", icon: "▣" },
  { href: "/fb-pages", label: "ເພຈ Facebook", icon: "⚑" },
  { href: "/settings", label: "ຕັ້ງຄ່າ", icon: "⚙" },
];

/** 4 ໜ້າທີ່ໃຊ້ຫຼາຍທີ່ສຸດໃນມືຖື — ອັນອື່ນຢູ່ໃນເມນູ ☰ */
const BOTTOM: NavItem[] = [
  { href: "/", label: "ໜ້າຫຼັກ", icon: "◈" },
  { href: "/inbox", label: "ຂໍ້ຄວາມ", icon: "✉", badgeKey: "inbox" },
  { href: "/orders", label: "ອໍເດີ", icon: "▧" },
  { href: "/campaigns", label: "ແຄມເປນ", icon: "◉" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /orders/import ເປັນເມນູຂອງມັນເອງ — ບໍ່ຄວນເຮັດໃຫ້ /orders ເຂັ້ມນຳ
  if (href === "/orders") {
    return pathname !== "/orders/import" && pathname.startsWith("/orders");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * ການນຳທາງຫຼັກ — ແຖບເທິງແທນເມນູຂ້າງ.
 *
 * ເຫດຜົນ: ໜ້າວຽກຈິງຂອງລະບົບນີ້ແມ່ນ **ຕາຕະລາງກວ້າງ** (ແຄມເປນ 14 ຄໍລຳ,
 * ອໍເດີ, ລາຍງານ) — ເມນູຂ້າງກິນຄວາມກວ້າງໄປ 18rem ຕະຫຼອດເວລາ.
 * ແຖບເທິງກິນຄວາມສູງພຽງ 3.25rem ແລະ ຄືນຄວາມກວ້າງທັງໝົດໃຫ້ຂໍ້ມູນ.
 *
 * ມືຖືໃຊ້ແຖບລຸ່ມຈໍ (ນິ້ວໂປ້ເອື້ອມເຖິງ) ບວກເມນູ ☰ ສຳລັບໜ້າທີ່ເຫຼືອ.
 */
export function TopNav({
  alertCount = 0,
  inboxCount = 0,
}: {
  alertCount?: number;
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ປິດເມນູເມື່ອກົດບ່ອນອື່ນ ຫຼື ກົດ Esc — ຄາດຫວັງໄດ້ຕາມມາດຕະຖານ
  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const countOf = (key?: "alerts" | "inbox") =>
    key === "alerts" ? alertCount : key === "inbox" ? inboxCount : 0;

  return (
    <>
      <header className="topnav">
        <div className="topnav-inner mx-auto w-full max-w-[1600px] px-3 sm:px-5 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="brand-mark h-7 w-7 text-[0.8rem]">F</span>
            <span className="brand-name hidden text-sm sm:block">FBMONOY</span>
          </Link>

          {/* ຄອມ: ລາຍການເຕັມຢູ່ແຖບເທິງ */}
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.href);
              const count = countOf(item.badgeKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`nav-item ${active ? "nav-item-active" : ""}`}
                >
                  {item.label}
                  {count > 0 ? (
                    <span className="nav-count">{count > 99 ? "99+" : count}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/orders" className="btn btn-primary btn-sm hidden sm:inline-flex">
              + ເພີ່ມ Order
            </Link>

            {/* ຄອມ: ເມນູ ⋯ ສຳລັບໜ້າທີ່ໃຊ້ນານໆເທື່ອ */}
            <div ref={menuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                aria-haspopup="menu"
                className="btn btn-sm"
              >
                ອື່ນໆ ▾
              </button>
              {menu ? (
                <div className="nav-menu" role="menu">
                  {MORE.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenu(false)}
                      className="nav-menu-item"
                    >
                      <span aria-hidden className="w-4 text-center">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                  <form action={logout}>
                    <button type="submit" className="nav-menu-item">
                      <span aria-hidden className="w-4 text-center">
                        ⏻
                      </span>
                      ອອກຈາກລະບົບ
                    </button>
                  </form>
                </div>
              ) : null}
            </div>

            {/* ມືຖື: ເປີດແຜ່ນເມນູເຕັມ */}
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="btn btn-sm lg:hidden"
              aria-label="ເປີດເມນູ"
            >
              ☰
            </button>
          </div>
        </div>
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
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-8">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="grid gap-1">
              {[...PRIMARY, ...MORE].map((item) => {
                const active = isActive(pathname, item.href);
                const count = countOf(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheet(false)}
                    className={`nav-menu-item ${active ? "bg-[var(--surface-2)] font-semibold text-[var(--fg)]" : ""}`}
                  >
                    <span aria-hidden className="w-4 text-center">
                      {item.icon ?? "•"}
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
              <form action={logout} className="mt-1 border-t border-[var(--border)] pt-1">
                <button type="submit" className="nav-menu-item">
                  <span aria-hidden className="w-4 text-center">
                    ⏻
                  </span>
                  ອອກຈາກລະບົບ
                </button>
              </form>
            </div>
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
    </>
  );
}
