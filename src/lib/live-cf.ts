/**
 * ລະບົບ CF ຕອນ live — ລູກຄ້າ comment "CF A1" ເພື່ອຈອງສິນຄ້າ.
 *
 * ໄຟລ໌ນີ້**ບໍລິສຸດ** (ຫ້າມ import prisma · ມີ test ຄຸມ): ອ່ານ comment,
 * ຈັດຄິວວ່າໃຜໄດ້ຂອງ, ລວມຍອດເປັນບິນຕໍ່ຄົນ ແລະ ຂຽນຂໍ້ຄວາມສະຫຼຸບຍອດ.
 * ການອ່ານ/ຂຽນຖານຂໍ້ມູນ ແລະ ການຮ້ອງ Facebook ຢູ່ `live-server.ts`.
 *
 * **ສະຖານະ ຈອງໄດ້/ລໍຄິວ ບໍ່ໄດ້ເກັບໄວ້ — ຄິດໃໝ່ທຸກເທື່ອ** ຈາກ comment ທັງໝົດ
 * ແລະ ຈຳນວນຂອງ. ຄົນຍົກເລີກ ຫຼື ແກ້ຈຳນວນຂອງ ຄິວຈຶ່ງເລື່ອນຂຶ້ນເອງ
 * ໂດຍບໍ່ມີແຖວໃດຄ້າງສະຖານະເກົ່າ.
 */

// ------------------------------------------------------------ ອ່ານ comment

export type CfLine = { code: string; quantity: number };

export type ParsedCf = {
  /** ມີຄຳວ່າ CF ບໍ່ — ມີແຕ່ອ່ານລະຫັດບໍ່ອອກ ຕ້ອງໃຫ້ຄົນເບິ່ງ */
  isCf: boolean;
  lines: CfLine[];
};

/** ຈຳນວນຕໍ່ລາຍການທີ່ຍັງເຊື່ອວ່າຕັ້ງໃຈພິມ — ຫຼາຍກວ່ານີ້ມັກແມ່ນເບີໂທ/ລາຄາ */
export const MAX_CF_QUANTITY = 50;

