/**
 * ຂໍ້ມູນຕົວຢ່າງ ເພື່ອໃຫ້ເຫັນໜ້າຈໍທຳງານໄດ້ທັນທີ.
 * ລຶບຂໍ້ມູນເກົ່າທັງໝົດກ່ອນ ແລ້ວໃສ່ໃໝ່ — ຢ່າແລ່ນໃສ່ຖານຂໍ້ມູນຈິງ.
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CampaignObjective } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USD_TO_LAK = 21_700;
const DAYS = 60;

/** ສຸ່ມແບບຄົງທີ່ (LCG) ເພື່ອໃຫ້ seed ຄືນຄ່າເກົ່າທຸກຄັ້ງ */
let state = 42;
function rnd() {
  state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return state / 4_294_967_296;
}
const between = (min: number, max: number) => min + rnd() * (max - min);
const intBetween = (min: number, max: number) => Math.round(between(min, max));

/**
 * ວັນທີ່ນັບຈາກ "ມື້ນີ້ຕາມເວລາລາວ (UTC+7)" ບໍ່ແມ່ນຕາມ UTC —
 * ບໍ່ດັ່ງນັ້ນ ຖ້າແລ່ນ seed ຕອນກາງຄືນ ຂໍ້ມູນຈະຈົບກ່ອນມື້ວານ 1 ວັນ
 * ແລ້ວການແຈ້ງເຕືອນ "ຍັງບໍ່ໄດ້ບັນທຶກຜົນ" ຈະຂຶ້ນທັນທີ.
 */
