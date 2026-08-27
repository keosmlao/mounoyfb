import { PageSkeleton } from "@/components/PageSkeleton";

/** ລາຍງານເປັນຕາຕະລາງຍາວ ບໍ່ມີແຖບຕົວເລກລວມແຍກ */
export default function Loading() {
  return <PageSkeleton stats={0} rows={12} />;
}
