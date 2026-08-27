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
- **`SegmentInsight` ຫ້າມເອົາໄປລວມກັບ `Insight`** ແລະ ຫ້າມບວກຂ້າມມິຕິ —
  ແຕ່ລະມິຕິຄືຕົວເລກອັນດຽວກັນທີ່ຫັ່ນຄົນລະແບບ (ອາຍຸ + ແຂວງ = 2 ເທົ່າ).
- **ຄຳແນະນຳໃນ `src/lib/advice.ts` ໃຊ້ເກນຄົນລະຊຸດ** ລະຫວ່າງ "ດີ" (ຕ້ອງມີ
  ຄົນທັກພຽງພໍ) ກັບ "ບໍ່ດີ" (ຕ້ອງມີເງິນທີ່ເສຍພຽງພໍ) — ເບິ່ງ `analysis.ts`
  ກ່ອນປັບ ບໍ່ດັ່ງນັ້ນລະບົບຈະແນະນຳຈາກຂໍ້ມູນບາງໆ ແລ້ວຄົນເສຍເງິນຈິງ.
- **ເງິນສະແດງຜ່ານ `money()` ຈາກ `loadMoney()` ສະເໝີ** ຢ່າເອີ້ນ `formatLak`
  ໂດຍກົງໃນໜ້າຈໍ — ຜູ້ໃຊ້ສະຫຼັບກີບ/ໂດລາໄດ້. `money.ts` ຫ້າມ import prisma
  (client component ໃຊ້ຢູ່) — ການອ່ານຄ່າຕັ້ງຢູ່ `money-server.ts`.
- **ຕົວຊີ້ວັດຄິດຈາກຍອດລວມສະເໝີ** (`src/lib/metrics.ts`) ບໍ່ແມ່ນຄ່າສະເລ່ຍຂອງ
  ອັດຕາສ່ວນລາຍວັນ — ຄ່າສະເລ່ຍຂອງ CTR/ROAS ລາຍວັນຈະໃຫ້ຄຳຕອບຜິດ.
- **ສີກຣາຟໃນ `globals.css` (`--chart-1..5`) ຜ່ານການກວດ CVD/contrast ແລ້ວ** —
  ຖ້າຈະປ່ຽນ ຕ້ອງກວດຄືນ ແລະ ຫ້າມສັບປ່ຽນລຳດັບ.
- **ທຸກ route ຖືກກັນດ້ວຍ `src/proxy.ts`** (Next 16 ປ່ຽນຊື່ middleware → proxy).
  ໜ້າໃໝ່ທີ່ຕ້ອງ login ໃຫ້ວາງໃນ `src/app/(app)/` — route group ບໍ່ປ່ຽນ URL.
  `src/lib/auth.ts` ຖືກ import ຈາກ proxy ຈຶ່ງ **ຫ້າມ import prisma ຫຼື node:crypto**
  ໃສ່ໄຟລ໌ນັ້ນ (ໃຊ້ໄດ້ແຕ່ Web Crypto).
- **ການ sync ແລ່ນເບື້ອງຫຼັງ** ດ້ວຍ `after()` ແລະ ແບ່ງດຶງເທື່ອລະອາທິດ.
  ຄວາມຄືບໜ້າຢູ່ `SyncLog.doneDays/totalDays` — ວຽກທີ່ `updatedAt` ເກົ່າກວ່າ
  15 ນາທີຖືວ່າຕາຍ ແລະ ຖືກປິດອັດຕະໂນມັດໂດຍ `activeSyncLog()`;
  `runSyncJob()` heartbeat ອັບເດດຄ່ານີ້ທຸກ 1 ນາທີລະຫວ່າງວຽກຍາວ.
- **ການດຶງອັດຕະໂນມັດແລ່ນໃນ process ດຽວກັບເວັບ** — `src/instrumentation.ts`
  ເອີ້ນ `startAutoSyncScheduler()` ຕອນເຊີບເວີຂຶ້ນ ແລ້ວກວດທຸກໆ 1 ນາທີ
  (`src/lib/auto-sync.ts`). ຄ່າຕັ້ງຢູ່ `AppSetting` (`autoSync*`) ແລະ
  ໄລຍະຫ່າງນັບຈາກ `SyncLog.startedAt` ຫຼ້າສຸດ **ບໍ່ວ່າຄົນກົດ ຫຼື ອັດຕະໂນມັດ**.
  ຖ້າຈະ deploy ຫຼາຍ instance ຕ້ອງຄິດເລື່ອງນີ້ຄືນ (ດຽວນີ້ກັນຊ້ອນດ້ວຍ
  partial unique index ຂອງແຖວ RUNNING).
- **`buildAlerts()` ຫ້າມຮ້ອງ Facebook** — ມັນຖືກເອີ້ນທຸກຄັ້ງທີ່ເປີດໜ້າ.
  ອາຍຸ token ຖືກກວດເບື້ອງຫຼັງທຸກ 6 ຊົ່ວໂມງ (`checkFbToken()` ໃນ `fb.ts`)
  ແລ້ວເກັບໄວ້ `AppSetting.fbToken*` — ໜ້າຈໍອ່ານແຕ່ຄ່າທີ່ເກັບໄວ້.
