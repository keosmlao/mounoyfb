import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionMessageForm } from "@/components/ActionMessageForm";
import { currentUser, hasUsers } from "@/lib/auth-server";
import { loadBoostContext } from "@/lib/live-boost-server";
import { BOOST_AGE, BOOST_HOURS, GENDER_LABEL, type BoostGender } from "@/lib/live-boost";
import { formatInt, formatMoney } from "@/lib/format";
import { formatTimeLao } from "@/lib/date";
import type { MoneyFn } from "@/lib/money";
import { createBoostAction, refreshBoostAction, runBoostAction, saveBoostCap } from "../actions";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  IN_PROCESS: "warning",
  PAUSED: "neutral",
  CAMPAIGN_PAUSED: "neutral",
  ADSET_PAUSED: "neutral",
  DISAPPROVED: "danger",
  WITH_ISSUES: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ກຳລັງຍິງ",
  PENDING_REVIEW: "Facebook ກຳລັງກວດ",
  IN_PROCESS: "ກຳລັງກຽມ",
  PAUSED: "ຢຸດຢູ່",
  CAMPAIGN_PAUSED: "ຢຸດຢູ່",
  ADSET_PAUSED: "ຢຸດຢູ່",
  DISAPPROVED: "ຖືກປະຕິເສດ",
  WITH_ISSUES: "ມີບັນຫາ",
};

/** ການ boost ຂອງ live ພ້ອມບອກວ່າໝົດເວລາແລ້ວບໍ່ (ຄິດຕອນໂຫຼດ ບໍ່ແມ່ນຕອນ render) */
async function loadBoosts(sessionId: string) {
  const rows = await prisma.liveBoost.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    include: { adAccount: { select: { name: true } } },
  });
  const now = Date.now();
  return rows.map((row) => ({ ...row, expired: row.endsAt.getTime() <= now }));
}

/**
 * Boost live — **ໃຊ້ເງິນຈິງ**. ສ້າງໄວ້ຢຸດສະເໝີ ຄົນກົດ "ຍິງ" ເອງ
 * ແລະ ງົບຕ້ອງບໍ່ເກີນເພດານ (ກີບ) ທີ່ ADMIN ຕັ້ງ.
 */
