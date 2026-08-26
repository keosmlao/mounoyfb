"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children = "ບັນທຶກ",
  className = "btn btn-primary",
  pendingText = "ກຳລັງບັນທຶກ...",
  disabled = false,
}: {
  children?: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}

/** ປຸ່ມລຶບ — ຖາມຢືນຢັນກ່ອນສະເໝີ */
export function DeleteButton({
  label = "ລຶບ",
  confirmText = "ຢືນຢັນການລຶບ? ຂໍ້ມູນທີ່ກ່ຽວຂ້ອງຈະຖືກລຶບນຳ.",
}: {
  label?: string;
  confirmText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? "..." : label}
    </button>
  );
}
