/**
 * ໄຟລ໌ແນບຂອງກ່ອງຂໍ້ຄວາມ — ຮູບ, ວິດີໂອ, ສຽງ ແລະ ໄຟລ໌ອື່ນ.
 *
 * **ຫ້າມ import prisma** (ມີ test ຄຸມ ແລະ ໜ້າຈໍ client ໃຊ້ນຳ).
 *
 * ລິ້ງທີ່ Facebook ໃຫ້ (`lookaside.fbsbx.com`) **ໝົດອາຍຸ** ແລະ ບາງອັນຕ້ອງມີ
 * page token ຈຶ່ງໂຫຼດໄດ້ — ໜ້າຈໍຈຶ່ງ**ຫ້າມຍິງກົງ**ໃສ່ລິ້ງນັ້ນ ໃຫ້ຜ່ານ
 * `/api/fb/media` ຊຶ່ງດຶງໃຫ້ຢູ່ຝັ່ງເຊີບເວີ ແລະ ຂໍລິ້ງໃໝ່ໃຫ້ເມື່ອອັນເກົ່າຕາຍ.
 */

/** ຊະນິດທີ່ໜ້າຈໍຕ້ອງຮູ້ເພື່ອເລືອກວິທີສະແດງ */
export type AttachmentKind = "image" | "video" | "audio" | "file";

export type MessageAttachment = {
  kind: AttachmentKind;
  /** ຊື່ໄຟລ໌ຕາມທີ່ Facebook ບອກ (ອາດບໍ່ມີ) */
  name: string | null;
  mime: string | null;
  /** ລິ້ງຕົ້ນທາງ — ໝົດອາຍຸໄດ້ ຈຶ່ງໃຊ້ໄດ້ແຕ່ຢູ່ຝັ່ງເຊີບເວີ */
  url: string | null;
  /** ຮູບຕົວຢ່າງ (ວິດີໂອ) */
  previewUrl: string | null;
};

/** ຮູບແບບດິບຈາກ `attachments{...}` ຂອງ Graph API */
export type RawMessageAttachment = {
  id?: string;
  mime_type?: string;
  name?: string;
  file_url?: string;
  image_data?: { url?: string; preview_url?: string };
  video_data?: { url?: string; preview_url?: string };
};

const EXTENSION_KIND: Record<string, AttachmentKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  ogg: "audio",
  oga: "audio",
  mp3: "audio",
  m4a: "audio",
  aac: "audio",
  wav: "audio",
};

/** ເດົາຊະນິດຈາກນາມສະກຸນ — ຂໍ້ຄວາມສຽງຂອງ Messenger ມັກມາແຕ່ຊື່ໄຟລ໌ .ogg */
function kindFromName(name: string | null | undefined): AttachmentKind | null {
  const ext = (name ?? "").toLowerCase().split("?")[0].split(".").pop();
  return ext ? (EXTENSION_KIND[ext] ?? null) : null;
}

/**
 * ຊະນິດຂອງໄຟລ໌ແນບ 1 ອັນ.
 *
 * ເຊື່ອ `image_data`/`video_data` ກ່ອນ mime ເພາະ Facebook ສົ່ງ mime ຜິດເລື້ອຍ
 * (ຮູບບາງອັນມາເປັນ `application/octet-stream`).
 */
export function attachmentKind(raw: RawMessageAttachment): AttachmentKind {
  if (raw.video_data) return "video";
  if (raw.image_data) return "image";

  const mime = (raw.mime_type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  return kindFromName(raw.name) ?? "file";
}

/** ແປງ `attachments{...}` ດິບ → ຮູບແບບທີ່ເກັບໃສ່ຖານຂໍ້ມູນ */
export function normalizeAttachments(
  data: RawMessageAttachment[] | undefined,
): MessageAttachment[] {
  return (data ?? []).map((raw) => ({
    kind: attachmentKind(raw),
    name: raw.name ?? null,
    mime: raw.mime_type ?? null,
    url: raw.image_data?.url ?? raw.video_data?.url ?? raw.file_url ?? null,
    previewUrl: raw.image_data?.preview_url ?? raw.video_data?.preview_url ?? null,
  }));
}

const KINDS: AttachmentKind[] = ["image", "video", "audio", "file"];

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** ອ່ານຄ່າ Json ຈາກຖານຂໍ້ມູນຄືນ — ຂໍ້ມູນເກົ່າ/ຜິດຮູບແບບຕ້ອງບໍ່ພັງໜ້າຈໍ */
export function readAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const kind = KINDS.find((k) => k === row.kind) ?? "file";
    return [
      {
        kind,
        name: str(row.name),
        mime: str(row.mime),
        url: str(row.url),
        previewUrl: str(row.previewUrl),
      },
    ];
  });
}

/**
 * ລາຍການທີ່ໜ້າຈໍຈະສະແດງ.
 *
 * ຂໍ້ຄວາມທີ່ດຶງມາກ່ອນມີຊ່ອງ `attachments` ຮູ້ແຕ່ຊື່ໄຟລ໌ — ຍັງສະແດງໄດ້
 * ເພາະ `/api/fb/media` ໄປຂໍລິ້ງໃໝ່ຈາກ Facebook ໃຫ້ຕອນເປີດເບິ່ງ.
 */
