#!/usr/bin/env bash
#
# ຈົບການ deploy ທີ່ຕ້ອງໃຊ້ sudo — **ກົດສອງເທື່ອຢູ່ Finder ກໍ່ແລ່ນໄດ້**
#
# ນາມສະກຸນ `.command` ເຮັດໃຫ້ macOS ເປີດ Terminal ໃຫ້ເອງ ຈຶ່ງບໍ່ຕ້ອງພິມຄຳສັ່ງ.
# ມີແຕ່ຂັ້ນ sudo 2 ບ່ອນທີ່ຕ້ອງໃສ່ລະຫັດ — ນອກນັ້ນແລ່ນເອງໝົດ.
set -euo pipefail

SERVER="${SERVER:-mn@10.0.40.77}"
APP_DIR="${APP_DIR:-~/fbmonoy}"

# ກົດຈາກ Finder ໂຟນເດີປັດຈຸບັນຈະເປັນບ້ານຂອງຜູ້ໃຊ້ — ຍ້າຍມາຮາກໂປຣເຈັກກ່ອນ
cd "$(dirname "$0")/.."
echo "ໂປຣເຈັກ: $(pwd)"
echo

echo "→ 1/2 ສົ່ງໂຄດຂຶ້ນເຊີບເວີ $SERVER"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .env --exclude '.env.backup*' --exclude 'deploy/dump' \
  ./ "$SERVER:$APP_DIR/"
echo "   ສົ່ງແລ້ວ"
echo

echo "→ 2/2 ແກ້ເຈົ້າຂອງຕາຕະລາງ · ອັບເດດຖານຂໍ້ມູນ · build · restart"
echo "   ຈະຖາມ [sudo] password — ພິມລະຫັດຂອງເຊີບເວີແລ້ວກົດ Enter"
echo "   (ຕອນພິມຈະບໍ່ເຫັນຕົວອັກສອນ ເປັນເລື່ອງປົກກະຕິ)"
echo

# -t ຈຳເປັນ ບໍ່ດັ່ງນັ້ນ sudo ຢູ່ປາຍທາງຖາມລະຫັດບໍ່ໄດ້
ssh -t "$SERVER" "cd $APP_DIR && \
  sudo bash deploy/fix-db-owner.sh && \
  npx prisma migrate deploy && \
  npm run build && \
  sudo systemctl restart fbmonoy"

echo
echo "✓ ສຳເລັດທັງໝົດ — ເປີດເບິ່ງໄດ້ເລີຍ:"
echo "   http://10.0.40.77:3002/inbox     (ໄຟລ໌ແນບ · ຮູບ · ສຽງ)"
echo "   http://10.0.40.77:3002/behavior  (ພຶດຕິກຳລູກຄ້າ)"
echo "   http://10.0.40.77:3002/billing   (ການຊຳລະ)"
echo
read -n 1 -r -p "ກົດປຸ່ມໃດກໍ່ໄດ້ເພື່ອປິດໜ້າຕ່າງນີ້..."
echo
