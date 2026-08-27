import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  /** ໃສ່ເມື່ອຢາກໃຫ້ລິ້ງກະໂດດມາຫາກາດນີ້ໄດ້ (ເຊັ່ນ /settings#alerts) */
  id?: string;
}) {
  return (
    <div id={id} className={`card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-header flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-[-0.03em] sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--fg-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p className="max-w-md text-sm text-[var(--fg-muted)]">{hint}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

/** ຄ່າຕົວເລກໃນຕາຕະລາງ — ຈັດຂວາ ແລະ ໃຊ້ຕົວເລກຄວາມກວ້າງເທົ່າກັນ */
export function Num({ children }: { children: ReactNode }) {
  return <span className="tnum">{children}</span>;
}
