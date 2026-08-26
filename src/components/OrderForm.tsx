import type { OrderStatus } from "@/generated/prisma/enums";
import { Field } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { LEAD_CHANNELS, ORDER_STATUS_LABEL, options } from "@/lib/labels";
import { todayStr, toDateInput } from "@/lib/date";

type Option = { id: string; name: string };
type LeadOption = Option & { phone: string | null };

export type OrderFormValue = {
  orderNo?: string | null;
  date?: Date | null;
  status?: OrderStatus;
  customerName?: string;
  phone?: string | null;
  channel?: string | null;
  quantity?: number;
  saleAmount?: number;
  productCost?: number;
  shippingCost?: number;
  otherCost?: number;
  refundAmount?: number;
  trackingNo?: string | null;
  note?: string | null;
  leadId?: string | null;
  productId?: string | null;
  campaignId?: string | null;
};

export function OrderForm({
  action,
  campaigns,
  products,
  leads,
  value,
  submitLabel = "ບັນທຶກ Order",
}: {
  action: (fd: FormData) => void | Promise<void>;
  campaigns: Option[];
  products: Option[];
  leads: LeadOption[];
  value?: OrderFormValue;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="grid gap-4 p-4 sm:grid-cols-2">
      <Field label="ວັນທີ່ *">
        <input
          name="date"
          type="date"
          required
          defaultValue={value?.date ? toDateInput(value.date) : todayStr()}
          className="field"
        />
      </Field>
      <Field label="ເລກ Order" hint="ວ່າງໄດ້; ຕ້ອງບໍ່ຊ້ຳກັນ">
        <input name="orderNo" defaultValue={value?.orderNo ?? ""} className="field" />
      </Field>
      <Field label="ລູກຄ້າຈາກ CRM" hint="ເລືອກແລ້ວຈະຮັບ campaign/product ໄດ້ອັດຕະໂນມັດ">
        <select name="leadId" defaultValue={value?.leadId ?? ""} className="field">
          <option value="">— ບໍ່ໄດ້ຜູກ Lead —</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name}{lead.phone ? ` · ${lead.phone}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ຊື່ລູກຄ້າ *" hint="ຖ້າຜູກ Lead ສາມາດປະວ່າງໄດ້">
        <input
          name="customerName"
          defaultValue={value?.customerName ?? ""}
          className="field"
        />
      </Field>
      <Field label="ເບີໂທ">
        <input name="phone" defaultValue={value?.phone ?? ""} className="field" />
      </Field>
      <Field label="ຊ່ອງທາງ">
        <select name="channel" defaultValue={value?.channel ?? "Messenger"} className="field">
          {LEAD_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>{channel}</option>
          ))}
        </select>
      </Field>
      <Field label="ສິນຄ້າ" hint="ຖ້າປະລາຄາ/ຕົ້ນທຶນວ່າງ ຈະໃຊ້ຈາກ Product × ຈຳນວນ">
        <select name="productId" defaultValue={value?.productId ?? ""} className="field">
          <option value="">— ບໍ່ລະບຸ —</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </Field>
      <Field label="ແຄມເປນທີ່ມາ">
        <select name="campaignId" defaultValue={value?.campaignId ?? ""} className="field">
          <option value="">— Organic / ບໍ່ລະບຸ —</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
      </Field>
      <Field label="ຈຳນວນ *">
        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={value?.quantity ?? 1}
          className="field"
        />
      </Field>
      <Field label="ສະຖານະ">
        <select name="status" defaultValue={value?.status ?? "PENDING"} className="field">
          {options(ORDER_STATUS_LABEL).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="ຍອດຂາຍ (ກີບ)" hint="ວ່າງ = ລາຄາ Product × ຈຳນວນ">
        <input
          name="saleAmount"
          type="number"
          min="0"
          step="1000"
          defaultValue={value?.saleAmount ?? ""}
          className="field"
        />
      </Field>
      <Field label="ຕົ້ນທຶນສິນຄ້າລວມ" hint="ວ່າງ = ຕົ້ນທຶນ Product × ຈຳນວນ">
        <input
          name="productCost"
          type="number"
          min="0"
          step="1000"
          defaultValue={value?.productCost ?? ""}
          className="field"
        />
      </Field>
      <Field label="ຄ່າສົ່ງ">
        <input name="shippingCost" type="number" min="0" step="1000" defaultValue={value?.shippingCost ?? 0} className="field" />
      </Field>
      <Field label="ຄ່າອື່ນ">
        <input name="otherCost" type="number" min="0" step="1000" defaultValue={value?.otherCost ?? 0} className="field" />
      </Field>
      <Field label="ເງິນຄືນ" hint="ສຳລັບຄືນເງິນບາງສ່ວນຂອງ Order ທີ່ຮັບສຳເລັດ">
        <input name="refundAmount" type="number" min="0" step="1000" defaultValue={value?.refundAmount ?? 0} className="field" />
      </Field>
      <Field label="ເລກພັດສະດຸ">
        <input name="trackingNo" defaultValue={value?.trackingNo ?? ""} className="field" />
      </Field>
      <Field label="ໝາຍເຫດ" className="sm:col-span-2">
        <textarea name="note" defaultValue={value?.note ?? ""} rows={3} className="field" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
