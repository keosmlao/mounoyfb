import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { ActionMessageForm } from "@/components/ActionMessageForm";
import { ProductThumb } from "@/components/ProductThumb";
import { createProductFromPhoto } from "../actions";
import { listPagePhotos, type PagePhoto } from "@/lib/fb-photos";
import { draftFromCaption } from "@/lib/product-caption";
import { explainFbError } from "@/lib/fb";
import { formatTimeLao } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * ເລືອກຮູບໃນເພຈມາເປັນສິນຄ້າ — ຊື່ ແລະ ລາຄາຮ່າງຈາກຄຳບັນຍາຍໂພສ
 * ຄົນກວດແກ້ກ່ອນກົດສ້າງສະເໝີ (ອ່ານຜິດ = ລາຄາຜິດໃນບິນ).
 */
export default async function ProductsFromPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; after?: string }>;
}) {
  const sp = await searchParams;
  const pages = await prisma.fbPage.findMany({
    where: { token: { not: null }, fbPageId: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const pageId = pages.find((p) => p.id === sp.page)?.id ?? pages[0]?.id ?? null;

  let photos: PagePhoto[] = [];
  let next: string | null = null;
  let error: string | null = null;
  if (pageId) {
    try {
      ({ photos, next } = await listPagePhotos(pageId, sp.after ?? null));
    } catch (e) {
      error = explainFbError(e);
    }
  }

  const imported = new Map(
    (
      await prisma.product.findMany({
        where: { fbPhotoId: { in: photos.map((p) => p.id) } },
        select: { id: true, name: true, fbPhotoId: true, imageUrl: true },
      })
    ).map((p) => [p.fbPhotoId!, p]),
  );

  return (
    <>
      <PageHeader
        title="ສ້າງສິນຄ້າຈາກຮູບໃນເພຈ"
        description="ເລືອກຮູບທີ່ເພຈໂພສໄວ້ — ລະບົບຮ່າງຊື່ ແລະ ລາຄາຈາກຄຳບັນຍາຍໃຫ້ ກວດແລ້ວກົດສ້າງ"
        action={<Link href="/products" className="btn">← ສິນຄ້າ</Link>}
      />

      {pages.length === 0 ? (
        <Card>
          <EmptyState
            title="ຍັງບໍ່ມີເພຈທີ່ເຊື່ອມ page token"
            action={<Link href="/fb-pages" className="btn btn-sm">ໄປເຊື່ອມເພຈ</Link>}
          />
        </Card>
      ) : (
        <>
          <Card className="mb-3">
            <form method="get" className="flex flex-wrap items-end gap-2 p-3">
              <Field label="ເພຈ">
                <select name="page" defaultValue={pageId ?? ""} className="field">
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="btn">ເບິ່ງຮູບ</button>
            </form>
          </Card>

          {error ? (
            <Card className="p-4 text-sm text-[var(--danger)]">{error}</Card>
          ) : photos.length === 0 ? (
            <Card>
              <EmptyState title="ບໍ່ພົບຮູບທີ່ເພຈນີ້ອັບໂຫຼດ" />
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {photos.map((photo) => {
                  const done = imported.get(photo.id);
                  const draft = draftFromCaption(photo.caption);
                  return (
                    <Card key={photo.id} className="overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/fb/photo?page=${pageId}&photo=${photo.id}`}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full bg-[var(--surface-2)] object-cover"
                      />
                      <div className="grid gap-2 p-3">
                        {photo.caption ? (
                          <details className="text-xs text-[var(--fg-muted)]">
                            <summary className="cursor-pointer truncate">{photo.caption.split("\n")[0]}</summary>
                            <p className="mt-1 whitespace-pre-wrap">{photo.caption}</p>
                          </details>
                        ) : (
                          <p className="text-xs text-[var(--fg-subtle)]">ບໍ່ມີຄຳບັນຍາຍ</p>
                        )}
                        {photo.createdAt ? (
                          <p className="text-2xs text-[var(--fg-subtle)]">ໂພສ {formatTimeLao(photo.createdAt)}</p>
                        ) : null}

                        {done ? (
                          <div className="flex items-center gap-2 rounded-md bg-[var(--success-soft)] p-2 text-sm">
                            <ProductThumb product={done} size="h-8 w-8" />
                            <span className="min-w-0 flex-1 truncate">ເປັນສິນຄ້າແລ້ວ: {done.name}</span>
                            <Link href={`/products/${done.id}`} className="btn btn-sm">ເປີດ</Link>
                          </div>
                        ) : (
                          <ActionMessageForm
                            action={createProductFromPhoto.bind(null, pageId!, photo.id)}
                            submitLabel="ສ້າງສິນຄ້າ"
                            pendingText="ກຳລັງສ້າງ..."
                            buttonClassName="btn btn-primary btn-sm"
                            className="grid gap-2"
                          >
                            <Field label="ຊື່ສິນຄ້າ *">
                              <input name="name" required defaultValue={draft.name} className="field w-full" />
                            </Field>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="ລາຄາ (ກີບ)" hint={draft.price ? "ອ່ານຈາກຄຳບັນຍາຍ — ກວດອີກເທື່ອ" : undefined}>
                                <input name="price" type="number" min={0} step={1} defaultValue={draft.price ?? ""} className="field w-full" />
                              </Field>
                              <Field label="ຕົ້ນທຶນ (ກີບ)">
                                <input name="cost" type="number" min={0} step={1} className="field w-full" />
                              </Field>
                            </div>
                            <Field label="SKU">
                              <input name="sku" className="field w-full" />
                            </Field>
                          </ActionMessageForm>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {sp.after ? (
                  <Link href={`/products/from-page?page=${pageId}`} className="btn">↺ ຮູບໃໝ່ສຸດ</Link>
                ) : null}
                {next ? (
                  <Link href={`/products/from-page?page=${pageId}&after=${encodeURIComponent(next)}`} className="btn">
                    ຮູບເກົ່າກວ່ານີ້ →
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
