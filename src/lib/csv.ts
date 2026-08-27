/**
 * ຕົວອ່ານ CSV — ຂຽນເອງເພາະຕ້ອງການແຕ່ການອ່ານ ແລະ ບໍ່ຢາກເພີ່ມ dependency.
 *
 * ຮອງຮັບສິ່ງທີ່ພົບຈິງເມື່ອຄົນ export ຈາກ Excel / Google Sheets:
 * - ຄ່າທີ່ມີເຄື່ອງໝາຍຄຳເວົ້າ ແລະ ມີຈຸດຄັ່ນຢູ່ຂ້າງໃນ  →  "ໂທລະສັບ, ສາຍສາກ"
 * - ເຄື່ອງໝາຍຄຳເວົ້າຊ້ອນ                            →  "ຂະໜາດ 6"" ນິ້ວ"
 * - ຂຶ້ນແຖວໃໝ່ພາຍໃນຄ່າ
 * - ຕົວຄັ່ນເປັນ tab (ຕອນວາງຈາກ Google Sheets ໂດຍກົງ)
 * - BOM ຈາກ Excel ພາສາລາວ/ໄທ
 */

/** ເດົາຕົວຄັ່ນຈາກແຖວທຳອິດ — ນອກວົງເລັບຄຳເວົ້າເທົ່ານັ້ນ */
export function detectDelimiter(text: string): string {
  const line = text.slice(0, 5000).split(/\r?\n/)[0] ?? "";
  const counts = [",", "\t", ";", "|"].map((d) => {
    let n = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') quoted = !quoted;
      else if (c === d && !quoted) n++;
    }
    return { d, n };
  });
  const best = counts.sort((a, b) => b.n - a.n)[0];
  return best.n > 0 ? best.d : ",";
}

/** ອ່ານ CSV ທັງກ້ອນເປັນຕາຕະລາງ — ແຖວວ່າງທັງແຖວຖືກຂ້າມ */
export function parseCsv(text: string, delimiter?: string): string[][] {
  // ລຶບ BOM ບໍ່ດັ່ງນັ້ນຫົວຄໍລຳທຳອິດຈະຈັບຄູ່ບໍ່ໄດ້
  const src = text.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(src);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === d) endField();
    else if (c === "\n") endRow();
    else if (c === "\r") continue;
    else field += c;
  }
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/** ຫຍໍ້ຫົວຄໍລຳໃຫ້ປຽບທຽບໄດ້ — ຕັດຊ່ອງວ່າງ, ວົງເລັບ ແລະ ຕົວພິມໃຫຍ່ນ້ອຍ */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[\s_\-.]/g, "")
    .trim();
}

// ------------------------------------------------------------------ ຂຽນ CSV

/** ຫຸ້ມຄ່າດຽວໃຫ້ປອດໄພ — ຄ່າທີ່ມີຈຸດຄັ່ນ, ຄຳເວົ້າ ຫຼື ຂຶ້ນແຖວ ຕ້ອງໃສ່ວົງເລັບ */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * ສ້າງໄຟລ໌ CSV ທັງກ້ອນ.
 *
 * ຂຶ້ນຕົ້ນດ້ວຍ **BOM** ສະເໝີ — ຖ້າບໍ່ມີ Excel ຢູ່ Windows ຈະອ່ານ UTF-8
 * ເປັນ ANSI ແລ້ວຊື່ພາສາລາວກາຍເປັນຕົວອັກສອນຂີ້ເຫຍື້ອທັງໄຟລ໌.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return `\ufeff${lines.join("\n")}\n`;
}

/** ຫົວຕອບມາດຕະຖານຂອງໄຟລ໌ CSV ທີ່ໃຫ້ໂຫຼດລົງເຄື່ອງ */
export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
