import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTO_REPLY_SECONDS,
  buildQueue,
  durationLao,
  summarize,
  urgencyOf,
  waitingSince,
  type QueueMessage,
  type ThreadInput,
} from "./queue";

/**
 * ຄິວນີ້ຄືລຳດັບທີ່ຄົນຕອບຈະລົງມືຈິງ. ນັບຜິດ = ລູກຄ້າທີ່ຈ່າຍຄ່າໂຄສະນາໄປແລ້ວ
 * ຖືກປະໄວ້ຈົນໝົດ 24 ຊົ່ວໂມງ ແລ້ວຕອບບໍ່ໄດ້ອີກຕະຫຼອດໄປ.
 */

const NOW = new Date("2026-08-29T10:00:00.000Z");

function msg(minutesAgo: number, fromPage = false): QueueMessage {
  return { fromPage, sentAt: new Date(NOW.getTime() - minutesAgo * 60_000) };
}

function thread(over: Partial<ThreadInput> & { id: string }): ThreadInput {
  return {
    personName: `ຄົນ ${over.id}`,
    pageName: "ເພຈທົດລອງ",
    snippet: null,
    assignee: null,
    handled: false,
    leadId: null,
    messages: [],
    ...over,
  };
}

// ------------------------------------------------------- ບອດ ຫຼື ຄົນ

test("ບອດຕອບທັນທີ ບໍ່ນັບເປັນການຕອບຂອງຄົນ", () => {
  const customer = msg(60);
  const bot: QueueMessage = {
    fromPage: true,
    sentAt: new Date(customer.sentAt.getTime() + 3_000), // 3 ວິນາທີ
  };
  const { since, autoRepliedOnly } = waitingSince([customer, bot]);

  assert.deepEqual(since, customer.sentAt);
  assert.equal(autoRepliedOnly, true);
});

test("ຄົນຕອບຫຼັງຈາກນັ້ນ = ບໍ່ລໍແລ້ວ", () => {
  const customer = msg(60);
  const bot: QueueMessage = {
    fromPage: true,
    sentAt: new Date(customer.sentAt.getTime() + 3_000),
  };
  const human: QueueMessage = {
    fromPage: true,
    sentAt: new Date(customer.sentAt.getTime() + 10 * 60_000),
  };
  const { since, autoRepliedOnly } = waitingSince([customer, bot, human]);

  assert.equal(since, null);
  assert.equal(autoRepliedOnly, false);
});

test("ເສັ້ນແບ່ງບອດ/ຄົນ ຢູ່ທີ່ 30 ວິນາທີພໍດີ", () => {
  const customer = msg(60);
  const at = (s: number): QueueMessage => ({
    fromPage: true,
    sentAt: new Date(customer.sentAt.getTime() + s * 1000),
  });

  assert.notEqual(waitingSince([customer, at(AUTO_REPLY_SECONDS - 1)]).since, null);
  assert.equal(waitingSince([customer, at(AUTO_REPLY_SECONDS)]).since, null);
});

test("ລູກຄ້າພິມຫຼາຍຂໍ້ຄວາມຕິດກັນ ນັບຈາກອັນທຳອິດ", () => {
  const first = msg(90);
  const { since } = waitingSince([first, msg(85), msg(80)]);
  assert.deepEqual(since, first.sentAt);
});

test("ຕອບແລ້ວ ລູກຄ້າຖາມມາໃໝ່ = ລໍໃໝ່ຈາກຂໍ້ຄວາມໃໝ່", () => {
  const old = msg(300);
  const reply = msg(280, true);
  const fresh = msg(30);
  const { since } = waitingSince([old, reply, fresh]);
  assert.deepEqual(since, fresh.sentAt);
});

test("ເພຈທັກໄປກ່ອນ ລູກຄ້າຍັງບໍ່ຕອບ = ບໍ່ມີວຽກຄ້າງ", () => {
  assert.equal(waitingSince([msg(60, true)]).since, null);
  assert.equal(waitingSince([]).since, null);
});

// ------------------------------------------------------- ຄວາມດ່ວນ

test("ຄວາມດ່ວນອີງເວລາທີ່ເຫຼືອໃນໜ້າຕ່າງ 24 ຊົ່ວໂມງ", () => {
  assert.equal(urgencyOf(-1), "expired");
  assert.equal(urgencyOf(0), "expired");
  assert.equal(urgencyOf(60), "urgent");
  assert.equal(urgencyOf(5 * 60), "soon");
  assert.equal(urgencyOf(20 * 60), "ok");
});

// ------------------------------------------------------- ຄິວ

test("ຮຽງຄົນທີ່ລໍດົນສຸດຂຶ້ນກ່ອນ · ໝົດເວລາແລ້ວໄປທ້າຍສຸດ", () => {
  const rows = buildQueue(
    [
      thread({ id: "ລໍ 2 ຊມ", messages: [msg(120)] }),
      thread({ id: "ໝົດເວລາ", messages: [msg(30 * 60)] }),
      thread({ id: "ລໍ 8 ຊມ", messages: [msg(8 * 60)] }),
      thread({ id: "ລໍ 10 ນາທີ", messages: [msg(10)] }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((r) => r.id),
    ["ລໍ 8 ຊມ", "ລໍ 2 ຊມ", "ລໍ 10 ນາທີ", "ໝົດເວລາ"],
  );
  assert.equal(rows[0].waitedMinutes, 480);
  assert.equal(rows[0].minutesLeft, 24 * 60 - 480);
  assert.equal(rows[3].urgency, "expired");
});

test("ຫ້ອງທີ່ໝາຍວ່າຈັດການແລ້ວ ບໍ່ຢູ່ໃນຄິວ", () => {
  const rows = buildQueue(
    [thread({ id: "a", handled: true, messages: [msg(120)] })],
    NOW,
  );
  assert.equal(rows.length, 0);
});

test("ສະຫຼຸບຄິວ — ນັບຫ້ອງທີ່ມີແຕ່ບອດຕອບໄວ້ນຳ", () => {
  const customer = msg(120);
  const bot: QueueMessage = {
    fromPage: true,
    sentAt: new Date(customer.sentAt.getTime() + 2_000),
  };

  const s = summarize(
    buildQueue(
      [
        thread({ id: "bot", messages: [customer, bot] }),
        thread({ id: "urgent", messages: [msg(23 * 60)] }),
        thread({ id: "mine", assignee: "ນ້ອຍ", messages: [msg(30)] }),
      ],
      NOW,
    ),
  );

  assert.equal(s.total, 3);
  assert.equal(s.urgent, 1);
  assert.equal(s.unassigned, 2);
  assert.equal(s.autoRepliedOnly, 1);
  assert.equal(s.longestWait, 23 * 60);
});

test("ອ່ານໄລຍະເວລາເປັນພາສາຄົນ", () => {
  assert.equal(durationLao(45), "45 ນາທີ");
  assert.equal(durationLao(60), "1 ຊົ່ວໂມງ");
  assert.equal(durationLao(200), "3 ຊົ່ວໂມງ 20 ນາທີ");
  assert.equal(durationLao(1500), "1 ວັນ 1 ຊົ່ວໂມງ");
});
