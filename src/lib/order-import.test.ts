import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, detectDelimiter } from "./csv";
import {
  detectColumns,
  parseFlexibleDate,
  parseNumber,
  parseOrderCsv,
  parseStatus,
} from "./order-import";

/**
 * ການນຳເຂົ້າຜິດ = ຕົວເລກເງິນຜິດທັງລະບົບ ແລະ ບໍ່ມີໃຜສັງເກດເຫັນ.
 * ສ່ວນນີ້ຈຶ່ງຕ້ອງມີ test ຄຸມທຸກຮູບແບບທີ່ພົບຈິງ.
 */

test("ອ່ານຄ່າທີ່ມີເຄື່ອງໝາຍຄຳເວົ້າ ແລະ ຈຸດຄັ່ນຢູ່ຂ້າງໃນ", () => {
  const rows = parseCsv('a,b\n"ໂທລະສັບ, ສາຍສາກ",5000');
  assert.deepEqual(rows[1], ["ໂທລະສັບ, ສາຍສາກ", "5000"]);
});

test("ອ່ານເຄື່ອງໝາຍຄຳເວົ້າຊ້ອນໄດ້", () => {
  const rows = parseCsv('a\n"ຂະໜາດ 6"" ນິ້ວ"');
  assert.equal(rows[1][0], 'ຂະໜາດ 6" ນິ້ວ');
});

test("ຮັບຕົວຄັ່ນ tab ຈາກການວາງໃນ Google Sheets", () => {
  assert.equal(detectDelimiter("ວັນທີ່\tຍອດຂາຍ\n2026-08-20\t50000"), "\t");
  const rows = parseCsv("ວັນທີ່\tຍອດຂາຍ\n2026-08-20\t50000");
  assert.deepEqual(rows[1], ["2026-08-20", "50000"]);
});

test("ລຶບ BOM ຂອງ Excel ບໍ່ດັ່ງນັ້ນຫົວຄໍລຳທຳອິດຈັບຄູ່ບໍ່ໄດ້", () => {
  const map = detectColumns(parseCsv("﻿ວັນທີ່,ຍອດຂາຍ")[0]);
  assert.equal(map.date, 0);
});

test("ຈັບຄູ່ຫົວຄໍລຳລາວ ໄທ ແລະ ອັງກິດ", () => {
  const lao = detectColumns(["ວັນທີ່", "ຊື່ລູກຄ້າ", "ຍອດຂາຍ", "ຄ່າສົ່ງ", "ສະຖານະ"]);
  assert.equal(lao.date, 0);
  assert.equal(lao.customerName, 1);
  assert.equal(lao.saleAmount, 2);
  assert.equal(lao.shippingCost, 3);
  assert.equal(lao.status, 4);

  const en = detectColumns(["Date", "Customer Name", "Sale Amount", "Shipping"]);
  assert.equal(en.date, 0);
  assert.equal(en.customerName, 1);
  assert.equal(en.saleAmount, 2);

  const th = detectColumns(["วันที่", "ชื่อลูกค้า", "ยอดขาย"]);
  assert.equal(th.date, 0);
  assert.equal(th.saleAmount, 2);
});

test("ຄໍລຳໜຶ່ງບໍ່ຖືກຈັບຄູ່ 2 ຊ່ອງ", () => {
  // "ຕົ້ນທຶນ" ບໍ່ຄວນຖືກເອົາໄປເປັນ "ຍອດຂາຍ" ນຳ
  const map = detectColumns(["ຍອດຂາຍ", "ຕົ້ນທຶນ"]);
  assert.equal(map.saleAmount, 0);
  assert.equal(map.productCost, 1);
});

test("ອ່ານຕົວເລກທີ່ມີຈຸດຄັ່ນຫຼັກພັນ ແລະ ສັນຍາລັກເງິນ", () => {
  assert.equal(parseNumber("1,250,000"), 1250000);
  assert.equal(parseNumber("₭ 85,000"), 85000);
  assert.equal(parseNumber("$12.50"), 12.5);
  assert.equal(parseNumber(""), 0);
  assert.equal(parseNumber("—"), 0);
});

