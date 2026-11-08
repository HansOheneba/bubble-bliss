import {
  Bars,
  Empty,
  Ledger,
  LedgerRow,
  PageHeader,
  Rule,
  Section,
  Segments,
  ShareRow,
} from "@/components/admin/ledger";
import { requireAdmin } from "@/lib/admin/auth";
import { hourLabel, money, paymentName, plural, shortDay } from "@/lib/admin/format";
import {
  fetchPeriod,
  fetchTotals,
  getBranches,
  getMonthlyHistory,
  summarize,
} from "@/lib/admin/queries";
import { getDayBoundsUtc, ghanaToday } from "@/lib/range-metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

type PeriodKey = "7d" | "30d" | "month" | "last" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "all", label: "All time" },
];

type PageProps = {
  searchParams: Promise<{ period?: string; branch?: string }>;
};

type Resolved = {
  from: Date | null;
  to: Date;
  previousFrom: Date | null;
  previousTo: Date | null;
  compareLabel: string;
};

function resolvePeriod(key: PeriodKey): Resolved {
  const [todayStart, todayEnd] = getDayBoundsUtc(ghanaToday());
  const monthStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 1, 1));

  if (key === "7d" || key === "30d") {
    const days = key === "7d" ? 7 : 30;
    const from = new Date(todayEnd.getTime() - days * DAY_MS);
    return {
      from,
      to: todayEnd,
      previousFrom: new Date(from.getTime() - days * DAY_MS),
      previousTo: from,
      compareLabel: `the ${days} days before`,
    };
  }
  if (key === "month") {
    // The same number of days at the start of last month, so it is a fair race.
    const elapsed = Date.now() - monthStart.getTime();
    return {
      from: monthStart,
      to: todayEnd,
      previousFrom: lastMonthStart,
      previousTo: new Date(lastMonthStart.getTime() + elapsed),
      compareLabel: "this point last month",
    };
  }
  if (key === "last") {
    return {
      from: lastMonthStart,
      to: monthStart,
      previousFrom: new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 2, 1)),
      previousTo: lastMonthStart,
      compareLabel: "the month before",
    };
  }
  return { from: null, to: todayEnd, previousFrom: null, previousTo: null, compareLabel: "" };
}

