/**
 * ໄອຄອນຂອງເມນູ — ວາດເປັນ SVG ເສັ້ນຊຸດດຽວກັນ.
 *
 * ຂອງເກົ່າໃຊ້ຕົວອັກສອນສັນຍາລັກ (▧ ▣ ▤ ◈ ◑) ເຊິ່ງມີ 2 ບັນຫາ:
 * ຮູບຮ່າງຄ້າຍກັນຈົນ "ອໍເດີ / ບັນຊີໂຄສະນາ / ລາຍງານ" ແຍກບໍ່ອອກດ້ວຍຫາງຕາ
 * ແລະ ນ້ຳໜັກເສັ້ນຂອງແຕ່ລະຕົວຂຶ້ນກັບຟອນຂອງເຄື່ອງ ຈຶ່ງບໍ່ສະໝ່ຳສະເໝີ.
 *
 * ທຸກໄອຄອນຢູ່ຕາຂ່າຍ 24×24 ນ້ຳໜັກເສັ້ນ 1.6 ແລະ ໃຊ້ `currentColor`
 * ຈຶ່ງປ່ຽນສີຕາມສະຖານະຂອງລາຍການເອງ ແລະ ຄົມທັງໂໝດແຈ້ງ/ມືດ.
 */

export type IconName =
  | "home"
  | "inbox"
  | "queue"
  | "orders"
  | "leads"
  | "campaigns"
  | "analysis"
  | "behavior"
  | "alerts"
  | "reports"
  | "import"
  | "products"
  | "adAccounts"
  | "billing"
  | "playbook"
  | "pages"
  | "settings"
  | "logout"
  | "menu";

/** ເສັ້ນຂອງແຕ່ລະໄອຄອນ — ຫໍ່ດ້ວຍ <svg> ຂ້າງລຸ່ມ */
const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M6 9.6V20h12V9.6" />
      <path d="M10 20v-4.4h4V20" />
    </>
  ),
  inbox: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 6.8 8.2 6 8.2-6" />
    </>
  ),
  // ລາຍການມີເຄື່ອງໝາຍຖືກ + ໂມງ — "ວຽກທີ່ລໍຢູ່"
  queue: (
    <>
      <path d="M4 6.5h9M4 12h6M4 17.5h5" />
      <circle cx="16.8" cy="16.2" r="4.4" />
      <path d="M16.8 14v2.4l1.6 1" />
    </>
  ),
  orders: (
    <>
      <path d="M6.5 3.5h11v17l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4z" />
      <path d="M9.5 8.5h5M9.5 12h5" />
    </>
  ),
  leads: (
    <>
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.6 19.4a5.9 5.9 0 0 1 11.8 0" />
      <path d="M16.4 6.5a3 3 0 0 1 0 5.4" />
      <path d="M17.6 14.4a5.4 5.4 0 0 1 2.9 4.4" />
    </>
  ),
  campaigns: (
    <>
      <path d="M4 14.2V9.8a1 1 0 0 1 1-1h3l6-3.6v13.6l-6-3.6H5a1 1 0 0 1-1-1z" />
      <path d="M8 15.2v3.3a1.6 1.6 0 0 0 3.2 0v-2.4" />
      <path d="M17.4 9.4a3.6 3.6 0 0 1 0 5.2" />
    </>
  ),
  analysis: (
    <>
      <path d="M4 20h16" />
      <path d="M7.2 20v-5.6M12 20V6.5M16.8 20v-8.4" />
    </>
  ),
  behavior: (
    <>
      <path d="M3 12.6h3.2l2.1-5.4 3 10.4 2.2-6.2 1.5 3H21" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 4.2a5 5 0 0 0-5 5v3.1L5.6 15.4h12.8L17 12.3V9.2a5 5 0 0 0-5-5z" />
      <path d="M10.2 18a1.8 1.8 0 0 0 3.6 0" />
    </>
  ),
  reports: (
    <>
      <path d="M6.2 3.5h7.6l4 4v13H6.2z" />
      <path d="M13.6 3.5v4.2h4.2" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  import: (
    <>
      <path d="M12 14.6V3.8" />
      <path d="M8.2 7.4 12 3.6l3.8 3.8" />
      <path d="M4.6 14.6v3.8a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-3.8" />
    </>
  ),
  products: (
    <>
      <path d="m12 3.4 8 4.2v8.8l-8 4.2-8-4.2V7.6z" />
      <path d="m4 7.6 8 4.2 8-4.2" />
      <path d="M12 11.8V20.6" />
    </>
  ),
  adAccounts: (
    <>
      <rect x="3" y="5.4" width="18" height="13.2" rx="2" />
      <path d="M3 10h18" />
      <path d="M6.6 14.4h3.8" />
    </>
  ),
  billing: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.4 9.6h.01M17.6 14.4h.01" />
    </>
  ),
  // ແຜນທີ່ + ທຸງ — "ວິທີໄປໃຫ້ຮອດເປົ້າ"
  playbook: (
    <>
      <path d="M3.4 6.4 9 4.2l6 2.2 5.6-2.2v13.4L15 19.8l-6-2.2-5.6 2.2z" />
      <path d="M9 4.2v13.4M15 6.4v13.4" />
    </>
  ),
  pages: (
    <>
      <path d="M6 20.6V4" />
      <path d="M6 4.8h10.6l-1.9 3.5 1.9 3.5H6" />
    </>
  ),
  // ໃຊ້ "ຕົວປັບ" ບໍ່ແມ່ນເຟືອງ — ເຟືອງທີ່ວາດດ້ວຍເສັ້ນບາງໆ ຢູ່ຂະໜາດ 17px
  // ອ່ານອອກມາຄືໄອຄອນຄວາມແຈ້ງ (ດວງອາທິດ) ຫຼາຍກວ່າ
  settings: (
    <>
      <path d="M4 8.4h8.4M17.4 8.4H20" />
      <circle cx="14.9" cy="8.4" r="2.2" />
      <path d="M4 15.6h2.6M11.6 15.6H20" />
      <circle cx="9.1" cy="15.6" r="2.2" />
    </>
  ),
  logout: (
    <>
      <path d="M12 3.6v7.6" />
      <path d="M7.6 6.6a7 7 0 1 0 8.8 0" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "nav-svg",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      // ໃສ່ຂະໜາດຕິດຕົວໄວ້ນຳ — ຖ້າ CSS ຍັງມາບໍ່ທັນ (ຫຼື ໂຫຼດລົ້ມ)
      // SVG ທີ່ບໍ່ມີຂະໜາດຈະຢືດເຕັມຈໍ ແລ້ວໜ້າຈໍພັງທັງໜ້າ
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
