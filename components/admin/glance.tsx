import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tonight's running total against a comparison day. The gap between the two
 * lines answers "are we ahead?" before anything has to be read.
 */
export function PaceChart({
  today,
  compare,
  labels,
  todayLabel,
  compareLabel,
  maxLabel,
}: {
  /** Running totals up to now, so this may be shorter than `compare`. */
  today: number[];
  compare: number[];
  labels: string[];
  todayLabel: string;
  compareLabel: string;
  maxLabel: string;
}) {
  const WIDTH = 320;
  const HEIGHT = 110;
  const count = Math.max(2, compare.length);
  const max = Math.max(1, ...today, ...compare);
  const x = (index: number) => (index / (count - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - 2 - (value / max) * (HEIGHT - 6);
  const line = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");

  const lastIndex = today.length - 1;
  const area =
    today.length > 1
      ? `${line(today)} L${x(lastIndex).toFixed(1)} ${HEIGHT} L0 ${HEIGHT} Z`
      : "";

  return (
    <figure>
      <div className="relative">
        <span className="absolute top-0 left-0 text-[11px] tabular-nums text-muted-foreground">{maxLabel}</span>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Running total: ${todayLabel} compared with ${compareLabel}`}
          className="block w-full h-32 overflow-visible sm:h-40"
        >
          <line x1="0" x2={WIDTH} y1={HEIGHT - 1} y2={HEIGHT - 1} className="stroke-border" vectorEffect="non-scaling-stroke" />
          {compare.some((value) => value > 0) && (
            <path
              d={line(compare)}
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground/70"
            />
          )}
          {area && <path d={area} className="fill-primary/15" />}
          {today.length > 1 && (
            <path
              d={line(today)}
              fill="none"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-primary"
            />
          )}
        </svg>
        {today.length > 0 && (
          <span
            aria-hidden
            className="absolute rounded-full size-2.5 bg-primary ring-2 ring-background -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(x(lastIndex) / WIDTH) * 100}%`,
              top: `${(y(today[lastIndex]) / HEIGHT) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-0.5 rounded-full bg-primary" />
          {todayLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
          {compareLabel}
        </span>
      </figcaption>
    </figure>
  );
}

/** The counts he checks most, nothing else. */
export function StatStrip({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-3 border-t border-l border-dashed">
      {stats.map((stat) => (
        <div key={stat.label} className="px-3 py-2.5 border-b border-r border-dashed">
          <dd className="text-xl font-bold tracking-tight font-display tabular-nums">{stat.value}</dd>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const SPLIT_COLOURS = ["bg-chart-1", "bg-chart-3", "bg-chart-2", "bg-chart-4", "bg-chart-5"];

/** One bar cut into shares, with the exact amounts underneath. */
export function SplitBar({
  parts,
}: {
  parts: { key: string; label: string; value: number; amount: string; detail?: string }[];
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div>
      <div className="flex h-5 gap-0.5 overflow-hidden rounded-md bg-muted" role="img" aria-label="Share of takings">
        {total > 0 &&
          parts
            .filter((part) => part.value > 0)
            .map((part) => (
              <div
                key={part.key}
                title={`${part.label}: ${part.amount}`}
                className={SPLIT_COLOURS[parts.indexOf(part) % SPLIT_COLOURS.length]}
                style={{ width: `${(part.value / total) * 100}%` }}
              />
            ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        {parts.map((part, index) => (
          <li key={part.key} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className={cn("size-2 rounded-[2px] shrink-0", SPLIT_COLOURS[index % SPLIT_COLOURS.length])} />
              <span className="truncate">{part.label}</span>
              {total > 0 && part.value > 0 && (
                <span className="tabular-nums">{Math.round((part.value / total) * 100)}%</span>
              )}
            </span>
            <span className="block font-semibold tabular-nums">{part.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked rows, where the bar length is the comparison. */
export function RankBars({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    detail?: string;
    value: number;
    display: string;
    image?: string | null;
    initials?: string;
  }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2.5">
          {row.initials !== undefined ? (
            <span
              aria-hidden
              className="flex items-center justify-center text-xs font-bold rounded-full size-9 shrink-0 bg-secondary"
            >
              {row.initials}
            </span>
          ) : (
            <span className="relative block overflow-hidden rounded-md size-9 shrink-0 bg-muted">
              {row.image && <Image src={row.image} alt="" fill sizes="36px" className="object-cover" />}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {row.label}
                {row.detail && <span className="ml-1 text-xs text-muted-foreground">{row.detail}</span>}
              </span>
              <span className="font-semibold shrink-0 tabular-nums">{row.display}</span>
            </div>
            <div className="h-1.5 mt-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A tappable count for something that needs a look. */
export function AlertChip({
  href,
  icon: Icon,
  count,
  label,
}: {
  href: string;
  icon: LucideIcon;
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-press
      className="flex items-center gap-2 px-3 py-2 rounded-md shrink-0 bg-attention-soft"
    >
      <Icon className="size-4 text-attention" aria-hidden />
      <span className="text-sm font-bold tabular-nums">{count}</span>
      <span className="text-sm whitespace-nowrap">{label}</span>
    </Link>
  );
}

/** "+12%" against the row before, coloured so it reads at a glance. */
export function Change({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span className="text-xs text-muted-foreground">First month</span>;
  if (now === 0 && before === 0) return <span className="text-xs text-muted-foreground">No sales</span>;
  const percent = before === 0 ? 100 : Math.round(((now - before) / before) * 100);
  if (percent === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", percent > 0 ? "text-good" : "text-attention")}>
      {percent > 0 ? "+" : ""}
      {percent}%
    </span>
  );
}

/** Months as bars, each with its orders, money, and change on the month before. */
export function MonthBars({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    orders: number;
    pesewas: number;
    money: string;
    previous: { orders: number; pesewas: number } | null;
    /** The month still running: a percentage against a full month would mislead. */
    partial?: boolean;
  }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.pesewas));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium truncate">
              {row.label}
              {row.partial && <span className="ml-1 text-xs font-normal text-muted-foreground">so far</span>}
            </span>
            <span className="font-semibold shrink-0 tabular-nums">{row.money}</span>
          </div>
          <div className="h-1.5 mt-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.pesewas / max) * 100)}%` }} />
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {row.orders.toLocaleString("en-GH")} orders{" "}
              {!row.partial && <Change now={row.orders} before={row.previous?.orders ?? null} />}
            </span>
            {!row.partial && (
              <span>
                Money <Change now={row.pesewas} before={row.previous?.pesewas ?? null} />
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
