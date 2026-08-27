import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEVERITY_ICON,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_TONE,
  countActionable,
  sortAlerts,
  type Alert,
  type Severity,
} from "./alert-types";

/**
 * ໜ້າຫຼັກສະແດງການແຈ້ງເຕືອນພຽງສອງສາມອັນທຳອິດ — ລຳດັບຈຶ່ງເປັນເລື່ອງເປັນ-ຕາຍ.
 * ຖ້າ "ງົບລວມໝົດແລ້ວ" ຕົກໄປລຳດັບທ້າຍ ຄົນຈະບໍ່ເຫັນຈົນກວ່າຈະສາຍເກີນໄປ.
 */

const ALL_SEVERITIES: Severity[] = ["critical", "serious", "warning", "info"];

function alert(severity: Severity, title: string): Alert {
  return { id: title, severity, category: "ທົດສອບ", title, detail: "" };
}

test("ທຸກລະດັບມີລຳດັບ, ຄຳອ່ານ, ສີ ແລະ ໄອຄອນຄົບ", () => {
  // ຂາດອັນໃດອັນໜຶ່ງ = ໜ້າຈໍສະແດງ undefined ໂດຍບໍ່ພັງ ຈຶ່ງບໍ່ມີໃຜເຫັນ
  for (const s of ALL_SEVERITIES) {
    assert.equal(typeof SEVERITY_ORDER[s], "number", `ລຳດັບຂອງ ${s}`);
    assert.ok(SEVERITY_LABEL[s], `ຄຳອ່ານຂອງ ${s}`);
    assert.ok(SEVERITY_TONE[s], `ສີຂອງ ${s}`);
    assert.ok(SEVERITY_ICON[s], `ໄອຄອນຂອງ ${s}`);
  }
});

test("ໄອຄອນບໍ່ຊ້ຳກັນ — ຄວາມໝາຍບໍ່ຂຶ້ນກັບສີຢ່າງດຽວ", () => {
  const icons = ALL_SEVERITIES.map((s) => SEVERITY_ICON[s]);
  assert.equal(new Set(icons).size, icons.length);
});

test("ດ່ວນທີ່ສຸດຂຶ້ນກ່ອນ ເບົາທີ່ສຸດຢູ່ທ້າຍ", () => {
  const sorted = sortAlerts([
    alert("info", "ຮັບຮູ້"),
    alert("warning", "ລະວັງ"),
    alert("critical", "ດ່ວນ"),
    alert("serious", "ຕ້ອງເບິ່ງ"),
  ]);
  assert.deepEqual(
    sorted.map((a) => a.severity),
    ["critical", "serious", "warning", "info"],
  );
});

test("ຮ້າຍແຮງເທົ່າກັນ ຮຽງຕາມຊື່ ລຳດັບຈຶ່ງບໍ່ກະໂດດໄປມາ", () => {
  const sorted = sortAlerts([
    alert("warning", "ຂ"),
    alert("warning", "ກ"),
    alert("warning", "ຄ"),
  ]);
  assert.deepEqual(
    sorted.map((a) => a.title),
    ["ກ", "ຂ", "ຄ"],
  );
});

test("ຮຽງແລ້ວບໍ່ໄປແກ້ລາຍການເດີມ", () => {
  const original = [alert("info", "ຂ"), alert("critical", "ກ")];
  const sorted = sortAlerts(original);
  assert.equal(original[0].severity, "info", "ຂອງເດີມຕ້ອງຄືເກົ່າ");
  assert.equal(sorted[0].severity, "critical");
});

test("ນັບສະເພາະອັນທີ່ຕ້ອງລົງມືເຮັດ", () => {
  const alerts = [
    alert("critical", "ກ"),
    alert("serious", "ຂ"),
    alert("warning", "ຄ"),
    alert("info", "ງ"),
    alert("info", "ຈ"),
  ];
  // ປ້າຍໃນເມນູນັບອັນນີ້ — "ຮັບຮູ້ໄວ້" ບໍ່ຄວນເຮັດໃຫ້ປ້າຍແດງຄ້າງຕະຫຼອດ
  assert.equal(countActionable(alerts), 3);
  assert.equal(countActionable([]), 0);
  assert.equal(countActionable([alert("info", "ກ")]), 0);
});