/** ລະຫັດສິນຄ້າ: ຕົວອັກສອນອັງກິດ/ຕົວເລກ ຍາວບໍ່ເກີນ 12 */
export function normalizeCode(value: string): string {
  return toAsciiDigits(value.normalize("NFKC"))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/** ຕົວເລກລາວ (໐–໙) ແລະ ໄທ (๐–๙) → 0–9 */
function toAsciiDigits(value: string): string {
  return value
    .replace(/[໐-໙]/g, (d) => String(d.charCodeAt(0) - 0x0ed0))
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
}

const CF_TOKEN = /^CF/;
const QTY_ONLY = /^[X×*=]?(\d{1,3})$/;
const CODE_WITH_QTY = /^(.+?)[X×*=](\d{1,3})$/;

/**
 * ອ່ານ comment ເປັນລາຍການຈອງ.
 *
 * ຮັບສະເພາະລະຫັດທີ່ຕັ້ງໄວ້ໃນ live ນັ້ນ (`codes`) — ຄຳອື່ນໃນ comment
 * ຈຶ່ງບໍ່ຖືກອ່ານເປັນລະຫັດມົ່ວ. ຮູບແບບທີ່ຮັບ:
 * `CF A1` · `cf a1 2` · `CFA1x2` · `CF A1*2 B3` · `CF ໑໒` · `CF 12, 13`
 *
 * ຕົວເລກທີ່ຕາມຫຼັງລະຫັດທັນທີ = ຈຳນວນ. ຮ້ານທີ່ໃຊ້ລະຫັດເປັນຕົວເລກລ້ວນ
 * ຕ້ອງຂັ້ນດ້ວຍຈຸດ/ຈຸດ (`,` `+` `/`) ຈຶ່ງຈອງຫຼາຍລະຫັດໃນ comment ດຽວໄດ້.
 * ລະຫັດດຽວກັນຊ້ຳໃນ comment ດຽວ = ບວກຈຳນວນ.
 */
export function parseCf(
  message: string | null | undefined,
  codes: ReadonlySet<string>,
): ParsedCf {
  if (!message) return { isCf: false, lines: [] };

  const text = toAsciiDigits(message.normalize("NFKC")).toUpperCase();
  // ແຍກເປັນທ່ອນຕາມເຄື່ອງໝາຍຂັ້ນ ແລ້ວແຍກຄຳໃນແຕ່ລະທ່ອນ
  const segments = text.split(/[,+/\n;、，]+/);
  const tokens: { value: string; boundary: boolean }[] = [];
  for (const segment of segments) {
    const words = segment.split(/[\s:.#()[\]]+/).filter(Boolean);
    words.forEach((word, i) => tokens.push({ value: word, boundary: i === 0 }));
  }

  if (!tokens.some((t) => CF_TOKEN.test(t.value))) {
    return { isCf: false, lines: [] };
  }

  const totals = new Map<string, number>();
  let last: { code: string; hasQty: boolean } | null = null;

  const add = (code: string, quantity: number, hasQty: boolean) => {
    totals.set(code, (totals.get(code) ?? 0) + quantity);
    last = { code, hasQty };
  };

  /** ຈຳນວນຂອງລະຫັດທີ່ຫາກໍ່ອ່ານ — ຕອນອ່ານລະຫັດໃສ່ 1 ໄວ້ກ່ອນ ຈຶ່ງບວກສ່ວນທີ່ເກີນ */
  const setQty = (quantity: number) => {
    if (!last || last.hasQty) return false;
    if (quantity < 1 || quantity > MAX_CF_QUANTITY) return false;
    totals.set(last.code, (totals.get(last.code) ?? 0) + quantity - 1);
    last.hasQty = true;
    return true;
  };

  for (const { value, boundary } of tokens) {
    // "CFA1" ຕິດກັນ — ຕັດ CF ອອກແລ້ວອ່ານສ່ວນທີ່ເຫຼືອ
    // ຕົວໜັງສືລາວທີ່ຕິດມາ ("2ຊິ້ນ", "A1ເດີ") ບໍ່ແມ່ນສ່ວນຂອງລະຫັດ/ຈຳນວນ
    const word = (CF_TOKEN.test(value) ? value.slice(2) : value).replace(
      /[^\x21-\x7E×]/g,
      "",
    );
    if (!word) continue;

    // ຕົວເລກຫຼັງລະຫັດໃນທ່ອນດຽວກັນ = ຈຳນວນ
    const qtyOnly = QTY_ONLY.exec(word);
    if (qtyOnly && !boundary && setQty(Number(qtyOnly[1]))) continue;

    // "A1*2" ມີເຄື່ອງໝາຍຈຳນວນຊັດເຈນ — ອ່ານກ່ອນ ບໍ່ດັ່ງນັ້ນຈະກາຍເປັນລະຫັດ "A12".
    // ສ່ວນ "X" ເປັນຕົວອັກສອນໄດ້ ຈຶ່ງລອງເປັນລະຫັດເຕັມກ່ອນ
    const withQty = CODE_WITH_QTY.exec(word);
    const explicitQty = /[×*=]/.test(word);
    const code = normalizeCode(word);

    if (!explicitQty && codes.has(code)) {
      add(code, 1, false);
      continue;
    }

    if (withQty) {
      const base = normalizeCode(withQty[1]);
      const quantity = Number(withQty[2]);
      if (codes.has(base) && quantity >= 1 && quantity <= MAX_CF_QUANTITY) {
        add(base, quantity, true);
        continue;
      }
    }

    // "x2" ທີ່ຕາມຫຼັງທ່ອນໃໝ່ ເຊັ່ນ "CF A1 , x2" ກໍ່ຍັງເປັນຈຳນວນ
    if (qtyOnly && /^[X×*=]/.test(word)) setQty(Number(qtyOnly[1]));
  }

  return {
    isCf: true,
    lines: [...totals].map(([code, quantity]) => ({ code, quantity })),
  };
}

// ------------------------------------------------------------------ ຈັດຄິວ

export type ClaimState = "RESERVED" | "WAITLIST" | "CANCELLED" | "UNMATCHED";

export type AllocItem = {
  id: string;
  /** null = ບໍ່ຈຳກັດຈຳນວນ */
  stock: number | null;
};

export type AllocClaim = {
  id: string;
  itemId: string | null;
  quantity: number;
  commentedAt: Date;
  fbCommentId: string;
  cancelled: boolean;
  /** ອອກບິນແລ້ວ — ຂອງຖືກຕັດໄປແລ້ວແທ້ ຈຶ່ງໄດ້ກ່ອນສະເໝີ */
  ordered: boolean;
};

export type ItemCount = {
  reserved: number;
  waitlist: number;
  /** ຍັງເຫຼືອໃຫ້ຈອງ — null ເມື່ອບໍ່ຈຳກັດ */
  left: number | null;
};

export type Allocation = {
  state: Map<string, ClaimState>;
  /** ລຳດັບໃນຄິວລໍ (ເລີ່ມ 1) ຂອງແຕ່ລະສິນຄ້າ */
  queue: Map<string, number>;
  items: Map<string, ItemCount>;
};

/** ມາກ່ອນໄດ້ກ່ອນ — ຕາມເວລາທີ່ Facebook ບັນທຶກ comment ບໍ່ແມ່ນເວລາທີ່ເຮົາດຶງມາ */
export function compareClaims(a: AllocClaim, b: AllocClaim): number {
  return (
    a.commentedAt.getTime() - b.commentedAt.getTime() ||
    a.fbCommentId.localeCompare(b.fbCommentId) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * ຈັດວ່າໃຜໄດ້ຂອງ.
 *
 * - ຂອງທີ່ອອກບິນແລ້ວໄດ້ກ່ອນສະເໝີ — ຄົນກົດ "ຄືນ" comment ເກົ່າພາຍຫຼັງ
 *   ຈະບໍ່ດຶງຂອງອອກຈາກບິນທີ່ສ້າງແລ້ວ.
 * - ນອກນັ້ນຕາມລຳດັບເວລາ comment. ຈຳນວນທີ່ຂໍເກີນຂອງທີ່ເຫຼືອ = ລໍຄິວທັງລາຍການ
 *   (ບໍ່ແບ່ງໃຫ້ບາງສ່ວນ) ແຕ່ບໍ່ກັນຄົນຫຼັງທີ່ຂໍໜ້ອຍກວ່າ ແລະ ຍັງພໍ.
 */
export function allocateClaims(
  items: readonly AllocItem[],
  claims: readonly AllocClaim[],
): Allocation {
  const state = new Map<string, ClaimState>();
  const queue = new Map<string, number>();
  const counts = new Map<string, ItemCount>(
    items.map((item) => [item.id, { reserved: 0, waitlist: 0, left: item.stock }]),
  );

  const waiting = new Map<string, number>();

  const sorted = [...claims].sort(
    (a, b) => Number(b.ordered) - Number(a.ordered) || compareClaims(a, b),
  );

  for (const claim of sorted) {
    const count = claim.itemId ? counts.get(claim.itemId) : undefined;
    if (!count) {
      state.set(claim.id, claim.cancelled ? "CANCELLED" : "UNMATCHED");
      continue;
    }
    if (claim.cancelled && !claim.ordered) {
      state.set(claim.id, "CANCELLED");
      continue;
    }

    const fits = count.left === null || claim.quantity <= count.left || claim.ordered;
    if (fits) {
      count.reserved += claim.quantity;
      if (count.left !== null) count.left = Math.max(0, count.left - claim.quantity);
      state.set(claim.id, "RESERVED");
    } else {
      count.waitlist += claim.quantity;
      state.set(claim.id, "WAITLIST");
      const position = (waiting.get(claim.itemId!) ?? 0) + 1;
      waiting.set(claim.itemId!, position);
      queue.set(claim.id, position);
    }
  }

  return { state, queue, items: counts };
}

// ------------------------------------------------------------ ລວມເປັນບິນ

/** ຄົນດຽວກັນ — ໃຊ້ id ຂອງ Facebook ຖ້າມີ ບໍ່ດັ່ງນັ້ນໃຊ້ຊື່ */
export function customerKey(fromId: string | null, fromName: string | null): string {
  if (fromId) return `id:${fromId}`;
  return `name:${(fromName ?? "").trim().toLowerCase() || "?"}`;
}

export type BillClaim = {
  id: string;
  fromId: string | null;
  fromName: string | null;
  quantity: number;
  commentedAt: Date;
  item: {
    id: string;
    code: string;
    name: string;
    productId: string | null;
    price: number;
    cost: number;
  };
};

export type BillLine = {
  itemId: string;
  code: string;
  name: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type Bill = {
  key: string;
  fromId: string | null;
  fromName: string;
  lines: BillLine[];
  claimIds: string[];
  quantity: number;
  saleAmount: number;
  productCost: number;
};

/**
 * ລວມລາຍການທີ່ຈອງໄດ້ເປັນ 1 ບິນຕໍ່ຄົນ — ລະຫັດດຽວກັນຫຼາຍ comment ລວມເປັນແຖວດຽວ.
 * ລາຄາ/ຕົ້ນທຶນເອົາຕາມທີ່ຕັ້ງໃນ live ຕອນອອກບິນ (snapshot ຄືກັບ Order ທົ່ວໄປ).
 */
export function buildBills(claims: readonly BillClaim[]): Bill[] {
  const bills = new Map<string, Bill & { lineMap: Map<string, BillLine> }>();

  const sorted = [...claims].sort(
    (a, b) => a.commentedAt.getTime() - b.commentedAt.getTime(),
  );

  for (const claim of sorted) {
    const key = customerKey(claim.fromId, claim.fromName);
    let bill = bills.get(key);
    if (!bill) {
      bill = {
        key,
        fromId: claim.fromId,
        fromName: claim.fromName?.trim() || "ບໍ່ຮູ້ຊື່",
        lines: [],
        claimIds: [],
        quantity: 0,
        saleAmount: 0,
        productCost: 0,
        lineMap: new Map(),
      };
      bills.set(key, bill);
    }

    let line = bill.lineMap.get(claim.item.id);
    if (!line) {
      line = {
        itemId: claim.item.id,
        code: claim.item.code,
        name: claim.item.name,
        productId: claim.item.productId,
        quantity: 0,
        unitPrice: claim.item.price,
        unitCost: claim.item.cost,
      };
      bill.lineMap.set(claim.item.id, line);
      bill.lines.push(line);
    }

    line.quantity += claim.quantity;
    bill.claimIds.push(claim.id);
    bill.quantity += claim.quantity;
    bill.saleAmount += claim.quantity * claim.item.price;
    bill.productCost += claim.quantity * claim.item.cost;
  }

  return [...bills.values()].map(({ lineMap: _, ...bill }) => bill);
}

/** ສິນຄ້າຂອງ Order — ຜູກໄດ້ກໍ່ຕໍ່ເມື່ອທຸກແຖວເປັນສິນຄ້າດຽວກັນ */
export function singleProductId(lines: readonly { productId: string | null }[]): string | null {
  const ids = new Set(lines.map((l) => l.productId));
  if (ids.size !== 1) return null;
  return [...ids][0];
}

// ------------------------------------------------------- ຂໍ້ຄວາມສະຫຼຸບຍອດ

export const DEFAULT_SUMMARY_TEMPLATE = [
  "ສະບາຍດີ {name} 🙏",
  "ຂອບໃຈທີ່ CF ໃນ live ຂອງພວກເຮົາ ລາຍການຂອງທ່ານ:",
  "{items}",
  "ລວມ {total}",
  "ກະລຸນາສົ່ງ ຊື່ · ເບີໂທ · ທີ່ຢູ່ ເພື່ອຈັດສົ່ງ",
].join("\n");

/**
 * ຂຽນຂໍ້ຄວາມສະຫຼຸບຍອດຈາກແມ່ແບບ — `{name}` `{items}` `{total}` `{count}`.
 * `formatPrice` ສົ່ງເຂົ້າມາ ເພາະຂໍ້ຄວາມຫາລູກຄ້າເປັນກີບສະເໝີ
 * ບໍ່ຂຶ້ນກັບສະກຸນທີ່ຜູ້ໃຊ້ເລືອກເບິ່ງໃນໜ້າຈໍ.
 */
export function renderSummary(
  template: string,
  bill: {
    name: string;
    lines: readonly { code: string; name: string; quantity: number; unitPrice: number }[];
    total: number;
  },
  formatPrice: (value: number) => string,
): string {
  const items = bill.lines
    .map(
      (line) =>
        `• ${line.code} ${line.name} × ${line.quantity} = ${formatPrice(line.quantity * line.unitPrice)}`,
    )
    .join("\n");
  const count = bill.lines.reduce((sum, line) => sum + line.quantity, 0);

  return template
    .replaceAll("{name}", bill.name)
    .replaceAll("{items}", items)
    .replaceAll("{total}", formatPrice(bill.total))
    .replaceAll("{count}", String(count))
    .trim();
}

/** Facebook ໃຫ້ private reply ພາຍໃນ 7 ວັນນັບຈາກເວລາ comment */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function canPrivateReply(commentedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - commentedAt.getTime() < PRIVATE_REPLY_WINDOW_MS;
}

/**
 * ຈາກ URL ຫຼື id ທີ່ຄົນວາງໃສ່ — ເອົາ id ວິດີໂອອອກມາ.
 * ຮັບ: `123456`, `.../videos/123456/`, `...?v=123456`, `.../live/?v=123`,
 * ແລະ id ແບບ `<page>_<post>`.
 */
export function extractVideoId(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^\d+(_\d+)?$/.test(value)) return value;
  const fromPath = /\/videos\/(?:[^/]+\/)?(\d{6,})/.exec(value);
  if (fromPath) return fromPath[1];
  const fromQuery = /[?&](?:v|video_id|story_fbid)=(\d{6,})/.exec(value);
  if (fromQuery) return fromQuery[1];
  return null;
}
