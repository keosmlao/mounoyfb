import test from "node:test";
import assert from "node:assert/strict";
import {
  adviseLive,
  analyzeLive,
  type AnalysisClaim,
  type AnalysisComment,
  type LiveAnalysisInput,
} from "./live-analysis";

const T0 = Date.UTC(2026, 8, 15, 12, 0);
const at = (min: number) => new Date(T0 + min * 60_000);
const money = (v: number | null | undefined) => `${v ?? 0} ₭`;

let n = 0;
function comment(min: number, extra: Partial<AnalysisComment> = {}): AnalysisComment {
  n++;
  return {
    fbCommentId: `c${n}`,
    parentFbId: null,
    fromId: `u${n}`,
    fromName: `ຄົນ ${n}`,
    fromPage: false,
    message: "ງາມ",
    commentedAt: at(min),
    isCf: false,
    isQuestion: false,
    handled: false,
    ...extra,
  };
}
function claim(c: AnalysisComment, itemId: string | null, extra: Partial<AnalysisClaim> = {}): AnalysisClaim {
  return {
    id: `k${c.fbCommentId}`,
    itemId,
    quantity: 1,
    commentedAt: c.commentedAt,
    fbCommentId: c.fbCommentId,
    cancelled: false,
    ordered: false,
    fromId: c.fromId,
    fromName: c.fromName,
    cancelReason: null,
    ...extra,
  };
}

function base(): LiveAnalysisInput {
  return { comments: [], claims: [], items: [], orders: [], past: [], autoAck: false, stats: [], boosts: [] };
}

test("ຂອງໝົດຕອນໃດ ແລະ ຍອດທີ່ພາດ", () => {
  const input = base();
  input.items = [{ id: "a", code: "A1", name: "ເສື້ອ", price: 100, stock: 2 }];
  const cs = [0, 3, 7, 9, 12].map((m) => comment(m, { isCf: true, message: "CF A1" }));
  input.comments = cs;
  input.claims = cs.map((c) => claim(c, "a"));

  const a = analyzeLive(input);
  const item = a.items[0];
  assert.equal(item.reserved, 2);
  assert.equal(item.waitlist, 3);
  assert.equal(item.soldOutMinute, 3);
  assert.equal(item.missedValue, 300);
  assert.equal(a.minutes, 12);
  assert.equal(a.cfCustomers, 5);

  const advice = adviseLive(a, money, false);
  assert.ok(advice.some((x) => x.id === "live-soldout-a"));
});

test("ຄຳຖາມທີ່ຕອບແລ້ວ ນັບຈາກຄຳຕອບຂອງເພຈໃຕ້ comment ແລະ ເວລາຕອບ", () => {
  const input = base();
  const q1 = comment(0, { isQuestion: true, message: "ລາຄາເທົ່າໃດ" });
  const q2 = comment(1, { isQuestion: true, message: "ສົ່ງຕ່າງແຂວງບໍ່" });
  const q3 = comment(2, { isQuestion: true, message: "ລາຄາ A2 ເທົ່າໃດ", handled: true });
  const reply = comment(4, { fromPage: true, parentFbId: q1.fbCommentId, message: "100 ພັນ" });
  input.comments = [q1, q2, q3, reply];

  const a = analyzeLive(input);
  assert.equal(a.questions, 3);
  assert.equal(a.answered, 2);
  assert.equal(a.medianReplyMinutes, 4);
  assert.equal(a.comments, 3, "ຄຳຕອບຂອງເພຈບໍ່ນັບເປັນ comment ຂອງລູກຄ້າ");
  assert.deepEqual(a.intents.map((i) => [i.key, i.count]), [["price", 2], ["shipping", 1]]);
});

test("ບໍ່ແນະນຳຈາກຂໍ້ມູນບາງ", () => {
  const input = base();
  input.items = [
    { id: "a", code: "A1", name: "ເສື້ອ", price: 100, stock: null },
    { id: "b", code: "B1", name: "ໝວກ", price: 50, stock: null },
  ];
  const cs = [comment(0, { isCf: true }), comment(1), comment(2)];
  input.comments = cs;
  input.claims = [claim(cs[0], "a")];
  const advice = adviseLive(analyzeLive(input), money, false);
  // CF 1 ລາຍການ ບໍ່ພໍເວົ້າວ່າ B1 ຂາຍບໍ່ອອກ · ຄົນ comment 3 ຄົນ ບໍ່ພໍເວົ້າເລື່ອງ conversion
  assert.equal(advice.some((x) => x.id === "live-nocf-b"), false);
  assert.equal(advice.some((x) => x.id === "live-conversion"), false);
});

test("ຄົນ comment ຫຼາຍ CF ໜ້ອຍ + ສິນຄ້າທີ່ບໍ່ມີຄົນເອົາ", () => {
  const input = base();
  input.items = [
    { id: "a", code: "A1", name: "ເສື້ອ", price: 100, stock: null },
    { id: "b", code: "B1", name: "ໝວກ", price: 50, stock: null },
  ];
  const chatter = Array.from({ length: 90 }, (_, i) => comment(i % 30, { message: "ລາຄາເທົ່າໃດ", isQuestion: true }));
  const cfs = Array.from({ length: 10 }, (_, i) => comment(i, { isCf: true }));
  input.comments = [...chatter, ...cfs];
  input.claims = cfs.map((c) => claim(c, "a"));

  const a = analyzeLive(input);
  assert.equal(a.commenters, 100);
  assert.equal(a.conversion, 0.1);
  const ids = adviseLive(a, money, false).map((x) => x.id);
  assert.ok(ids.includes("live-conversion"));
  assert.ok(ids.includes("live-nocf-b"));
  assert.ok(ids.includes("live-unanswered"));
});

