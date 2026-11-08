import { unstable_cache } from "next/cache";

import { hourLabel, money, plural, shortDay } from "@/lib/admin/format";
import {
  fetchPeriod,
  fetchTotals,
  getMonthlyHistory,
  summarize,
  type BranchOption,
} from "@/lib/admin/queries";
import { getDayBoundsUtc, ghanaToday } from "@/lib/range-metrics";

export type PeriodKey = "7d" | "30d" | "month" | "last" | "all";

const DAY_MS = 86_400_000;

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

async function buildSalesView(period: PeriodKey, branchId: number | null, branches: BranchOption[]) {
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
  const firstDay =
    range.from ?? (orders.length ? new Date(orders[orders.length - 1].created_at ?? 0) : range.to);
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
  const topCustomers = [...customers.entries()]
    .sort(([, a], [, b]) => b.pesewas - a.pesewas)
    .slice(0, 5)
    .map(([phone, customer]) => ({ phone, ...customer }));

  return {
    summary,
    history,
    bars,
    useMonths,
    bestDay,
    hourBars,
    customerCount: customers.size,
    returning: [...customers.values()].filter((c) => c.orders > 1).length,
    topCustomers,
    moneyDelta: previous ? change(summary.pesewas, previous.pesewas) : "",
    isUp: previous ? summary.pesewas >= previous.pesewas : true,
    average: summary.orders ? Math.round(summary.pesewas / summary.orders) : 0,
    compareLabel: range.compareLabel,
  };
}

/**
 * The finished numbers for a period, shared for 60 seconds. Going back and
 * forth between periods, or two people looking at once, costs one calculation.
 */
export const getSalesView = unstable_cache(buildSalesView, ["admin-sales-view"], {
  revalidate: 60,
});