test("ວົງເລັບແປວ່າຄ່າລົບ (ຮູບແບບບັນຊີ)", () => {
  assert.equal(parseNumber("(5,000)"), -5000);
});

test("ອ່ານວັນທີ່ຫຼາຍຮູບແບບ", () => {
  assert.equal(parseFlexibleDate("2026-08-20"), "2026-08-20");
  assert.equal(parseFlexibleDate("20/08/2026"), "2026-08-20");
  assert.equal(parseFlexibleDate("5-8-26"), "2026-08-05");
});

test("ປີພຸດທະສັກກະລາດຖືກແປງເປັນ ຄ.ສ.", () => {
  assert.equal(parseFlexibleDate("20/08/2569"), "2026-08-20");
});

test("ວັນທີ່ທີ່ບໍ່ມີຈິງຖືກປະຕິເສດ ບໍ່ແມ່ນເດົາ", () => {
  assert.equal(parseFlexibleDate("31/02/2026"), null);
  assert.equal(parseFlexibleDate("ບໍ່ຮູ້"), null);
  assert.equal(parseFlexibleDate(""), null);
});

test("ອ່ານສະຖານະຫຼາຍພາສາ ແລະ ວ່າງ = ສົ່ງສຳເລັດ", () => {
  assert.equal(parseStatus("ສົ່ງສຳເລັດ"), "DELIVERED");
  assert.equal(parseStatus("ຕີກັບ"), "RETURNED");
  assert.equal(parseStatus("ຍົກເລີກ"), "CANCELLED");
  assert.equal(parseStatus("Shipped"), "SHIPPED");
  assert.equal(parseStatus(""), "DELIVERED");
});

test("ອ່ານທັງໄຟລ໌ ແລະ ບອກແຖວທີ່ຜິດພ້ອມເລກແຖວແບບ Excel", () => {
  const csv = [
    "ວັນທີ່,ຊື່ລູກຄ້າ,ຍອດຂາຍ,ຕົ້ນທຶນ,ຄ່າສົ່ງ,ສະຖານະ",
    "2026-08-20,ນາງ ກ,150000,90000,20000,ສົ່ງສຳເລັດ",
    "ບໍ່ຮູ້,ນາງ ຂ,100000,,,",
    "2026-08-21,ນາງ ຄ,0,,,",
    "21/08/2026,ນາງ ງ,\"250,000\",120000,20000,ຕີກັບ",
  ].join("\n");

  const r = parseOrderCsv(csv);
  assert.equal(r.missing.length, 0);
  assert.equal(r.orders.length, 2);
  assert.equal(r.errors.length, 2);
  assert.equal(r.errors[0].rowNumber, 3); // ແຖວ 3 ໃນ Excel
  assert.equal(r.errors[1].rowNumber, 4);

  assert.equal(r.orders[0].saleAmount, 150000);
  assert.equal(r.orders[0].status, "DELIVERED");
  assert.equal(r.orders[1].saleAmount, 250000);
  assert.equal(r.orders[1].status, "RETURNED");
  assert.equal(r.orders[1].date, "2026-08-21");
});

test("ຂາດຄໍລຳຈຳເປັນ → ບອກກ່ອນ ບໍ່ນຳເຂົ້າຫຍັງເລີຍ", () => {
  const r = parseOrderCsv("ຊື່ລູກຄ້າ,ເບີໂທ\nນາງ ກ,020123");
  assert.deepEqual(r.missing, ["date", "saleAmount"]);
  assert.equal(r.orders.length, 0);
});

test("ໄຟລ໌ເປັນໂດລາຖືກແປງເປັນກີບຕອນນຳເຂົ້າ", () => {
  const csv = "ວັນທີ່,ຍອດຂາຍ\n2026-08-20,10";
  const r = parseOrderCsv(csv, { fxRate: 21700 });
  assert.equal(r.orders[0].saleAmount, 217000);
});

test("ຊື່ລູກຄ້າວ່າງ ບໍ່ເຮັດໃຫ້ແຖວຕົກ", () => {
  const r = parseOrderCsv("ວັນທີ່,ຊື່ລູກຄ້າ,ຍອດຂາຍ\n2026-08-20,,50000");
  assert.equal(r.orders.length, 1);
  assert.ok(r.orders[0].customerName.length > 0);
});
