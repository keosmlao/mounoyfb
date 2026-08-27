"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

/**
 * ປຸ່ມ ຢຸດ / ຍິງຕໍ່ ທີ່ສັ່ງໄປ Facebook.
 *
 * ໃຊ້ `useActionState` ເພື່ອ **ຮັບຂໍ້ຜິດພາດມາສະແດງຢູ່ຂ້າງປຸ່ມ** —
 * ຖ້າປ່ອຍໃຫ້ server action throw ອອກໄປ Next ຈະຂຶ້ນໜ້າ “This page couldn’t load”
 * ທັງໜ້າ ຊຶ່ງເຮັດໃຫ້ຄົນເບິ່ງບໍ່ອອກວ່າຜິດຫຍັງ ແລະ ຕາຕະລາງທັງໝົດຫາຍໄປນຳ.
 */
export function RunToggle({
  action,
  label,
}: {
  /** server action ທີ່ຄືນຂໍ້ຄວາມຜິດພາດ (null = ສຳເລັດ) */
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  label: string;
}) {
  const [error, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="inline-block text-right">
      <Button label={label} />
      {error ? (
        <p className="mt-1 max-w-56 text-xs leading-snug text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Button({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}
