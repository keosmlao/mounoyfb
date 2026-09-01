import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentsLabel,
  displayAttachments,
  normalizeAttachments,
  normalizeCommentAttachment,
  placeholderKind,
  readAttachments,
  visibleText,
} from "./fb-attachment";

/**
 * ຖ້າແປງຊະນິດຜິດ ຄົນຈະເຫັນ "[audioclip-....ogg]" ແທນທີ່ຈະໄດ້ຍິນສຽງ —
 * ຜິດແບບງຽບໆ ບໍ່ມີ error ໃຫ້ເຫັນ ຈຶ່ງຕ້ອງມີ test ຄຸມ.
 */

test("ຮູບ — ເອົາລິ້ງຈາກ image_data", () => {
  const [img] = normalizeAttachments([
    {
      id: "1",
      mime_type: "image/jpeg",
      name: "photo.jpg",
      image_data: { url: "https://fb/img.jpg", preview_url: "https://fb/prev.jpg" },
    },
  ]);
  assert.equal(img.kind, "image");
  assert.equal(img.url, "https://fb/img.jpg");
  assert.equal(img.previewUrl, "https://fb/prev.jpg");
});

test("ຂໍ້ຄວາມສຽງຂອງ Messenger — ມາເປັນ file_url ຮູ້ຊະນິດຈາກ mime", () => {
  const [audio] = normalizeAttachments([
    {
      id: "2",
      mime_type: "audio/mpeg",
      name: "audioclip-1787884555000-4827.ogg",
      file_url: "https://fb/clip.ogg",
    },
  ]);
  assert.equal(audio.kind, "audio");
  assert.equal(audio.url, "https://fb/clip.ogg");
});

test("ບໍ່ມີ mime ກໍ່ຍັງຮູ້ຈາກນາມສະກຸນ", () => {
  const [clip] = normalizeAttachments([
    { name: "audioclip-1787884515000-21967.ogg", file_url: "https://fb/c.ogg" },
  ]);
  assert.equal(clip.kind, "audio");

  const [movie] = normalizeAttachments([{ name: "VID_2026.mp4" }]);
  assert.equal(movie.kind, "video");

  // ບໍ່ຮູ້ຈັກ = ໄຟລ໌ທຳມະດາ ບໍ່ແມ່ນພັງ
  const [other] = normalizeAttachments([{ name: "ໃບບິນ.zip" }]);
  assert.equal(other.kind, "file");
});

test("mime ຜິດ ແຕ່ມີ image_data/video_data — ເຊື່ອຂໍ້ມູນ ບໍ່ແມ່ນເຊື່ອ mime", () => {
  const [img] = normalizeAttachments([
    { mime_type: "application/octet-stream", image_data: { url: "https://fb/a" } },
  ]);
  assert.equal(img.kind, "image");

  const [vid] = normalizeAttachments([
    { mime_type: "application/octet-stream", video_data: { url: "https://fb/v" } },
  ]);
  assert.equal(vid.kind, "video");
});

