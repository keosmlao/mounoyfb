import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import {
  runFacebookSync,
  saveAlertThresholds,
  saveExchangeRate,
  saveSettings,
} from "./actions";
import { getThresholds } from "@/lib/alerts";
import { FbTokenGuide } from "@/components/FbTokenGuide";
import { FbConnection } from "@/components/FbConnection";
import { addDays, formatDateLao, todayStr } from "@/lib/date";
import { formatInt } from "@/lib/format";
import { CURRENCIES } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SYNC_TONE: Record<string, string> = {
  SUCCESS: "success",
  FAILED: "danger",
  RUNNING: "info",
};

const SYNC_LABEL: Record<string, string> = {
  SUCCESS: "ສຳເລັດ",
  FAILED: "ຜິດພາດ",
  RUNNING: "ກຳລັງແລ່ນ",
};

export default async function SettingsPage() {
  const [settings, rates, logs, accountsWithId, thresholds] = await Promise.all([
    prisma.appSetting.findMany(),
    prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 15 }),
    prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.adAccount.count({ where: { fbAccountId: { not: null } } }),
    getThresholds(),
  ]);

  const map = new Map(settings.map((s) => [s.key, s.value]));
  const hasToken = Boolean(map.get("fbAccessToken") || process.env.FB_ACCESS_TOKEN);

  return (
    <>
      <PageHeader
        title="ຕັ້ງຄ່າ"
        description="ຄ່າທົ່ວໄປ, ອັດຕາແລກປ່ຽນ ແລະ ການເຊື່ອມຕໍ່ Facebook Marketing API"
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="h-fit">
          <CardHeader title="ຄ່າທົ່ວໄປ" />
          <form action={saveSettings} className="grid gap-4 p-4">
            <Field label="ຊື່ບໍລິສັດ">
              <input
                name="companyName"
                defaultValue={map.get("companyName") ?? ""}
                className="field"
              />
            </Field>
            <Field
              label="ອັດຕາແລກປ່ຽນຕັ້ງຕົ້ນ 1 USD = ? ກີບ"
              hint="ໃຊ້ເມື່ອວັນນັ້ນຍັງບໍ່ໄດ້ບັນທຶກອັດຕາສະເພາະ"
            >
              <input
                name="defaultFxRateToLak"
                type="number"
                step="1"
                min="1"
                defaultValue={map.get("defaultFxRateToLak") ?? "21700"}
                className="field"
              />
            </Field>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-3 text-sm font-medium">Facebook Marketing API</p>
              <div className="grid gap-4">
                <Field label="ເວີຊັນ API">
                  <input
                    name="fbApiVersion"
                    defaultValue={map.get("fbApiVersion") ?? "v25.0"}
                    className="field"
                  />
                </Field>
                <Field
                  label="Access Token"
                  hint={
                    hasToken
                      ? "ມີ token ເກັບໄວ້ແລ້ວ — ປະວ່າງໄວ້ຖ້າບໍ່ຕ້ອງການປ່ຽນ"
                      : "ຍັງບໍ່ມີ token — ລະບົບຈະໃຊ້ໄດ້ສະເພາະການປ້ອນມື"
                  }
                >
                  <input
                    name="fbAccessToken"
                    type="password"
                    autoComplete="off"
                    placeholder={hasToken ? "••••••••••••" : "EAAG..."}
                    className="field"
                  />
                </Field>
                {hasToken ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="clearToken" value="1" className="h-4 w-4" />
                    ລຶບ token ທີ່ເກັບໄວ້ອອກ
                  </label>
                ) : null}
              </div>
            </div>

            <SubmitButton>ບັນທຶກຄ່າ</SubmitButton>
          </form>
          <FbConnection hasToken={hasToken} />
          <FbTokenGuide />
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader
              title="ດຶງຂໍ້ມູນຈາກ Facebook"
              subtitle={
                hasToken
                  ? `${accountsWithId} ບັນຊີພ້ອມ sync — ຂໍ້ມູນ Facebook ຈະທັບແຖວວັນ/ແຄມເປນດຽວກັນ`
                  : "ຕ້ອງໃສ່ access token ກ່ອນຈຶ່ງ sync ໄດ້"
              }
            />
            <form action={runFacebookSync} className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="ແຕ່ວັນທີ່">
                <input
                  name="from"
                  type="date"
                  defaultValue={addDays(todayStr(), -7)}
                  className="field"
                />
              </Field>
              <Field label="ຫາວັນທີ່">
                <input
                  name="to"
                  type="date"
                  defaultValue={todayStr()}
                  className="field"
                />
              </Field>

              <fieldset className="sm:col-span-2">
                <legend className="label">ລະດັບທີ່ຈະດຶງ</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <input
                      type="checkbox"
                      name="levelCampaign"
                      defaultChecked
                      disabled
                      className="h-4 w-4"
                    />
                    ແຄມເປນ (ດຶງສະເໝີ)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="levelAdset" className="h-4 w-4" />
                    ຊຸດໂຄສະນາ
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="levelAd" className="h-4 w-4" />
                    ຊິ້ນໂຄສະນາ
                  </label>
                </div>
                <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
                  ລະດັບແຄມເປນຖືກດຶງສະເໝີ ເພາະຍອດລວມທັງລະບົບນັບຈາກລະດັບນີ້.
                  ລະດັບຊຸດ/ຊິ້ນເປັນລາຍລະອຽດເພີ່ມ (ບໍ່ຖືກນັບຊ້ຳໃນຍອດລວມ) ແຕ່ຊ້າກວ່າ
                  ແລະ ກິນໂຄຕ້າ API ຫຼາຍກວ່າ
                </p>
              </fieldset>

              <div className="sm:col-span-2">
                <SubmitButton pendingText="ກຳລັງດຶງຂໍ້ມູນ...">
                  ດຶງຂໍ້ມູນດຽວນີ້
                </SubmitButton>
                {!hasToken ? (
                  <p className="mt-2 text-xs text-[var(--fg-subtle)]">
                    ບໍ່ມີ token — ການກົດຈະບັນທຶກເປັນ “ຜິດພາດ” ໄວ້ໃນປະຫວັດລຸ່ມນີ້
                  </p>
                ) : null}
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="ປະຫວັດການດຶງຂໍ້ມູນ" subtitle="10 ຄັ້ງລ່າສຸດ" />
            {logs.length === 0 ? (
              <EmptyState title="ຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນຈາກ API" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ເວລາ</th>
                      <th>ສະຖານະ</th>
                      <th className="num">ແຖວ</th>
                      <th>ຂໍ້ຄວາມ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap text-xs">
                          {log.startedAt.toLocaleString("en-GB", {
                            timeZone: "Asia/Vientiane",
                            hour12: false,
                          })}
                        </td>
                        <td>
                          <Badge tone={SYNC_TONE[log.status] ?? "neutral"}>
                            {SYNC_LABEL[log.status] ?? log.status}
                          </Badge>
                        </td>
                        <td className="num">{formatInt(log.recordCount)}</td>
                        <td className="max-w-80 text-xs text-[var(--fg-muted)]">
                          {log.message ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="xl:col-span-2" id="alerts">
          <CardHeader
            title="ເກນການແຈ້ງເຕືອນ"
            subtitle="ໃຊ້ຄິດວ່າອັນໃດຄວນຂຶ້ນເຕືອນຢູ່ໜ້າ ການແຈ້ງເຕືອນ"
          />
          <form
            action={saveAlertThresholds}
            className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <Field
              label="ຍອມໃຫ້ເກີນງົບຕໍ່ວັນ (%)"
              hint="ເກີນກວ່ານີ້ຈຶ່ງເຕືອນ — ກັນການເຕືອນຈາກສ່ວນຕ່າງເລັກນ້ອຍ"
            >
              <input
                name="dailyBudgetTolerancePct"
                type="number"
                min="0"
                step="1"
                defaultValue={thresholds.dailyBudgetTolerancePct}
                className="field"
              />
            </Field>
            <Field label="ເຕືອນເມື່ອໃຊ້ງົບລວມເຖິງ (%)" hint="ໃຊ້ກັບງົບແຄມເປນ ແລະ ເພດານບັນຊີ">
              <input
                name="lifetimeBudgetPct"
                type="number"
                min="1"
                max="100"
                step="1"
                defaultValue={thresholds.lifetimeBudgetPct}
                className="field"
              />
            </Field>
            <Field label="ROAS ຕ່ຳສຸດທີ່ຮັບໄດ້" hint="ຄິດຈາກ 7 ວັນຫຼ້າສຸດ">
              <input
                name="roasMin"
                type="number"
                min="0"
                step="0.1"
                defaultValue={thresholds.roasMin}
                className="field"
              />
            </Field>
            <Field
              label="ຄ່າຕໍ່ 1 ຄົນທັກ ສູງສຸດ (ກີບ)"
              hint="ໃສ່ 0 ເພື່ອປິດການກວດນີ້"
            >
              <input
                name="costPerMessageMax"
                type="number"
                min="0"
                step="1000"
                defaultValue={thresholds.costPerMessageMax}
                className="field"
              />
            </Field>
            <Field label="ລູກຄ້າຄ້າງເກີນ (ວັນ)" hint="ຢູ່ສະຖານະ “ໃໝ່” ດົນກວ່ານີ້ຈຶ່ງເຕືອນ">
              <input
                name="staleLeadDays"
                type="number"
                min="1"
                step="1"
                defaultValue={thresholds.staleLeadDays}
                className="field"
              />
            </Field>
            <Field label="ເຕືອນກ່ອນແຄມເປນຈົບ (ວັນ)">
              <input
                name="endingSoonDays"
                type="number"
                min="1"
                step="1"
                defaultValue={thresholds.endingSoonDays}
                className="field"
              />
            </Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <SubmitButton>ບັນທຶກເກນ</SubmitButton>
            </div>
          </form>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="ອັດຕາແລກປ່ຽນລາຍວັນ"
            subtitle="ໃຊ້ແປງຄ່າໂຄສະນາເປັນກີບ — ບັນທຶກຕອນປ້ອນຜົນລາຍວັນກໍ່ໄດ້"
          />
          <form
            action={saveExchangeRate}
            className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] p-4"
          >
            <Field label="ວັນທີ່">
              <input
                name="date"
                type="date"
                required
                defaultValue={todayStr()}
                className="field"
              />
            </Field>
            <Field label="ສະກຸນເງິນ">
              <select name="currency" defaultValue="USD" className="field">
                {CURRENCIES.filter((c) => c !== "LAK").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="1 ໜ່ວຍ = ? ກີບ">
              <input
                name="rateToLak"
                type="number"
                step="1"
                min="1"
                required
                defaultValue={map.get("defaultFxRateToLak") ?? "21700"}
                className="field"
              />
            </Field>
            <SubmitButton>ບັນທຶກອັດຕາ</SubmitButton>
          </form>

          {rates.length === 0 ? (
            <EmptyState title="ຍັງບໍ່ມີອັດຕາແລກປ່ຽນ" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ວັນທີ່</th>
                    <th>ສະກຸນ</th>
                    <th className="num">ເປັນກີບ</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateLao(r.date)}</td>
                      <td>{r.currency}</td>
                      <td className="num">{formatInt(r.rateToLak)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