test("ເສັ້ນເວລາ ແລະ ຊ່ວງທ້າຍ", () => {
  const input = base();
  input.items = [{ id: "a", code: "A1", name: "ເສື້ອ", price: 100, stock: null }];
  const early = Array.from({ length: 12 }, (_, i) => comment(i, { isCf: true }));
  const last = comment(60);
  input.comments = [...early, last];
  input.claims = early.map((c) => claim(c, "a"));

  const a = analyzeLive(input);
  assert.equal(a.bucketMinutes, 5);
  assert.equal(a.timeline.length, 13);
  assert.equal(a.peak?.label, "00:00");
  assert.equal(a.lateCfShare, 0);
  assert.ok(adviseLive(a, money, false).some((x) => x.id === "live-late"));
});

test("ບິນ: ຍັງບໍ່ແຈ້ງ ແລະ ຍົກເລີກຫຼາຍ · ທຽບ live ກ່ອນ", () => {
  const input = base();
  input.items = [{ id: "a", code: "A1", name: "ເສື້ອ", price: 1000, stock: null }];
  const cs = Array.from({ length: 5 }, (_, i) => comment(i, { isCf: true }));
  input.comments = cs;
  input.claims = cs.map((c) => claim(c, "a"));
  const row = { saleAmount: 1000, productCost: 0, shippingCost: 0, otherCost: 0, refundAmount: 0 };
  input.orders = [
    ...Array.from({ length: 7 }, () => ({ ...row, status: "DELIVERED" as const, notifiedAt: at(1) })),
    ...Array.from({ length: 3 }, () => ({ ...row, status: "CANCELLED" as const, notifiedAt: null })),
  ];
  input.past = [1, 2, 3].map(() => ({ reservedValue: 10_000, cfCustomers: 10, viewers: null }));

  const a = analyzeLive(input);
  assert.deepEqual(a.funnel, { billed: 10, notified: 7, confirmed: 7, delivered: 7, cancelled: 3 });
  assert.equal(a.money.netRevenue, 7000);
  assert.equal(a.vsPast, 0.5);
  const ids = adviseLive(a, money, false).map((x) => x.id);
  assert.ok(ids.includes("live-notify"));
  assert.ok(ids.includes("live-cancel"));
  assert.ok(ids.includes("live-vs-past"));
});

test("ຄົນເບິ່ງ: ຈຸດຫຼ້າສຸດ, ອັດຕາສ່ວນຮ່ວມ, ເວລາເບິ່ງ", () => {
  const input = base();
  input.items = [{ id: "a", code: "A1", name: "ເສື້ອ", price: 1000, stock: null }];
  const cs = Array.from({ length: 6 }, (_, i) => comment(i, { isCf: i < 2 }));
  input.comments = cs;
  input.claims = cs.slice(0, 2).map((c) => claim(c, "a"));
  input.stats = [
    { at: at(5), views: 300, viewers: 250, avgWatchMs: 40_000, reactions: 10 },
    { at: at(30), views: 900, viewers: 600, avgWatchMs: null, reactions: 40 },
  ];

  const a = analyzeLive(input);
  assert.equal(a.audience.viewers, 600);
  assert.equal(a.audience.avgWatchSeconds, 40, "ຈຸດຫຼ້າສຸດບໍ່ມີຄ່າ ໃຫ້ຖອຍໄປເອົາຈຸດກ່ອນ");
  assert.equal(a.audience.engagementRate, 6 / 600);
  assert.equal(a.audience.cfRate, 2 / 600);
  assert.deepEqual(a.audience.timeline.map((t) => t.viewers), [250, 600]);
  const ids = adviseLive(a, money, false).map((x) => x.id);
  assert.ok(ids.includes("live-engagement"));
  assert.ok(ids.includes("live-watchtime"));
});

test("boost: ຄ່າໂຄສະນາເປັນກີບ ແລະ ຄຸ້ມບໍ່", () => {
  const input = base();
  input.items = [{ id: "a", code: "A1", name: "ເສື້ອ", price: 100_000, stock: null }];
  const cs = Array.from({ length: 4 }, (_, i) => comment(i, { isCf: true }));
  input.comments = cs;
  input.claims = cs.map((c) => claim(c, "a"));
  // ງົບ $20 = 434,000 ກີບ · ໃຊ້ໄປ $10 → 217,000 ກີບ · ຍອດຈອງ 400,000
  input.boosts = [{ spend: 10, budget: 20, budgetLak: 434_000, reach: 5000 }];

  const a = analyzeLive(input);
  assert.equal(a.boost?.spendLak, 217_000);
  assert.equal(a.boost?.costPerCfCustomer, 217_000 / 4);
  assert.ok(adviseLive(a, money, false).some((x) => x.id === "live-boost-poor"));
  assert.equal(analyzeLive(base()).boost, null, "ບໍ່ໄດ້ boost = ບໍ່ມີກ່ອງ boost");
});
