#!/usr/bin/env bash
#
# ສຳຮອງຖານຂໍ້ມູນຈາກ **ເຄື່ອງຕົນເອງ** ເພື່ອເອົາຂຶ້ນເຊີບເວີ.
#
#     bash deploy/dump-db.sh
#
# ໄຟລ໌ຖືກເກັບໄວ້ deploy/dump/fbmonoy.sql.gz ຊຶ່ງ **ຢູ່ນອກ git**
# ເພາະໃນຖານຂໍ້ມູນມີ Facebook access token — ຫ້າມ push ຂຶ້ນ GitHub.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT_DIR="deploy/dump"
OUT="$OUT_DIR/fbmonoy.sql.gz"

[ -f .env ] || { echo "✗ ບໍ່ພົບ .env" >&2; exit 1; }

# ອ່ານ DATABASE_URL ໂດຍບໍ່ພິມອອກໜ້າຈໍ
DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
[ -n "$DB_URL" ] || { echo "✗ ບໍ່ພົບ DATABASE_URL ໃນ .env" >&2; exit 1; }

# ຕັດ ?schema=public ອອກ — ເປັນພາຣາມິເຕີຂອງ Prisma ທີ່ pg_dump ບໍ່ຮູ້ຈັກ
DB_URL="${DB_URL%%\?*}"

mkdir -p "$OUT_DIR"

# --no-owner / --no-acl : ໃຫ້ restore ເຂົ້າຜູ້ໃຊ້ໃດກໍ່ໄດ້ຢູ່ເຊີບເວີ
# --clean --if-exists   : ບໍ່ໃສ່ ເພາະ restore ໃສ່ຖານຂໍ້ມູນເປົ່າເທົ່ານັ້ນ
pg_dump --no-owner --no-acl --format=plain "$DB_URL" | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
TABLES="$(gunzip -c "$OUT" | grep -c '^CREATE TABLE' || true)"
ROWS="$(gunzip -c "$OUT" | grep -c '^COPY ' || true)"

cat <<EOF

✓ ສຳຮອງແລ້ວ: $OUT  ($SIZE)
  ຕາຕະລາງ $TABLES · ຊຸດຂໍ້ມູນ $ROWS

⚠️  ໄຟລ໌ນີ້ມີ Facebook access token ຢູ່ຂ້າງໃນ
    ຢູ່ນອກ git ແລ້ວ — ສົ່ງຜ່ານ rsync/scp ເທົ່ານັ້ນ ຢ່າແນບທາງແຊັດ

ຂັ້ນຕໍ່ໄປ — ສົ່ງຂຶ້ນເຊີບເວີ:
  rsync -az deploy/dump/ ຜູ້ໃຊ້@ເຊີບເວີ:/ບ່ອນທີ່ວາງໂຄດ/deploy/dump/
EOF
