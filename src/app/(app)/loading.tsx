import { PageSkeleton } from "@/components/PageSkeleton";

/**
 * ສະແດງທັນທີທີ່ກົດເມນູ ຈົນກວ່າໜ້າຈິງຈະພ້ອມ.
 *
 * ນອກຈາກເຫັນວ່າ "ກົດຕິດແລ້ວ" ການມີໄຟລ໌ນີ້ຍັງເຮັດໃຫ້ Next **prefetch
 * ບາງສ່ວນຂອງ route ທີ່ເປັນ dynamic ໄດ້** — ບໍ່ດັ່ງນັ້ນມັນຂ້າມການ prefetch
 * ທັງໝົດ ແລ້ວການປ່ຽນໜ້າຈະຄ້າງຢູ່ໜ້າເກົ່າຈົນເຊີບເວີຕອບ.
 */
export default function Loading() {
  return <PageSkeleton />;
}
