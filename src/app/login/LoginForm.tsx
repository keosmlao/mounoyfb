"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, formAction] = useActionState(login, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="ລະຫັດຜ່ານ">
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="field"
          placeholder="••••••••"
        />
      </Field>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      <SubmitButton className="btn btn-primary w-full" pendingText="ກຳລັງກວດ...">
        ເຂົ້າສູ່ລະບົບ
      </SubmitButton>
    </form>
  );
}
