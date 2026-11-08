import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The dashed divider from a till receipt. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn("border-t border-dashed border-border", className)} />;
}

export function PageHeader({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function Ledger({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

/** Label, dotted leader, value: the way a receipt lines things up. */
export function LedgerRow({
  label,
  detail,
  value,
  strong,
  tone,
}: {
  label: ReactNode;
  detail?: ReactNode;
  value: ReactNode;
  strong?: boolean;
  tone?: "good" | "attention";
}) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-sm">
      <dt className={cn("min-w-0", strong && "font-semibold")}>
        <span>{label}</span>
        {detail && <span className="ml-1.5 text-xs text-muted-foreground">{detail}</span>}
      </dt>
      <span
        aria-hidden
        className="flex-1 min-w-4 translate-y-[-3px] border-b border-dotted border-muted-foreground/40"
      />
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "font-semibold" : "font-medium",
          tone === "good" && "text-good",
          tone === "attention" && "text-attention",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export { Segments } from "@/components/admin/segments";
export type { SegmentOption } from "@/components/admin/segments";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-center text-muted-foreground">{children}</p>;
}

/** Spend across rows, as thin bars under a label. Plain CSS, no chart library. */
export function ShareRow({
  label,
  detail,
  value,
  share,
}: {
  label: ReactNode;
  detail?: ReactNode;
  value: ReactNode;
  share: number;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">
          {label}
          {detail && <span className="ml-1.5 text-xs text-muted-foreground">{detail}</span>}
        </span>
        <span className="shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
        />
      </div>
    </div>
  );
}

export type Bar = { key: string; label: string; value: number; ghost?: number; title: string };

/** Vertical bars with an optional paler comparison behind each one. */
export function Bars({ bars, labelEvery = 1 }: { bars: Bar[]; labelEvery?: number }) {
  const max = Math.max(1, ...bars.map((bar) => Math.max(bar.value, bar.ghost ?? 0)));
  return (
    <div>
      <div className="flex items-end h-32 gap-px sm:gap-1" role="img" aria-label="Sales over time">
        {bars.map((bar) => (
          <div key={bar.key} title={bar.title} className="relative flex-1 h-full min-w-0">
            {bar.ghost !== undefined && (
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-ghost-bar"
                style={{ height: `${(bar.ghost / max) * 100}%` }}
              />
            )}
            <div
              className="absolute inset-x-[18%] bottom-0 rounded-t-[2px] bg-primary"
              style={{ height: `${(bar.value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-px mt-1 sm:gap-1">
        {bars.map((bar, index) => (
          <div
            key={bar.key}
            className="flex-1 min-w-0 overflow-visible text-[11px] text-center whitespace-nowrap text-muted-foreground"
          >
            {index % labelEvery === 0 ? bar.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
