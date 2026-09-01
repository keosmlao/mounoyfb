#!/usr/bin/env bash
#
# ໂອນຄວາມເປັນເຈົ້າຂອງຕາຕະລາງໃນຖານຂໍ້ມູນໃຫ້ **user ທີ່ແອັບໃຊ້ຕໍ່**
#
#     sudo bash deploy/fix-db-owner.sh
#
# ເປັນຫຍັງຕ້ອງມີ: ຕອນກູ້ຂໍ້ມູນຈາກໄຟລ໌ສຳຮອງ ຕາຕະລາງກາຍເປັນຂອງ user ທີ່ກູ້
# (ປົກກະຕິ `postgres`) ສ່ວນແອັບຕໍ່ດ້ວຍ user ອື່ນ. ອ່ານ/ຂຽນຂໍ້ມູນຍັງໄດ້ຢູ່
# ແຕ່ `prisma migrate deploy` **ລົ້ມ** ເພາະການແກ້ໂຄງສ້າງຕາຕະລາງ
# (`ALTER TABLE`) ເຮັດໄດ້ແຕ່ເຈົ້າຂອງ:
#
#     ERROR: must be owner of table FbComment
#
# ແລ່ນເທື່ອດຽວກໍ່ພໍ — ຫຼັງຈາກນີ້ການອັບເດດຄັ້ງຕໍ່ໄປຈະຜ່ານເອງ.
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "✗ ຕ້ອງແລ່ນດ້ວຍ sudo" >&2; exit 1; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
[ -f "$APP_DIR/.env" ] || { echo "✗ ບໍ່ພົບ $APP_DIR/.env" >&2; exit 1; }

# ອ່ານ DATABASE_URL ໂດຍບໍ່ພິມອອກໜ້າຈໍ (ໃນນັ້ນມີລະຫັດຜ່ານ)
DB_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
DB_URL="${DB_URL%%\?*}"
[ -n "$DB_URL" ] || { echo "✗ ບໍ່ພົບ DATABASE_URL" >&2; exit 1; }

# ຖາມຖານຂໍ້ມູນເອງວ່າແອັບຕໍ່ເຂົ້າມາເປັນໃຜ ແລະ ຖານໃດ — ບໍ່ຕ້ອງເດົາຈາກ URL
OWNER="$(psql "$DB_URL" -Atc 'select current_user')"
DB="$(psql "$DB_URL" -Atc 'select current_database()')"
echo "→ ຖານຂໍ້ມູນ '$DB' · ໂອນໃຫ້ user '$OWNER'"

# ຍ້າຍໄປໂຟນເດີທີ່ user `postgres` ເຂົ້າໄດ້ — ບໍ່ດັ່ງນັ້ນ psql ຈະເຕືອນ
# "could not change directory to ..." ທຸກເທື່ອ (ບ້ານຂອງຜູ້ໃຊ້ປິດສິດໄວ້)
cd /tmp

SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT

# ສ້າງຄຳສັ່ງຈາກລາຍການຈິງ — ຕາຕະລາງ, ລຳດັບ, ວິວ ແລະ enum ຂອງ schema public
sudo -u postgres psql -d "$DB" -Atc "
  select format('ALTER TABLE public.%I OWNER TO %I;', tablename, '$OWNER')
    from pg_tables where schemaname = 'public'
  union all
  select format('ALTER SEQUENCE public.%I OWNER TO %I;', sequencename, '$OWNER')
    from pg_sequences where schemaname = 'public'
  union all
  select format('ALTER VIEW public.%I OWNER TO %I;', viewname, '$OWNER')
    from pg_views where schemaname = 'public'
  union all
  select format('ALTER TYPE public.%I OWNER TO %I;', t.typname, '$OWNER')
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
" > "$SQL"

# ຕາຕະລາງໃໝ່ໃນອະນາຄົດຕ້ອງສ້າງໄດ້ນຳ ບໍ່ດັ່ງນັ້ນ migration ຕໍ່ໄປກໍ່ຍັງລົ້ມ
echo "GRANT USAGE, CREATE ON SCHEMA public TO \"$OWNER\";" >> "$SQL"

COUNT="$(grep -c '^ALTER' "$SQL" || true)"
# ສົ່ງຜ່ານ stdin ບໍ່ແມ່ນ -f ເພາະໄຟລ໌ຊົ່ວຄາວເປັນຂອງ root (ສິດ 600)
# ແລ້ວ user `postgres` ຈະເປີດອ່ານເອງບໍ່ໄດ້ — root ເປັນຄົນເປີດໃຫ້ແທນ
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q < "$SQL"

echo "✓ ໂອນແລ້ວ $COUNT ລາຍການ"
echo "  ຕໍ່ໄປ: cd $APP_DIR && npx prisma migrate deploy"
