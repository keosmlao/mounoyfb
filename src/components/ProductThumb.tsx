/**
 * ຮູບຫຍໍ້ຂອງສິນຄ້າ — ຜ່ານ `/api/products/[id]/image` ສະເໝີ
 * (ຮູບຈາກເພຈໝົດອາຍຸ ຕ້ອງໃຫ້ເຊີບເວີຂໍລິ້ງໃໝ່). ບໍ່ມີຮູບ = ບໍ່ສະແດງຫຍັງ.
 */
export function ProductThumb({
  product,
  size = "h-10 w-10",
}: {
  product: { id: string; imageUrl: string | null; fbPhotoId?: string | null };
  size?: string;
}) {
  if (!product.imageUrl && !product.fbPhotoId) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/products/${product.id}/image`}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] object-cover`}
    />
  );
}
