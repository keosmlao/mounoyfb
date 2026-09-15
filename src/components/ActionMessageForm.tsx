"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "./SubmitButton";

/**
 * ຟອມທີ່ action ຄືນຂໍ້ຄວາມຜົນ (ສຳເລັດ/ລົ້ມ) ແທນການ throw —
 * ໃຊ້ກັບວຽກທີ່ຄົນຕ້ອງຮູ້ຜົນ ເຊັ່ນ ອອກບິນ ຫຼື ສົ່ງຂໍ້ຄວາມຫາລູກຄ້າ.
 */
export function ActionMessageForm({
  action,
  children,
  submitLabel,
  pendingText,
  confirmText,
  className = "",
  buttonClassName = "btn btn-primary",
}: {
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  children?: ReactNode;
  submitLabel: string;
  pendingText: string;
  confirmText?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [message, formAction] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton className={buttonClassName} pendingText={pendingText}>
          {submitLabel}
        </SubmitButton>
        {message ? (
          <p className="text-xs text-[var(--fg-muted)]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
