#!/usr/bin/env bash
#
# ຕິດຕັ້ງ FBMONOY ຢູ່ເຊີບເວີ Ubuntu/Debian ໃນຮອບດຽວ.
#
# ແລ່ນ **ຢູ່ເຊີບເວີ** ຫຼັງຈາກເອົາໂຄດຂຶ້ນໄປແລ້ວ:
#     cd /opt/fbmonoy && sudo DOMAIN=example.com bash deploy/install.sh
#
# ບໍ່ໃສ່ DOMAIN ກໍ່ໄດ້ — ຈະຂ້າມ nginx ແລະ HTTPS ໄປ ແລ້ວແອັບຟັງຢູ່ 127.0.0.1:3000
#
# ແລ່ນຊ້ຳໄດ້ — ສິ່ງທີ່ມີແລ້ວຈະຖືກຂ້າມ ບໍ່ແມ່ນສ້າງທັບ.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
APP_DIR="${APP_DIR:-/opt/fbmonoy}"
APP_USER="${APP_USER:-mn}"
DB_NAME="fbmonoy"
DB_USER="fbmonoy"
PORT=3000

say()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "ຕ້ອງແລ່ນດ້ວຍ sudo"
[ -f "$APP_DIR/package.json" ] || die "ບໍ່ພົບໂຄດຢູ່ $APP_DIR — ເອົາໂຄດຂຶ້ນມາກ່ອນ"

# ---------------------------------------------------------------- 1. ແພັກເກັດ
say "ຕິດຕັ້ງແພັກເກັດທີ່ຕ້ອງການ"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

for pkg in nginx postgresql certbot python3-certbot-nginx rsync; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then ok "$pkg ມີແລ້ວ"
  else apt-get install -y -qq "$pkg" && ok "ຕິດຕັ້ງ $pkg"; fi
done

if command -v node >/dev/null 2>&1 && [ "$(node -v | cut -c2- | cut -d. -f1)" -ge 20 ]; then
  ok "Node $(node -v) ມີແລ້ວ"
else
  say "ຕິດຕັ້ງ Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
  ok "Node $(node -v)"
fi

# ------------------------------------------------------------- 2. ຖານຂໍ້ມູນ
say "ຕັ້ງຖານຂໍ້ມູນ"
systemctl enable --now postgresql >/dev/null 2>&1 || true

# ລະຫັດ DB ຕ້ອງກົງກັບ .env ສະເໝີ — ຖ້າ .env ມີຢູ່ແລ້ວໃຫ້ຖືເປັນຫຼັກ
# (ບໍ່ດັ່ງນັ້ນ .env ຊີ້ລະຫັດໜຶ່ງ ແຕ່ Postgres ໃຊ້ອີກລະຫັດ ແລ້ວຕໍ່ບໍ່ໄດ້)
DB_PASS=""
if [ -f "$APP_DIR/.env" ]; then
  DB_PASS="$(grep -oP '(?<=://'"$DB_USER"':)[^@]+' "$APP_DIR/.env" 2>/dev/null || true)"
fi
[ -n "$DB_PASS" ] || DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  # ບັງຄັບໃຫ້ລະຫັດກົງກັບ .env — ກັນກໍລະນີສ້າງໄວ້ກ່ອນດ້ວຍລະຫັດອື່ນ
  sudo -u postgres psql -qc "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
  ok "ຜູ້ໃຊ້ $DB_USER ມີແລ້ວ — ຊິງລະຫັດໃຫ້ກົງກັບ .env"
else
  sudo -u postgres psql -qc "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  ok "ສ້າງຜູ້ໃຊ້ $DB_USER"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  ok "ຖານຂໍ້ມູນ $DB_NAME ມີແລ້ວ"
else
  sudo -u postgres psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  ok "ສ້າງຖານຂໍ້ມູນ $DB_NAME"
fi

# ຢືນຢັນວ່າແອັບຈະຕໍ່ໄດ້ຈິງ ກ່ອນໄປຕໍ່ — ດີກວ່າໄປລົ້ມຕອນ migrate
PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1" >/dev/null 2>&1 \
  && ok "ຕໍ່ຖານຂໍ້ມູນດ້ວຍລະຫັດນີ້ໄດ້" \
  || die "ຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ — ກວດ pg_hba.conf ວ່າອະນຸຍາດ md5/scram ຈາກ localhost ບໍ່"

