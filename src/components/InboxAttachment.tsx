import { type MessageAttachment, displayAttachments } from "@/lib/fb-attachment";

/**
 * ໄຟລ໌ແນບໃນກ່ອງຂໍ້ຄວາມ — ຮູບເຫັນເປັນຮູບ, ສຽງກົດຟັງໄດ້ ບໍ່ແມ່ນເຫັນແຕ່ຊື່ໄຟລ໌.
 *
 * ທຸກໄຟລ໌ຍິງຜ່ານ `/api/fb/media` ບໍ່ແມ່ນລິ້ງຂອງ Facebook ໂດຍກົງ —
 * ລິ້ງນັ້ນໝົດອາຍຸ ແລະ ບາງອັນຕ້ອງມີ page token (ເບິ່ງ route ນັ້ນ).
 *
 * ໃຊ້ `<img>` ທຳມະດາ ບໍ່ແມ່ນ `next/image` ຕັ້ງໃຈ — ຕົວປັບຮູບຂອງ Next
 * ດຶງຮູບເອງໂດຍບໍ່ມີ cookie ຂອງຜູ້ໃຊ້ ຈຶ່ງຈະຖືກດ່ານ login ປະຕິເສດ.
 */

function mediaUrl(base: string, index: number) {
  return `${base}&i=${index}`;
}

function One({ file, src }: { file: MessageAttachment; src: string }) {
  const name = file.name ?? "ໄຟລ໌ແນບ";

  if (file.kind === "image") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="max-h-64 max-w-full rounded-[var(--radius-sm)] object-contain"
        />
      </a>
    );
  }

  if (file.kind === "video") {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-64 max-w-full rounded-[var(--radius-sm)]"
      />
    );
  }

  if (file.kind === "audio") {
    // preload="none" — ຫ້ອງໜຶ່ງມີສຽງຫຼາຍອັນ ຢ່າໄປໂຫຼດໝົດຕອນເປີດໜ້າ
    return <audio src={src} controls preload="none" className="h-9 w-56 max-w-full" />;
  }

  return (
    <a href={src} target="_blank" rel="noreferrer" className="link text-sm">
      📎 {name}
    </a>
  );
}

export function InboxAttachments({
  /** ລິ້ງພື້ນຖານ ເຊັ່ນ `/api/fb/media?msg=<id>` */
  base,
  attachment,
  attachments,
}: {
  base: string;
  attachment: string | null;
  attachments: unknown;
}) {
  const files = displayAttachments(attachment, attachments);
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {files.map((file, index) => (
        <One key={index} file={file} src={mediaUrl(base, index)} />
      ))}
    </div>
  );
}

/** ຮູບຂອງ comment — comment ມີໄຟລ໌ແນບໄດ້ອັນດຽວ ຈຶ່ງບໍ່ຕ້ອງມີ index */
export function CommentImage({
  commentId,
  alt,
  link,
}: {
  commentId: string;
  alt: string | null;
  link: string | null;
}) {
  const src = `/api/fb/media?comment=${commentId}`;
  return (
    <a
      href={link ?? src}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 block w-fit"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? "ຮູບໃນ comment"}
        loading="lazy"
        className="max-h-56 max-w-full rounded-[var(--radius-sm)] object-contain"
      />
    </a>
  );
}
