export type RangeKey = "24h" | "7d" | "30d" | "6m";

type RangeGranularity = "hour" | "day" | "month";

type RangeMeta = {
  granularity: RangeGranularity;
  points: number;
  tickStep: number;
};

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "6m", label: "6m" },
];

const RANGE_META: Record<RangeKey, RangeMeta> = {
  "24h": { granularity: "hour", points: 24, tickStep: 3 },
  "7d": { granularity: "day", points: 7, tickStep: 2 },
  "30d": { granularity: "day", points: 30, tickStep: 5 },
  "6m": { granularity: "month", points: 6, tickStep: 1 },
};

type RangeBucket = {
  key: string;
  label: string;
};

type RangePoint = {
  label: string;
  revenue: number;
  orders: number;
};

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    month: "short",
    day: "numeric",
  });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-GH", {
    month: "short",
    year: "2-digit",
  });
}

function getBucketKey(date: Date, granularity: RangeGranularity) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  if (granularity === "month") {
    return `${year}-${month}`;
  }
  const day = pad2(date.getDate());
  if (granularity === "day") {
    return `${year}-${month}-${day}`;
  }
  const hour = pad2(date.getHours());
  return `${year}-${month}-${day}-${hour}`;
}

function getRangeBuckets(range: RangeKey, now: Date) {
  const { granularity, points } = RANGE_META[range];
  const buckets: RangeBucket[] = [];

  for (let i = points - 1; i >= 0; i -= 1) {
    const d = new Date(now);

    if (granularity === "hour") {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      buckets.push({
        key: getBucketKey(d, granularity),
        label: d.toLocaleTimeString("en-GH", { hour: "numeric" }),
      });
      continue;
    }

    if (granularity === "day") {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({
        key: getBucketKey(d, granularity),
        label: formatShortDate(d.toISOString()),
      });
      continue;
    }

    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    buckets.push({
      key: getBucketKey(d, granularity),
      label: formatMonthLabel(d),
    });
  }

  return { buckets, granularity };
}

export function buildRangeSeries<T>(
  range: RangeKey,
  orders: T[],
  now: Date,
  options: {
    getDate: (order: T) => Date;
    getRevenue: (order: T) => number;
  },
) {
  const { buckets, granularity } = getRangeBuckets(range, now);
  const bucketMap = new Map(
    buckets.map((b) => [b.key, { revenue: 0, orders: 0 }]),
  );

  for (const order of orders) {
    const date = options.getDate(order);
    const key = getBucketKey(date, granularity);
    const bucket = bucketMap.get(key);
    if (!bucket) {
      continue;
    }
    bucket.orders += 1;
    bucket.revenue += options.getRevenue(order);
  }

  return buckets.map((b) => ({
    label: b.label,
    revenue: bucketMap.get(b.key)?.revenue ?? 0,
    orders: bucketMap.get(b.key)?.orders ?? 0,
  })) as RangePoint[];
}

export function getRangeLabel(range: RangeKey) {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range;
}

export function getRangeTickStep(range: RangeKey) {
  return RANGE_META[range].tickStep;
}

export function sparseTickLabel(value: string, index: number, step: number) {
  return index % step === 0 ? value : "";
}
