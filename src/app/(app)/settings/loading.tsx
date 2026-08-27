import { PageSkeleton } from "@/components/PageSkeleton";

/** ໜ້າຕັ້ງຄ່າເປັນຟອມຫຼາຍກາດ ບໍ່ມີແຖບຕົວເລກລວມ */
export default function Loading() {
  return <PageSkeleton stats={0} rows={12} />;
}
