import { Card } from "@/components/ui";

/**
 * ໂຄງຫຼອກຕອນກຳລັງໂຫຼດໜ້າ.
 *
 * ເປັນຫຍັງຕ້ອງມີ: ທຸກໜ້າຂອງລະບົບເປັນ `force-dynamic` (ຕ້ອງຖາມຖານຂໍ້ມູນສະເໝີ)
 * ຊຶ່ງ Next **ຂ້າມການ prefetch** ໃຫ້ — ກົດເມນູແລ້ວໜ້າຈະຄ້າງຢູ່ອັນເກົ່າ
 * ຈົນເຊີບເວີຕອບ ຄືກັບວ່າກົດບໍ່ຕິດ. ພໍມີ `loading.tsx` Next ຈຶ່ງ prefetch
 * ບາງສ່ວນໄດ້ ແລະ ສະແດງໂຄງນີ້ທັນທີທີ່ກົດ.
 *
 * ຮູບຮ່າງອີງໂຄງທີ່ໜ້າສ່ວນຫຼາຍໃຊ້ຢູ່ (ຫົວໜ້າ → ແຖບຕົວເລກ → ຕາຕະລາງ)
 * ເພື່ອບໍ່ໃຫ້ໜ້າກະໂດດແຮງຕອນຂໍ້ມູນຈິງມາແທນ.
 */
export function PageSkeleton({
  /** ຈຳນວນຊ່ອງໃນແຖບຕົວເລກ — 0 = ໜ້ານັ້ນບໍ່ມີແຖບຕົວເລກ */
  stats = 4,
  rows = 8,
}: {
  stats?: number;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">ກຳລັງໂຫຼດ...</span>

      {/* ຫົວໜ້າ */}
      <div className="page-header mb-2.5">
        <div className="skel h-5 w-52" />
        <div className="skel mt-1.5 h-3 w-72" />
      </div>

      {/* ແຖບຕົວເລກລວມ */}
      {stats > 0 ? (
        <div className="stat-strip mb-3 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="stat-cell">
              <div className="skel h-3 w-20" />
              <div className="skel mt-1.5 h-5 w-24" />
              <div className="skel mt-1.5 h-2.5 w-16" />
            </div>
          ))}
        </div>
      ) : null}

      {/* ຕາຕະລາງ */}
      <Card>
        <div className="card-header border-b border-[var(--border)] px-3 py-2">
          <div className="skel h-3.5 w-40" />
        </div>
        <div className="p-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="skel h-3 flex-1" />
              <div className="skel hidden h-3 w-24 sm:block" />
              <div className="skel hidden h-3 w-16 md:block" />
              <div className="skel h-3 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
