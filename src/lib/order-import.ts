import { normalizeHeader, parseCsv } from "./csv";
import { OrderStatus } from "@/generated/prisma/enums";

/**
 * ນຳເຂົ້າຍອດຂາຍເກົ່າຈາກ CSV/Excel.
 *
 * ຄົນເກັບຍອດຂາຍໄວ້ໃນ Excel ຢູ່ແລ້ວ — ບັງຄັບໃຫ້ພິມຄືນທັງໝົດຈະບໍ່ມີໃຜເຮັດ.
 * ໄຟລ໌ນີ້ຈຶ່ງ **ເດົາຫົວຄໍລຳໃຫ້ອັດຕະໂນມັດ** ທັງພາສາລາວ, ໄທ ແລະ ອັງກິດ
 * ແລ້ວໃຫ້ຄົນເບິ່ງຕົວຢ່າງກ່ອນວ່າຈັບຄູ່ຖືກບໍ່ ຈຶ່ງຄ່ອຍບັນທຶກຈິງ.
 *
 * ສ່ວນນີ້**ບໍລິສຸດ** (ບໍ່ແຕະຖານຂໍ້ມູນ) ຈຶ່ງທົດສອບໄດ້ໄວ — ການບັນທຶກຢູ່ actions.
 */

export type OrderField =
  | "date"
  | "orderNo"
  | "customerName"
  | "phone"
  | "channel"
  | "campaign"
  | "product"
  | "quantity"
  | "saleAmount"
  | "productCost"
  | "shippingCost"
  | "otherCost"
  | "refundAmount"
  | "status"
  | "trackingNo"
  | "note";

/** ຄຳທີ່ພົບຈິງໃນໄຟລ໌ຄົນລາວ — ຮຽງຈາກສະເພາະໄປຫາກວ້າງ */
const HEADER_ALIASES: Record<OrderField, string[]> = {
  date: ["ວັນທີ່", "ວັນທີ", "ວັນ", "วันที่", "date", "orderdate", "ວັນສັ່ງ"],
  orderNo: ["ເລກອໍເດີ", "ເລກorder", "orderno", "orderid", "เลขออเดอร์", "ລະຫັດ"],
  customerName: [
    "ຊື່ລູກຄ້າ",
    "ລູກຄ້າ",
    "ຊື່",
    "ชื่อลูกค้า",
    "customername",
    "customer",
    "name",
  ],
  phone: ["ເບີໂທ", "ເບີ", "ໂທ", "เบอร์", "phone", "tel", "mobile"],
  channel: ["ຊ່ອງທາງ", "ช่องทาง", "channel", "source"],
  campaign: ["ແຄມເປນ", "ໂຄສະນາ", "แคมเปญ", "campaign", "campaignname", "ads"],
  product: ["ສິນຄ້າ", "ຜະລິດຕະພັນ", "สินค้า", "product", "productname", "item", "sku"],
  quantity: ["ຈຳນວນ", "จำนวน", "quantity", "qty", "ຈຳນວນຊິ້ນ"],
  saleAmount: [
    "ຍອດຂາຍ",
    "ລາຄາຂາຍ",
    "ຍອດ",
    "ยอดขาย",
    "saleamount",
    "amount",
    "total",
    "revenue",
    "price",
  ],
  productCost: ["ຕົ້ນທຶນ", "ຕົ້ນທຶນສິນຄ້າ", "ต้นทุน", "productcost", "cost", "cogs"],
  shippingCost: ["ຄ່າສົ່ງ", "ค่าส่ง", "shippingcost", "shipping", "delivery"],
  otherCost: ["ຄ່າອື່ນ", "ຄ່າໃຊ້ຈ່າຍອື່ນ", "othercost", "other", "fee"],
  refundAmount: ["ເງິນຄືນ", "คืนเงิน", "refund", "refundamount"],
  status: ["ສະຖານະ", "สถานะ", "status", "orderstatus"],
  trackingNo: ["ເລກພັດສະດຸ", "ພັດສະດຸ", "tracking", "trackingno", "trackingnumber"],
  note: ["ໝາຍເຫດ", "หมายเหตุ", "note", "remark", "comment"],
};

export type ColumnMap = Partial<Record<OrderField, number>>;