function dayUTC(offsetFromToday: number): Date {
  const laoNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const d = new Date(
    Date.UTC(laoNow.getUTCFullYear(), laoNow.getUTCMonth(), laoNow.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + offsetFromToday);
  return d;
}

async function main() {
  console.log("ລຶບຂໍ້ມູນເກົ່າ...");
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

  await prisma.appSetting.createMany({
    data: [
      { key: "defaultFxRateToLak", value: String(USD_TO_LAK) },
      { key: "baseCurrency", value: "LAK" },
      { key: "companyName", value: "ODIEN GROUP" },
    ],
  });

  console.log("ບັນຊີໂຄສະນາ + ເພຈ + ສິນຄ້າ...");
  const accMain = await prisma.adAccount.create({
    data: {
      name: "ODIEN Main Ad Account",
      fbAccountId: "act_1000000000001",
      currency: "USD",
      spendCap: 5000,
      note: "ບັນຊີຫຼັກ ຕັດບັດ USD",
    },
  });
  const accShop = await prisma.adAccount.create({
    data: {
      name: "ODIEN Shop (ບັນຊີສຳຮອງ)",
      fbAccountId: "act_1000000000002",
      currency: "USD",
      note: "ໃຊ້ຍິງສິນຄ້າຕາມລະດູ",
    },
  });

  const pageMall = await prisma.fbPage.create({
    data: { name: "Odien Maall", fbPageId: "100000000001", category: "ຮ້ານຄ້າ" },
  });
  const pageTech = await prisma.fbPage.create({
    data: { name: "Odien Tech", fbPageId: "100000000002", category: "ເອເລັກໂຕຣນິກ" },
  });

  const products = await Promise.all(
    [
      { name: "ຕູ້ເຢັນ Hisense 180L", sku: "HS-180", price: 3_450_000, cost: 2_600_000 },
      { name: "ແອປັບອາກາດ 12000 BTU", sku: "AC-12K", price: 4_900_000, cost: 3_800_000 },
      { name: "ໂທລະສັບ Redmi Note 14", sku: "RN-14", price: 2_890_000, cost: 2_350_000 },
      { name: "ຊຸດຫມໍ້ຫຸງເຂົ້າໄຟຟ້າ", sku: "RC-01", price: 690_000, cost: 460_000 },
    ].map((p) => prisma.product.create({ data: p })),
  );

  console.log("ແຄມເປນ + ຊຸດໂຄສະນາ + ໂຄສະນາ...");
  const campaignSpecs: Array<{
    name: string;
    objective: CampaignObjective;
    accountId: string;
    pageId: string;
    productIndex: number;
    dailyBudget: number;
    audience: string;
  }> = [
    {
      name: "ຕູ້ເຢັນ Hisense — ທັກແຊັດ",
      objective: "MESSAGES",
      accountId: accMain.id,
      pageId: pageMall.id,
      productIndex: 0,
      dailyBudget: 25,
      audience: "ນະຄອນຫຼວງ, ອາຍຸ 25-50, ສົນໃຈເຄື່ອງໃຊ້ໄຟຟ້າ",
    },
    {
      name: "ແອປັບອາກາດ ລະດູຮ້ອນ",
      objective: "MESSAGES",
      accountId: accMain.id,
      pageId: pageMall.id,
      productIndex: 1,
      dailyBudget: 40,
      audience: "ທົ່ວປະເທດ, ອາຍຸ 25-55",
    },
    {
      name: "Redmi Note 14 — ຍອດຂາຍ",
      objective: "SALES",
      accountId: accMain.id,
      pageId: pageTech.id,
      productIndex: 2,
      dailyBudget: 30,
      audience: "ອາຍຸ 18-35, ສົນໃຈມືຖື",
    },
    {
      name: "ຫມໍ້ຫຸງເຂົ້າ — ໂປຣລາຄາພິເສດ",
      objective: "ENGAGEMENT",
      accountId: accShop.id,
      pageId: pageMall.id,
      productIndex: 3,
      dailyBudget: 12,
      audience: "ແມ່ບ້ານ ອາຍຸ 25-45",
    },
    {
      name: "ເກັບລາຍຊື່ລູກຄ້າ ຜ່ອນ 0%",
      objective: "LEADS",
      accountId: accShop.id,
      pageId: pageMall.id,
      productIndex: 0,
      dailyBudget: 18,
      audience: "ພະນັກງານປະຈຳ, ອາຍຸ 22-45",
    },
    {
      name: "ແບຣນ Odien — ໃຫ້ຄົນຮູ້ຈັກ",
      objective: "AWARENESS",
      accountId: accMain.id,
      pageId: pageTech.id,
      productIndex: 2,
      dailyBudget: 10,
      audience: "ທົ່ວປະເທດ 18-55",
    },
  ];

  const campaigns = [];
  for (const spec of campaignSpecs) {
    const campaign = await prisma.campaign.create({
      data: {
        name: spec.name,
        objective: spec.objective,
        adAccountId: spec.accountId,
        pageId: spec.pageId,
        productId: products[spec.productIndex].id,
        dailyBudget: spec.dailyBudget,
        startDate: dayUTC(-DAYS),
        ownerName: rnd() > 0.5 ? "ນາງ ສີດາ" : "ທ້າວ ບຸນມີ",
        status: rnd() > 0.2 ? "ACTIVE" : "PAUSED",
        adSets: {
          create: [
            {
              name: `${spec.name} — ກຸ່ມກວ້າງ`,
              audience: spec.audience,
              placements: "Facebook Feed, Reels, Messenger",
              dailyBudget: spec.dailyBudget * 0.6,
              optimizationGoal:
                spec.objective === "MESSAGES" ? "CONVERSATIONS" : "LINK_CLICKS",
              billingEvent: "IMPRESSIONS",
              ads: {
                create: [
                  {
                    name: "ວິດີໂອຮີວິວ 30 ວິ",
                    creativeType: "VIDEO",
                    headline: "ລາຄາພິເສດ ມື້ນີ້ເທົ່ານັ້ນ",
                    callToAction: "ສົ່ງຂໍ້ຄວາມ",
                  },
                  {
                    name: "ຮູບສິນຄ້າ + ລາຄາ",
                    creativeType: "IMAGE",
                    headline: "ສົ່ງຟຣີທົ່ວນະຄອນຫຼວງ",
                    callToAction: "ສົ່ງຂໍ້ຄວາມ",
                  },
                ],
              },
            },
            {
              name: `${spec.name} — Retarget`,
              audience: "ຄົນທີ່ເຄີຍທັກ / ເຂົ້າເບິ່ງເພຈ 30 ວັນ",
              placements: "Facebook Feed",
              dailyBudget: spec.dailyBudget * 0.4,
              optimizationGoal: "CONVERSATIONS",
              billingEvent: "IMPRESSIONS",
              ads: {
                create: [
                  {
                    name: "ຄາຣູແຊວ 4 ຮູບ",
                    creativeType: "CAROUSEL",
                    headline: "ຍັງສົນໃຈຢູ່ບໍ່?",
                    callToAction: "ສັ່ງຊື້ດຽວນີ້",
                  },
                ],
              },
            },
          ],
        },
      },
      include: { adSets: { include: { ads: true } } },
    });
    campaigns.push(campaign);
  }

  console.log(`ຜົນລາຍວັນ ${DAYS} ວັນ...`);

  // ROAS ເປົ້າໝາຍຂອງແຕ່ລະແຄມເປນ — ຈົງໃຈໃຫ້ 2 ອັນຕ່ຳກວ່າ 1 ເພື່ອທົດສອບໜ້າ “ຕ້ອງເບິ່ງດ່ວນ”
  const TARGET_ROAS = [2.6, 3.4, 1.8, 0.7, 1.2, 0.4];
  const closeRateByCampaign = new Map(
    campaigns.map((c, i) => [c.id, TARGET_ROAS[i % TARGET_ROAS.length]]),
  );

  const insights = [];
  const rates = [];
  for (let i = DAYS; i >= 1; i--) {
    const date = dayUTC(-i);
    const fx = Math.round(USD_TO_LAK * between(0.985, 1.015));
    rates.push({ date, currency: "USD", rateToLak: fx });

    for (const campaign of campaigns) {
      if (campaign.status === "PAUSED" && i < 10) continue; // ຢຸດຍິງໄລຍະຫຼັງ

      const budget = campaign.dailyBudget ?? 10;
      const spend = Number(between(budget * 0.7, budget * 1.05).toFixed(2));
      const impressions = intBetween(spend * 400, spend * 900);
      const reach = Math.round(impressions / between(1.15, 1.8));
      const clicks = intBetween(impressions * 0.008, impressions * 0.035);
      const linkClicks = Math.round(clicks * between(0.55, 0.85));
      const messages =
        campaign.objective === "MESSAGES" || campaign.objective === "SALES"
          ? intBetween(linkClicks * 0.15, linkClicks * 0.45)
          : intBetween(0, 3);
      const leadsCount =
        campaign.objective === "LEADS" ? intBetween(clicks * 0.1, clicks * 0.3) : 0;

      // ອັດຕາປິດການຂາຍຕ່າງກັນຕາມແຄມເປນ ເພື່ອໃຫ້ບາງອັນກຳໄລ ບາງອັນຂາດທຶນ
      // (ຄິດຍ້ອນຫຼັງຈາກ ROAS ເປົ້າໝາຍ ເພື່ອໃຫ້ຕົວເລກສົມຈິງກັບລາຄາສິນຄ້າ)
      const product = products.find((p) => p.id === campaign.productId);
      const price = product?.price ?? 500_000;
      const targetRoas = closeRateByCampaign.get(campaign.id) ?? 2;
      const expectedOrders = ((spend * fx * targetRoas) / price) * between(0.6, 1.4);
      // ປັດແບບສຸ່ມ: ຮັກສາຄ່າສະເລ່ຍໄວ້ ບໍ່ໃຫ້ມື້ທີ່ຄາດ 0.4 ອໍເດີ ກາຍເປັນ 0 ທຸກມື້
      const purchases = Math.max(
        0,
        Math.floor(expectedOrders) + (rnd() < expectedOrders % 1 ? 1 : 0),
      );
      const revenue = purchases * price;

      insights.push({
        date,
        level: "CAMPAIGN" as const,
        entityKey: `CAMPAIGN:${campaign.id}`,
        adAccountId: campaign.adAccountId,
        campaignId: campaign.id,
        currency: "USD",
        fxRateToLak: fx,
        spend,
        spendLak: Math.round(spend * fx),
        impressions,
        reach,
        clicks,
        linkClicks,
        messages,
        leadsCount,
        purchases,
        revenue,
        videoViews: intBetween(impressions * 0.05, impressions * 0.2),
        source: "MANUAL" as const,
      });
    }
  }
  await prisma.exchangeRate.createMany({ data: rates });
  await prisma.insight.createMany({ data: insights });

  console.log("ລູກຄ້າຈາກໂຄສະນາ...");
  const laoNames = [
    "ນາງ ຄຳຫລ້າ",
    "ທ້າວ ສົມສັກ",
    "ນາງ ພອນສະຫວັນ",
    "ທ້າວ ວິໄລ",
    "ນາງ ດາວອນ",
    "ທ້າວ ໄຊຍະ",
    "ນາງ ມະນີ",
    "ທ້າວ ຄຳສອນ",
    "ນາງ ນາລີ",
    "ທ້າວ ອຸ່ນແກ້ວ",
  ];
  const channels = ["Messenger", "ຄອມເມັນ", "Lead Form", "ໂທເຂົ້າ"];
  const statuses = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;

  const leads = [];
  for (let i = 0; i < 80; i++) {
    const campaign = campaigns[intBetween(0, campaigns.length - 1)];
    const status = statuses[intBetween(0, statuses.length - 1)];
    const product = products.find((p) => p.id === campaign.productId);
    leads.push({
      date: dayUTC(-intBetween(1, 30)),
      name: `${laoNames[intBetween(0, laoNames.length - 1)]} ${i + 1}`,
      phone: `020 ${intBetween(50, 99)} ${intBetween(100, 999)} ${intBetween(100, 999)}`,
      channel: channels[intBetween(0, channels.length - 1)],
      status,
      amount: status === "WON" ? (product?.price ?? 0) : 0,
      campaignId: campaign.id,
      productId: campaign.productId,
      assignee: rnd() > 0.5 ? "ນາງ ສີດາ" : "ທ້າວ ບຸນມີ",
    });
  }
  await prisma.lead.createMany({ data: leads });

  console.log(
    `ສຳເລັດ: ${campaigns.length} ແຄມເປນ, ${insights.length} ແຖວຜົນລາຍວັນ, ${leads.length} ລູກຄ້າ`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