# ------------------------------------------------------------------ 3. .env
say "ຕັ້ງຄ່າ .env"
if [ -f "$APP_DIR/.env" ]; then
  ok ".env ມີແລ້ວ — ບໍ່ຂຽນທັບ"
  # ບັງຄັບ COOKIE_SECURE=1 ເພາະຈະເປີດອອກອິນເຕີເນັດ
  if grep -q '^COOKIE_SECURE=' "$APP_DIR/.env"; then
    sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=1/' "$APP_DIR/.env"
  else
    echo 'COOKIE_SECURE=1' >> "$APP_DIR/.env"
  fi
  ok "ບັງຄັບ COOKIE_SECURE=1"
  APP_PASSWORD="$(grep -oP '(?<=^APP_PASSWORD=).*' "$APP_DIR/.env" | tr -d '"')"
  [ -n "$APP_PASSWORD" ] || die "ບໍ່ພົບ APP_PASSWORD ໃນ .env — ໃສ່ກ່ອນ ບໍ່ດັ່ງນັ້ນ login ບໍ່ໄດ້"
else
  APP_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')"
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"

# ລະຫັດຜ່ານເຂົ້າລະບົບ (ໃຊ້ຮ່ວມກັນທັງທີມ)
APP_PASSWORD=$APP_PASSWORD
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
# ເປີດອອກອິນເຕີເນັດຜ່ານ HTTPS — ບັງຄັບໃຫ້ cookie ສົ່ງສະເພາະ https
COOKIE_SECURE=1

FB_API_VERSION="v25.0"
FB_ACCESS_TOKEN=""
EOF
  ok "ສ້າງ .env ໃໝ່"
fi
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# ------------------------------------------------------------- 4. build ແອັບ
say "ຕິດຕັ້ງ ແລະ build (ໃຊ້ເວລາ 2-5 ນາທີ)"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"
# ຖ້າມີໄຟລ໌ສຳຮອງມານຳ ແລະ ຖານຂໍ້ມູນຍັງເປົ່າ ໃຫ້ກູ້ຄືນກ່ອນ —
# dump ມີໂຄງສ້າງ ແລະ ປະຫວັດ migration ຢູ່ແລ້ວ migrate deploy ຈຶ່ງຮູ້ວ່າອັນໃດແລ່ນແລ້ວ
DUMP="$APP_DIR/deploy/dump/fbmonoy.sql.gz"
TABLE_COUNT=$(sudo -u postgres psql -tAd "$DB_NAME" -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo 0)

if [ -f "$DUMP" ] && [ "${TABLE_COUNT:-0}" -eq 0 ]; then
  say "ກູ້ຂໍ້ມູນຈາກໄຟລ໌ສຳຮອງ"
  gunzip -c "$DUMP" | sudo -u postgres psql -q -d "$DB_NAME" >/dev/null
  sudo -u postgres psql -qd "$DB_NAME" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER;"
  sudo -u postgres psql -qd "$DB_NAME" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
  ok "ກູ້ຂໍ້ມູນແລ້ວ"
elif [ -f "$DUMP" ]; then
  warn "ມີໄຟລ໌ສຳຮອງ ແຕ່ຖານຂໍ້ມູນມີຕາຕະລາງຢູ່ແລ້ວ ($TABLE_COUNT) — ຂ້າມການກູ້ຄືນ"
fi

sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npx prisma migrate deploy"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm run build"
ok "build ສຳເລັດ"

# ------------------------------------------------------------- 5. ບໍລິການ
say "ຕັ້ງໃຫ້ແລ່ນເປັນບໍລິການ"
sed "s|/opt/fbmonoy|$APP_DIR|g; s|^User=.*|User=$APP_USER|" \
  "$APP_DIR/deploy/fbmonoy.service" > /etc/systemd/system/fbmonoy.service