/** ຈັບຄູ່ຫົວຄໍລຳກັບຊ່ອງທີ່ລະບົບຮູ້ຈັກ */
export function detectColumns(headers: string[]): ColumnMap {
  const norm = headers.map(normalizeHeader);
  const map: ColumnMap = {};
  const taken = new Set<number>();

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    OrderField,
    string[],
  ][]) {
    // ຫາແບບຕົງກັນເປະກ່ອນ ຈຶ່ງຄ່ອຍຫາແບບມີຄຳນັ້ນຢູ່ຂ້າງໃນ
    let idx = norm.findIndex(
      (h, i) => !taken.has(i) && aliases.some((a) => h === normalizeHeader(a)),
    );
    if (idx === -1) {
      idx = norm.findIndex(
        (h, i) =>
          !taken.has(i) &&
          h.length > 1 &&
          aliases.some((a) => h.includes(normalizeHeader(a))),
      );
    }
    if (idx !== -1) {
      map[field] = idx;
      taken.add(idx);
    }
  }
  return map;
}

/** ຄຳສະຖານະທີ່ຄົນຂຽນຈິງ → ສະຖານະໃນລະບົບ */
const STATUS_WORDS: Array<[OrderStatus, string[]]> = [
  [OrderStatus.DELIVERED, ["ສຳເລັດ", "ຮັບແລ້ວ", "ສົ່ງສຳເລັດ", "delivered", "done", "complete", "สำเร็จ"]],
  [OrderStatus.RETURNED, ["ຕີກັບ", "ຄືນ", "returned", "return", "ตีกลับ"]],
  [OrderStatus.CANCELLED, ["ຍົກເລີກ", "cancel", "cancelled", "canceled", "ยกเลิก"]],
  [OrderStatus.SHIPPED, ["ສົ່ງແລ້ວ", "ສົ່ງອອກ", "shipped", "ส่งแล้ว"]],
  [OrderStatus.CONFIRMED, ["ຢືນຢັນ", "confirmed", "confirm", "ยืนยัน"]],
  [OrderStatus.PENDING, ["ລໍ", "ລໍຖ້າ", "ສັ່ງແລ້ວ", "pending", "new", "รอ"]],
];

export function parseStatus(raw: string | undefined): OrderStatus {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return OrderStatus.DELIVERED; // ຍອດຂາຍເກົ່າທີ່ນຳເຂົ້າ ປົກກະຕິແມ່ນຈົບແລ້ວ
  for (const [status, words] of STATUS_WORDS) {
    if (words.some((w) => v.includes(w.toLowerCase()))) return status;
  }
  return OrderStatus.DELIVERED;
}

/** ຕົວເລກທີ່ມີຈຸດຄັ່ນຫຼັກພັນ, ສັນຍາລັກເງິນ ຫຼື ວົງເລັບ (ຄ່າລົບແບບບັນຊີ) */
export function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

/**
 * ວັນທີ່ — ຮັບ `YYYY-MM-DD`, `DD/MM/YYYY`, `D-M-YY` ແລະ ຮູບແບບທີ່ Excel ອອກ.
 * ຄືນ `null` ຖ້າອ່ານບໍ່ໄດ້ ເພື່ອໃຫ້ແຖວນັ້ນຖືກລາຍງານເປັນຜິດພາດ ບໍ່ແມ່ນເດົາຊົ່ວໆ.
 */
export function parseFlexibleDate(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;

  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return build(+iso[1], +iso[2], +iso[3]);

  const dmy = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    let year = +dmy[3];
    if (year < 100) year += 2000;
    // ປີພຸດທະສັກກະລາດ (ຄົນລາວ/ໄທໃຊ້ຫຼາຍ) → ຄ.ສ.
    if (year > 2400) year -= 543;
    return build(year, +dmy[2], +dmy[1]);
  }
  return null;

  function build(y: number, m: number, d: number): string | null {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
}

export type ParsedOrder = {
  rowNumber: number;
  date: string;
  orderNo: string | null;
  customerName: string;
  phone: string | null;
  channel: string | null;
  campaignName: string | null;
  productName: string | null;
  quantity: number;
  saleAmount: number;
  productCost: number;
  shippingCost: number;
  otherCost: number;
  refundAmount: number;
  status: OrderStatus;
  trackingNo: string | null;
  note: string | null;
};

export type RowError = { rowNumber: number; message: string };