function change(current: number, previous: number): string {
  if (previous === 0) return "";
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent >= 0 ? "Up" : "Down"} ${Math.abs(percent)}%`;
}

function monthName(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString("en-GH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export default async function SalesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period)
    ? (params.period as PeriodKey)
    : "7d";

  const branches = await getBranches();
  const branch = branches.find((b) => b.slug === params.branch) ?? null;
  const branchId = branch?.id ?? null;
  const range = resolvePeriod(period);

  const [orders, previous, history] = await Promise.all([
    fetchPeriod(range.from, range.to, branchId),
    range.previousFrom && range.previousTo
      ? fetchTotals(range.previousFrom, range.previousTo, branchId)
      : Promise.resolve(null),
    getMonthlyHistory(),
  ]);
  const summary = await summarize(orders, branches);

  // Sales by day, or by month when the period is long.
  const firstDay = range.from ?? (orders.length ? new Date(orders[orders.length - 1].created_at ?? 0) : range.to);
  const spanDays = Math.ceil((range.to.getTime() - firstDay.getTime()) / DAY_MS);
  const useMonths = spanDays > 62;
  const buckets = new Map<string, { pesewas: number; orders: number }>();
  if (!useMonths) {
    for (let t = firstDay.getTime(); t < range.to.getTime(); t += DAY_MS) {
      buckets.set(new Date(t).toISOString().slice(0, 10), { pesewas: 0, orders: 0 });
    }
  }
  for (const order of orders) {
    if (order.payment_status !== "paid" || order.status === "cancelled" || !order.created_at) continue;
    const key = order.created_at.slice(0, useMonths ? 7 : 10);
    const bucket = buckets.get(key) ?? { pesewas: 0, orders: 0 };
    bucket.pesewas += order.total_pesewas;
    bucket.orders += 1;
    buckets.set(key, bucket);
  }
  const series = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const bestDay = useMonths
    ? null
    : series.reduce<[string, { pesewas: number; orders: number }] | null>(
        (best, entry) => (!best || entry[1].pesewas > best[1].pesewas ? entry : best),
        null,
      );
  const bars = series.map(([key, value]) => ({
    key,
    label: useMonths
      ? new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GH", { timeZone: "UTC", month: "short" })
      : series.length <= 7
        ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GH", { timeZone: "UTC", weekday: "short" })
        : shortDay(`${key}T00:00:00Z`),
    value: value.pesewas,
    title: `${key}: ${money(value.pesewas)}, ${plural(value.orders, "order")}`,
  }));

  // When is the shop actually busy, for planning shifts.
  const activeHours = summary.hours.filter((h) => h.orders > 0);
  const hourBars =
    activeHours.length === 0
      ? []
      : summary.hours
          .slice(activeHours[0].hour, activeHours[activeHours.length - 1].hour + 1)
          .map((h) => ({
            key: String(h.hour),
            label: hourLabel(h.hour),
            value: h.orders,
            title: `${hourLabel(h.hour)}: ${plural(h.orders, "order")}`,
          }));

  // Regular customers, by the phone number on the order.
  const customers = new Map<string, { name: string | null; orders: number; pesewas: number }>();
  for (const order of orders) {
    const phone = order.phone?.trim();
    if (!phone || order.payment_status !== "paid" || order.status === "cancelled") continue;
    const row = customers.get(phone) ?? { name: null, orders: 0, pesewas: 0 };
    row.name = row.name ?? order.customer_name;
    row.orders += 1;
    row.pesewas += order.total_pesewas;
    customers.set(phone, row);
  }
  const returning = [...customers.values()].filter((c) => c.orders > 1).length;
  const topCustomers = [...customers.entries()]
    .sort(([, a], [, b]) => b.pesewas - a.pesewas)
    .slice(0, 5);

  const maxItem = Math.max(1, ...summary.items.slice(0, 10).map((item) => item.qty));
  const moneyDelta = previous ? change(summary.pesewas, previous.pesewas) : "";
  const isUp = previous ? summary.pesewas >= previous.pesewas : true;
  const average = summary.orders ? Math.round(summary.pesewas / summary.orders) : 0;

  const href = (next: { period?: string; branch?: string | null }) => {
    const query = new URLSearchParams();
    const nextPeriod = next.period ?? period;
    const nextBranch = next.branch === undefined ? branch?.slug : next.branch;
    if (nextPeriod !== "7d") query.set("period", nextPeriod);
    if (nextBranch) query.set("branch", nextBranch);
    const text = query.toString();
    return text ? `/admin/analytics?${text}` : "/admin/analytics";
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Sales" />
        <div className="flex flex-col gap-2 -mt-3">
          <Segments
            label="Period"
            options={PERIODS.map((p) => ({
              label: p.label,
              href: href({ period: p.key }),
              active: period === p.key,
            }))}
          />
          <Segments
            label="Branch"
            options={[
              { label: "All branches", href: href({ branch: null }), active: !branch },
              ...branches.map((b) => ({
                label: b.name.replace(" Branch", ""),
                href: href({ branch: b.slug }),
                active: branch?.id === b.id,
              })),
            ]}
          />
        </div>
      </div>

      <div>
        <p className="font-display text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
          {money(summary.pesewas)}
        </p>
        <p className="mt-2 text-base">
          {plural(summary.orders, "paid order")}
          {average > 0 && `, about ${money(average)} each`}.{" "}
          {moneyDelta && (
            <span className={cn("font-medium", isUp ? "text-good" : "text-attention")}>
              {moneyDelta} on {range.compareLabel}.
            </span>
          )}
        </p>
        {bestDay && bestDay[1].pesewas > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Best day: {shortDay(`${bestDay[0]}T00:00:00Z`)}, {money(bestDay[1].pesewas)}.
          </p>
        )}
      </div>

      {bars.length > 0 && (
        <Section title={useMonths ? "Month by month" : "Day by day"}>
          <Bars bars={bars} labelEvery={bars.length > 14 ? 7 : 1} />
        </Section>
      )}

      <div className="grid gap-8 md:grid-cols-2 md:gap-x-12">
        <Section title="How people paid">
          <Ledger>
            {summary.methods.map((row) => (
              <LedgerRow
                key={row.key}
                label={paymentName(row.key)}
                detail={`${Math.round((row.pesewas / Math.max(1, summary.pesewas)) * 100)}%`}
                value={money(row.pesewas)}
              />
            ))}
            {summary.methods.length === 0 && <Empty>No sales in this period.</Empty>}
            <Rule className="my-1" />
            <LedgerRow label="Cups used" detail="completed orders" value={summary.cups.toLocaleString("en-GH")} />
          </Ledger>
        </Section>

        <Section title="At the till">
          {summary.tellers.length === 0 ? (
            <Empty>No cashier sales in this period.</Empty>
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

        <Section title="Selling most" className="md:row-span-2">
          {summary.items.length === 0 ? (
            <Empty>Nothing sold in this period.</Empty>
          ) : (
            summary.items.slice(0, 10).map((item) => (
              <ShareRow
                key={`${item.name}${item.size}`}
                label={item.name}
                detail={item.size ?? undefined}
                value={`${item.qty.toLocaleString("en-GH")} sold`}
                share={item.qty / maxItem}
              />
            ))
          )}
        </Section>

        {summary.toppings.length > 0 && (
          <Section title="Favourite toppings">
            <Ledger>
              {summary.toppings.slice(0, 5).map((topping) => (
                <LedgerRow key={topping.name} label={topping.name} value={topping.qty.toLocaleString("en-GH")} />
              ))}
            </Ledger>
          </Section>
        )}

        {hourBars.length > 0 && (
          <Section title="When it gets busy" note="Orders by hour">
            <Bars bars={hourBars} labelEvery={2} />
          </Section>
        )}

        <Section
          title="Regulars"
          note={customers.size > 0 ? `${returning} of ${customers.size} came back` : undefined}
        >
          {topCustomers.length === 0 ? (
            <Empty>No phone numbers were recorded in this period.</Empty>
          ) : (
            <Ledger>
              {topCustomers.map(([phone, customer]) => (
                <LedgerRow
                  key={phone}
                  label={customer.name ?? phone}
                  detail={plural(customer.orders, "order")}
                  value={money(customer.pesewas)}
                />
              ))}
            </Ledger>
          )}
        </Section>
      </div>

      <Section title="Every month">
        <Ledger>
          {history.map((row) => (
            <LedgerRow
              key={row.month}
              label={monthName(row.month)}
              detail={
                branches.length > 1 && !branch
                  ? branches
                      .filter((b) => row.branches[String(b.id)])
                      .map((b) => `${b.name.replace(" Branch", "")} ${money(row.branches[String(b.id)])}`)
                      .join(", ")
                  : undefined
              }
              value={money(branch ? (row.branches[String(branch.id)] ?? 0) : row.pesewas)}
            />
          ))}
        </Ledger>
      </Section>
    </div>
  );
}
