import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClockAlert,
  PackageX,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import AutoRefresh from "@/components/admin/auto-refresh";
import {
  AlertChip,
  PaceChart,
  RankBars,
  SplitBar,
  StatStrip,
} from "@/components/admin/glance";
import { Empty, Section, Segments } from "@/components/admin/ledger";
import { requireAdmin } from "@/lib/admin/auth";
import { clock, hourLabel, initials, money, paymentName } from "@/lib/admin/format";
import {
  fetchAttention,
  fetchDayByHour,
  fetchPeriod,
  fetchSoldOut,
  fetchTotals,
  getBranches,
  getProductImages,
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

const BUCKET_MINUTES = 15;

type Timed = { at: string; pesewas: number };

/** Running totals in 15-minute steps across the trading day. */
function runningTotals(rows: Timed[], dayStart: Date, firstHour: number, lastHour: number): number[] {
  const open = dayStart.getTime() + firstHour * 3_600_000;
  const steps = ((lastHour - firstHour + 1) * 60) / BUCKET_MINUTES;
  const totals = Array.from({ length: steps + 1 }, () => 0);
  for (const row of rows) {
    const minutes = (new Date(row.at).getTime() - open) / 60_000;
    const step = Math.min(steps, Math.max(0, Math.ceil(minutes / BUCKET_MINUTES)));
    totals[step] += row.pesewas;
  }
  for (let i = 1; i < totals.length; i++) totals[i] += totals[i - 1];
  return totals;
}

/** How much of the trading day has happened, as a number of chart steps. */
function stepsSoFar(dayStart: Date, firstHour: number, total: number): number {
  const open = dayStart.getTime() + firstHour * 3_600_000;
  const step = Math.ceil((Date.now() - open) / (BUCKET_MINUTES * 60_000));
  return Math.min(total, Math.max(1, step + 1));
}

/** The most recent same weekday that actually traded. Closed days make a useless comparison. */
async function findComparisonDay(dateKey: string, branchId: number | null): Promise<string> {
  for (let weeks = 1; weeks <= 4; weeks++) {
    const candidate = shiftDay(dateKey, -7 * weeks);
    const [start, end] = getDayBoundsUtc(candidate);
    const totals = await fetchTotals(start, end, branchId);
    if (totals.pesewas > 0) return candidate;
  }
  return shiftDay(dateKey, -7);
}

function comparisonName(compareDay: string, dateKey: string): string {
  const [start] = getDayBoundsUtc(compareDay);
  const weekday = start.toLocaleDateString("en-GH", { timeZone: "UTC", weekday: "long" });
  if (compareDay === shiftDay(dateKey, -7)) return `last ${weekday}`;
  const day = start.toLocaleDateString("en-GH", { timeZone: "UTC", day: "numeric", month: "short" });
  return `${weekday} ${day}`;
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
  const lastWeek = await findComparisonDay(date, branchId);
  const lastWeekName = comparisonName(lastWeek, date);
  const [lastWeekStart, lastWeekEnd] = getDayBoundsUtc(lastWeek);
  const [orders, compareRows, attention, soldOut, productImages] = await Promise.all([
    fetchPeriod(dayStart, dayEnd, branchId),
    fetchDayByHour(lastWeekStart, lastWeekEnd, branchId),
    fetchAttention(dayStart, dayEnd, branchId),
    isToday ? fetchSoldOut() : Promise.resolve<string[]>([]),
    getProductImages(),
  ]);
  const summary = await summarize(orders, branches);

  // Tonight so far is compared with the same point in the evening that day.
  const compareEnd = isToday ? sameTimeLastWeek(lastWeekStart, dayStart) : lastWeekEnd;
  const compareSoFar = compareRows
    .filter((row) => new Date(row.at) < compareEnd)
    .reduce((sum, row) => sum + row.pesewas, 0);
  const difference = summary.pesewas - compareSoFar;

  const paid = orders.flatMap((o) =>
    o.payment_status === "paid" && o.status !== "cancelled" && o.created_at
      ? [{ at: o.created_at, pesewas: o.total_pesewas }]
      : [],
  );
  const hoursUsed = [
    ...paid.map((row) => new Date(row.at).getUTCHours()),
    ...compareRows.map((row) => new Date(row.at).getUTCHours()),
  ];
  const firstHour = Math.min(14, ...hoursUsed);
  const lastHour = Math.max(22, ...hoursUsed);
  const compareLine = runningTotals(compareRows, lastWeekStart, firstHour, lastHour);
  const dayLine = runningTotals(paid, dayStart, firstHour, lastHour);
  const todayLine = isToday
    ? dayLine.slice(0, stepsSoFar(dayStart, firstHour, dayLine.length))
    : dayLine;
  const chartPeak = Math.max(...todayLine, ...compareLine);
  const chartLabels = [
    firstHour,
    Math.round((firstHour + lastHour + 1) / 2),
    lastHour + 1,
  ].map((hour) => hourLabel(hour % 24));

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

      {/* The number, and whether it is good */}
      <div>
        <p className="font-display text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
          {money(summary.pesewas)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          {compareSoFar > 0 && (
            <span
              className={cn(
                "flex items-center gap-1.5 text-lg font-bold tabular-nums",
                difference >= 0 ? "text-good" : "text-attention",
              )}
            >
              {difference >= 0 ? (
                <TrendingUp className="size-5" aria-hidden />
              ) : (
                <TrendingDown className="size-5" aria-hidden />
              )}
              {difference >= 0 ? "+" : "-"}
              {money(Math.abs(difference))}
              <span className="text-xs font-normal text-muted-foreground">vs {lastWeekName}</span>
            </span>
          )}
          {isToday && summary.lastOrderAt && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="rounded-full size-1.5 bg-good" />
              Last order {clock(summary.lastOrderAt)}
            </span>
          )}
        </div>
      </div>

      <PaceChart
        today={todayLine}
        compare={compareLine}
        labels={chartLabels}
        todayLabel={isToday ? "Tonight" : dayTitle(date, today)}
        compareLabel={lastWeekName}
        maxLabel={money(chartPeak)}
      />

      <StatStrip
        stats={[
          { label: "Paid orders", value: summary.orders },
          { label: "Shawarmas sold", value: summary.shawarma.qty },
          { label: "Drinks sold", value: summary.drinks.qty },
          { label: "Cups used", value: summary.cups },
        ]}
      />

      {(attention.unpaidToday > 0 || attention.staleOpen > 0 || soldOut.length > 0) && (
        <nav aria-label="Needs a look" className="flex gap-2 -mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {attention.unpaidToday > 0 && (
            <AlertChip
              href={`/admin/orders?${dayQuery}&show=unpaid${branchQuery}`}
              icon={CircleDollarSign}
              count={attention.unpaidToday}
              label="not paid"
            />
          )}
          {soldOut.length > 0 && (
            <AlertChip href="/admin/products?stock=out" icon={PackageX} count={soldOut.length} label="sold out" />
          )}
          {attention.staleOpen > 0 && (
            <AlertChip
              href={`/admin/orders?day=all&show=open${branchQuery}`}
              icon={ClockAlert}
              count={attention.staleOpen}
              label="old orders left open"
            />
          )}
        </nav>
      )}

      <div className="grid gap-8 md:grid-cols-2 md:gap-x-12">
        <Section
          title="Shawarma"
          note={summary.shawarma.qty > 0 ? `${summary.shawarma.qty} sold, ${money(summary.shawarma.pesewas)}` : undefined}
        >
          {summary.shawarma.qty === 0 ? (
            <Empty>No shawarma sold yet.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2" aria-label="By size">
                {summary.shawarma.sizes.map((row) => (
                  <span key={row.size} className="px-3 py-1.5 text-sm rounded-md bg-secondary">
                    {row.size} <strong className="ml-1 tabular-nums">{row.qty}</strong>
                  </span>
                ))}
              </div>
              <RankBars
                rows={summary.shawarma.items.map((item) => ({
                  key: `${item.name}${item.size}`,
                  label: item.name,
                  detail: item.size ?? undefined,
                  value: item.qty,
                  display: `${item.qty}`,
                  image: productImages[item.name],
                }))}
              />
            </div>
          )}
        </Section>

        <Section title="Drinks and food">
          <SplitBar
            parts={[
              { key: "drinks", label: "Drinks", value: summary.drinks.pesewas, amount: money(summary.drinks.pesewas) },
              { key: "shawarma", label: "Shawarma", value: summary.shawarma.pesewas, amount: money(summary.shawarma.pesewas) },
            ]}
          />
        </Section>

        <Section title="Cash up">
          <SplitBar
            parts={
              summary.methods.length > 0
                ? summary.methods.map((row) => ({
                    key: row.key,
                    label: paymentName(row.key),
                    value: row.pesewas,
                    amount: money(row.pesewas),
                  }))
                : [{ key: "none", label: "No sales yet", value: 0, amount: money(0) }]
            }
          />
        </Section>

        {!branch && branches.length > 1 && (
          <Section title="Branches">
            <SplitBar
              parts={branches.map((b) => {
                const row = summary.branches.find((r) => r.key === String(b.id));
                return {
                  key: String(b.id),
                  label: b.name.replace(" Branch", ""),
                  value: row?.pesewas ?? 0,
                  amount: money(row?.pesewas ?? 0),
                };
              })}
            />
          </Section>
        )}

        <Section title="At the till">
          {summary.tellers.length === 0 ? (
            <Empty>No sales yet.</Empty>
          ) : (
            <RankBars
              rows={summary.tellers.map((row) => ({
                key: row.key,
                label: row.key === "none" ? "No cashier" : row.label,
                detail: String(row.orders),
                value: row.pesewas,
                display: money(row.pesewas),
                initials: row.key === "none" ? "?" : initials(row.label),
              }))}
            />
          )}
        </Section>

        <Section title="Selling most">
          {summary.items.length === 0 ? (
            <Empty>Nothing sold yet.</Empty>
          ) : (
            <RankBars
              rows={summary.items.slice(0, 5).map((item) => ({
                key: `${item.name}${item.size}`,
                label: item.name,
                detail: item.size ?? undefined,
                value: item.qty,
                display: String(item.qty),
                image: productImages[item.name],
              }))}
            />
          )}
        </Section>
      </div>

      {orders.length > 0 && (
        <Section title="Latest orders">
          <ul className="border-t border-dashed">
            {orders.slice(0, 5).map((order) => (
              <li key={order.id} className="flex items-baseline gap-3 py-2 text-sm border-b border-dashed">
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{clock(order.created_at)}</span>
                <span className="flex-1 min-w-0 truncate">
                  {order.items
                    .map((item) => (item.quantity > 1 ? `${item.quantity} ${item.product_name}` : item.product_name))
                    .join(", ")}
                </span>
                <span className="font-semibold tabular-nums shrink-0">{money(order.total_pesewas)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Link
        href={`/admin/orders?${dayQuery}${branchQuery}`}
        prefetch={false}
        data-press
        className="block w-full py-2.5 text-sm font-medium text-center border rounded-md hover:bg-accent"
      >
        See all {summary.orders > 0 ? `${summary.orders} ` : ""}orders
      </Link>
    </div>
  );
}