export function displayAttachments(
  attachment: string | null,
  attachments: unknown,
): MessageAttachment[] {
  const list = readAttachments(attachments);
  if (list.length > 0) return list;
  if (!attachment) return [];

  return [
    {
      kind: kindFromName(attachment) ?? "file",
      name: attachment,
      mime: null,
      url: null,
      previewUrl: null,
    },
  ];
}

const KIND_LABEL: Record<AttachmentKind, string> = {
  image: "ຮູບ",
  video: "ວິດີໂອ",
  audio: "ຂໍ້ຄວາມສຽງ",
  file: "ໄຟລ໌ແນບ",
};

export function attachmentLabel(item: MessageAttachment): string {
  return KIND_LABEL[item.kind];
}

/** ປ້າຍສັ້ນຂອງທັງຂໍ້ຄວາມ — ໃຊ້ໃນຊ່ອງ `attachment` ແລະ ໃນລາຍການ */
export function attachmentsLabel(list: MessageAttachment[]): string | null {
  if (list.length === 0) return null;
  const first = attachmentLabel(list[0]);
  return list.length > 1 ? `${first} +${list.length - 1}` : first;
}

/**
 * ຂໍ້ຄວາມທີ່ບໍ່ແມ່ນຄຳຄົນພິມ ແຕ່ເປັນ**ຊື່ແທນຂອງໄຟລ໌** ທີ່ຖືກໃສ່ມາແທນຮູບ
 * ເຊັ່ນ `[image-1394292075377186]`, `[audioclip-....ogg]`, `[sticker]`.
 *
 * ຮູບແບບນີ້ Facebook ສົ່ງມາໃນຊ່ອງ `message` ເມື່ອຮູບຖືກສົ່ງຜ່ານເຄື່ອງມືພາຍນອກ
 * (Pancake / Botcake / Send API ແບບ `attachment_id`) — ຮູບຈິງຢູ່ໃນ `attachments`
 * ຂອງຂໍ້ຄວາມນັ້ນ ບໍ່ແມ່ນຢູ່ໃນຕົວເລກທີ່ເຫັນ. ຄືນຊະນິດເພື່ອໃຫ້ໜ້າຈໍເອີ້ນຊື່ຖືກ.
 */
const PLACEHOLDER = /^\[\s*(image|photo|img|gif|sticker|video|videoclip|audio|audioclip|voice|file|attachment)\b[^\]]*\]$/i;

const PLACEHOLDER_KIND: Record<string, AttachmentKind> = {
  image: "image",
  photo: "image",
  img: "image",
  gif: "image",
  sticker: "image",
  video: "video",
  videoclip: "video",
  audio: "audio",
  audioclip: "audio",
  voice: "audio",
  file: "file",
  attachment: "file",
};

export function placeholderKind(
  text: string | null | undefined,
): AttachmentKind | null {
  const match = PLACEHOLDER.exec((text ?? "").trim());
  return match ? (PLACEHOLDER_KIND[match[1].toLowerCase()] ?? "file") : null;
}

/**
 * ຕົວໜັງສືທີ່ຄວນສະແດງໃນຟອງແຊັດ — `null` ຄື **ບໍ່ຕ້ອງສະແດງ**.
 *
 * ຊື່ແທນເຊັ່ນ `[image-139…]` ບໍ່ມີຄວາມໝາຍຫຍັງກັບຄົນອ່ານ:
 * ມີໄຟລ໌ແນບແລ້ວ = ເຊື່ອງໄປເລີຍ (ຮູບເວົ້າແທນ) · ຍັງດຶງໄຟລ໌ບໍ່ໄດ້ = ບອກເປັນ
 * ຄຳລາວ ("ຮູບ" / "ຂໍ້ຄວາມສຽງ") ແທນທີ່ຈະໂຊ້ id ດິບ.
 */
export function visibleText(
  text: string | null | undefined,
  files: MessageAttachment[],
): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;

  const kind = placeholderKind(trimmed);
  if (!kind) return trimmed;
  return files.length > 0 ? null : KIND_LABEL[kind];
}

// --------------------------------------------------------------- ຝັ່ງ comment

/** ຮູບແບບດິບຈາກ `attachment{type,url,media{image{src}},target{url}}` */
export type RawCommentAttachment = {
  type?: string;
  url?: string;
  title?: string;
  media?: { image?: { src?: string } };
  target?: { url?: string };
};

export type CommentAttachment = {
  /** ຊະນິດຕາມ Facebook (photo / video_inline / sticker ...) */
  type: string | null;
  /** ຮູບທີ່ຈະສະແດງ (ວິດີໂອ = ຮູບປົກ) */
  imageUrl: string | null;
  /** ລິ້ງເປີດເບິ່ງທີ່ Facebook */
  link: string | null;
};

export function normalizeCommentAttachment(
  raw: RawCommentAttachment | undefined,
): CommentAttachment | null {
  if (!raw) return null;
  const imageUrl = raw.media?.image?.src ?? null;
  const link = raw.target?.url ?? raw.url ?? null;
  if (!raw.type && !imageUrl && !link) return null;
  return { type: raw.type ?? null, imageUrl, link };
}
