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
- **ໜ້າ `/behavior` ອ່ານຈາກຂໍ້ມູນຝັ່ງເຮົາ ບໍ່ແມ່ນຂອງ Facebook** — ເວລາທີ່ຄົນທັກ,
  ຄວາມໄວຕອບ, ຄຳຖາມທີ່ພົບເລື້ອຍ ແລະ ໄລຍະຈາກທັກຮອດຊື້. ຕົວຄິດຢູ່ `src/lib/behavior.ts`
  (ຫ້າມ import prisma · ມີ test ຄຸມ) ການອ່ານຖານຂໍ້ມູນຢູ່ `behavior-server.ts`.
  ເວລາຈິງ (`sentAt`) ຕ້ອງແປງເປັນເວລາລາວດ້ວຍ `laoHour/laoWeekday/laoDayStart`
  ໃນ `date.ts` ສະເໝີ — ບໍ່ດັ່ງນັ້ນຊົ່ວໂມງຈະເລື່ອນ 7 ຊົ່ວໂມງ.
- **ຄຳແນະນຳໃນ `src/lib/advice.ts` ໃຊ້ເກນຄົນລະຊຸດ** ລະຫວ່າງ "ດີ" (ຕ້ອງມີ
  ຄົນທັກພຽງພໍ) ກັບ "ບໍ່ດີ" (ຕ້ອງມີເງິນທີ່ເສຍພຽງພໍ) — ເບິ່ງ `analysis.ts`
  ກ່ອນປັບ ບໍ່ດັ່ງນັ້ນລະບົບຈະແນະນຳຈາກຂໍ້ມູນບາງໆ ແລ້ວຄົນເສຍເງິນຈິງ.
- **ເງິນສະແດງຜ່ານ `money()` ຈາກ `loadMoney()` ສະເໝີ** ຢ່າເອີ້ນ `formatLak`
  ໂດຍກົງໃນໜ້າຈໍ — ຜູ້ໃຊ້ສະຫຼັບກີບ/ໂດລາໄດ້. `money.ts` ຫ້າມ import prisma
  (client component ໃຊ້ຢູ່) — ການອ່ານຄ່າຕັ້ງຢູ່ `money-server.ts`.
- **ຕົວຊີ້ວັດຄິດຈາກຍອດລວມສະເໝີ** (`src/lib/metrics.ts`) ບໍ່ແມ່ນຄ່າສະເລ່ຍຂອງ
  ອັດຕາສ່ວນລາຍວັນ — ຄ່າສະເລ່ຍຂອງ CTR/ROAS ລາຍວັນຈະໃຫ້ຄຳຕອບຜິດ.
- **ໄອຄອນເມນູເປັນ SVG ຢູ່ `src/components/nav-icons.tsx`** — ຫ້າມກັບໄປໃຊ້
  ຕົວອັກສອນສັນຍາລັກ (▧ ▣ ▤) ອີກ ເພາະຮູບຮ່າງຄ້າຍກັນຈົນແຍກບໍ່ອອກ ແລະ ນ້ຳໜັກ
  ເສັ້ນຂຶ້ນກັບຟອນຂອງເຄື່ອງ. ເພີ່ມເມນູໃໝ່ = ເພີ່ມໄອຄອນໃສ່ `IconName` ນຳ.
- **ສີກຣາຟໃນ `globals.css` (`--chart-1..5`) ຜ່ານການກວດ CVD/contrast ແລ້ວ** —
  ຖ້າຈະປ່ຽນ ຕ້ອງກວດຄືນ ແລະ ຫ້າມສັບປ່ຽນລຳດັບ.
