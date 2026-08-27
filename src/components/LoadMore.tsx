import Link from "next/link";
import { formatInt } from "@/lib/format";

/**
 * ແຖບ "ໂຫຼດເພີ່ມ" ໃຕ້ຕາຕະລາງທີ່ຍາວ.
 *
 * ກ່ອນນີ້ໜ້າ Order / ລູກຄ້າ ຕັດແຖວຖິ້ມຢູ່ 300 ກັບ 200 ແລ້ວບອກແຕ່ວ່າ
 * "ສູງສຸດ 300" — ອັນເກົ່າກວ່ານັ້ນເປີດເບິ່ງບໍ່ໄດ້ເລີຍ. ໃຊ້ວິທີດຽວກັບ
 * ກ່ອງຂໍ້ຄວາມ: ເພີ່ມຈຳນວນຜ່ານ `?show=` ຊຶ່ງເປັນລິ້ງທຳມະດາ
 * ຈຶ່ງໃຊ້ໄດ້ທັງຕອນກົດຍ້ອນຫຼັງ ແລະ ຕອນແບ່ງລິ້ງໃຫ້ຄົນອື່ນ.
 */
export function LoadMore({
  shown,
  total,
  step,
  href,
}: {
  shown: number;
  total: number;
  /** ໂຫຼດເພີ່ມເທື່ອລະຈັກແຖວ */
  step: number;
  /** ສ້າງລິ້ງຈາກຈຳນວນທີ່ຢາກສະແດງ (ຮັກສາຕົວກັ່ນຕອງເດີມໄວ້) */
  href: (show: number) => string;
}) {
  const remaining = total - shown;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--fg-muted)]">
        ສະແດງ {formatInt(shown)} ຈາກ {formatInt(total)} ລາຍການ
      </p>
      {remaining > 0 ? (
        <Link
          href={href(shown + step)}
          // ຈໍນ້ອຍ: ປຸ່ມເຕັມແຖວ ກົດງ່າຍດ້ວຍນິ້ວມື · ຈໍໃຫຍ່: ປຸ່ມພໍດີຄຳ
          className="btn btn-sm w-full sm:w-auto"
        >
          ໂຫຼດເພີ່ມ {formatInt(Math.min(step, remaining))} ລາຍການ
        </Link>
      ) : null}
    </div>
  );
}
