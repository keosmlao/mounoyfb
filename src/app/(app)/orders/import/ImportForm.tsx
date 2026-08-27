"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Card, CardHeader, Field, Num } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { FIELD_LABEL, IMPORT_FIELDS } from "@/lib/order-import";
import { makeMoney, type DisplayCurrency } from "@/lib/money";
import {
  confirmImport,
  previewImport,
  type ImportState,
} from "./actions";

const IDLE: ImportState = { phase: "idle" };

export function ImportForm({
  currency,
  rate,
  defaultFxRate,
}: {
  currency: DisplayCurrency;
  rate: number;
  defaultFxRate: number;
}) {
  const [state, runPreview] = useActionState(previewImport, IDLE);
  const money = makeMoney(currency, rate);

  if (state.phase === "done") return <Done state={state} />;
  if (state.phase === "preview") {
    return <Preview state={state} money={money} />;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="ນຳເຂົ້າຍອດຂາຍຈາກ CSV / Excel"
        subtitle="ລະບົບຈະເດົາຫົວຄໍລຳໃຫ້ ແລ້ວໃຫ້ເບິ່ງຕົວຢ່າງກ່ອນບັນທຶກ"
      />
      <form action={runPreview} className="grid gap-3 p-3">
        {state.phase === "error" ? (
          <p
            role="alert"
            className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
          >
            {state.message}
          </p>
        ) : null}

        <Field
          label="ເລືອກໄຟລ໌"
          hint="ຮັບໄຟລ໌ .csv — ຖ້າເປັນ Excel ໃຫ້ File → Save As → “CSV UTF-8 (.csv)” ກ່ອນ"
        >
          <input
            type="file"
            name="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv"
            className="field"
          />
        </Field>

        <details>
          <summary className="cursor-pointer text-sm text-[var(--fg-muted)]">
            ຫຼື ວາງຂໍ້ມູນຈາກ Google Sheets ໂດຍກົງ
          </summary>
          <div className="mt-3">
            <Field
              label="ວາງຂໍ້ມູນ"
              hint="ຄັດລອກທັງຕາຕະລາງພ້ອມຫົວຄໍລຳ ແລ້ວວາງບ່ອນນີ້"
            >
              <textarea name="text" rows={6} className="field font-mono text-xs" />
            </Field>
          </div>
        </details>

        <CurrencyChoice defaultFxRate={defaultFxRate} />

        <SubmitButton pendingText="ກຳລັງອ່ານ...">ອ່ານ ແລະ ເບິ່ງຕົວຢ່າງ</SubmitButton>
      </form>

      <div className="border-t border-[var(--border)] px-4 py-3 text-xs leading-relaxed text-[var(--fg-subtle)]">
        <p className="mb-1 font-medium text-[var(--fg-muted)]">
          ຄໍລຳທີ່ລະບົບຮູ້ຈັກ (ຕ້ອງມີຢ່າງໜ້ອຍ ວັນທີ່ ແລະ ຍອດຂາຍ):
        </p>
        {IMPORT_FIELDS.map((f) => FIELD_LABEL[f]).join(" · ")}
        <p className="mt-2">
          ຊື່ຄໍລຳເປັນລາວ, ໄທ ຫຼື ອັງກິດກໍ່ໄດ້ · ວັນທີ່ຮັບທັງ 2026-08-20,
          20/08/2026 ແລະ ປີ ພ.ສ. · ຕົວເລກມີຈຸດຄັ່ນຫຼັກພັນໄດ້
        </p>
      </div>
    </Card>
  );
}

function CurrencyChoice({ defaultFxRate }: { defaultFxRate: number }) {
  const [currency, setCurrency] = useState("LAK");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="ຕົວເລກໃນໄຟລ໌ເປັນສະກຸນໃດ">
        <select
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="field"
        >
          <option value="LAK">ກີບ</option>
          <option value="USD">ໂດລາ</option>
        </select>
      </Field>
      {currency === "USD" ? (
        <Field label="ອັດຕາແລກປ່ຽນ" hint="ໃຊ້ແປງເປັນກີບຕອນບັນທຶກ">
          <input
            name="fxRate"
            type="number"
            min="1"
            defaultValue={defaultFxRate}
            className="field"
          />
        </Field>
      ) : null}
    </div>
  );
}

