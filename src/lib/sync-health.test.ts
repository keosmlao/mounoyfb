import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SYNC_STALE_HOURS,
  evaluateSyncHealth,
  fxGapAlert,
  missingFxDays,
  tokenDaysLeft,
  UNKNOWN_TOKEN,
  type SyncHealthInput,
} from "./sync-health";

/**
 * ກົດເຫຼົ່ານີ້ຄືສິ່ງດຽວທີ່ບອກຄົນວ່າ "ຕົວເລກທີ່ເຈົ້າເຫັນຢູ່ນີ້ບໍ່ແມ່ນຂອງຫຼ້າສຸດ".
 * ຖ້າມັນງຽບຜິດບ່ອນ ຄົນຈະຕັດສິນໃຈໃຊ້ເງິນຈາກຂໍ້ມູນເກົ່າໂດຍບໍ່ຮູ້ໂຕ —
 * ຖ້າມັນຮ້ອງຜິດບ່ອນ ຄົນຈະຊິນແລ້ວເຊົາອ່ານການເຕືອນທັງໝົດ.
 */

const NOW = new Date("2026-08-27T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** ລະບົບທີ່ດີທຸກຢ່າງ — ແຕ່ລະ test ຄ່ອຍປ່ຽນສະເພາະສິ່ງທີ່ຢາກທົດສອບ */
function healthy(patch: Partial<SyncHealthInput> = {}): SyncHealthInput {
  return {
    connected: true,
    autoSyncEnabled: true,
    lastSync: { status: "SUCCESS", startedAt: NOW, message: null },
    lastSuccessAt: new Date(NOW.getTime() - HOUR),
    token: { checkedAt: NOW, valid: true, expiresAt: null, error: null },
    inboxEnabled: false,
    inboxError: null,
    staleHours: DEFAULT_SYNC_STALE_HOURS,
    now: NOW,
    ...patch,
  };
}

const ids = (input: SyncHealthInput) =>
  evaluateSyncHealth(input).map((a) => a.id);

test("ລະບົບປົກກະຕິ ບໍ່ມີການເຕືອນ", () => {
  assert.deepEqual(ids(healthy()), []);
});

test("ຮ້ານທີ່ປ້ອນມືຢ່າງດຽວ ບໍ່ຖືກລົບກວນ", () => {
  // ຍັງບໍ່ໄດ້ຕໍ່ Facebook = ບໍ່ມີຫຍັງພັງ ເຖິງແມ່ນບໍ່ເຄີຍດຶງຈັກເທື່ອ
  const input = healthy({
    connected: false,
    lastSync: null,
    lastSuccessAt: null,
    token: UNKNOWN_TOKEN,
  });
  assert.deepEqual(ids(input), []);
});

test("token ໃຊ້ບໍ່ໄດ້ແລ້ວ ເຕືອນລະດັບດ່ວນທີ່ສຸດ", () => {
  const alerts = evaluateSyncHealth(
    healthy({
      token: {
        checkedAt: NOW,
        valid: false,
        expiresAt: null,
        error: "token ໝົດອາຍຸ ຫຼື ຖືກຍົກເລີກ",
      },
    }),
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, "token-invalid");
  assert.equal(alerts[0].severity, "critical");
  // ຕ້ອງບອກເຫດຜົນຈາກ Facebook ຕໍ່ໃຫ້ຄົນອ່ານ ບໍ່ແມ່ນແຕ່ "ຜິດພາດ"
  assert.match(alerts[0].detail, /ຖືກຍົກເລີກ/);
});

test("token ພັງແລ້ວ ບໍ່ເຕືອນຊ້ຳເລື່ອງຂໍ້ມູນຄ້າງ ແລະ ການດຶງລົ້ມ", () => {
  // ທັງສາມອັນນີ້ແມ່ນເລື່ອງດຽວກັນ — ເຕືອນສາມເທື່ອຄືກັນກັບບໍ່ໄດ້ເຕືອນ
  const alerts = ids(
    healthy({
      token: { checkedAt: NOW, valid: false, expiresAt: null, error: "ຕາຍ" },
      lastSync: { status: "FAILED", startedAt: NOW, message: "code 190" },
      lastSuccessAt: new Date(NOW.getTime() - 5 * DAY),
      inboxEnabled: true,
      inboxError: "ດຶງບໍ່ໄດ້",
    }),
  );
  assert.deepEqual(alerts, ["token-invalid"]);
});

test("token ໃກ້ໝົດອາຍຸ ເຕືອນລ່ວງໜ້າ ແລະ ຮ້ອນຂຶ້ນເມື່ອໃກ້ເຂົ້າ", () => {
  const at = (days: number) =>
    evaluateSyncHealth(
      healthy({
        token: {
          checkedAt: NOW,
          valid: true,
          expiresAt: new Date(NOW.getTime() + days * DAY),
          error: null,
        },
      }),
    );

  assert.deepEqual(at(30).map((a) => a.id), [], "ເຫຼືອ 30 ວັນ ຍັງບໍ່ຕ້ອງເຕືອນ");
  assert.equal(at(5)[0].id, "token-expiring");
  assert.equal(at(5)[0].severity, "warning");
  assert.equal(at(1)[0].severity, "serious", "ເຫຼືອມື້ດຽວ ຕ້ອງຮ້ອນຂຶ້ນ");
  assert.equal(at(-1)[0].id, "token-expired");
  assert.equal(at(-1)[0].severity, "critical");
});

test("token ຂອງ system user ທີ່ບໍ່ໝົດອາຍຸ ບໍ່ຖືກເຕືອນ", () => {
  // expiresAt = null ແປວ່າ "ບໍ່ໝົດ" ບໍ່ແມ່ນ "ໝົດຕັ້ງແຕ່ປີ 1970"
  assert.deepEqual(ids(healthy({ token: { checkedAt: NOW, valid: true, expiresAt: null, error: null } })), []);
});

test("ຂໍ້ມູນຄ້າງເກີນເກນ ເຕືອນວ່າຢ່າຕັດສິນໃຈຈາກຕົວເລກນີ້", () => {
  const alerts = evaluateSyncHealth(
    healthy({ lastSuccessAt: new Date(NOW.getTime() - 30 * HOUR) }),
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, "sync-stale");
  assert.equal(alerts[0].severity, "critical");
  assert.match(alerts[0].title, /30 ຊົ່ວໂມງ/);
});

test("ຍັງບໍ່ຮອດເກນ ບໍ່ຕ້ອງເຕືອນ", () => {
  const justUnder = new Date(NOW.getTime() - (DEFAULT_SYNC_STALE_HOURS - 1) * HOUR);
  assert.deepEqual(ids(healthy({ lastSuccessAt: justUnder })), []);
});

test("ກຳລັງດຶງຢູ່ ບໍ່ເຕືອນວ່າຄ້າງ", () => {
  // ການດຶງຍ້ອນຫຼັງຄັ້ງທຳອິດໃຊ້ເວລາດົນ — ເຕືອນຕອນນັ້ນເປັນການລົບກວນລ້າໆ
  const input = healthy({
    lastSync: { status: "RUNNING", startedAt: NOW, message: null },
    lastSuccessAt: null,
  });
  assert.deepEqual(ids(input), []);
});

test("ປິດການດຶງອັດຕະໂນມັດໄວ້ ບໍ່ເຕືອນວ່າຄ້າງ", () => {
  // ຄົນທີ່ກົດດຶງເອງເປັນຄັ້ງຄາວ ຮູ້ຢູ່ແລ້ວວ່າຂໍ້ມູນເກົ່າ
  const input = healthy({
    autoSyncEnabled: false,
    lastSuccessAt: new Date(NOW.getTime() - 10 * DAY),
  });
  assert.deepEqual(ids(input), []);
});

test("ເປີດດຶງອັດຕະໂນມັດແຕ່ບໍ່ເຄີຍສຳເລັດ ຕ້ອງເຕືອນ", () => {
  const input = healthy({ lastSync: null, lastSuccessAt: null });
  assert.deepEqual(ids(input), ["sync-never"]);
});

test("ຮອບດຶງລົ້ມເຫຼວ ບອກເຫດຜົນທີ່ Facebook ຄືນມາ", () => {
  const alerts = evaluateSyncHealth(
    healthy({
      lastSync: {
        status: "FAILED",
        startedAt: NOW,
        message: "ຮ້ອງ API ຖີ່ເກີນ (rate limit)",
      },
    }),
  );
  assert.deepEqual(alerts.map((a) => a.id), ["sync-failed"]);
  assert.match(alerts[0].detail, /rate limit/);
});

test("ດຶງກ່ອງຂໍ້ຄວາມບໍ່ໄດ້ ຈຶ່ງເຕືອນ ສະເພາະຕອນເປີດໃຊ້ຢູ່", () => {
  assert.deepEqual(
    ids(healthy({ inboxEnabled: false, inboxError: "token ເພຈຂາດສິດ" })),
    [],
  );
  assert.deepEqual(
    ids(healthy({ inboxEnabled: true, inboxError: "token ເພຈຂາດສິດ" })),
    ["inbox-error"],
  );
});

test("ນັບວັນທີ່ເຫຼືອຂອງ token", () => {
  const token = {
    checkedAt: NOW,
    valid: true,
    expiresAt: new Date(NOW.getTime() + 3 * DAY),
    error: null,
  };
  assert.equal(tokenDaysLeft(token, NOW), 3);
  assert.equal(tokenDaysLeft(UNKNOWN_TOKEN, NOW), null);
});

// ------------------------------------------------------- ອັດຕາແລກປ່ຽນທີ່ຂາດ

test("ຫາວັນທີ່ໃຊ້ເງິນແຕ່ບໍ່ມີອັດຕາແລກປ່ຽນ", () => {
  const spend = [
    { date: "2026-08-20", currency: "USD" },
    { date: "2026-08-21", currency: "USD" },
    { date: "2026-08-21", currency: "THB" },
  ];
  const rates = [{ date: "2026-08-20", currency: "USD" }];

  assert.deepEqual(missingFxDays(spend, rates), [
    { date: "2026-08-21", currency: "THB" },
    { date: "2026-08-21", currency: "USD" },
  ]);
});

test("ບັນຊີທີ່ຕັດເປັນກີບຢູ່ແລ້ວ ບໍ່ຕ້ອງການອັດຕາແລກປ່ຽນ", () => {
  const spend = [{ date: "2026-08-21", currency: "LAK" }];
  assert.deepEqual(missingFxDays(spend, []), []);
});

test("ຂາດຫຼາຍວັນເຂົ້າ ຄວາມຮ້າຍແຮງເພີ່ມຂຶ້ນ", () => {
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-08-${String(10 + i).padStart(2, "0")}`,
      currency: "USD",
    }));

  assert.equal(fxGapAlert([]), null);
  assert.equal(fxGapAlert(days(2))?.severity, "warning");
  assert.equal(fxGapAlert(days(7))?.severity, "serious");
  // ຕ້ອງບອກຊ່ວງວັນ ບໍ່ດັ່ງນັ້ນຄົນບໍ່ຮູ້ວ່າຈະໄປປ້ອນວັນໃດ
  assert.match(fxGapAlert(days(3))!.detail, /10 ສ\.ຫ\. 2026/);
});
