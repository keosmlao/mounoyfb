import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import { LivePoller } from "@/components/LivePoller";
import { ProductThumb } from "@/components/ProductThumb";
import { LoadMore } from "@/components/LoadMore";
import { ActionMessageForm } from "@/components/ActionMessageForm";
import { COMMENT_PAGE_SIZE, CommentsPanel, commentTab } from "./CommentsPanel";
import {
  assignClaim,
  billLive,
  deleteLive,
  deleteLiveItem,
  linkLiveVideo,
  notifyLive,
  pullLiveNow,
  saveLiveItem,
  setClaimCancelled,
  setLiveStatus,
  startLive,
  updateLive,
} from "../actions";
import { loadLiveBoard, listPageLiveVideos, NOTIFY_PER_RUN } from "@/lib/live-server";
import { DEFAULT_SUMMARY_TEMPLATE, type ClaimState } from "@/lib/live-cf";
import { explainFbError } from "@/lib/fb";
import { formatDateLao, formatTimeLao, toDateInput } from "@/lib/date";
import { formatInt } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";
import {
  LIVE_STATUS_LABEL,
  LIVE_STATUS_TONE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const CLAIM_LABEL: Record<ClaimState, string> = {
  RESERVED: "ຈອງໄດ້",
  WAITLIST: "ລໍຄິວ",
  CANCELLED: "ຍົກເລີກ",
  UNMATCHED: "ອ່ານລະຫັດບໍ່ອອກ",
};
const CLAIM_TONE: Record<ClaimState, string> = {
  RESERVED: "success",
  WAITLIST: "warning",
  CANCELLED: "neutral",
  UNMATCHED: "danger",
};

export default async function LiveBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show?: string; c?: string; cshow?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { money } = await loadMoney();

  const [board, products] = await Promise.all([
    loadLiveBoard(id),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
  ]);
  if (!board) notFound();

  const { session, items, allocation, stateOf, bills, unbilledCustomers } = board;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const claims = session.claims;
  const limit = Math.min(Number(sp.show) || PAGE_SIZE, 5000);

  // ວິດີໂອຍັງບໍ່ໄດ້ຜູກ — ສະເໜີ live ຫຼ້າສຸດຂອງເພຈໃຫ້ເລືອກ
  let videos: Awaited<ReturnType<typeof listPageLiveVideos>> = [];
  let videoError: string | null = null;
  if (!session.fbVideoId || sp.show === "videos") {
    try {
      // ອັນທີ່ກຳລັງອອກອາກາດຢູ່ເທິງສຸດ — ສ່ວນຫຼາຍແມ່ນອັນທີ່ຕ້ອງການ
      videos = (await listPageLiveVideos(session.pageId)).toSorted(
        (a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE"),
      );
    } catch (error) {
      videoError = explainFbError(error);
    }
  }

  const unmatched = claims.filter((c) => stateOf(c.id) === "UNMATCHED");
  const reservedQty = [...allocation.items.values()].reduce((s, c) => s + c.reserved, 0);
  const waitingQty = [...allocation.items.values()].reduce((s, c) => s + c.waitlist, 0);
  const reservedValue = bills.reduce((s, b) => s + b.saleAmount, 0);

  const orders = session.orders;
  const unnotified = orders.filter((o) => !o.notifiedAt && o.status !== "CANCELLED");
  const notifyFailed = unnotified.filter((o) => o.notifyError);
  const orderByCustomer = new Map<string, (typeof orders)[number][]>();
  for (const order of orders) {
    const key = order.fbCustomerId ? `id:${order.fbCustomerId}` : `name:${order.customerName.trim().toLowerCase()}`;
    orderByCustomer.set(key, [...(orderByCustomer.get(key) ?? []), order]);
  }

  const isLive = session.status === "LIVE";

  return (
    <>
      <PageHeader
        title={session.title}
        description={`${session.page.name} · ບິນລົງວັນທີ່ ${formatDateLao(session.date)}`}
        action={
          <>
            <Badge tone={LIVE_STATUS_TONE[session.status]}>{LIVE_STATUS_LABEL[session.status]}</Badge>
            {session.permalink ? (
              <a href={session.permalink} target="_blank" rel="noreferrer" className="btn btn-sm">
                ເປີດ live ↗
              </a>
            ) : null}
            {session.status !== "LIVE" ? (
              <ActionMessageForm
                action={startLive.bind(null, session.id)}
                submitLabel={session.status === "ENDED" ? "● ເກັບ CF ຕໍ່" : "● ເລີ່ມເກັບ CF"}
                pendingText={session.fbVideoId ? "ກຳລັງເລີ່ມ..." : "ກຳລັງຫາ live ຂອງເພຈ..."}
              />
            ) : (
              <form action={setLiveStatus.bind(null, session.id, "ENDED")}>
                <SubmitButton className="btn" pendingText="ກຳລັງຢຸດ...">■ ຢຸດເກັບ CF</SubmitButton>
              </form>
            )}
            <Link href={`/live/${session.id}/report`} className="btn">ວິເຄາະ live</Link>
            <Link href="/live" className="btn">← ທຸກຮອບ</Link>
          </>
        }
      />

      {isLive ? (
        <Card className="mb-3 overflow-hidden">
          <LivePoller sessionId={session.id} />
        </Card>
      ) : null}

      {session.pollError ? (
        <Card className="mb-3 border-[var(--danger)] p-3 text-sm text-[var(--danger)]">
          ດຶງ comment ບໍ່ໄດ້: {session.pollError}
        </Card>
      ) : null}

      {!session.page.hasToken ? (
        <Card className="mb-3 p-3 text-sm text-[var(--warning)]">
          ເພຈນີ້ຍັງບໍ່ມີ page token — ດຶງ comment ແລະ ສົ່ງຂໍ້ຄວາມບໍ່ໄດ້.{" "}
          <Link href="/fb-pages" className="link">ໄປເຊື່ອມເພຈ</Link>
        </Card>
      ) : null}

      {!session.fbVideoId || sp.show === "videos" ? (
        <Card className="mb-3">
          <CardHeader
            title="ຜູກວິດີໂອ live"
            subtitle="ບໍ່ຕ້ອງເລືອກກໍ່ໄດ້ — ກົດ “ເລີ່ມເກັບ CF” ຕອນເພຈກຳລັງ live ລະບົບຈະຫາວິດີໂອໃຫ້ເອງ"
          />
          {videoError ? (
            <p className="p-4 text-sm text-[var(--danger)]">{videoError}</p>
          ) : videos.length === 0 ? (
            <EmptyState
              title="ບໍ່ພົບ live ຂອງເພຈນີ້"
              hint="ເລີ່ມ live ໃນ Facebook ກ່ອນ ແລ້ວໂຫຼດໜ້ານີ້ຄືນ — ຫຼື ວາງລິ້ງວິດີໂອໃນຟອມ “ຂໍ້ມູນຮອບ” ຂ້າງລຸ່ມ"
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {videos.map((video) => (
                <li key={video.videoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{video.title}</p>
                    <p className="text-xs text-[var(--fg-subtle)]">
                      {video.status === "LIVE" ? "🔴 ກຳລັງ live · " : `${video.status} · `}
                      {video.createdAt ? formatTimeLao(video.createdAt) : ""}
                    </p>
                  </div>
                  <form action={linkLiveVideo.bind(null, session.id, video.videoId, video.permalink)}>
                    <SubmitButton className="btn btn-sm" pendingText="...">
                      {session.fbVideoId === video.videoId ? "ຜູກຢູ່ແລ້ວ" : "ໃຊ້ວິດີໂອນີ້"}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <StatStrip cols={5}>
        <StatTile label="CF ທັງໝົດ" value={formatInt(claims.length)} hint={`ອ່ານ comment ${formatInt(session.commentsSeen)}`} />
        <StatTile label="ຈອງໄດ້" value={`${formatInt(reservedQty)} ຊິ້ນ`} />
        <StatTile label="ລໍຄິວ" value={`${formatInt(waitingQty)} ຊິ້ນ`} hint="ໄດ້ຂອງເມື່ອມີຄົນຍົກເລີກ" />
        <StatTile label="ລູກຄ້າ" value={formatInt(bills.length)} hint={`ຍັງບໍ່ອອກບິນ ${formatInt(unbilledCustomers)}`} />
        <StatTile label="ຍອດຈອງ" value={money(reservedValue)} />
      </StatStrip>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3">
          {/* ------------------------------------------------ ສິນຄ້າ */}
          <Card>
            <CardHeader
              title="ສິນຄ້າໃນ live"
              subtitle="ລະຫັດທີ່ລູກຄ້າພິມ · ຈຳນວນວ່າງ = ບໍ່ຈຳກັດ · ລາຄາເປັນກີບ"
            />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ລະຫັດ</th>
                    <th>ຊື່</th>
                    <th className="num">ລາຄາ</th>
                    <th className="num">ມີ</th>
                    <th className="num">ຈອງ / ຄິວ</th>
                    <th className="num">ເຫຼືອ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const count = allocation.items.get(item.id);
                    const formId = `item-${item.id}`;
                    return (
                      <tr key={item.id}>
                        <td>
                          <input form={formId} name="code" defaultValue={item.code} className="field !w-20 font-semibold" />
                        </td>
                        <td>
                          <input form={formId} name="name" defaultValue={item.name} className="field min-w-32" />
                          {item.product ? (
                            <div className="mt-1 flex items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
                              <ProductThumb product={{ id: item.productId!, ...item.product }} size="h-7 w-7" />
                              {item.product.name}
                            </div>
                          ) : null}
                        </td>
                        <td className="num">
                          <input form={formId} name="price" type="number" min={0} defaultValue={item.price} className="field !w-28 text-right" />
                        </td>
                        <td className="num">
                          <input form={formId} name="stock" type="number" min={0} defaultValue={item.stock ?? ""} placeholder="∞" className="field !w-20 text-right" />
                        </td>
                        <td className="num tnum">
                          {formatInt(count?.reserved)}
                          {count?.waitlist ? <span className="text-[var(--warning)]"> / {formatInt(count.waitlist)}</span> : null}
                        </td>
                        <td className={`num tnum ${count?.left === 0 ? "text-[var(--danger)] font-semibold" : ""}`}>
                          {count?.left === null ? "∞" : count?.left === 0 ? "ໝົດ" : formatInt(count?.left)}
                        </td>
                        <td className="num whitespace-nowrap">
                          <form id={formId} action={saveLiveItem.bind(null, session.id)} className="inline">
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="productId" value={item.productId ?? ""} />
                            <input type="hidden" name="cost" value={item.cost} />
                            <SubmitButton className="btn btn-sm" pendingText="...">ບັນທຶກ</SubmitButton>
                          </form>{" "}
                          <form action={deleteLiveItem.bind(null, item.id)} className="inline">
                            <DeleteButton label="ລຶບ" confirmText={`ລຶບ ${item.code}? CF ຂອງລະຫັດນີ້ຈະກາຍເປັນ “ອ່ານລະຫັດບໍ່ອອກ”`} />
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form action={saveLiveItem.bind(null, session.id)} className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] p-3">
              <Field label="ລະຫັດ">
                <input name="code" required className="field !w-20" placeholder="A1" />
              </Field>
              <Field label="ສິນຄ້າໃນລະບົບ">
                <select name="productId" className="field max-w-48">
                  <option value="">— ບໍ່ຜູກ —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ຊື່ (ວ່າງ = ຕາມສິນຄ້າ)">
                <input name="name" className="field min-w-32" />
              </Field>
              <Field label="ລາຄາ ₭">
                <input name="price" type="number" min={0} className="field !w-28" placeholder="ຕາມສິນຄ້າ" />
              </Field>
              <Field label="ຈຳນວນມີ">
                <input name="stock" type="number" min={0} className="field !w-20" placeholder="∞" />
              </Field>
              <SubmitButton className="btn btn-primary" pendingText="...">+ ເພີ່ມ</SubmitButton>
            </form>
          </Card>

          {/* ------------------------------------------ CF ທີ່ອ່ານບໍ່ອອກ */}
          {unmatched.length > 0 ? (
            <Card>
              <CardHeader
                title={`CF ທີ່ອ່ານລະຫັດບໍ່ອອກ (${formatInt(unmatched.length)})`}
                subtitle="ລູກຄ້າພິມລະຫັດຜິດ ຫຼື ລະຫັດທີ່ຍັງບໍ່ໄດ້ເພີ່ມ — ເລືອກສິນຄ້າໃຫ້ ຫຼື ຍົກເລີກ"
              />
              <ul className="divide-y divide-[var(--border)]">
                {unmatched.slice(0, 50).map((claim) => (
                  <li key={claim.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{claim.fromName ?? "ບໍ່ຮູ້ຊື່"}</span>{" "}
                      <span className="text-xs text-[var(--fg-subtle)]">{formatTimeLao(claim.commentedAt)}</span>
                      <p className="truncate text-xs text-[var(--fg-muted)]">{claim.message}</p>
                    </div>
                    <form action={assignClaim.bind(null, claim.id)} className="flex items-center gap-1">
                      <select name="itemId" required className="field !py-1">
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>{item.code} {item.name}</option>
                        ))}
                      </select>
                      <input name="quantity" type="number" min={1} defaultValue={1} className="field !w-16 !py-1" />
                      <SubmitButton className="btn btn-sm" pendingText="..." disabled={items.length === 0}>ໃຊ້</SubmitButton>
                    </form>
                    <form action={setClaimCancelled.bind(null, claim.id, true)}>
                      <SubmitButton className="btn btn-sm" pendingText="...">ຍົກເລີກ</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <CommentsPanel
            session={session}
            tab={commentTab(sp.c)}
            show={Math.min(Number(sp.cshow) || COMMENT_PAGE_SIZE, 2000)}
          />

          {/* ---------------------------------------------- ລາຍການ CF */}
          <Card>
            <CardHeader
              title="ລາຍການ CF"
              subtitle="ໃໝ່ສຸດຢູ່ເທິງ · ລຳດັບຄິວນັບຕາມເວລາ comment"
              action={
                <form action={pullLiveNow.bind(null, session.id)}>
                  <SubmitButton className="btn btn-sm" pendingText="ກຳລັງດຶງ..." disabled={!session.fbVideoId}>
                    ↻ ດຶງດຽວນີ້
                  </SubmitButton>
                </form>
              }
            />
            {claims.length === 0 ? (
              <EmptyState
                title="ຍັງບໍ່ມີ CF"
                hint={isLive ? "ລໍລູກຄ້າ comment — ໜ້ານີ້ອັບເດດເອງ" : "ຕັ້ງສິນຄ້າ ຜູກວິດີໂອ ແລ້ວກົດ “ເລີ່ມເກັບ CF”"}
              />
            ) : (
              <>
                <div className="table-wrap max-h-[40rem] overflow-y-auto">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ເວລາ</th>
                        <th>ລູກຄ້າ</th>
                        <th>comment</th>
                        <th>ລາຍການ</th>
                        <th>ສະຖານະ</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {claims.slice(0, limit).map((claim) => {
                        const state = stateOf(claim.id);
                        const item = claim.itemId ? itemById.get(claim.itemId) : undefined;
                        const position = allocation.queue.get(claim.id);
                        return (
                          <tr key={claim.id} className={state === "CANCELLED" ? "opacity-60" : ""}>
                            <td className="tnum whitespace-nowrap text-xs">{formatTimeLao(claim.commentedAt)}</td>
                            <td className="text-sm font-medium">{claim.fromName ?? "ບໍ່ຮູ້ຊື່"}</td>
                            <td className="max-w-56 truncate text-xs text-[var(--fg-muted)]" title={claim.message ?? ""}>
                              {claim.message}
                            </td>
                            <td className="whitespace-nowrap text-sm">
                              {item ? `${item.code} × ${claim.quantity}` : "—"}
                            </td>
                            <td className="whitespace-nowrap">
                              <Badge tone={CLAIM_TONE[state]}>
                                {CLAIM_LABEL[state]}
                                {position ? ` #${position}` : ""}
                              </Badge>
                              {claim.orderId ? <Badge tone="info">ອອກບິນແລ້ວ</Badge> : null}
                              {state === "CANCELLED" && claim.cancelReason ? (
                                <div className="text-2xs text-[var(--fg-subtle)]">{claim.cancelReason}</div>
                              ) : null}
                            </td>
                            <td className="num">
                              {claim.orderId || state === "UNMATCHED" ? null : (
                                <form action={setClaimCancelled.bind(null, claim.id, !claim.cancelled)}>
                                  <SubmitButton className="btn btn-sm" pendingText="...">
                                    {claim.cancelled ? "ຄືນ" : "ຍົກເລີກ"}
                                  </SubmitButton>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <LoadMore
                  shown={Math.min(limit, claims.length)}
                  total={claims.length}
                  step={PAGE_SIZE}
                  href={(show) => `/live/${session.id}?show=${show}`}
                />
              </>
            )}
          </Card>
        </div>

        <div className="grid gap-3 xl:sticky xl:top-8">
          {/* ---------------------------------------------- ລູກຄ້າ */}
          <Card>
            <CardHeader title="ຍອດຕໍ່ລູກຄ້າ" subtitle="ລວມສະເພາະທີ່ຈອງໄດ້ — ຄິວລໍບໍ່ນັບເງິນ" />
            {bills.length === 0 ? (
              <EmptyState title="ຍັງບໍ່ມີຍອດ" />
            ) : (
              <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
                {bills
                  .toSorted((a, b) => b.saleAmount - a.saleAmount)
                  .map((bill) => {
                    const billed = orderByCustomer.get(bill.key) ?? [];
                    return (
                      <li key={bill.key} className="px-4 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{bill.fromName}</span>
                          <span className="tnum text-sm font-semibold">{money(bill.saleAmount)}</span>
                        </div>
                        <p className="text-xs text-[var(--fg-muted)]">
                          {bill.lines.map((l) => `${l.code}×${l.quantity}`).join(" · ")}
                          {bill.waiting ? <span className="text-[var(--warning)]"> · ລໍຄິວ {formatInt(bill.waiting)}</span> : null}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {bill.unbilled ? <Badge tone="warning">ຍັງບໍ່ອອກບິນ</Badge> : null}
                          {billed.map((order) => (
                            <Link key={order.id} href={`/orders/${order.id}`} className="inline-flex gap-1">
                              <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                              {order.notifiedAt ? (
                                <Badge tone="success">ແຈ້ງແລ້ວ</Badge>
                              ) : order.notifyError ? (
                                <Badge tone="danger">ແຈ້ງບໍ່ໄດ້</Badge>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                        {billed.map((order) =>
                          !order.notifiedAt && order.notifyError ? (
                            <p key={order.id} className="mt-0.5 text-2xs text-[var(--danger)]">{order.notifyError}</p>
                          ) : null,
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>

          {/* ------------------------------------------ ອອກບິນ / ແຈ້ງ */}
          <Card>
            <CardHeader title="ປິດການຂາຍ" subtitle="ຢຸດເກັບ CF → ອອກບິນ → ສົ່ງສະຫຼຸບຍອດ" />
            <div className="grid gap-4 p-4">
              <div>
                <p className="mb-2 text-sm">
                  1. ອອກບິນໃຫ້ <b>{formatInt(unbilledCustomers)}</b> ຄົນທີ່ຍັງບໍ່ມີບິນ
                </p>
                {isLive ? (
                  <p className="text-xs text-[var(--fg-muted)]">ຢຸດເກັບ CF ກ່ອນ — ລະຫວ່າງ live ຄິວຍັງປ່ຽນຢູ່</p>
                ) : (
                  <ActionMessageForm
                    action={billLive.bind(null, session.id)}
                    submitLabel="ອອກບິນ"
                    pendingText="ກຳລັງອອກບິນ..."
                    confirmText={`ອອກບິນໃຫ້ ${unbilledCustomers} ຄົນ? ລາຍການທີ່ອອກບິນແລ້ວຈະແກ້ຈາກໜ້ານີ້ບໍ່ໄດ້`}
                  />
                )}
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-1 text-sm">
                  2. ສົ່ງສະຫຼຸບຍອດເຂົ້າ Messenger — ຍັງບໍ່ໄດ້ສົ່ງ <b>{formatInt(unnotified.length)}</b> ບິນ
                  {notifyFailed.length ? (
                    <span className="text-[var(--danger)]"> (ລົ້ມ {formatInt(notifyFailed.length)})</span>
                  ) : null}
                </p>
                <p className="mb-2 text-2xs text-[var(--fg-subtle)]">
                  ຕອບ comment CF ຂອງລູກຄ້າເປັນຂໍ້ຄວາມສ່ວນຕົວ · Facebook ໃຫ້ພາຍໃນ 7 ວັນ ແລະ 1 ເທື່ອຕໍ່ comment ·
                  ສົ່ງເທື່ອລະ {NOTIFY_PER_RUN} ຄົນ · {"{name} {items} {total} {count}"}
                </p>
                <ActionMessageForm
                  action={notifyLive.bind(null, session.id)}
                  submitLabel="ສົ່ງສະຫຼຸບຍອດ"
                  pendingText="ກຳລັງສົ່ງ..."
                  confirmText="ສົ່ງຂໍ້ຄວາມຫາລູກຄ້າແທ້? ສົ່ງແລ້ວຖອນຄືນບໍ່ໄດ້"
                  className="grid gap-2"
                >
                  <textarea
                    name="template"
                    rows={6}
                    defaultValue={DEFAULT_SUMMARY_TEMPLATE}
                    className="field w-full text-xs"
                  />
                </ActionMessageForm>
              </div>
            </div>
          </Card>

          {/* ------------------------------------------ ຂໍ້ມູນຮອບ */}
          <Card>
            <CardHeader title="ຂໍ້ມູນຮອບ" />
            <form action={updateLive.bind(null, session.id)} className="grid gap-3 p-4">
              <Field label="ຊື່ຮອບ">
                <input name="title" required defaultValue={session.title} className="field w-full" />
              </Field>
              <Field label="ວັນທີ່ຂອງບິນ">
                <input name="date" type="date" required defaultValue={toDateInput(session.date)} className="field w-full" />
              </Field>
              <Field
                label="ປ່ຽນວິດີໂອ (ລິ້ງ ຫຼື id)"
                hint={session.fbVideoId ? `ຜູກຢູ່: ${session.fbVideoId}` : "ຍັງບໍ່ໄດ້ຜູກ"}
              >
                <input name="video" className="field w-full" placeholder="ວ່າງ = ບໍ່ປ່ຽນ" />
              </Field>
              <Field label="ບັນທຶກ">
                <input name="note" defaultValue={session.note ?? ""} className="field w-full" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton className="btn">ບັນທຶກ</SubmitButton>
                <Link href={`/live/${session.id}?show=videos`} className="btn">ເລືອກຈາກລາຍການ live</Link>
              </div>
            </form>
            <form action={deleteLive.bind(null, session.id)} className="border-t border-[var(--border)] p-4">
              <DeleteButton
                label="ລຶບຮອບ live ນີ້"
                confirmText="ລຶບຮອບ live ແລະ CF ທັງໝົດ? ບິນທີ່ອອກແລ້ວຍັງຢູ່ໃນ Orders"
              />
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
