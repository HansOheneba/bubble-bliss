// Ghana uses UTC+0 (GMT) year-round with no daylight saving.
// All date math here uses UTC, which is identical to Ghana local time.
// A DateKey is a "YYYY-MM-DD" string representing a calendar day in Ghana.

export type DateKey = string;

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** Returns today's date as "YYYY-MM-DD" in Ghana time (UTC+0). */
export function ghanaToday(): DateKey {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

/** Formats a "YYYY-MM-DD" key as a short human-readable label. */
export function formatDateKey(dateKey: DateKey): string {
  const now = new Date();
  const today = ghanaToday();
  const yUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const yesterday = `${yUTC.getUTCFullYear()}-${pad2(yUTC.getUTCMonth() + 1)}-${pad2(yUTC.getUTCDate())}`;
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-GH", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Returns the [start, end) Date bounds in UTC for a Ghana calendar day. */
export function getDayBoundsUtc(dateKey: DateKey): [Date, Date] {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return [start, end];
}

/** Returns the [start, end) Date bounds in UTC for a whole calendar month. */
export function getMonthBoundsUtc(yearMonth: string): [Date, Date] {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return [start, end];
}

type DaySeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
};

/**
 * Builds hourly buckets (Ghana/UTC time) for the selected date.
 * For today, only hours up to the current UTC hour are included.
 */
export function buildDaySeries<T>(
  dateKey: DateKey,
  orders: T[],
  options: {
    getDate: (order: T) => Date;
    getRevenue: (order: T) => number;
  },
): DaySeriesPoint[] {
  const [start, end] = getDayBoundsUtc(dateKey);
  const isToday = dateKey === ghanaToday();
  const maxHour = isToday ? new Date().getUTCHours() : 23;

  const buckets: (DaySeriesPoint & { hour: number })[] = [];
  for (let h = 0; h <= maxHour; h++) {
    const hourDate = new Date(start.getTime() + h * 3_600_000);
    const label = hourDate.toLocaleTimeString("en-GH", {
      timeZone: "UTC",
      hour: "numeric",
    });
    buckets.push({ hour: h, label, revenue: 0, orders: 0 });
  }

  for (const order of orders) {
    const d = options.getDate(order);
    if (d >= start && d < end) {
      const h = d.getUTCHours();
      const bucket = buckets.find((b) => b.hour === h);
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += options.getRevenue(order);
      }
    }
  }

  return buckets.map(({ label, revenue, orders }) => ({
    label,
    revenue,
    orders,
  }));
}

export function sparseTickLabel(value: string, index: number, step: number) {
  return index % step === 0 ? value : "";
}
