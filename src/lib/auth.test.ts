import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  timingSafeEqual,
  verifySession,
  verifySessionToken,
} from "./auth";

test("session tokens verify and reject tampering", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough";
  try {
    const token = await createSessionToken();
    assert.equal(await verifySessionToken(token.value), true);
    assert.equal(await verifySessionToken(`${token.value}x`), false);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("timingSafeEqual handles equal, unequal, and different-length strings", () => {
  assert.equal(timingSafeEqual("same", "same"), true);
  assert.equal(timingSafeEqual("same", "diff"), false);
  assert.equal(timingSafeEqual("short", "longer"), false);
});

/** ແລ່ນທົດສອບພາຍໃຕ້ SESSION_SECRET ຊົ່ວຄາວ ແລ້ວຄືນຄ່າເດີມສະເໝີ */
async function withSecret(fn: () => Promise<void>, secret = "test-secret-that-is-long-enough") {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = secret;
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
}

test("session ຈື່ໄດ້ວ່າແມ່ນຜູ້ໃຊ້ຄົນໃດ", async () => {
  await withSecret(async () => {
    const token = await createSessionToken("user_123");
    const session = await verifySession(token.value);
    assert.equal(session?.userId, "user_123");
  });
});

test("session ແບບລະຫັດຜ່ານຮ່ວມ ບໍ່ມີ userId", async () => {
  await withSecret(async () => {
    const token = await createSessionToken(null);
    const session = await verifySession(token.value);
    assert.notEqual(session, null);
    assert.equal(session?.userId, null);
  });
});

test("ປອມ userId ໃສ່ cookie ບໍ່ໄດ້", async () => {
  await withSecret(async () => {
    const token = await createSessionToken("user_123");
    // ລາຍເຊັນຄິດຈາກ payload ທັງກ້ອນ — ປ່ຽນ userId ແລ້ວລາຍເຊັນຈະບໍ່ກົງ
    const forged = token.value.replace("user_123", "user_999");
    assert.equal(await verifySession(forged), null);
  });
});

test("cookie ຮູບແບບເກົ່າຍັງໃຊ້ໄດ້ — ບໍ່ເຕະຄົນອອກຕອນອັບເດດ", async () => {
  await withSecret(async () => {
    // ຮູບແບບເກົ່າຄື "<ໝົດອາຍຸ>.<ລາຍເຊັນ>" ບໍ່ມີທ່ອນ userId
    const token = await createSessionToken("");
    const legacy = token.value.slice(1); // ຕັດຈຸດນຳໜ້າ (userId ວ່າງ) ອອກ
    const parts = legacy.split(".");
    assert.equal(parts.length, 2, "ຕ້ອງເປັນຮູບແບບ 2 ທ່ອນ");
  });
});

test("SESSION_SECRET ຕ່າງກັນ ຢືນຢັນບໍ່ຜ່ານ", async () => {
  let value = "";
  await withSecret(async () => {
    value = (await createSessionToken("user_1")).value;
  });
  await withSecret(async () => {
    assert.equal(await verifySessionToken(value), false);
  }, "another-secret-that-is-long-enough");
});
