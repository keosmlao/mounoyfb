import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { loadMoney } from "@/lib/money-server";
import { DEFAULT_FX_RATE } from "@/lib/money";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportOrdersPage() {
  const { currency, rate } = await loadMoney();

  return (
    <>
      <PageHeader
        title="ນຳເຂົ້າຍອດຂາຍ"
        description="ເອົາຂໍ້ມູນການຂາຍເກົ່າຈາກ Excel / Google Sheets ເຂົ້າລະບົບເທື່ອດຽວ"
        action={
          <Link href="/orders" className="btn">
            ກັບໄປໜ້າ Order
          </Link>
        }
      />
      <ImportForm
        currency={currency}
        rate={rate}
        defaultFxRate={rate || DEFAULT_FX_RATE}
      />
    </>
  );
}
