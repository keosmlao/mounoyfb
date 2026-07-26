import Link from "next/link";
import { Badge } from "@/components/ui";
import {
  SEVERITY_ICON,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  type Alert,
} from "@/lib/alerts";

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
          <span aria-hidden className="pt-0.5 text-base leading-none">
            {SEVERITY_ICON[alert.severity]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[alert.severity]}>
                {SEVERITY_LABEL[alert.severity]}
              </Badge>
              <span className="text-xs text-[var(--fg-subtle)]">
                {alert.category}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">{alert.title}</p>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{alert.detail}</p>
          </div>
          {alert.href ? (
            <Link href={alert.href} className="btn btn-sm shrink-0">
              ເປີດເບິ່ງ
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