systemctl daemon-reload
systemctl enable --now fbmonoy
sleep 3
systemctl is-active --quiet fbmonoy \
  && ok "ບໍລິການແລ່ນຢູ່" \
  || die "ບໍລິການບໍ່ຂຶ້ນ — ເບິ່ງດ້ວຍ: journalctl -u fbmonoy -n 50"

for i in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null \
  && ok "ແອັບຕອບສະໜອງ ແລະ ຕໍ່ຖານຂໍ້ມູນໄດ້" \
  || warn "ແອັບຍັງບໍ່ຕອບ — ເບິ່ງ journalctl -u fbmonoy -n 50"

# --------------------------------------------------------------- 6. nginx
if [ -z "$DOMAIN" ]; then
  warn "ບໍ່ໄດ້ໃສ່ DOMAIN — ຂ້າມ nginx ແລະ HTTPS"
  warn "ແອັບຟັງຢູ່ 127.0.0.1:$PORT · ຕັ້ງພາຍຫຼັງ: sudo DOMAIN=... bash deploy/install.sh"
else
say "ຕັ້ງ nginx"
mkdir -p /var/www/certbot
sed "s|__DOMAIN__|$DOMAIN|g" \
  "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/fbmonoy
ln -sf /etc/nginx/sites-available/fbmonoy /etc/nginx/sites-enabled/fbmonoy
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default && ok "ເອົາ default site ອອກ"
nginx -t >/dev/null 2>&1 || die "nginx config ຜິດ — ກວດດ້ວຍ: nginx -t"
systemctl reload nginx
ok "nginx ພ້ອມ"

# -------------------------------------------------------------- 7. HTTPS
say "ຂໍໃບຮັບຮອງ HTTPS"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  ok "ມີໃບຮັບຮອງແລ້ວ — ຂ້າມ"
else
  warn "ຕ້ອງໃຫ້ port 80 ເຂົ້າເຖິງໄດ້ຈາກອິນເຕີເນັດ"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
       --register-unsafely-without-email --redirect; then
    ok "ໄດ້ໃບຮັບຮອງແລ້ວ"
  else
    warn "ຂໍໃບຮັບຮອງບໍ່ໄດ້ — ມັກເປັນເພາະ router ຍັງບໍ່ໄດ້ forward port 80"
    warn "ແກ້ router ແລ້ວແລ່ນ: sudo certbot --nginx -d $DOMAIN --redirect"
  fi
fi
fi

# ------------------------------------------------------------- 8. ສຳຮອງ DB
say "ຕັ້ງການສຳຮອງຖານຂໍ້ມູນທຸກຄືນ"
mkdir -p /var/backups/fbmonoy
cat > /etc/cron.daily/fbmonoy-backup <<EOF
#!/bin/sh
# ສຳຮອງ 14 ວັນຫຼ້າສຸດ
sudo -u postgres pg_dump $DB_NAME | gzip > /var/backups/fbmonoy/\$(date +%F).sql.gz
find /var/backups/fbmonoy -name '*.sql.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/fbmonoy-backup
ok "ສຳຮອງໄວ້ /var/backups/fbmonoy (ເກັບ 14 ວັນ)"

# ------------------------------------------------------------------ ສະຫຼຸບ
cat <<EOF

────────────────────────────────────────────────
 ຕິດຕັ້ງສຳເລັດ

 ເວັບ            ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://127.0.0.1:3000 (ຍັງບໍ່ໄດ້ຕັ້ງ nginx)}
 ລະຫັດເຂົ້າລະບົບ  $APP_PASSWORD

 ຄຳສັ່ງທີ່ໃຊ້ເລື້ອຍ
   systemctl status fbmonoy       ສະຖານະ
   journalctl -u fbmonoy -f       log ສົດ
   systemctl restart fbmonoy      restart

 ຂັ້ນຕໍ່ໄປ
   1. ເປີດເວັບ ແລ້ວ login ດ້ວຍລະຫັດຂ້າງເທິງ
   2. ໄປໜ້າ ຕັ້ງຄ່າ → ໃສ່ Facebook token → ດຶງຂໍ້ມູນ
────────────────────────────────────────────────
EOF
