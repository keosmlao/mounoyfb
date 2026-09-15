import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateClaims,
  buildBills,
  canPrivateReply,
  customerKey,
  extractVideoId,
  parseCf,
  renderSummary,
  singleProductId,
  type AllocClaim,
} from "./live-cf";

const CODES = new Set(["A1", "A2", "B3", "12", "13"]);
const parse = (message: string) => parseCf(message, CODES);

test("ອ່ານ CF ຮູບແບບທີ່ລູກຄ້າພິມແທ້", () => {
  assert.deepEqual(parse("CF A1").lines, [{ code: "A1", quantity: 1 }]);
  assert.deepEqual(parse("cf a1 2").lines, [{ code: "A1", quantity: 2 }]);
  assert.deepEqual(parse("CFA1x2").lines, [{ code: "A1", quantity: 2 }]);
  assert.deepEqual(parse("CF A1*3 B3").lines, [
    { code: "A1", quantity: 3 },
    { code: "B3", quantity: 1 },
  ]);
  assert.deepEqual(parse("ຂໍ CF A1 x 2 ເດີ").lines, [{ code: "A1", quantity: 2 }]);
  assert.deepEqual(parse("CF A1 2ຊິ້ນ").lines, [{ code: "A1", quantity: 2 }]);
  assert.deepEqual(parse("CF: a2").lines, [{ code: "A2", quantity: 1 }]);
});

test("ຕົວເລກລາວ ແລະ ໄທ ອ່ານເປັນຕົວເລກ", () => {
  assert.deepEqual(parse("CF ໑໒").lines, [{ code: "12", quantity: 1 }]);
  assert.deepEqual(parse("CF A1 ๒").lines, [{ code: "A1", quantity: 2 }]);
});

test("ລະຫັດຕົວເລກລ້ວນ — ຈຸດຂັ້ນແຍກລະຫັດ ບໍ່ດັ່ງນັ້ນເລກຕໍ່ມາຄືຈຳນວນ", () => {
  assert.deepEqual(parse("CF 12, 13").lines, [
    { code: "12", quantity: 1 },
    { code: "13", quantity: 1 },
  ]);
  assert.deepEqual(parse("CF 12 13").lines, [{ code: "12", quantity: 13 }]);
});

test("A1*2 ບໍ່ຖືກອ່ານເປັນລະຫັດ A12 ເຖິງມີລະຫັດນັ້ນ", () => {
  const lines = parseCf("CF A1*2", new Set(["A1", "A12"])).lines;
  assert.deepEqual(lines, [{ code: "A1", quantity: 2 }]);
});

test("ລະຫັດຊ້ຳໃນ comment ດຽວ ບວກຈຳນວນ", () => {
  assert.deepEqual(parse("CF A1 CF A1 2").lines, [{ code: "A1", quantity: 3 }]);
});

test("ບໍ່ມີ CF = ບໍ່ແມ່ນການຈອງ · ມີ CF ແຕ່ລະຫັດບໍ່ຮູ້ຈັກ = ຕ້ອງໃຫ້ຄົນເບິ່ງ", () => {
  assert.deepEqual(parse("A1 ລາຄາເທົ່າໃດ"), { isCf: false, lines: [] });
  assert.deepEqual(parse(""), { isCf: false, lines: [] });
  assert.deepEqual(parse("CF Z9"), { isCf: true, lines: [] });
});

test("ຈຳນວນເກີນເພດານບໍ່ນັບ (ມັກແມ່ນເບີໂທ/ລາຄາ)", () => {
  assert.deepEqual(parse("CF A1 2055").lines, [{ code: "A1", quantity: 1 }]);
  assert.deepEqual(parse("CF A1 99").lines, [{ code: "A1", quantity: 1 }]);
});

// ---------------------------------------------------------------- ຈັດຄິວ

let seq = 0;
function claim(
  itemId: string | null,
  minute: number,
  extra: Partial<AllocClaim> = {},
): AllocClaim {
  seq++;
  return {
    id: `c${seq}`,
    itemId,
    quantity: 1,
    commentedAt: new Date(Date.UTC(2026, 8, 15, 12, minute)),
    fbCommentId: `fb${String(seq).padStart(3, "0")}`,
    cancelled: false,
    ordered: false,
    ...extra,
  };
}

test("ມາກ່ອນໄດ້ກ່ອນ ຕາມເວລາ comment ບໍ່ແມ່ນລຳດັບທີ່ດຶງມາ", () => {
  const late = claim("a", 5);
  const early = claim("a", 1);
  const result = allocateClaims([{ id: "a", stock: 1 }], [late, early]);
  assert.equal(result.state.get(early.id), "RESERVED");
  assert.equal(result.state.get(late.id), "WAITLIST");
  assert.equal(result.queue.get(late.id), 1);
  assert.deepEqual(result.items.get("a"), { reserved: 1, waitlist: 1, left: 0 });
});

test("ຍົກເລີກແລ້ວ ຄິວຖັດໄປໄດ້ຂອງແທນເອງ", () => {
  const first = claim("a", 1, { cancelled: true });
  const second = claim("a", 2);
  const result = allocateClaims([{ id: "a", stock: 1 }], [first, second]);
  assert.equal(result.state.get(first.id), "CANCELLED");
  assert.equal(result.state.get(second.id), "RESERVED");
});

