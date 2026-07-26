import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { OBJECTIVE_LABEL, STATUS_LABEL, options } from "@/lib/labels";
import { toDateInput } from "@/lib/date";
import type { CampaignModel } from "@/generated/prisma/models";

type Option = { id: string; name: string };

export function CampaignForm({
  action,
  campaign,
  accounts,
  pages,
  products,
  submitLabel = "ບັນທຶກ",
}: {
  action: (fd: FormData) => Promise<void>;
  campaign?: CampaignModel;
  accounts: Option[];
  pages: Option[];
  products: Option[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="grid gap-4 p-4 sm:grid-cols-2">
      <Field label="ຊື່ແຄມເປນ *" className="sm:col-span-2">
        <input
          name="name"
          required
          defaultValue={campaign?.name}
          className="field"
          placeholder="ຕົວຢ່າງ: ຕູ້ເຢັນ Hisense — ທັກແຊັດ"
        />
      </Field>

      <Field label="ບັນຊີໂຄສະນາ *">
        <select
          name="adAccountId"
          required
          defaultValue={campaign?.adAccountId ?? ""}
          className="field"
        >
          <option value="" disabled>
            — ເລືອກບັນຊີ —
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ເປົ້າໝາຍ (objective)">
        <select
          name="objective"
          defaultValue={campaign?.objective ?? "MESSAGES"}
          className="field"
        >
          {options(OBJECTIVE_LABEL).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ເພຈທີ່ຍິງ">
        <select
          name="pageId"
          defaultValue={campaign?.pageId ?? ""}
          className="field"
        >
          <option value="">— ບໍ່ລະບຸ —</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ສິນຄ້າ" hint="ຜູກໄວ້ເພື່ອຄິດກຳໄລ ແລະ ROAS">
        <select
          name="productId"
          defaultValue={campaign?.productId ?? ""}
          className="field"
        >
          <option value="">— ບໍ່ລະບຸ —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ງົບຕໍ່ວັນ" hint="ຕາມສະກຸນເງິນຂອງບັນຊີໂຄສະນາ">
        <input
          name="dailyBudget"
          type="number"
          step="0.01"
          min="0"
          defaultValue={campaign?.dailyBudget ?? ""}
          className="field"
        />
      </Field>

      <Field label="ງົບລວມທັງແຄມເປນ">
        <input
          name="lifetimeBudget"
          type="number"
          step="0.01"
          min="0"
          defaultValue={campaign?.lifetimeBudget ?? ""}
          className="field"
        />
      </Field>

      <Field label="ວັນເລີ່ມ">
        <input
          name="startDate"
          type="date"
          defaultValue={campaign?.startDate ? toDateInput(campaign.startDate) : ""}
          className="field"
        />
      </Field>

      <Field label="ວັນສິ້ນສຸດ">
        <input
          name="endDate"
          type="date"
          defaultValue={campaign?.endDate ? toDateInput(campaign.endDate) : ""}
          className="field"
        />
      </Field>

      <Field label="ຜູ້ຮັບຜິດຊອບ">
        <input
          name="ownerName"
          defaultValue={campaign?.ownerName ?? ""}
          className="field"
          placeholder="ຊື່ຄົນຍິງ"
        />
      </Field>

      <Field label="ສະຖານະ">
        <select
          name="status"
          defaultValue={campaign?.status ?? "ACTIVE"}
          className="field"
        >
          {options(STATUS_LABEL).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Facebook Campaign ID" hint="ວ່າງໄດ້ — ໃສ່ເມື່ອຈະ sync ກັບ API">
        <input
          name="fbCampaignId"
          defaultValue={campaign?.fbCampaignId ?? ""}
          className="field"
        />
      </Field>

      <Field label="ປະເພດການຊື້">
        <select
          name="buyingType"
          defaultValue={campaign?.buyingType ?? "AUCTION"}
          className="field"
        >
          <option value="AUCTION">AUCTION (ປະມູນ)</option>
          <option value="RESERVED">RESERVED (ຈອງລ່ວງໜ້າ)</option>
        </select>
      </Field>

      <Field label="ໝາຍເຫດ" className="sm:col-span-2">
        <textarea
          name="note"
          rows={2}
          defaultValue={campaign?.note ?? ""}
          className="field"
        />
      </Field>

      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
