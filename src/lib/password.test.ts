import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";

/**
 * ຖ້າການກວດລະຫັດຜ່ານພັງທາງ "ຮັບໝົດ" ໃຜກໍ່ເຂົ້າລະບົບໄດ້.
 * ຖ້າພັງທາງ "ປະຕິເສດໝົດ" ບໍ່ມີໃຜເຂົ້າໄດ້ເລີຍ. ສອງທາງນີ້ຕ້ອງມີ test ຄຸມ.
 */

test("ລະຫັດຖືກ ຜ່ານ · ລະຫັດຜິດ ບໍ່ຜ່ານ", () => {
  const stored = hashPassword("ລະຫັດລັບ12345");
  assert.equal(verifyPassword("ລະຫັດລັບ12345", stored), true);
  assert.equal(verifyPassword("ລະຫັດລັບ12346", stored), false);
  assert.equal(verifyPassword("", stored), false);
});

test("ລະຫັດດຽວກັນ ໄດ້ hash ຄົນລະອັນ (ມີ salt)", () => {
  const a = hashPassword("same-password");
  const b = hashPassword("same-password");
  assert.notEqual(a, b);
  // ແຕ່ທັງສອງອັນຕ້ອງກວດຜ່ານ
  assert.equal(verifyPassword("same-password", a), true);
  assert.equal(verifyPassword("same-password", b), true);
});

test("ບໍ່ເກັບລະຫັດຜ່ານແບບອ່ານໄດ້", () => {
  const stored = hashPassword("plaintext-secret");
  assert.ok(!stored.includes("plaintext-secret"));
  assert.ok(stored.startsWith("pbkdf2$"));
});

test("ແຖວທີ່ເສຍໃນຖານຂໍ້ມູນ ບໍ່ເຮັດໃຫ້ພັງ ແລະ ບໍ່ຜ່ານ", () => {
  for (const bad of ["", "abc", "pbkdf2$x$y$z", "pbkdf2$1000$$", "md5$1$a$b"]) {
    assert.equal(verifyPassword("ຫຍັງກໍ່ໄດ້", bad), false, `ຄ່າ: ${bad}`);
  }
});
