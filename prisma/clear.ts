/**
 * ລ້າງຂໍ້ມູນຕົວຢ່າງອອກໃຫ້ໝົດ ແລ້ວຕັ້ງຄ່າເລີ່ມຕົ້ນຂອງຮ້ານຈິງ.
 *   npm run db:clear                  → ໃຊ້ຊື່ "Mounoy Shop"
 *   npm run db:clear -- "ຊື່ຮ້ານ"      → ໃຊ້ຊື່ທີ່ໃສ່
 *
 * ຕ່າງຈາກ db:seed ຕົງທີ່ບໍ່ໃສ່ຂໍ້ມູນຕົວຢ່າງໃດໆ — ເຫຼືອແຕ່ໂຄງເປົ່າພ້ອມໃຊ້ຈິງ.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const shopName = process.argv[2]?.trim() || "Mounoy Shop";

async function main() {
  console.log("ລຶບຂໍ້ມູນທັງໝົດ...");
  // ຮຽງຕາມ foreign key — ລູກກ່ອນ ແມ່ຫຼັງ
  await prisma.insight.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.product.deleteMany();
  await prisma.fbPage.deleteMany();
  await prisma.adAccount.deleteMany();
  await prisma.exchangeRate.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.appSetting.deleteMany();

  console.log(`ຕັ້ງຄ່າເລີ່ມຕົ້ນສຳລັບ "${shopName}"...`);
  await prisma.appSetting.createMany({
    data: [
      { key: "companyName", value: shopName },
      { key: "baseCurrency", value: "LAK" },
      { key: "defaultFxRateToLak", value: "21700" },
      { key: "fbApiVersion", value: "v25.0" },
    ],
  });

  // ໂຄງເປົ່າພໍໃຫ້ສ້າງແຄມເປນໄດ້ທັນທີ — ໃສ່ act_... ແລະ Page ID ພາຍຫຼັງໄດ້
  const account = await prisma.adAccount.create({
    data: {
      name: `${shopName} — ບັນຊີໂຄສະນາ`,
      currency: "USD",
      note: "ໃສ່ Facebook Ad Account ID (act_...) ເມື່ອຈະຕໍ່ API",
    },
  });
  const page = await prisma.fbPage.create({
    data: {
      name: shopName,
      note: "ໃສ່ Facebook Page ID ເມື່ອຈະຕໍ່ API",
    },
  });

  console.log("ສຳເລັດ — ຖານຂໍ້ມູນສະອາດແລ້ວ");
  console.log(`  ບັນຊີໂຄສະນາ: ${account.name}`);
  console.log(`  ເພຈ: ${page.name}`);
  console.log("  ຕໍ່ໄປ: ເພີ່ມສິນຄ້າ → ສ້າງແຄມເປນ → ບັນທຶກຜົນລາຍວັນ");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
