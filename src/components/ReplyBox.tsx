"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * ກ່ອງຕອບ comment — ຕອບໄດ້ 2 ແບບຈາກຟອມດຽວ:
 *
 * - **ຕອບໃຕ້ comment** (ຄົນອື່ນເຫັນນຳ)
 * - **ຕອບເຂົ້າແຊັດ** (private reply — Facebook ເປີດຫ້ອງ Messenger ໃຫ້ເລີຍ)
 *
 * ປຸ່ມທັງສອງສົ່ງຟອມອັນດຽວກັນ ແຕ່ສົ່ງ `mode` ຄົນລະຄ່າ ຈຶ່ງບໍ່ຕ້ອງມີ 2 ຟອມ
 * ຊ້ອນກັນ (HTML ຫ້າມຟອມຊ້ອນຟອມ ແລະ ໜ້ານີ້ມີຟອມເລືອກຫຼາຍອັນຄຸມຢູ່ແລ້ວ).
 *
 * ຄຳຕອບສຳເລັດຮູບເປັນປຸ່ມທີ່ຕື່ມຂໍ້ຄວາມໃສ່ຊ່ອງ — ຍັງແກ້ໄດ້ກ່ອນສົ່ງ.
 */
export function ReplyBox({
  action,
  canned,
  canPrivateReply,
}: {
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  canned: string[];
  /** comment ຂອງເພຈເອງ ຕອບເຂົ້າແຊັດບໍ່ໄດ້ */
  canPrivateReply: boolean;
}) {
  const [error, formAction] = useActionState(action, null);
  const [text, setText] = useState("");

  return (
    <form
      action={(fd) => {
        formAction(fd);
        setText("");
      }}
      className="mt-3"
    >
      {canned.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {canned.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => setText((old) => (old ? `${old} ${reply}` : reply))}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              {reply.length > 34 ? `${reply.slice(0, 34)}…` : reply}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          name="message"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="field min-w-0 flex-1"
          placeholder="ພິມຄຳຕອບ..."
        />
        <Send mode="public" label="ຕອບໃຕ້ comment" primary />
        {canPrivateReply ? (
          <Send mode="private" label="ຕອບເຂົ້າແຊັດ" primary={false} />
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </form>
  );
}

function Send({
  mode,
  label,
  primary,
}: {
  mode: string;
  label: string;
  primary: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="mode"
      value={mode}
      disabled={pending}
      className={`btn${primary ? " btn-primary" : ""}`}
    >
      {pending ? "ກຳລັງສົ່ງ..." : label}
    </button>
  );
}