- **`src/lib/sync-health.ts` ຕ້ອງບໍລິສຸດ** (ຫ້າມ import prisma) — ກົດເຕືອນ
  ເລື່ອງ token/ການດຶງ/ຂໍ້ມູນຄ້າງ ຢູ່ໃນນັ້ນ ແລະ ມີ test ຄຸມ. ການອ່ານຖານຂໍ້ມູນ
  ຢູ່ `alerts.ts` ແລ້ວສົ່ງຄ່າເຂົ້າໄປ. ຖ້າ token ພັງ **ຫ້າມເຕືອນຊ້ຳ**
  ວ່າ "ດຶງລົ້ມ" ແລະ "ຂໍ້ມູນຄ້າງ" — ບອກຕົ້ນເຫດອັນດຽວ.
- **ລາຍການທີ່ຍາວໃຊ້ `?show=` ບໍ່ແມ່ນຕັດແຖວຖິ້ມ** — `/orders`, `/leads`,
  `/inbox` ໂຫຼດເພີ່ມເທື່ອລະ 100 ຜ່ານ `<LoadMore>` ພ້ອມນັບຍອດຈິງດ້ວຍ `count()`.
  ຢ່າໃສ່ `take:` ຄົງທີ່ແລ້ວບອກແຕ່ "ສູງສຸດ N" — ອັນເກົ່າກວ່ານັ້ນຈະເປີດເບິ່ງບໍ່ໄດ້.
- **ກ່ອງຂໍ້ຄວາມໃຊ້ token ຄົນລະໜ່ວຍກັບຝັ່ງໂຄສະນາ** — comment/ແຊັດ ຕ້ອງໃຊ້
  *page token* ຂອງແຕ່ລະເພຈ (`FbPage.token`, ດຶງດ້ວຍ `syncPageTokens()`)
  ບໍ່ແມ່ນ token ຫຼັກໃນ `AppSetting`. **ຫ້າມສົ່ງ `FbPage.token` ອອກໜ້າຈໍ**.
  ໂພສໂຄສະນາ (dark post) ບໍ່ຢູ່ໃນ `/{page}/posts` — ຫາຜ່ານ
  `creative{effective_object_story_id}` ຂອງ ad (`pullAdPosts` ໃນ `fb-inbox.ts`).
- **`handled` / `leadId` ຂອງ comment ແລະ ແຊັດ ເປັນຂອງຄົນ** — ຮອບດຶງທັບໄດ້ແຕ່
  ຂໍ້ມູນທີ່ມາຈາກ Facebook (ຂໍ້ຄວາມ, ຈຳນວນໄລຄ໌, ສະຖານະເຊື່ອງ) ຫ້າມທັບສະຖານະວຽກ.
- **ຊ່ອງຂອງແຄມເປນທີ່ຜູກ FB ແບ່ງເປັນ 3 ພວກ** — ສົ່ງໄປ Facebook ໄດ້ (ຊື່, ງົບ),
  Facebook ເປັນເຈົ້າຂອງແຕ່ແກ້ບໍ່ໄດ້ (ເປົ້າໝາຍ, ວັນ, ສະຖານະ) ແລະ ຂອງເຮົາເອງ.
  ຫ້າມໃຫ້ຟອມແກ້ພວກທີ 2 ໄດ້ — ຮອບ sync ຈະທັບຖິ້ມແລ້ວຄົນຈະບໍ່ຮູ້ຕົວ.
  ພວກທີ 1 ຕ້ອງສົ່ງໄປ Facebook **ກ່ອນ** ບັນທຶກ ຖ້າລົ້ມແມ່ນບໍ່ບັນທຶກຫຍັງເລີຍ.
- **ການຮ້ອງ Graph API ຜ່ານ `graphFetch()` ສະເໝີ** — ມັນລອງໃໝ່ໃຫ້ເມື່ອຊົນ
  rate limit (code 1/2/4/17/32/341/613). ຢ່າຮ້ອງ `fetch` ໃສ່ Graph ໂດຍກົງ.
- **Webhook ບໍ່ໄດ້ຂຽນຂໍ້ມູນເອງ** — ມັນກວດລາຍເຊັນແລ້ວສັ່ງໃຫ້ `syncInbox()`
  ດຶງເອງ. ຢ່າສ້າງເສັ້ນທາງຂຽນທີສອງຈາກ payload ຂອງ webhook.
- **ບັນຊີຜູ້ໃຊ້ເປັນທາງເລືອກ** — ບໍ່ມີແຖວໃນ `User` = ໃຊ້ `APP_PASSWORD` ຮ່ວມກັນ
  ຄືເກົ່າ · ມີແລ້ວ = ບັງຄັບ login ດ້ວຍຊື່+ລະຫັດ ແລະ session ແບບລະຫັດຮ່ວມໃຊ້ບໍ່ໄດ້ອີກ.
  `proxy.ts` ກວດໄດ້ແຕ່ລາຍເຊັນ — ການກວດວ່າ**ບັນຊີຍັງເປີດຢູ່**ຢູ່ `isAuthenticated()`
  ແລະ `(app)/layout.tsx`. `password.ts` ຫ້າມ import ຈາກ proxy ຫຼື client.
- **ເງື່ອນໄຂກັ່ນຕອງລາຍການຢູ່ `list-filters.ts` ບ່ອນດຽວ** — ໜ້າຈໍກັບໄຟລ໌ CSV
  ທີ່ສົ່ງອອກຕ້ອງໄດ້ແຖວອັນດຽວກັນ. `toCsv()` ໃສ່ BOM ໃຫ້ ບໍ່ດັ່ງນັ້ນ Excel
  ອ່ານພາສາລາວເປັນຕົວຂີ້ເຫຍື້ອ.
- **ຢ່າ deploy ອອກອິນເຕີເນັດແບບ http** — ຕັ້ງ `COOKIE_SECURE=1` ພ້ອມ HTTPS ກ່ອນ.