export type ParseResult = {
  headers: string[];
  map: ColumnMap;
  orders: ParsedOrder[];
  errors: RowError[];
  /** ຊ່ອງທີ່ຈຳເປັນແຕ່ຈັບຄູ່ບໍ່ໄດ້ — ບອກໄວ້ກ່ອນນຳເຂົ້າ */
  missing: OrderField[];
};

const REQUIRED: OrderField[] = ["date", "saleAmount"];

/**
 * ອ່ານ CSV ທັງກ້ອນເປັນລາຍການອໍເດີ.
 * `fxRate` ໃສ່ເມື່ອຕົວເລກໃນໄຟລ໌ເປັນໂດລາ — ຖານຂໍ້ມູນເກັບເປັນກີບສະເໝີ.
 */
export function parseOrderCsv(
  text: string,
  opts: { fxRate?: number } = {},
): ParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { headers: [], map: {}, orders: [], errors: [], missing: REQUIRED };
  }

  const headers = rows[0];
  const map = detectColumns(headers);
  const missing = REQUIRED.filter((f) => map[f] === undefined);

  const orders: ParsedOrder[] = [];
  const errors: RowError[] = [];
  const rate = opts.fxRate && opts.fxRate > 0 ? opts.fxRate : 1;

  const at = (row: string[], field: OrderField): string | undefined => {
    const i = map[field];
    return i === undefined ? undefined : row[i];
  };
  const money = (row: string[], field: OrderField): number =>
    Math.round(parseNumber(at(row, field)) * rate);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1; // ນັບແບບດຽວກັບ Excel (ແຖວ 1 ຄືຫົວຄໍລຳ)

    if (missing.length > 0) break;

    const date = parseFlexibleDate(at(row, "date"));
    if (!date) {
      errors.push({
        rowNumber,
        message: `ອ່ານວັນທີ່ບໍ່ໄດ້: "${at(row, "date") ?? ""}"`,
      });
      continue;
    }

    const saleAmount = money(row, "saleAmount");
    if (saleAmount <= 0) {
      errors.push({
        rowNumber,
        message: `ຍອດຂາຍຕ້ອງຫຼາຍກວ່າ 0 (ໄດ້ "${at(row, "saleAmount") ?? ""}")`,
      });
      continue;
    }

    const quantity = Math.max(1, Math.round(parseNumber(at(row, "quantity"))));

    orders.push({
      rowNumber,
      date,
      orderNo: at(row, "orderNo")?.trim() || null,
      customerName: at(row, "customerName")?.trim() || `ລູກຄ້າ ແຖວ ${rowNumber}`,
      phone: at(row, "phone")?.trim() || null,
      channel: at(row, "channel")?.trim() || null,
      campaignName: at(row, "campaign")?.trim() || null,
      productName: at(row, "product")?.trim() || null,
      quantity,
      saleAmount,
      productCost: money(row, "productCost"),
      shippingCost: money(row, "shippingCost"),
      otherCost: money(row, "otherCost"),
      refundAmount: money(row, "refundAmount"),
      status: parseStatus(at(row, "status")),
      trackingNo: at(row, "trackingNo")?.trim() || null,
      note: at(row, "note")?.trim() || null,
    });
  }

  return { headers, map, orders, errors, missing };
}

/** ຊື່ຊ່ອງເປັນພາສາລາວ — ໃຊ້ສະແດງຕາຕະລາງການຈັບຄູ່ */
export const FIELD_LABEL: Record<OrderField, string> = {
  date: "ວັນທີ່",
  orderNo: "ເລກອໍເດີ",
  customerName: "ຊື່ລູກຄ້າ",
  phone: "ເບີໂທ",
  channel: "ຊ່ອງທາງ",
  campaign: "ແຄມເປນ",
  product: "ສິນຄ້າ",
  quantity: "ຈຳນວນ",
  saleAmount: "ຍອດຂາຍ",
  productCost: "ຕົ້ນທຶນສິນຄ້າ",
  shippingCost: "ຄ່າສົ່ງ",
  otherCost: "ຄ່າອື່ນ",
  refundAmount: "ເງິນຄືນ",
  status: "ສະຖານະ",
  trackingNo: "ເລກພັດສະດຸ",
  note: "ໝາຍເຫດ",
};

export const IMPORT_FIELDS = Object.keys(FIELD_LABEL) as OrderField[];
