import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CURRENCIES, STATUS_LABEL, options } from "@/lib/labels";
import type { AdAccountModel } from "@/generated/prisma/models";

export function AdAccountForm({
  action,
  account,
}: {
  action: (fd: FormData) => Promise<void>;
  account?: AdAccountModel;
}) {
  return (
    <form action={action} className="grid gap-3 p-3 sm:grid-cols-2">
      <Field label="ຊື່ບັນຊີໂຄສະນາ *" className="sm:col-span-2">
        <input
          name="name"
          required
          defaultValue={account?.name}
          className="field"
          placeholder="ຕົວຢ່າງ: ODIEN Main Ad Account"
        />
      </Field>

      <Field
        label="Facebook Ad Account ID"
        hint="ຮູບແບບ act_XXXXXXXXX — ໃສ່ເມື່ອຈະຕໍ່ API (ວ່າງໄດ້)"
      >
        <input
          name="fbAccountId"
          defaultValue={account?.fbAccountId ?? ""}
          className="field"
          placeholder="act_1234567890"
        />
      </Field>

      <Field label="ສະກຸນເງິນທີ່ Facebook ຕັດ">
        <select
          name="currency"
          defaultValue={account?.currency ?? "USD"}
          className="field"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ເຂດເວລາ">
        <input
          name="timezone"
          defaultValue={account?.timezone ?? "Asia/Vientiane"}
          className="field"
        />
      </Field>

      <Field label="ເພດານຄ່າໃຊ້ຈ່າຍ (spend cap)" hint="ຕາມສະກຸນເງິນຂອງບັນຊີ">
        <input
          name="spendCap"
          type="number"
          step="0.01"
          min="0"
          defaultValue={account?.spendCap ?? ""}
          className="field"
        />
      </Field>

      <Field label="ສະຖານະ">
        <select
          name="status"
          defaultValue={account?.status ?? "ACTIVE"}
          className="field"
        >
          {options(STATUS_LABEL).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ໝາຍເຫດ" className="sm:col-span-2">
        <textarea
          name="note"
          rows={2}
          defaultValue={account?.note ?? ""}
          className="field"
        />
      </Field>

      <div className="sm:col-span-2">
        <SubmitButton>{account ? "ບັນທຶກການແກ້ໄຂ" : "ເພີ່ມບັນຊີ"}</SubmitButton>
      </div>
    </form>
  );
}