test("ອ່ານຄ່າຈາກຖານຂໍ້ມູນ — ຂອງເກົ່າ/ຜິດຮູບແບບ ຫ້າມພັງໜ້າຈໍ", () => {
  assert.deepEqual(readAttachments(null), []);
  assert.deepEqual(readAttachments("ບໍ່ແມ່ນ array"), []);
  assert.deepEqual(readAttachments([null, 7]), []);

  const list = readAttachments([{ kind: "ບໍ່ຮູ້ຈັກ", url: "https://fb/x" }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, "file");
  assert.equal(list[0].name, null);
});

test("ຂໍ້ຄວາມເກົ່າທີ່ຮູ້ແຕ່ຊື່ໄຟລ໌ — ຍັງສະແດງໄດ້", () => {
  const [old] = displayAttachments("audioclip-1787884555000-4827.ogg", null);
  assert.equal(old.kind, "audio");
  assert.equal(old.url, null); // ບໍ່ມີລິ້ງ — /api/fb/media ໄປຂໍໃໝ່ໃຫ້

  assert.deepEqual(displayAttachments(null, null), []);

  // ມີຂໍ້ມູນເຕັມແລ້ວ ໃຫ້ໃຊ້ອັນນັ້ນ ບໍ່ແມ່ນປ້າຍເກົ່າ
  const full = displayAttachments("photo.jpg", [
    { kind: "image", url: "https://fb/a" },
    { kind: "image", url: "https://fb/b" },
  ]);
  assert.equal(full.length, 2);
});

test("ປ້າຍສັ້ນ — ຫຼາຍໄຟລ໌ບອກຈຳນວນທີ່ເຫຼືອ", () => {
  assert.equal(attachmentsLabel([]), null);
  assert.equal(attachmentsLabel(displayAttachments("a.jpg", null)), "ຮູບ");
  assert.equal(
    attachmentsLabel(readAttachments([{ kind: "image" }, { kind: "file" }])),
    "ຮູບ +1",
  );
});

test("ໄຟລ໌ແນບຂອງ comment — ເອົາຮູບຈາກ media.image ແລະ ລິ້ງຈາກ target", () => {
  const photo = normalizeCommentAttachment({
    type: "photo",
    url: "https://facebook.com/photo/?fbid=1",
    media: { image: { src: "https://scontent/img.jpg" } },
    target: { url: "https://facebook.com/photo/1" },
  });
  assert.deepEqual(photo, {
    type: "photo",
    imageUrl: "https://scontent/img.jpg",
    link: "https://facebook.com/photo/1",
  });

  // ບໍ່ມີ target ໃຫ້ຖອຍໄປໃຊ້ url
  assert.equal(
    normalizeCommentAttachment({ type: "sticker", url: "https://facebook.com/s" })?.link,
    "https://facebook.com/s",
  );
  assert.equal(normalizeCommentAttachment(undefined), null);
  assert.equal(normalizeCommentAttachment({}), null);
});

/**
 * ຊື່ແທນຂອງໄຟລ໌ (`[image-139…]`) ມາຈາກເຄື່ອງມືພາຍນອກທີ່ສົ່ງຮູບແທນເພຈ.
 * ຖ້າປ່ອຍໃຫ້ຂຶ້ນຈໍ ຄົນຈະເຫັນຕົວເລກຍາວແທນຮູບ — ແລະ ຖ້າກັ່ນແຮງເກີນໄປ
 * ຂໍ້ຄວາມຈິງຂອງລູກຄ້າທີ່ຂຶ້ນຕົ້ນດ້ວຍ `[` ຈະຫາຍໄປ ຈຶ່ງຕ້ອງມີ test ຄຸມສອງທາງ.
 */
test("ຊື່ແທນຂອງໄຟລ໌ — ຮູ້ຊະນິດຈາກຄຳໜ້າ", () => {
  assert.equal(placeholderKind("[image-1394292075377186]"), "image");
  assert.equal(placeholderKind("[audioclip-2026-08-31.ogg]"), "audio");
  assert.equal(placeholderKind("[video-123]"), "video");
  assert.equal(placeholderKind("[sticker]"), "image");
  assert.equal(placeholderKind("[file-9]"), "file");
});

test("ຄຳຄົນພິມ — ບໍ່ໃຫ້ນັບເປັນຊື່ແທນ", () => {
  assert.equal(placeholderKind("ສົ່ງຮູບໃຫ້ແດ່"), null);
  assert.equal(placeholderKind("[ດ່ວນ] ສັ່ງ 2 ອັນ"), null);
  assert.equal(placeholderKind("ລາຄາ [image-1] ບໍ່"), null);
  assert.equal(placeholderKind(""), null);
  assert.equal(placeholderKind(null), null);
});

test("ມີໄຟລ໌ແນບແລ້ວ — ເຊື່ອງຊື່ແທນ ບໍ່ໃຫ້ຂຶ້ນຄູ່ກັບຮູບ", () => {
  const files = normalizeAttachments([
    { id: "1", mime_type: "image/jpeg", image_data: { url: "https://fb/i.jpg" } },
  ]);
  assert.equal(visibleText("[image-1394292075377186]", files), null);
});

test("ຍັງດຶງໄຟລ໌ບໍ່ໄດ້ — ບອກເປັນຄຳລາວ ບໍ່ແມ່ນໂຊ້ id ດິບ", () => {
  assert.equal(visibleText("[image-1394292075377186]", []), "ຮູບ");
  assert.equal(visibleText("[audioclip-x.ogg]", []), "ຂໍ້ຄວາມສຽງ");
});

test("ຂໍ້ຄວາມຈິງ — ສະແດງຄືເກົ່າ ເຖິງມີໄຟລ໌ແນບນຳ", () => {
  const files = normalizeAttachments([{ id: "1", mime_type: "image/png" }]);
  assert.equal(visibleText("ອັນນີ້ລາຄາເທົ່າໃດ", files), "ອັນນີ້ລາຄາເທົ່າໃດ");
  assert.equal(visibleText("  ", files), null);
  assert.equal(visibleText(null, []), null);
});