export async function BoostPanel({
  session,
  money,
}: {
  session: { id: string; fbVideoId: string | null };
  money: MoneyFn;
}) {
  const [{ accounts, cap, rates }, boosts, user, anyUsers] = await Promise.all([
    loadBoostContext(),
    loadBoosts(session.id),
    currentUser(),
    hasUsers(),
  ]);
  const isAdmin = user?.role === "ADMIN" || !anyUsers;

  return (
    <Card id="boost">
      <CardHeader
        title="Boost live"
        subtitle="ຍິງໂຄສະນາໃຫ້ live ນີ້ — ສ້າງໄວ້ຢຸດ ກວດແລ້ວຈຶ່ງກົດຍິງ · ໝົດເວລາ Facebook ຢຸດເອງ"
      />

      {boosts.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
          {boosts.map((b) => {
            const { expired } = b;
            const shown = b.effectiveStatus ?? b.status;
            const spendLak = b.spend !== null && b.budget > 0 ? (b.spend / b.budget) * b.budgetLak : null;
            return (
              <li key={b.id} className="grid gap-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={expired ? "neutral" : (STATUS_TONE[shown] ?? "info")}>
                    {expired ? "ໝົດເວລາແລ້ວ" : (STATUS_LABEL[shown] ?? shown)}
                  </Badge>
                  <span className="text-sm font-medium">{formatMoney(b.budget, b.currency)}</span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    ≈ {money(b.budgetLak)} · {b.hours} ຊົ່ວໂມງ · ຮອດ {formatTimeLao(b.endsAt)}
                  </span>
                </div>
                <p className="text-xs text-[var(--fg-muted)]">
                  {b.adAccount.name} · ລາວ ອາຍຸ {b.ageMin}–{b.ageMax} · {GENDER_LABEL[b.gender as BoostGender] ?? b.gender}
                  {b.createdBy ? ` · ສ້າງໂດຍ ${b.createdBy}` : ""}
                </p>
                {b.spend !== null ? (
                  <p className="tnum text-xs">
                    ໃຊ້ໄປ {formatMoney(b.spend, b.currency)}
                    {spendLak !== null ? ` (≈ ${money(spendLak)})` : ""} · ເຂົ້າເຖິງ {formatInt(b.reach)} ຄົນ
                    {b.checkedAt ? <span className="text-[var(--fg-subtle)]"> · ກວດ {formatTimeLao(b.checkedAt)}</span> : null}
                  </p>
                ) : null}
                {b.reviewNote ? <p className="text-xs text-[var(--danger)]">{b.reviewNote}</p> : null}
                {b.error ? <p className="text-xs text-[var(--danger)]">{b.error}</p> : null}

                <div className="flex flex-wrap items-start gap-1.5">
                  {!expired && b.status !== "ACTIVE" ? (
                    <ActionMessageForm
                      action={runBoostAction.bind(null, b.id, true)}
                      submitLabel="▶ ຍິງ"
                      pendingText="ກຳລັງສັ່ງ..."
                      buttonClassName="btn btn-primary btn-sm"
                      confirmText={`ຍິງໂຄສະນາ ${formatMoney(b.budget, b.currency)} ແທ້? ເງິນຈະເລີ່ມຖືກຕັດຈາກ ${b.adAccount.name}`}
                    />
                  ) : null}
                  {!expired && b.status === "ACTIVE" ? (
                    <ActionMessageForm
                      action={runBoostAction.bind(null, b.id, false)}
                      submitLabel="■ ຢຸດທັນທີ"
                      pendingText="ກຳລັງຢຸດ..."
                      buttonClassName="btn btn-danger btn-sm"
                    />
                  ) : null}
                  <form action={refreshBoostAction.bind(null, b.id)}>
                    <SubmitButton className="btn btn-sm" pendingText="...">↻ ອັບເດດ</SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-3 p-4">
        {cap === null ? (
          <p className="text-sm text-[var(--warning)]">
            ຍັງບໍ່ໄດ້ຕັ້ງເພດານງົບ — boost ບໍ່ໄດ້ຈົນກວ່າຜູ້ດູແລລະບົບຈະຕັ້ງ (ກັນພິມງົບຜິດ ເຊັ່ນ 500 ແທນ 5)
          </p>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">ເພດານງົບຕໍ່ການ boost 1 ເທື່ອ: <b>{money(cap)}</b></p>
        )}

        {isAdmin ? (
          <details open={cap === null}>
            <summary className="cursor-pointer text-xs text-[var(--fg-muted)]">ຕັ້ງເພດານງົບ (ADMIN)</summary>
            <form action={saveBoostCap.bind(null, session.id)} className="mt-2 flex flex-wrap items-end gap-2">
              <Field label="ເພດານຕໍ່ເທື່ອ (ກີບ)">
                <input name="cap" type="number" min={1} step={1} defaultValue={cap ?? ""} required className="field !w-40" />
              </Field>
              <SubmitButton className="btn btn-sm" pendingText="...">ບັນທຶກ</SubmitButton>
            </form>
          </details>
        ) : null}

        {!session.fbVideoId ? (
          <p className="text-xs text-[var(--fg-subtle)]">ຜູກວິດີໂອ live ກ່ອນ ຈຶ່ງ boost ໄດ້</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-[var(--fg-subtle)]">
            ບໍ່ມີບັນຊີໂຄສະນາທີ່ຜູກກັບ Facebook — <Link href="/ad-accounts" className="link">ໄປໜ້າບັນຊີໂຄສະນາ</Link>
          </p>
        ) : cap !== null ? (
          <ActionMessageForm
            action={createBoostAction.bind(null, session.id)}
            submitLabel="ສ້າງ boost (ຢຸດໄວ້)"
            pendingText="ກຳລັງສ້າງຢູ່ Facebook..."
            className="grid gap-2 border-t border-[var(--border)] pt-3"
          >
            <Field label="ບັນຊີໂຄສະນາ">
              <select name="adAccountId" required className="field w-full">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency}
                    {a.currency !== "LAK" ? ` · 1 = ${formatInt(rates[a.currency])} ກີບ` : ""})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="ງົບລວມ (ສະກຸນຂອງບັນຊີ)" hint="ເຊັ່ນ 10 = $10">
                <input name="budget" type="number" min={1} step="0.01" required className="field w-full" />
              </Field>
              <Field label="ຍິງດົນ (ຊົ່ວໂມງ)">
                <input
                  name="hours"
                  type="number"
                  min={BOOST_HOURS.min}
                  max={BOOST_HOURS.max}
                  step={1}
                  defaultValue={3}
                  required
                  className="field w-full"
                />
              </Field>
              <Field label="ອາຍຸຕ່ຳສຸດ">
                <input name="ageMin" type="number" min={BOOST_AGE.min} max={BOOST_AGE.max} defaultValue={18} className="field w-full" />
              </Field>
              <Field label="ອາຍຸສູງສຸດ">
                <input name="ageMax" type="number" min={BOOST_AGE.min} max={BOOST_AGE.max} defaultValue={55} className="field w-full" />
              </Field>
            </div>
            <Field label="ເພດ">
              <select name="gender" defaultValue="all" className="field w-full">
                {Object.entries(GENDER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <p className="text-2xs text-[var(--fg-subtle)]">
              ເປົ້າໝາຍ: ການມີສ່ວນຮ່ວມ (comment/react) · ປະເທດລາວ · ສະແດງໃນ Facebook ·
              ສ້າງແລ້ວ<b>ຍັງບໍ່ຕັດເງິນ</b> ຈົນກວ່າຈະກົດ “ຍິງ”
            </p>
          </ActionMessageForm>
        ) : null}
      </div>
    </Card>
  );
}
