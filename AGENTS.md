<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FBMONOY

ລະບົບຈັດການການຍິງໂຄສະນາ Facebook (Next.js 16 App Router + Prisma 7 + Postgres).

## ຂໍ້ຄວນຮູ້ກ່ອນແກ້ໂຄດ

- **Prisma 7 ໃຊ້ driver adapter.** Client ຖືກ generate ໄປທີ່ `src/generated/prisma`
  ແລະ ຕ້ອງສ້າງດ້ວຍ `new PrismaClient({ adapter: new PrismaPg(...) })` — ເບິ່ງ
  `src/lib/prisma.ts`. Type ຂອງ model ຊື່ລົງທ້າຍດ້ວຍ `Model` (ເຊັ່ນ `CampaignModel`).
- **ເງິນທັງໝົດທີ່ເອົາມາລວມ/ປຽບທຽບ ແມ່ນກີບ.** `Insight.spend` ເປັນສະກຸນຂອງບັນຊີ
  ໂຄສະນາ (ປົກກະຕິ USD) ສ່ວນ `Insight.spendLak` ຄິດໄວ້ຕອນບັນທຶກ
  (`spend * fxRateToLak`). ຢ່າລວມ `spend` ຂ້າມບັນຊີທີ່ຄົນລະສະກຸນ.
- **ຄໍລຳວັນທີ່ເປັນ `@db.Date`** — ຕ້ອງຜ່ານ helper ໃນ `src/lib/date.ts` ສະເໝີ
  (`parseDate` / `toDateInput`) ບໍ່ດັ່ງນັ້ນ timezone ຈະເລື່ອນວັນ.
- **`Insight` ມີ unique `(date, entityKey)`** ໂດຍ `entityKey = "<LEVEL>:<id>"` —
  ນີ້ຄືສິ່ງທີ່ກັນການປ້ອນຊ້ຳ ແລະ ເປັນ key ຂອງ upsert ທັງຝັ່ງປ້ອນມື ແລະ ຝັ່ງ API sync.
- **ຍອດລວມນັບສະເພາະແຖວລະດັບແຄມເປນ** — ອ່ານ `src/lib/scope.ts` ກ່ອນຂຽນ query
  ໃໝ່ທີ່ບວກເລກ. ຕາຕະລາງດຽວກັນເກັບໄດ້ 3 ລະດັບ ຖ້າບວກໝົດຈະໄດ້ 3 ເທົ່າ.
  ທຸກ query ທີ່ເອົາໄປລວມຍອດຕ້ອງ spread `totalsScope` ໃສ່ `where`.
- **ຕົວຊີ້ວັດຄິດຈາກຍອດລວມສະເໝີ** (`src/lib/metrics.ts`) ບໍ່ແມ່ນຄ່າສະເລ່ຍຂອງ
  ອັດຕາສ່ວນລາຍວັນ — ຄ່າສະເລ່ຍຂອງ CTR/ROAS ລາຍວັນຈະໃຫ້ຄຳຕອບຜິດ.
- **ສີກຣາຟໃນ `globals.css` (`--chart-1..5`) ຜ່ານການກວດ CVD/contrast ແລ້ວ** —
  ຖ້າຈະປ່ຽນ ຕ້ອງກວດຄືນ ແລະ ຫ້າມສັບປ່ຽນລຳດັບ.
- **ຍັງບໍ່ມີລະບົບ login ໂດຍເຈຕະນາ.** ຢ່າ deploy ອອກສູ່ອິນເຕີເນັດແບບນີ້.
