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
    <div className="card-header flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5">
      <div className="min-w-0">
        <h2 className="text-[0.85rem] font-semibold leading-tight">{title}</h2>
        {subtitle ? (
          <p className="text-[0.72rem] leading-snug text-[var(--fg-muted)]">
            {subtitle}
          </p>
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
    <div className="page-header mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-base font-bold tracking-[-0.02em] sm:text-lg">{title}</h1>
        {description ? (
          <p className="max-w-4xl text-[0.78rem] leading-snug text-[var(--fg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-1.5">{action}</div>
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
    <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p className="max-w-md text-[0.8rem] text-[var(--fg-muted)]">{hint}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
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
        <p className="mt-0.5 text-[0.7rem] leading-snug text-[var(--fg-subtle)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** ຄ່າຕົວເລກໃນຕາຕະລາງ — ຈັດຂວາ ແລະ ໃຊ້ຕົວເລກຄວາມກວ້າງເທົ່າກັນ */
export function Num({ children }: { children: ReactNode }) {
  return <span className="tnum">{children}</span>;
}
