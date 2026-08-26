# ຕິດຕັ້ງ FBMONOY ຢູ່ເຊີບເວີ

ເປົ້າໝາຍ: `https://mounoyfb.odienmall.com` → nginx → Next.js (127.0.0.1:3000) → Postgres

```
ອິນເຕີເນັດ ──443──▶ nginx ──▶ 127.0.0.1:3000 ──▶ Postgres (localhost)
                     │
                     └── ໃບຮັບຮອງຈາກ Let's Encrypt (certbot ຕໍ່ອາຍຸເອງ)
```

## ຕ້ອງມີກ່ອນ

| ລາຍການ | ກວດແນວໃດ |
|---|---|
| DNS ສາທາລະນະຊີ້ມາຫາ IP ຂອງເຮົາ | `nslookup mounoyfb.odienmall.com 8.8.8.8` |
| Router forward port **80** ແລະ **443** ມາຫາເຊີບເວີ | ບໍ່ດັ່ງນັ້ນ certbot ຈະຢືນຢັນບໍ່ໄດ້ |
| Node 20+ ແລະ PostgreSQL ຢູ່ເຊີບເວີ | `node -v` · `psql --version` |

> ⚠️ **port 80 ຕ້ອງເປີດຈາກອິນເຕີເນັດ** ຕອນຂໍໃບຮັບຮອງ ແລະ ຕອນຕໍ່ອາຍຸທຸກ 90 ວັນ

## ວິທີໄວ — 2 ຄຳສັ່ງ

**1. ຈາກເຄື່ອງຕົນເອງ** — ເອົາໂຄດຂຶ້ນເຊີບເວີ (ຖາມລະຫັດ SSH ເທື່ອດຽວ)

```bash
# -t ຈຳເປັນ — ບໍ່ດັ່ງນັ້ນ sudo ຢູ່ປາຍທາງຖາມລະຫັດບໍ່ໄດ້
ssh -t mn@10.0.40.77 'sudo mkdir -p /opt/fbmonoy && sudo chown $USER /opt/fbmonoy'

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .env \
  ./ mn@10.0.40.77:/opt/fbmonoy/
```

> ຖາມລະຫັດ 3 ເທື່ອ (ssh → sudo → rsync) — ໃຊ້ລະຫັດອັນດຽວກັນໝົດ

**1.5 (ທາງເລືອກ) ເອົາຂໍ້ມູນປັດຈຸບັນຂຶ້ນນຳ** — ຖ້າຢາກໃຫ້ເຊີບເວີມີຂໍ້ມູນເລີຍ

```bash
bash deploy/dump-db.sh
rsync -az deploy/dump/ mn@10.0.40.77:/opt/fbmonoy/deploy/dump/
```

> ⚠️ ໄຟລ໌ສຳຮອງ **ມີ Facebook access token ຢູ່ຂ້າງໃນ** — ຢູ່ນອກ git ແລ້ວ
> ສົ່ງຜ່ານ rsync/scp ເທົ່ານັ້ນ ຢ່າແນບທາງແຊັດ ຫຼື push ຂຶ້ນ GitHub
>
> ຖ້າຂ້າມຂັ້ນນີ້ ເຊີບເວີຈະສ້າງຕາຕະລາງເປົ່າໃຫ້ (ໃຊ້ໄດ້ປົກກະຕິ ແຕ່ຕ້ອງໃສ່
> token ແລະ ດຶງຂໍ້ມູນໃໝ່ເອງ)

**2. ຢູ່ເຊີບເວີ** — ຕິດຕັ້ງທັງໝົດ

```bash
ssh mn@10.0.40.77
cd /opt/fbmonoy && sudo bash deploy/install.sh
```

ສະຄຣິບຈະ: ຕິດຕັ້ງ Node/Postgres/nginx/certbot → ສ້າງ DB ແລະ ລະຫັດແບບສຸ່ມ →
**ກູ້ຂໍ້ມູນຈາກໄຟລ໌ສຳຮອງ (ຖ້າມີ)** →
build → ຕັ້ງ systemd → ຕັ້ງ nginx → ຂໍໃບຮັບຮອງ HTTPS → ຕັ້ງສຳຮອງ DB ທຸກຄືນ
ແລ້ວພິມ **ລະຫັດເຂົ້າລະບົບ** ອອກມາໃຫ້ຕອນທ້າຍ.

ແລ່ນຊ້ຳໄດ້ປອດໄພ — ສິ່ງທີ່ມີແລ້ວຈະຖືກຂ້າມ ບໍ່ແມ່ນສ້າງທັບ.

### ອັບເດດພາຍຫຼັງ

```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
  --exclude .env ./ mn@10.0.40.77:/opt/fbmonoy/
ssh mn@10.0.40.77 'cd /opt/fbmonoy && npm ci && npx prisma migrate deploy && npm run build && sudo systemctl restart fbmonoy'
```

---

## ວິທີເຮັດເອງເທື່ອລະຂັ້ນ

### 1. ຕິດຕັ້ງສິ່ງທີ່ຕ້ອງການ

