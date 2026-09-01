import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adviseBehavior,
  buildBehaviorReport,
  detectIntents,
  normalizePhone,
  replyMinutes,
  type BehaviorInput,
  type ThreadFact,
} from "./behavior";
import { makeMoney } from "./money";

/**
 * ໜ້ານີ້ບອກຄົນວ່າ "ຄວນຍິງໂຄສະນາເວລາໃດ ແລະ ຄວນແກ້ຫຍັງກ່ອນ" —
 * ຖ້າມັນນັບຜິດ ຫຼື ກ້າແນະນຳຈາກຂໍ້ມູນບາງໆ ຄົນຈະຍ້າຍງົບຈິງຕາມ.
 */

const money = makeMoney("LAK", 21_700);

/** 2026-08-20 ເປັນວັນພະຫັດ — ເວລາທີ່ໃສ່ເປັນ UTC (ລາວ = +7) */
function at(iso: string): Date {
  return new Date(iso);
}

function thread(over: Partial<ThreadFact> & { id: string }): ThreadFact {
  return {
    firstInboundAt: at("2026-08-20T05:00:00Z"), // 12:00 ເວລາລາວ
    firstReplyAt: null,
    texts: [],
    leadId: null,
    ordered: false,
    ...over,
  };
}

function input(over: Partial<BehaviorInput> = {}): BehaviorInput {
  return {
    threads: [],
    orders: [],
    leads: 0,
    costPerMessage: 0,
    spendByHour: null,
    priorPhones: new Set(),
    ...over,
  };
}

// ------------------------------------------------------------ ຄຳຖາມທີ່ພົບ

test("ຫາຄຳຖາມໄດ້ ເຖິງຄົນຈະພິມແຍກຄຳ", () => {
  assert.deepEqual(detectIntents(["ອັນນີ້ ລາຄາ ເທົ່າ ໃດ"]), ["price"]);
  assert.deepEqual(detectIntents([""]), []);
  assert.deepEqual(detectIntents([]), []);
});

test("1 ຫ້ອງ ຖາມໄດ້ຫຼາຍເລື່ອງ ແຕ່ນັບເລື່ອງລະ 1 ເທື່ອ", () => {
  const found = detectIntents(["ລາຄາເທົ່າໃດ", "ຄ່າສົ່ງອີກບໍ", "ລາຄາ"]);
  assert.deepEqual(found.sort(), ["price", "shipping"]);
});

// ------------------------------------------------------------ ເວລາຕອບ

test("ເວລາຕອບນັບເປັນນາທີ · ຍັງບໍ່ຕອບ = null", () => {
  assert.equal(
    replyMinutes(
      thread({
        id: "a",
        firstInboundAt: at("2026-08-20T05:00:00Z"),
        firstReplyAt: at("2026-08-20T05:20:00Z"),
      }),
    ),
    20,
  );
  assert.equal(replyMinutes(thread({ id: "b" })), null);
});

// ------------------------------------------------------------ ລາຍງານ

test("ຊົ່ວໂມງນັບຕາມເວລາລາວ ບໍ່ແມ່ນ UTC", () => {
  // 17:00Z = 00:00 ຂອງມື້ຖັດໄປຕາມເວລາລາວ
  const r = buildBehaviorReport(
    input({
      threads: [thread({ id: "a", firstInboundAt: at("2026-08-20T17:00:00Z") })],
    }),
  );
  assert.equal(r.hours[0].threads, 1);
  assert.equal(r.hours[17].threads, 0);
  // 21 ສ.ຫ. 2026 ເປັນວັນສຸກ
  assert.equal(r.weekdays[5].threads, 1);
});

test("ນັບຫ້ອງທີ່ຍັງບໍ່ໄດ້ຕອບ ແລະ ຄ່າກາງຂອງເວລາຕອບ", () => {
  const r = buildBehaviorReport(
    input({
      threads: [
        thread({
          id: "a",
          firstReplyAt: at("2026-08-20T05:10:00Z"), // 10 ນາທີ
        }),
        thread({
          id: "b",
          firstReplyAt: at("2026-08-20T06:00:00Z"), // 60 ນາທີ
        }),
        thread({ id: "c" }),
      ],
    }),
  );

  assert.equal(r.threads, 3);
  assert.equal(r.replied, 2);
  assert.equal(r.unanswered, 1);
  assert.equal(r.replyMedian, 35);
  assert.equal(r.replies.find((b) => b.key === "none")!.threads, 1);
  assert.equal(r.replies.find((b) => b.key === "m30")!.threads, 1);
  assert.equal(r.replies.find((b) => b.key === "h2")!.threads, 1);
});