- **ຂະໜາດຕົວອັກສອນມີບັນໄດດຽວຢູ່ `@theme` ໃນ `globals.css`** — ໃຊ້ utility
  ຂອງ Tailwind (`text-2xs` 0.76 · `text-xs` 0.82 · `text-sm` 0.9 · `text-base` 1
  · `text-lg` 1.1 · `text-xl` 1.25rem …) **ຫ້າມຂຽນ `text-[0.7rem]` ແບບຕັ້ງເອງ**
  ແລະ CSS ຂອງ component ໃຫ້ອ້າງ `var(--text-*)` ບໍ່ແມ່ນໃສ່ເລກ rem ໂດຍກົງ.
  ບົດບາດ: ປ້າຍ/ຫົວຕາຕະລາງ/badge = `2xs` · ຂໍ້ຄວາມຮອງ ແລະ ຊ່ອງຕາຕະລາງ = `xs`
  · ແຖວຫຼັກ = `sm` · ຫົວກາດ = `base` · ຫົວໜ້າ = `lg`/`xl` · ຕົວເລກສະຫຼຸບ = `xl`.
  ຂັ້ນນ້ອຍສຸດ 0.76rem ແລະ ຄວາມສູງແຖວຂອງທຸກຂັ້ນນ້ອຍ ≥1.5 (ຄ່າ 1.33 ຂອງ
  Tailwind ແໜ້ນເກີນສຳລັບວັນນະຍຸດລາວ) — ດ້ວຍເຫດນີ້ຈຶ່ງ **ບໍ່ໃຊ້ `leading-snug`**.
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
- **ໄຟລ໌ແນບໃນກ່ອງຂໍ້ຄວາມສະແດງຜ່ານ `/api/fb/media` ເທົ່ານັ້ນ** — ລິ້ງ
  `lookaside.fbsbx.com` ຂອງ Facebook **ໝົດອາຍຸ** ແລະ ບາງອັນຕ້ອງມີ page token
  ຈຶ່ງ **ຫ້າມເອົາລິ້ງ Facebook ໃສ່ `<img>/<audio>` ໂດຍກົງ**. route ນັ້ນຂໍລິ້ງໃໝ່
  ຈາກ Facebook ໃຫ້ເອງເມື່ອດຶງບໍ່ໄດ້ (ຂໍ້ຄວາມເກົ່າທີ່ຮູ້ແຕ່ຊື່ໄຟລ໌ຈຶ່ງຍັງເປີດໄດ້)
  ແລະ ບັງຄັບຊະນິດໄຟລ໌ — html/svg ຖືກສົ່ງເປັນໄຟລ໌ໂຫຼດ ບໍ່ໃຫ້ແລ່ນໃນໂດເມນເຮົາ.
  ຕົວແປງຊະນິດຢູ່ `src/lib/fb-attachment.ts` (ຫ້າມ import prisma · ມີ test ຄຸມ).
