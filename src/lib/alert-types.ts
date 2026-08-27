/**
 * ໂຄງຂອງການແຈ້ງເຕືອນ — ແຍກໄຟລ໌ໄວ້ບໍ່ໃຫ້ພົວພັນກັບ prisma
 * ເພື່ອໃຫ້ກົດການເຕືອນທີ່ເປັນຟັງຊັນບໍລິສຸດ (ເຊັ່ນ `sync-health.ts`) ທົດສອບໄດ້.
 */

/** ຄວາມຮ້າຍແຮງ — ຮຽງຈາກໜັກໄປເບົາ */
export type Severity = "critical" | "serious" | "warning" | "info";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  warning: 2,
  info: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "ດ່ວນຫຼາຍ",
  serious: "ຕ້ອງເບິ່ງ",
  warning: "ລະວັງ",
  info: "ຮັບຮູ້ໄວ້",
};

export const SEVERITY_TONE: Record<Severity, string> = {
  critical: "danger",
  serious: "danger",
  warning: "warning",
  info: "info",
};

/** ໄອຄອນຄູ່ກັບປ້າຍຄຳ — ບໍ່ໃຫ້ຄວາມໝາຍຂຶ້ນກັບສີຢ່າງດຽວ */
export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "⛔",
  serious: "▲",
  warning: "⚠",
  info: "ℹ",
};

export type Alert = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  href?: string;
};

/**
 * ຮຽງການແຈ້ງເຕືອນ — ໜັກສຸດຂຶ້ນກ່ອນສະເໝີ.
 *
 * ສຳຄັນເພາະໜ້າຫຼັກສະແດງພຽງສອງສາມອັນທຳອິດ — ຖ້າ "ງົບລວມໝົດແລ້ວ"
 * ຕົກໄປຢູ່ລຳດັບ 9 ຄົນຈະບໍ່ເຫັນມັນຈົນກວ່າຈະສາຍ.
 * ຄວາມຮ້າຍແຮງເທົ່າກັນຈຶ່ງຮຽງຕາມຊື່ ເພື່ອໃຫ້ລຳດັບຄົງທີ່ບໍ່ກະໂດດໄປມາ.
 */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.title.localeCompare(b.title),
  );
}

/** ນັບການແຈ້ງເຕືອນທີ່ຕ້ອງລົງມືເຮັດ (ບໍ່ນັບລະດັບ “ຮັບຮູ້ໄວ້”) */
export function countActionable(alerts: Alert[]): number {
  return alerts.filter((a) => a.severity !== "info").length;
}