test("ອັດຕາປິດຕາມຄວາມໄວຕອບ ນັບສະເພາະຫ້ອງທີ່ຜູກກັບລູກຄ້າແລ້ວ", () => {
  const r = buildBehaviorReport(
    input({
      threads: [
        thread({
          id: "a",
          leadId: "L1",
          ordered: true,
          firstReplyAt: at("2026-08-20T05:02:00Z"),
        }),
        // ບໍ່ໄດ້ຜູກ — ຮູ້ບໍ່ໄດ້ວ່າປິດການຂາຍໄດ້ບໍ່ ຈຶ່ງບໍ່ນັບໃສ່ຖານ
        thread({ id: "b", firstReplyAt: at("2026-08-20T05:03:00Z") }),
      ],
    }),
  );

  const fast = r.replies.find((b) => b.key === "m5")!;
  assert.equal(fast.threads, 2);
  assert.equal(fast.linked, 1);
  assert.equal(fast.orderRate, 1);
});

test("ລູກຄ້າຊື້ຊ້ຳນັບຈາກເບີ — ຮູບແບບເບີຕ່າງກັນຖືວ່າຄົນດຽວກັນ", () => {
  const r = buildBehaviorReport(
    input({
      orders: [
        { day: "2026-08-20", leadDay: null, delivered: true, phone: "020 5555 1111" },
        { day: "2026-08-21", leadDay: null, delivered: false, phone: "02055551111" },
        { day: "2026-08-21", leadDay: null, delivered: false, phone: "02099998888" },
        { day: "2026-08-22", leadDay: null, delivered: false, phone: null },
      ],
      priorPhones: new Set(["02099998888"]),
    }),
  );

  assert.equal(r.repeat.customers, 2);
  assert.equal(r.repeat.repeat, 2); // ຄົນທຳອິດສັ່ງ 2 ເທື່ອ · ຄົນທີສອງເຄີຍສັ່ງມາກ່ອນ
  assert.equal(r.repeat.unknownPhone, 1);
});

test("ໄລຍະຈາກທັກຮອດຊື້ ຈັດເປັນຊ່ວງ ແລະ ບໍ່ນັບອໍເດີທີ່ບໍ່ໄດ້ຜູກລູກຄ້າ", () => {
  const orders = [
    { day: "2026-08-20", leadDay: "2026-08-20", delivered: false, phone: null },
    { day: "2026-08-22", leadDay: "2026-08-20", delivered: false, phone: null },
    { day: "2026-08-30", leadDay: "2026-08-20", delivered: false, phone: null },
    { day: "2026-08-30", leadDay: null, delivered: false, phone: null },
  ];
  const r = buildBehaviorReport(input({ orders }));

  assert.equal(r.lag[0].orders, 1); // ມື້ດຽວກັນ
  assert.equal(r.lag[1].orders, 1); // 1–3 ວັນ
  assert.equal(r.lag[3].orders, 1); // ເກີນ 7 ວັນ
  assert.equal(r.lag.reduce((a, b) => a + b.orders, 0), 3);
});

test("ກວຍປ່ຽນຄິດອັດຕາທຽບຂັ້ນກ່ອນໜ້າ", () => {
  const r = buildBehaviorReport(
    input({
      threads: [
        thread({ id: "a", firstReplyAt: at("2026-08-20T05:10:00Z") }),
        thread({ id: "b", firstReplyAt: at("2026-08-20T05:10:00Z") }),
        thread({ id: "c" }),
        thread({ id: "d" }),
      ],
      leads: 1,
      orders: [
        { day: "2026-08-20", leadDay: null, delivered: true, phone: null },
      ],
    }),
  );

  assert.equal(r.funnel[0].value, 4);
  assert.equal(r.funnel[1].rate, 0.5); // ຕອບ 2 ໃນ 4
  assert.equal(r.funnel[2].rate, 0.5); // ລູກຄ້າ 1 ໃນ 2 ທີ່ຕອບ
  assert.equal(r.funnel[4].rate, 1); // ສົ່ງສຳເລັດ 1 ໃນ 1 ອໍເດີ
});

// ------------------------------------------------------------ ຄຳແນະນຳ

test("ຂໍ້ມູນບາງໆບໍ່ອອກຄຳແນະນຳ", () => {
  const r = buildBehaviorReport(
    input({
      threads: [thread({ id: "a" }), thread({ id: "b" })],
      costPerMessage: 30_000,
    }),
  );
  assert.deepEqual(adviseBehavior(r, money), []);
});