function Preview({
  state,
  money,
}: {
  state: Extract<ImportState, { phase: "preview" }>;
  money: (v: number | null | undefined) => string;
}) {
  const [confirmState, runConfirm] = useActionState(confirmImport, IDLE);
  const { result } = state;

  if (confirmState.phase === "done") return <Done state={confirmState} />;

  const mapped = IMPORT_FIELDS.filter((f) => result.map[f] !== undefined);
  const totalSale = result.orders.reduce((s, o) => s + o.saleAmount, 0);
  const blocked = result.missing.length > 0;

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader
          title="ກວດການຈັບຄູ່ຄໍລຳ"
          subtitle="ຖ້າຈັບຄູ່ຜິດ ໃຫ້ແກ້ຫົວຄໍລຳໃນໄຟລ໌ແລ້ວອ່ານໃໝ່"
        />
        <div className="p-4">
          {blocked ? (
            <p className="mb-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
              ຫາຄໍລຳຈຳເປັນບໍ່ພົບ:{" "}
              {result.missing.map((f) => FIELD_LABEL[f]).join(", ")} —
              ນຳເຂົ້າບໍ່ໄດ້ຈົນກວ່າຈະມີ
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {mapped.map((f) => (
              <span key={f} className="badge badge-success">
                {FIELD_LABEL[f]} ← {result.headers[result.map[f] as number]}
              </span>
            ))}
            {result.headers
              .filter((_, i) => !Object.values(result.map).includes(i))
              .map((h) => (
                <span key={h} className="badge badge-neutral">
                  {h} (ບໍ່ໄດ້ໃຊ້)
                </span>
              ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="ນຳເຂົ້າໄດ້" value={`${result.orders.length} ແຖວ`} />
        <Stat
          label="ຂ້າມ (ຜິດພາດ)"
          value={`${result.errors.length} ແຖວ`}
          tone={result.errors.length > 0 ? "danger" : undefined}
        />
        <Stat label="ຍອດຂາຍລວມ" value={money(totalSale)} />
      </div>

      {state.unknownCampaigns.length > 0 ||
      state.unknownProducts.length > 0 ? (
        <Card>
          <CardHeader
            title="ຊື່ທີ່ຫາບໍ່ພົບໃນລະບົບ"
            subtitle="ແຖວເຫຼົ່ານີ້ຍັງນຳເຂົ້າໄດ້ ແຕ່ຈະບໍ່ຖືກຜູກ — ຄິດ ROAS ຕໍ່ແຄມເປນບໍ່ໄດ້"
          />
          <div className="grid gap-2 p-4 text-xs">
            {state.unknownCampaigns.length > 0 ? (
              <p>
                <span className="text-[var(--fg-muted)]">ແຄມເປນ: </span>
                {state.unknownCampaigns.join(" · ")}
              </p>
            ) : null}
            {state.unknownProducts.length > 0 ? (
              <p>
                <span className="text-[var(--fg-muted)]">ສິນຄ້າ: </span>
                {state.unknownProducts.join(" · ")}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {result.errors.length > 0 ? (
        <Card>
          <CardHeader
            title="ແຖວທີ່ອ່ານບໍ່ໄດ້"
            subtitle="ເລກແຖວຕົງກັບໃນ Excel — ແກ້ແລ້ວອ່ານໃໝ່ໄດ້"
          />
          <ul className="divide-y divide-[var(--border)] text-xs">
            {result.errors.slice(0, 20).map((e) => (
              <li key={e.rowNumber} className="px-4 py-2">
                <span className="text-[var(--fg-subtle)]">ແຖວ {e.rowNumber}:</span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="ຕົວຢ່າງ 10 ແຖວທຳອິດ"
          subtitle="ກວດວ່າຕົວເລກ ແລະ ວັນທີ່ຖືກຕ້ອງກ່ອນບັນທຶກ"
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ວັນທີ່</th>
                <th>ລູກຄ້າ</th>
                <th>ແຄມເປນ</th>
                <th>ສະຖານະ</th>
                <th className="num">ຍອດຂາຍ</th>
                <th className="num">ຕົ້ນທຶນ</th>
                <th className="num">ຄ່າສົ່ງ</th>
              </tr>
            </thead>
            <tbody>
              {result.orders.slice(0, 10).map((o) => (
                <tr key={o.rowNumber}>
                  <td className="whitespace-nowrap">{o.date}</td>
                  <td className="max-w-40 truncate">{o.customerName}</td>
                  <td className="max-w-40 truncate text-[var(--fg-muted)]">
                    {o.campaignName ?? "—"}
                  </td>
                  <td>{o.status}</td>
                  <td className="num">
                    <Num>{money(o.saleAmount)}</Num>
                  </td>
                  <td className="num">
                    <Num>{money(o.productCost)}</Num>
                  </td>
                  <td className="num">
                    <Num>{money(o.shippingCost)}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {confirmState.phase === "error" ? (
        <p
          role="alert"
          className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
        >
          {confirmState.message}
        </p>
      ) : null}

      <form action={runConfirm} className="flex flex-wrap gap-2">
        <input type="hidden" name="text" value={state.text} />
        <input type="hidden" name="fxRate" value={state.fxRate} />
        {blocked || result.orders.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">
            ຍັງນຳເຂົ້າບໍ່ໄດ້ — ແກ້ໄຟລ໌ແລ້ວລອງໃໝ່
          </p>
        ) : (
          <SubmitButton pendingText="ກຳລັງບັນທຶກ...">
            ບັນທຶກ {result.orders.length} ອໍເດີ
          </SubmitButton>
        )}
        <Link href="/orders/import" className="btn">
          ເລີ່ມໃໝ່
        </Link>
      </form>
    </div>
  );
}

function Done({ state }: { state: Extract<ImportState, { phase: "done" }> }) {
  return (
    <Card className="max-w-xl">
      <CardHeader title="ນຳເຂົ້າສຳເລັດ" />
      <div className="grid gap-2 p-4 text-sm">
        <p>
          ເພີ່ມໃໝ່ <strong>{state.created}</strong> ອໍເດີ · ອັບເດດ{" "}
          <strong>{state.updated}</strong> · ຂ້າມຊ້ຳ{" "}
          <strong>{state.skipped}</strong>
        </p>
        <p className="text-xs text-[var(--fg-muted)]">
          ຜູກກັບແຄມເປນໄດ້ {state.linkedCampaign} ອໍເດີ —
          ສະເພາະອັນທີ່ຜູກແລ້ວຈຶ່ງຄິດ ROAS ຕໍ່ແຄມເປນໄດ້
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/orders" className="btn btn-primary btn-sm">
            ເບິ່ງ Order
          </Link>
          <Link href="/analysis" className="btn btn-sm">
            ໄປໜ້າວິເຄາະ
          </Link>
          <Link href="/orders/import" className="btn btn-sm">
            ນຳເຂົ້າອີກ
          </Link>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${tone ? `text-[var(--${tone})]` : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