test("ຂໍເກີນຂອງທີ່ເຫຼືອ = ລໍຄິວ ແຕ່ບໍ່ກັນຄົນຫຼັງທີ່ຂໍໜ້ອຍກວ່າ", () => {
  const a = claim("a", 1, { quantity: 2 });
  const big = claim("a", 2, { quantity: 3 });
  const small = claim("a", 3, { quantity: 1 });
  const result = allocateClaims([{ id: "a", stock: 3 }], [a, big, small]);
  assert.equal(result.state.get(a.id), "RESERVED");
  assert.equal(result.state.get(big.id), "WAITLIST");
  assert.equal(result.state.get(small.id), "RESERVED");
  assert.deepEqual(result.items.get("a"), { reserved: 3, waitlist: 3, left: 0 });
});

test("ອອກບິນແລ້ວໄດ້ກ່ອນສະເໝີ — ຄືນ comment ເກົ່າບໍ່ດຶງຂອງອອກຈາກບິນ", () => {
  const restored = claim("a", 1);
  const billed = claim("a", 2, { ordered: true });
  const result = allocateClaims([{ id: "a", stock: 1 }], [restored, billed]);
  assert.equal(result.state.get(billed.id), "RESERVED");
  assert.equal(result.state.get(restored.id), "WAITLIST");
});

test("ບໍ່ຈຳກັດຈຳນວນ ແລະ ລະຫັດທີ່ບໍ່ຮູ້ຈັກ", () => {
  const x = claim("a", 1, { quantity: 40 });
  const unknown = claim(null, 2);
  const result = allocateClaims([{ id: "a", stock: null }], [x, unknown]);
  assert.equal(result.state.get(x.id), "RESERVED");
  assert.equal(result.state.get(unknown.id), "UNMATCHED");
  assert.deepEqual(result.items.get("a"), { reserved: 40, waitlist: 0, left: null });
});

// ------------------------------------------------------------ ລວມເປັນບິນ

const itemA = { id: "a", code: "A1", name: "ເສື້ອ", productId: "p1", price: 100_000, cost: 60_000 };
const itemB = { id: "b", code: "B3", name: "ໝວກ", productId: "p2", price: 50_000, cost: 20_000 };

test("1 ຄົນ = 1 ບິນ · ລະຫັດດຽວກັນຫຼາຍ comment ລວມເປັນແຖວດຽວ", () => {
  const at = (m: number) => new Date(Date.UTC(2026, 8, 15, 12, m));
  const bills = buildBills([
    { id: "1", fromId: "u1", fromName: "ນາງ ແກ້ວ", quantity: 1, commentedAt: at(1), item: itemA },
    { id: "2", fromId: "u2", fromName: "ທ້າວ ບຸນ", quantity: 1, commentedAt: at(2), item: itemB },
    { id: "3", fromId: "u1", fromName: "ນາງ ແກ້ວ", quantity: 2, commentedAt: at(3), item: itemA },
    { id: "4", fromId: "u1", fromName: "ນາງ ແກ້ວ", quantity: 1, commentedAt: at(4), item: itemB },
  ]);

  assert.equal(bills.length, 2);
  const kaew = bills.find((b) => b.fromId === "u1")!;
  assert.deepEqual(
    kaew.lines.map((l) => [l.code, l.quantity]),
    [["A1", 3], ["B3", 1]],
  );
  assert.deepEqual(kaew.claimIds, ["1", "3", "4"]);
  assert.equal(kaew.quantity, 4);
  assert.equal(kaew.saleAmount, 350_000);
  assert.equal(kaew.productCost, 200_000);
  assert.equal(singleProductId(kaew.lines), null);
  assert.equal(singleProductId(bills.find((b) => b.fromId === "u2")!.lines), "p2");
});

test("ບໍ່ມີ id ຂອງ Facebook — ລວມຕາມຊື່", () => {
  assert.equal(customerKey(null, "  Kaew "), customerKey(null, "kaew"));
  assert.notEqual(customerKey("1", "Kaew"), customerKey(null, "Kaew"));
});

test("ຂໍ້ຄວາມສະຫຼຸບຍອດ", () => {
  const text = renderSummary(
    "ສະບາຍດີ {name}\n{items}\nລວມ {total} ({count} ຊິ້ນ)",
    {
      name: "ແກ້ວ",
      lines: [
        { code: "A1", name: "ເສື້ອ", quantity: 2, unitPrice: 100_000 },
        { code: "B3", name: "ໝວກ", quantity: 1, unitPrice: 50_000 },
      ],
      total: 250_000,
    },
    (v) => `${v} ₭`,
  );
  assert.equal(
    text,
    "ສະບາຍດີ ແກ້ວ\n• A1 ເສື້ອ × 2 = 200000 ₭\n• B3 ໝວກ × 1 = 50000 ₭\nລວມ 250000 ₭ (3 ຊິ້ນ)",
  );
});

test("private reply ໄດ້ພາຍໃນ 7 ວັນ", () => {
  const now = new Date("2026-09-15T00:00:00Z");
  assert.equal(canPrivateReply(new Date("2026-09-09T00:00:01Z"), now), true);
  assert.equal(canPrivateReply(new Date("2026-09-08T00:00:00Z"), now), false);
});

test("ເອົາ id ວິດີໂອຈາກລິ້ງ", () => {
  assert.equal(extractVideoId("1234567890"), "1234567890");
  assert.equal(extractVideoId("https://www.facebook.com/shop/videos/9876543210/"), "9876543210");
  assert.equal(extractVideoId("https://www.facebook.com/watch/live/?v=1122334455"), "1122334455");
  assert.equal(extractVideoId("https://fb.watch/abc"), null);
  assert.equal(extractVideoId(""), null);
});