test("ເຕືອນເມື່ອຄົນທັກຄ້າງບໍ່ໄດ້ຕອບ ພ້ອມຄິດເງິນທີ່ຈ່າຍໄປແລ້ວ", () => {
  const threads = Array.from({ length: 30 }, (_, i) =>
    thread({
      id: `t${i}`,
      firstReplyAt: i < 20 ? at("2026-08-20T05:10:00Z") : null,
    }),
  );
  const r = buildBehaviorReport(input({ threads, costPerMessage: 10_000 }));
  const advice = adviseBehavior(r, money);
  const unanswered = advice.find((a) => a.id === "cut:behavior:unanswered");

  assert.ok(unanswered, "ຄວນມີຄຳເຕືອນເລື່ອງຫ້ອງທີ່ຍັງບໍ່ໄດ້ຕອບ");
  assert.match(unanswered.title, /10/);
  assert.match(unanswered.reason, /100,000 ₭/);
});

test("ບອກໃຫ້ຍ້າຍງົບ ເມື່ອຄົນທັກກະຈຸກຢູ່ຊ່ວງທີ່ງົບລົງໜ້ອຍ", () => {
  // ທັງໝົດທັກຕອນ 19:00 ເວລາລາວ (12:00Z) ແຕ່ງົບລົງຕອນເຊົ້າ
  const threads = Array.from({ length: 40 }, (_, i) =>
    thread({
      id: `t${i}`,
      firstInboundAt: at("2026-08-20T12:00:00Z"),
      firstReplyAt: at("2026-08-20T12:05:00Z"),
    }),
  );
  const spendByHour = new Array(24).fill(0) as number[];
  spendByHour[8] = 900_000;
  spendByHour[19] = 100_000;

  const advice = adviseBehavior(
    buildBehaviorReport(input({ threads, spendByHour })),
    money,
  );
  const shift = advice.find((a) => a.id.startsWith("shift:behavior:hour"));

  assert.ok(shift, "ຄວນແນະນຳໃຫ້ຍ້າຍງົບໄປຊ່ວງແລງ");
  assert.match(shift.title, /ແລງ/);
  assert.match(shift.reason, /10%/); // ງົບລົງຊ່ວງນັ້ນພຽງ 10%
});

test("ງົບລົງກົງກັບເວລາທີ່ຄົນທັກແລ້ວ ບໍ່ຕ້ອງແນະນຳໃຫ້ຍ້າຍ", () => {
  const threads = Array.from({ length: 40 }, (_, i) =>
    thread({ id: `t${i}`, firstInboundAt: at("2026-08-20T12:00:00Z") }),
  );
  const spendByHour = new Array(24).fill(0) as number[];
  spendByHour[19] = 1_000_000;

  const advice = adviseBehavior(
    buildBehaviorReport(input({ threads, spendByHour })),
    money,
  );
  assert.equal(
    advice.filter((a) => a.id.startsWith("shift:behavior:hour")).length,
    0,
  );
});

test("ຄຳຖາມທີ່ຄົນຖາມຊ້ຳກັນ ກາຍເປັນຄຳແນະນຳໃສ່ໃນໂຄສະນາ", () => {
  const threads = Array.from({ length: 30 }, (_, i) =>
    thread({
      id: `t${i}`,
      firstReplyAt: at("2026-08-20T05:05:00Z"),
      texts: i < 20 ? ["ລາຄາເທົ່າໃດ"] : ["ສະບາຍດີ"],
    }),
  );
  const advice = adviseBehavior(buildBehaviorReport(input({ threads })), money);
  const intent = advice.find((a) => a.id === "shift:behavior:intent:price");

  assert.ok(intent, "ຄວນແນະນຳໃຫ້ໃສ່ລາຄາໃນໂຄສະນາ");
  assert.match(intent.title, /67%/);
});

test("ເບີໂທທີ່ໃຊ້ບໍ່ໄດ້ຖືວ່າບໍ່ມີເບີ", () => {
  assert.equal(normalizePhone("020-5555-1111"), "02055551111");
  assert.equal(normalizePhone("—"), null);
  assert.equal(normalizePhone(null), null);
});

test("ຕອບຊ້າແລ້ວປິດບໍ່ໄດ້ເລີຍ ກໍ່ຕ້ອງເຕືອນ (ບໍ່ແມ່ນງຽບຍ້ອນຫານດ້ວຍ 0)", () => {
  const threads = [
    ...Array.from({ length: 10 }, (_, i) =>
      thread({
        id: `f${i}`,
        leadId: `LF${i}`,
        ordered: i < 7,
        firstReplyAt: at("2026-08-20T05:03:00Z"),
      }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      thread({
        id: `s${i}`,
        leadId: `LS${i}`,
        ordered: false,
        firstReplyAt: at("2026-08-20T09:00:00Z"), // 4 ຊົ່ວໂມງ
      }),
    ),
  ];

  const advice = adviseBehavior(buildBehaviorReport(input({ threads })), money);
  const speed = advice.find((a) => a.id === "shift:behavior:reply-speed");

  assert.ok(speed, "ຄວນແນະນຳໃຫ້ຕອບໄວ");
  assert.match(speed.reason, /70%/);
  assert.match(speed.reason, /0%/);
});