- **ຮູບໃນແຊັດທີ່ Facebook ສົ່ງມາເປັນຕົວໜັງສື `[image-<id>]`** (ຮູບທີ່ຖືກສົ່ງ
  ຜ່ານເຄື່ອງມືພາຍນອກ) — ຮູບຈິງຢູ່ໃນ `attachments` ຂອງຂໍ້ຄວາມ ບໍ່ແມ່ນຢູ່ໃນ id ນັ້ນ
  (ຮ້ອງ `/{message_id}?fields=attachments{…}` ດ້ວຍ *page token*). ໜ້າຈໍເອົາຕົວໜັງສື
  ນັ້ນອອກດ້ວຍ `visibleText()` ໃນ `fb-attachment.ts` (ບໍລິສຸດ · ມີ test ຄຸມ).
  ຂໍ້ຄວາມເກົ່າໄດ້ໄຟລ໌ຄືນຜ່ານ `backfillMessageAttachments()` ເພາະ `pullThreads()`
  **ຂ້າມ**ຫ້ອງທີ່ບໍ່ມີຂໍ້ຄວາມໃໝ່ ຈຶ່ງບໍ່ເຄີຍດຶງຂໍ້ຄວາມເກົ່າຄືນ — ຮອບດຶງເອີ້ນໃຫ້
  ເທື່ອລະ 50 ຂໍ້ຄວາມ (30 ວັນຫຼ້າສຸດ) ແລະ ມີປຸ່ມ “ຕື່ມໄຟລ໌ແນບ” ໃນໜ້າກ່ອງຂໍ້ຄວາມ
  ສຳລັບໄລ່ຍ້ອນຫຼັງທັງໝົດ. **1 ຂໍ້ຄວາມ = 1 request** ຈຶ່ງຕ້ອງມີເພດານທຸກເທື່ອ.
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
- **ຂາຍຜ່ານ live (CF) — `/live`** ກົດຢູ່ `src/lib/live-cf.ts` (ບໍລິສຸດ · ມີ test ຄຸມ)
  ການອ່ານ/ຂຽນ ແລະ Facebook ຢູ່ `live-server.ts`. **ສະຖານະ ຈອງໄດ້/ລໍຄິວ ບໍ່ເກັບ** —
  ຄິດໃໝ່ທຸກເທື່ອດ້ວຍ `allocateClaims()` ຕາມເວລາ comment ຂອງ Facebook
  (ຢ່າເພີ່ມຄໍລຳສະຖານະ ບໍ່ດັ່ງນັ້ນຄິວຈະບໍ່ເລື່ອນເມື່ອມີຄົນຍົກເລີກ). ລາຍການທີ່ອອກບິນ
  ແລ້ວ (`orderId`) ໄດ້ຂອງກ່ອນສະເໝີ ແລະ ແກ້ຈາກໜ້າ live ບໍ່ໄດ້. comment ຂອງ live
  **ບໍ່ລົງ `FbComment`** (ຈະຖົມກ່ອງຂໍ້ຄວາມ). ບິນ live ມີ `OrderItem` ແຕ່ຍອດເງິນ
  ຢູ່ `Order.saleAmount/productCost` ສະເໝີ — ລາຍງານຫ້າມບວກຈາກ `OrderItem` ຊ້ຳ.
  ສະຫຼຸບຍອດສົ່ງຜ່ານ Send API `recipient.comment_id` (1 ເທື່ອຕໍ່ comment · 7 ວັນ) —
  comment ທີ່ມີ `LiveComment.privateRepliedAt` ແລ້ວໃຊ້ຊ້ຳບໍ່ໄດ້ ຕ້ອງຂ້າມ.
  comment ທຸກອັນຂອງ live ຢູ່ `LiveComment` (ຈັດປະເພດໃນ `live-comments.ts` ບໍລິສຸດ).
  ຕອບຮັບ CF / ເຊື່ອງອັດຕະໂນມັດ **ຈອງສິດດ້ວຍ `updateMany … ackedAt/autoHideAt: null`
  ກ່ອນຮ້ອງ Facebook** ເພາະຮອບດຶງຊ້ອນກັນໄດ້ (ຫຼາຍແທັບ + ຕົວຕັ້ງເວລາ) — ລົ້ມແລ້ວບໍ່ລອງຊ້ຳ.
  `/{page}/live_videos` ຖືກ Facebook ກັນ (code 10 live-video-api) ຈຶ່ງມີທາງສຳຮອງ `/{page}/videos`.
  ວິເຄາະ live ຢູ່ `live-analysis.ts` (ບໍລິສຸດ · ມີເກນຂໍ້ມູນຂັ້ນຕ່ຳທຸກຄຳແນະນຳ).
- **Boost live ໃຊ້ເງິນຈິງ** (`live-boost-server.ts`) — ສ້າງ campaign/adset/ad
  ເປັນ **PAUSED ສະເໝີ** ຄົນກົດຍິງເອງ · ງົບຕ້ອງຜ່ານ `validateBoost()` ທຽບເພດານ
  **ກີບ** ທີ່ ADMIN ຕັ້ງ (`AppSetting.liveBoostMaxLak` — ບໍ່ມີ = boost ບໍ່ໄດ້) ·
  ການ*ສ້າງ*ໃຊ້ `createOnce()` **ບໍ່ລອງໃໝ່** (ລອງໃໝ່ = ແຄມເປນຊ້ຳ) ສ່ວນຍິງ/ຢຸດ
  ຜ່ານ `graphFetch()` ໄດ້ · ສ້າງກາງທາງລົ້ມຕ້ອງລຶບແຄມເປນທີ່ສ້າງແລ້ວຖິ້ມ.
- **ຍອດຄົນເບິ່ງ live** ມາຈາກ `/{video}/video_insights` (page token + `read_insights`)
  ເກັບເປັນຈຸດສະສົມໃນ `LiveStat` — **ບໍ່ມີຄົນເບິ່ງພ້ອມກັນ** (ຢູ່ Live Video API ທີ່ຖືກກັນ).
- **ຢ່າ deploy ອອກອິນເຕີເນັດແບບ http** — ຕັ້ງ `COOKIE_SECURE=1` ພ້ອມ HTTPS ກ່ອນ.