```bash
sudo apt update
sudo apt install -y nginx postgresql certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. ສ້າງຖານຂໍ້ມູນ

```bash
sudo -u postgres psql <<'SQL'
CREATE USER fbmonoy WITH PASSWORD 'ປ່ຽນລະຫັດນີ້';
CREATE DATABASE fbmonoy OWNER fbmonoy;
SQL
```

### 3. ເອົາໂຄດຂຶ້ນເຊີບເວີ

```bash
sudo mkdir -p /opt/fbmonoy && sudo chown $USER:$USER /opt/fbmonoy
# ຈາກເຄື່ອງຕົນເອງ:
rsync -av --exclude node_modules --exclude .next --exclude .env \
      ./ mn@10.0.40.77:/opt/fbmonoy/
```

### 4. ຕັ້ງຄ່າ `.env` ຢູ່ເຊີບເວີ

```bash
cd /opt/fbmonoy
cat > .env <<EOF
DATABASE_URL="postgresql://fbmonoy:ລະຫັດຈາກຂັ້ນ2@localhost:5432/fbmonoy?schema=public"
APP_PASSWORD="$(openssl rand -base64 12)"
SESSION_SECRET="$(openssl rand -base64 48)"
COOKIE_SECURE=1
FB_API_VERSION="v25.0"
EOF
chmod 600 .env
grep APP_PASSWORD .env    # ← ຈື່ລະຫັດນີ້ໄວ້ ໃຊ້ເຂົ້າລະບົບ
```

> **`COOKIE_SECURE=1` ຈຳເປັນ** ເມື່ອເປີດອອກອິນເຕີເນັດ — ບໍ່ດັ່ງນັ້ນ cookie
> ຈະຖືກສົ່ງແບບບໍ່ເຂົ້າລະຫັດ ແລະ ຖືກດັກເອົາໄດ້

### 5. ຕິດຕັ້ງ ແລະ build

```bash
cd /opt/fbmonoy
npm ci
npx prisma migrate deploy     # ສ້າງຕາຕະລາງ (ບໍ່ລຶບຂໍ້ມູນ ຕ່າງຈາກ migrate dev)
npm run build
```

### 6. ໃຫ້ແລ່ນເປັນບໍລິການ

```bash
sudo cp deploy/fbmonoy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fbmonoy
systemctl status fbmonoy
```

### 7. nginx

```bash
sudo mkdir -p /var/www/certbot
sudo cp deploy/nginx-mounoyfb.conf /etc/nginx/sites-available/mounoyfb
sudo ln -sf /etc/nginx/sites-available/mounoyfb /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

ກວດວ່າຜ່ານ http ໄດ້ກ່ອນ: `curl -I http://mounoyfb.odienmall.com`

### 8. ໃບຮັບຮອງ HTTPS

```bash
sudo certbot --nginx -d mounoyfb.odienmall.com --agree-tos -m ຊື່ອີເມວ --redirect
sudo systemctl list-timers | grep certbot   # ຕໍ່ອາຍຸເອງ
```

## ອັບເດດພາຍຫຼັງ

```bash
cd /opt/fbmonoy
git pull            # ຫຼື rsync ຄືນຈາກເຄື່ອງຕົນເອງ
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart fbmonoy
```

## ສຳຮອງຖານຂໍ້ມູນ

```bash
# ໃສ່ໃນ crontab -e ໃຫ້ແລ່ນທຸກຄືນ ຕີ 2
0 2 * * * pg_dump -U fbmonoy fbmonoy | gzip > /var/backups/fbmonoy-$(date +\%F).sql.gz
```

## ແກ້ບັນຫາ

| ອາການ | ສາເຫດທີ່ພົບຫຼາຍ |
|---|---|
| `502 Bad Gateway` | ບໍລິການບໍ່ແລ່ນ — `journalctl -u fbmonoy -n 50` |
| certbot ວ່າຢືນຢັນບໍ່ໄດ້ | port 80 ບໍ່ໄດ້ forward ຈາກອິນເຕີເນັດ |
| login ແລ້ວເດັ້ງກັບໜ້າ login | `COOKIE_SECURE=1` ແຕ່ເຂົ້າຜ່ານ http — ໃຫ້ໃຊ້ https |
| ດຶງ Facebook ບໍ່ໄດ້ | ເຊີບເວີອອກອິນເຕີເນັດບໍ່ໄດ້ ຫຼື token ໝົດອາຍຸ |
| `Database "fbmonoy" does not exist` | ຍັງບໍ່ໄດ້ແລ່ນ `install.sh` — ມັນສ້າງ DB ໃຫ້ |
| ໜ້າເປີດຊ້າ 5 ວິນາທີ | ກຳລັງແລ່ນ `npm run dev` — ຢູ່ເຊີບເວີຕ້ອງໃຊ້ production |

## ຢ່າແລ່ນ `npm run dev` ຢູ່ເຊີບເວີ

`next dev` compile ໃໝ່ທຸກເທື່ອທີ່ເປີດໜ້າ (ຊ້າ 5 ວິນາທີ), ເປີດເຜີຍ source code
ຜ່ານ source map, ກິນໜ່ວຍຄວາມຈຳຫຼາຍ ແລະ ດັບແລ້ວບໍ່ຟື້ນເອງ.

ໃຫ້ໃຊ້ `install.sh` ຊຶ່ງ build ແລ້ວແລ່ນຜ່ານ systemd — ຟື້ນເອງເມື່ອດັບ
ແລະ ຟັງແຕ່ `127.0.0.1` ໃຫ້ nginx ເປັນທາງເຂົ້າດຽວ.
