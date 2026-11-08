import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import AutoRefresh from "@/components/admin/auto-refresh";
import {
  Bars,
  Empty,
  Ledger,
  LedgerRow,
  Rule,
  Section,
  Segments,
} from "@/components/admin/ledger";
import { requireAdmin } from "@/lib/admin/auth";
import { clock, hourLabel, money, paymentName, plural } from "@/lib/admin/format";
import {
  fetchAttention,
  fetchPeriod,
  fetchSoldOut,
  fetchTotals,
  getBranches,
  summarize,
} from "@/lib/admin/queries";
import { getDayBoundsUtc, ghanaToday } from "@/lib/range-metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

type PageProps = {
  searchParams: Promise<{ date?: string; branch?: string }>;
};

function shiftDay(dateKey: string, days: number): string {
  const [start] = getDayBoundsUtc(dateKey);
  return new Date(start.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function dayTitle(dateKey: string, today: string): string {
  if (dateKey === today) return "Today";
  if (dateKey === shiftDay(today, -1)) return "Yesterday";
  const [start] = getDayBoundsUtc(dateKey);
  return start.toLocaleDateString("en-GH", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** The same moment in the evening, a week earlier. */
function sameTimeLastWeek(lastWeekStart: Date, dayStart: Date): Date {
  return new Date(lastWeekStart.getTime() + (Date.now() - dayStart.getTime()));
}

function weekdayName(dateKey: string): string {
  const [start] = getDayBoundsUtc(dateKey);
  return start.toLocaleDateString("en-GH", { timeZone: "UTC", weekday: "long" });
}

export default async function TodayPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const today = ghanaToday();
  const date =
    params.date && DATE_KEY.test(params.date) && params.date <= today ? params.date : today;
  const isToday = date === today;

  const branches = await getBranches();
  const branch = branches.find((b) => b.slug === params.branch) ?? null;
  const branchId = branch?.id ?? null;

  const [dayStart, dayEnd] = getDayBoundsUtc(date);
  const lastWeek = shiftDay(date, -7);
  const [lastWeekStart, lastWeekEnd] = getDayBoundsUtc(lastWeek);
  // Tonight so far is compared with the same point in the evening a week ago.
  const compareEnd = isToday
    ? sameTimeLastWeek(lastWeekStart, dayStart)
    : lastWeekEnd;

  const [orders, lastWeekOrders, lastWeekSoFar, attention, soldOut] = await Promise.all([
    fetchPeriod(dayStart, dayEnd, branchId),
    fetchPeriod(lastWeekStart, lastWeekEnd, branchId),
    fetchTotals(lastWeekStart, compareEnd, branchId),
    fetchAttention(dayStart, dayEnd, branchId),
    isToday ? fetchSoldOut() : Promise.resolve<string[]>([]),
  ]);

  const [summary, lastWeekSummary] = await Promise.all([
    summarize(orders, branches),
    summarize(lastWeekOrders, branches),
  ]);

  const difference = summary.pesewas - lastWeekSoFar.pesewas;
  const hoursWithSales = [...summary.hours, ...lastWeekSummary.hours].filter((h) => h.orders > 0);
  const firstHour = Math.min(14, ...hoursWithSales.map((h) => h.hour));
  const lastHour = Math.max(22, ...hoursWithSales.map((h) => h.hour));
  const bars = summary.hours.slice(firstHour, lastHour + 1).map((h) => ({
    key: String(h.hour),
    label: hourLabel(h.hour),
    value: h.pesewas,
    ghost: lastWeekSummary.hours[h.hour].pesewas,
    title: `${hourLabel(h.hour)}: ${money(h.pesewas)}, ${plural(h.orders, "order")}`,
  }));

  const query = (next: { date?: string; branch?: string | null }) => {
    const search = new URLSearchParams();
    const nextDate = next.date ?? date;
    const nextBranch = next.branch === undefined ? branch?.slug : next.branch;
    if (nextDate !== today) search.set("date", nextDate);
    if (nextBranch) search.set("branch", nextBranch);
    const text = search.toString();
    return text ? `/admin?${text}` : "/admin";
  };

  const dayQuery = isToday ? "day=today" : `date=${date}`;
  const branchQuery = branch ? `&branch=${branch.slug}` : "";

  return (
    <div className="flex flex-col gap-8">
      {isToday && <AutoRefresh seconds={60} />}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight truncate">{dayTitle(date, today)}</h1>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={query({ date: shiftDay(date, -1) })}
              prefetch={false}
              scroll={false}
              data-press
              aria-label="Previous day"
              className="flex items-center justify-center rounded-md size-9 hover:bg-accent"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            {isToday ? (
              <span aria-hidden className="size-9 text-muted-foreground/30 flex items-center justify-center">
                <ChevronRight className="size-5" />
              </span>
            ) : (
              <Link
                href={query({ date: shiftDay(date, 1) })}
                prefetch={false}
                scroll={false}
                data-press
                aria-label="Next day"
                className="flex items-center justify-center rounded-md size-9 hover:bg-accent"
              >
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <Segments
          label="Branch"
          className="mt-3"
          options={[
            { label: "All branches", href: query({ branch: null }), active: !branch },
            ...branches.map((b) => ({
              label: b.name.replace(" Branch", ""),
              href: query({ branch: b.slug }),
              active: branch?.id === b.id,
            })),
          ]}
        />
      </div>

      {/* The one number the owner opens this for */}
      <div>
        <p className="font-display text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
          {money(summary.pesewas)}
        </p>
        <p className="mt-2 text-base">
          {summary.orders === 0 ? (
            isToday ? "No paid orders yet today." : "No paid orders on this day."
          ) : (
            <>
              {plural(summary.orders, "paid order")}.{" "}
              {lastWeekSoFar.pesewas > 0 && (
                <span className={cn("font-medium", difference >= 0 ? "text-good" : "text-attention")}>
                  {money(Math.abs(difference))} {difference >= 0 ? "ahead of" : "behind"}{" "}
                  last {weekdayName(lastWeek)}
                  {isToday ? " at this time" : ""}.
                </span>
              )}
            </>
          )}
        </p>
        {isToday && summary.lastOrderAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Last order at {clock(summary.lastOrderAt)}. This page updates by itself.
          </p>
        )}
      </div>

      {(attention.unpaidToday > 0 || attention.staleOpen > 0 || soldOut.length > 0) && (
        <section aria-label="Needs a look" className="p-3 text-sm rounded-md bg-attention-soft">
          <ul className="flex flex-col gap-1.5">
            {attention.unpaidToday > 0 && (
              <li>
                <Link
                  href={`/admin/orders?${dayQuery}&show=unpaid${branchQuery}`}
                  prefetch={false}
                  className="font-medium underline underline-offset-4 decoration-attention"
                >
                  {plural(attention.unpaidToday, "order")} not paid yet
                </Link>{" "}
                on this day.
              </li>
            )}
            {attention.staleOpen > 0 && (
              <li>
                <Link
                  href={`/admin/orders?day=all&show=open${branchQuery}`}
                  prefetch={false}
                  className="font-medium underline underline-offset-4 decoration-attention"
                >
                  {plural(attention.staleOpen, "paid order")} from earlier days
                </Link>{" "}
                never marked completed. Cups only count once they are.
              </li>
            )}
            {soldOut.length > 0 && (
              <li>
                <Link
                  href="/admin/products?stock=out"
                  prefetch={false}
                  className="font-medium underline underline-offset-4 decoration-attention"
                >
                  Sold out:
                </Link>{" "}
                {soldOut.join(", ")}.
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2 md:gap-x-12">
        <Section title="Cash up">
          <Ledger>
            {summary.methods.length === 0 && <LedgerRow label="Cash" value={money(0)} />}
            {summary.methods.map((row) => (
              <LedgerRow
                key={row.key}
                label={paymentName(row.key)}
                detail={plural(row.orders, "order")}
                value={money(row.pesewas)}
              />
            ))}
            <Rule className="my-1" />
            <LedgerRow label="Total" value={money(summary.pesewas)} strong />
            <LedgerRow label="Cups used" detail="completed orders" value={summary.cups} />
          </Ledger>
        </Section>

        <Section title="At the till">
          {summary.tellers.length === 0 ? (
            <Empty>No cashier has taken a paid order yet.</Empty>
          ) : (
            <Ledger>
              {summary.tellers.map((row) => (
                <LedgerRow
                  key={row.key}
                  label={row.label}
                  detail={plural(row.orders, "order")}
                  value={money(row.pesewas)}
                />
              ))}
            </Ledger>
          )}
        </Section>

        {!branch && summary.branches.length > 0 && (
          <Section title="By branch">
            <Ledger>
              {summary.branches.map((row) => (
                <LedgerRow
                  key={row.key}
                  label={row.label.replace(" Branch", "")}
                  detail={plural(row.orders, "order")}
                  value={money(row.pesewas)}
                />
              ))}
            </Ledger>
          </Section>
        )}

        <Section title="Selling most">
          {summary.items.length === 0 ? (
            <Empty>Nothing sold yet.</Empty>
          ) : (
            <Ledger>
              {summary.items.slice(0, 5).map((item) => (
                <LedgerRow
                  key={`${item.name}${item.size}`}
                  label={item.name}
                  detail={item.size ?? undefined}
                  value={`${item.qty} sold`}
                />
              ))}
            </Ledger>
          )}
        </Section>
      </div>

      <Section title="Through the evening" note={`Pale bars: last ${weekdayName(lastWeek)}`}>
        <Bars bars={bars} labelEvery={2} />
      </Section>

      <p className="text-sm">
        <Link
          href={`/admin/orders?${dayQuery}${branchQuery}`}
          prefetch={false}
          className="font-medium underline underline-offset-4 text-primary"
        >
          See every order on this day
        </Link>
      </p>
    </div>
  );
}
