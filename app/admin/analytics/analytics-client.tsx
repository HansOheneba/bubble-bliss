"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import RangeSelect from "@/components/admin/range-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildRangeSeries,
  getRangeCutoff,
  getDisplayLabel,
  getRangeTickStep,
  sparseTickLabel,
  type RangeKey,
} from "@/lib/range-metrics";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type {
  SlimOrder,
  SlimShawarmaItem,
  BranchStat,
  ProductStat,
  ToppingStat,
  TellerStat,
  PaymentStat,
  SourceStat,
  CustomerStat,
} from "./page";

type Props = {
  slimOrders: SlimOrder[];
  slimShawarmaItems: SlimShawarmaItem[];
  branchStats: BranchStat[];
  topProducts: ProductStat[];
  topToppings: ToppingStat[];
  tellerStats: TellerStat[];
  paymentStats: PaymentStat[];
  sourceStats: SourceStat[];
  customerStats: CustomerStat[];
  branches: string[];
  branchProductStats: Record<string, ProductStat[]>;
  branchToppingStats: Record<string, ToppingStat[]>;
  branchPaymentStats: Record<string, PaymentStat[]>;
  branchSourceStats: Record<string, SourceStat[]>;
};

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function paymentLabel(method: string) {
  const map: Record<string, string> = {
    cash: "Cash",
    hubtel: "Hubtel",
    momo: "Mobile Money",
  };
  return (
    map[method.toLowerCase()] ??
    method.charAt(0).toUpperCase() + method.slice(1)
  );
}

function SizeBadge({ size }: { size: string }) {
  const lower = size.toLowerCase();
  const styles =
    lower === "large"
      ? "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-400 dark:border dark:border-orange-800/50"
      : lower === "medium"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 dark:border dark:border-blue-800/50"
        : "bg-muted text-muted-foreground";
  return (
    <Badge className={styles} variant="default">
      {size}
    </Badge>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function AnalyticsClient({
  slimOrders,
  slimShawarmaItems,
  branchStats,
  topProducts,
  topToppings,
  tellerStats,
  paymentStats,
  sourceStats,
  customerStats,
  branches,
  branchProductStats,
  branchToppingStats,
  branchPaymentStats,
  branchSourceStats,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function syncToUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const [range, setRange] = React.useState<RangeKey>(
    (searchParams.get("range") as RangeKey) ?? "today",
  );
  const [selectedBranch, setSelectedBranch] = React.useState<string>(
    searchParams.get("branch") ?? "all",
  );
  const now = new Date();

  // ── Derive active datasets based on selected branch ──────────────────────
  const activeOrders =
    selectedBranch === "all"
      ? slimOrders
      : slimOrders.filter((o) => o.branchName === selectedBranch);
  const activeTopProducts =
    selectedBranch === "all"
      ? topProducts
      : (branchProductStats[selectedBranch] ?? []);
  const activeTopToppings =
    selectedBranch === "all"
      ? topToppings
      : (branchToppingStats[selectedBranch] ?? []);
  const activePaymentStats =
    selectedBranch === "all"
      ? paymentStats
      : (branchPaymentStats[selectedBranch] ?? []);
  const activeSourceStats =
    selectedBranch === "all"
      ? sourceStats
      : (branchSourceStats[selectedBranch] ?? []);
  const activeBranchStats =
    selectedBranch === "all"
      ? branchStats
      : branchStats.filter((b) => b.name === selectedBranch);
  const activeTellerStats =
    selectedBranch === "all"
      ? tellerStats
      : tellerStats.filter((t) => t.branch === selectedBranch);

  // ── KPI computations ────────────────────────────────────────────────────
  const cutoff = getRangeCutoff(range, now);
  const rangeActiveOrders = activeOrders.filter(
    (o) => new Date(o.createdAt) >= cutoff,
  );
  const cupsInRange = rangeActiveOrders.reduce(
    (acc, o) => acc + o.cupsInOrder,
    0,
  );

  const totalOrders = rangeActiveOrders.length;
  const totalRevenueGhs = rangeActiveOrders.reduce(
    (acc, o) => acc + o.totalGhs,
    0,
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenueGhs / totalOrders : 0;
  const completedInRange = rangeActiveOrders.filter(
    (o) => o.status === "completed",
  ).length;

  // ── Payment breakdown (range + branch filtered, paid only) ──────────────
  const paymentBreakdown = (() => {
    const map = new Map<string, { count: number; revenueGhs: number }>();
    for (const o of rangeActiveOrders.filter(
      (o) => o.paymentStatus === "paid",
    )) {
      const cur = map.get(o.paymentMethod) ?? { count: 0, revenueGhs: 0 };
      cur.count += 1;
      cur.revenueGhs += o.totalGhs;
      map.set(o.paymentMethod, cur);
    }
    return [...map.entries()]
      .map(([method, s]) => ({ method, ...s }))
      .sort((a, b) => b.revenueGhs - a.revenueGhs);
  })();
  const totalPaidRevenueGhs = paymentBreakdown.reduce(
    (acc, p) => acc + p.revenueGhs,
    0,
  );

  // ── Shawarma analytics (range + branch filtered) ─────────────────────────
  const activeShawarmaItems =
    selectedBranch === "all"
      ? slimShawarmaItems
      : slimShawarmaItems.filter((s) => s.branchName === selectedBranch);
  const rangeShawarmaItems = activeShawarmaItems.filter(
    (s) => new Date(s.createdAt) >= cutoff,
  );
  const shawarmaStatMap = new Map<
    string,
    {
      productName: string;
      variantLabel: string;
      qty: number;
      revenueGhs: number;
    }
  >();
  for (const s of rangeShawarmaItems) {
    const key = `${s.productName}__${s.variantLabel}`;
    const cur = shawarmaStatMap.get(key) ?? {
      productName: s.productName,
      variantLabel: s.variantLabel,
      qty: 0,
      revenueGhs: 0,
    };
    cur.qty += s.qty;
    cur.revenueGhs += s.revenueGhs;
    shawarmaStatMap.set(key, cur);
  }
  const shawarmaItemStats = [...shawarmaStatMap.values()].sort(
    (a, b) => b.qty - a.qty,
  );
  const shawarmaBySize: Record<string, number> = {};
  for (const s of shawarmaItemStats) {
    shawarmaBySize[s.variantLabel] =
      (shawarmaBySize[s.variantLabel] ?? 0) + s.qty;
  }
  const totalShawarmasSold = shawarmaItemStats.reduce(
    (acc, s) => acc + s.qty,
    0,
  );

  // ── Range time series ───────────────────────────────────────────────────
  const rangeSeries = buildRangeSeries(range, activeOrders, now, {
    getDate: (o) => new Date(o.createdAt),
    getRevenue: (o) => o.totalGhs,
  });
  const tickStep = getRangeTickStep(range);

  // ── Chart configs ───────────────────────────────────────────────────────
  const revenueConfig = {
    revenue: { label: "Revenue (GHS)", color: "var(--color-chart-1)" },
  };
  const ordersConfig = {
    orders: { label: "Orders", color: "var(--color-chart-3)" },
  };
  const branchRevenueConfig = {
    revenueGhs: { label: "Revenue (GHS)", color: "var(--color-chart-2)" },
    orders: { label: "Orders", color: "var(--color-chart-4)" },
  };
  const productConfig = {
    qty: { label: "Units sold", color: "var(--color-chart-1)" },
  };
  const toppingConfig = {
    qty: { label: "Times ordered", color: "var(--color-chart-5)" },
  };
  const paymentConfig = activePaymentStats.reduce(
    (acc, s, i) => {
      acc[s.method] = {
        label: s.method.charAt(0).toUpperCase() + s.method.slice(1),
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );
  void paymentConfig;
  const sourceConfig = activeSourceStats.reduce(
    (acc, s, i) => {
      acc[s.source] = {
        label: s.source.charAt(0).toUpperCase() + s.source.slice(1),
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );

  const paymentPieData = activePaymentStats.map((s, i) => ({
    name: s.method,
    value: s.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  void paymentPieData;
  const sourcePieData = activeSourceStats.map((s, i) => ({
    name: s.source,
    value: s.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedBranch === "all"
              ? `Showing ${getDisplayLabel(range)} across all branches.`
              : `Showing ${getDisplayLabel(range)} for ${selectedBranch} only.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Branch</span>
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              syncToUrl({ branch: v === "all" ? null : v });
            }}
          >
            <SelectTrigger size="sm" className="min-w-40">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>Trend range</span>
          <RangeSelect
            value={range}
            onValueChange={(v) => {
              setRange(v);
              syncToUrl({ range: v === "today" ? null : v });
            }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {totalOrders}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {getDisplayLabel(range)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(totalRevenueGhs)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {getDisplayLabel(range)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Avg Order Value
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(avgOrderValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Per order</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Completed Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {completedInRange}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {getDisplayLabel(range)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Cups Used</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {cupsInRange}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {getDisplayLabel(range)}
          </p>
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-base font-semibold text-foreground">
            Revenue trend
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Total GHS collected per period
          </p>
          <ChartContainer config={revenueConfig} className="h-52 w-full">
            <AreaChart data={rangeSeries}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v, i) =>
                  sparseTickLabel(v as string, i, tickStep)
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={60}
                tickFormatter={(v) => `GHS ${(v as number).toFixed(0)}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-chart-1)"
                fill="url(#revGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        {/* Order volume trend */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-base font-semibold text-foreground">
            Order volume
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Number of orders placed per period
          </p>
          <ChartContainer config={ordersConfig} className="h-52 w-full">
            <AreaChart data={rangeSeries}>
              <defs>
                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v, i) =>
                  sparseTickLabel(v as string, i, tickStep)
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={40}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="var(--color-chart-3)"
                fill="url(#ordGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* Branch performance + Payment / Source pies */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Branch revenue */}
        <div className="rounded-lg border bg-card p-6 lg:col-span-2">
          <p className="text-base font-semibold text-foreground">
            Revenue by branch
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Total revenue and order count per location
          </p>
          {activeBranchStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer
              config={branchRevenueConfig}
              className="h-52 w-full"
            >
              <BarChart data={activeBranchStats}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={60}
                  tickFormatter={(v) => `GHS ${(v as number).toFixed(0)}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="revenueGhs"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                  name="Revenue (GHS)"
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-chart-4)"
                  radius={[4, 4, 0, 0]}
                  name="Orders"
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        {/* Payment breakdown + Source pie stacked */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-card p-6 flex-1">
            <p className="text-sm font-semibold text-foreground mb-1">
              Revenue by payment
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {getDisplayLabel(range)}, paid orders only
            </p>
            {paymentBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No paid orders.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground border-b pb-1 mb-1">
                  <span>Method</span>
                  <span>Revenue / Orders</span>
                </div>
                {paymentBreakdown.map((p) => (
                  <div
                    key={p.method}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {paymentLabel(p.method)}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-foreground">
                        {formatMoney(p.revenueGhs)}
                      </span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({p.count})
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm border-t pt-2 mt-1">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-bold text-foreground">
                    {formatMoney(totalPaidRevenueGhs)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-6 flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">
              Order sources
            </p>
            {sourcePieData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No data.
              </p>
            ) : (
              <ChartContainer config={sourceConfig} className="h-32 w-full">
                <PieChart>
                  <Pie
                    data={sourcePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={50}
                    label={({ name, percent }) =>
                      `${name as string} ${((percent as number) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {sourcePieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top products + Top toppings */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-base font-semibold text-foreground">
            Top products
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {selectedBranch === "all"
              ? "By units sold across all branches"
              : `By units sold at ${selectedBranch}`}
          </p>
          {activeTopProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer config={productConfig} className="h-64 w-full">
              <BarChart data={activeTopProducts} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  horizontal={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="qty"
                  fill="var(--color-chart-1)"
                  radius={[0, 4, 4, 0]}
                  name="Units sold"
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        {/* Top toppings */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-base font-semibold text-foreground">
            Top toppings
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Most frequently added to orders
          </p>
          {activeTopToppings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer config={toppingConfig} className="h-64 w-full">
              <BarChart data={activeTopToppings} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  horizontal={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="qty"
                  fill="var(--color-chart-5)"
                  radius={[0, 4, 4, 0]}
                  name="Times ordered"
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* Shawarma Sales */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">
              Shawarma Sales
            </p>
            <p className="text-sm text-muted-foreground">
              Breakdown by product and size &mdash; {getDisplayLabel(range)}
              {selectedBranch !== "all" ? ` · ${selectedBranch}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total sold</div>
            <div className="text-lg font-bold text-foreground">
              {totalShawarmasSold}
            </div>
          </div>
        </div>

        {Object.keys(shawarmaBySize).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(shawarmaBySize)
              .sort((a, b) => b[1] - a[1])
              .map(([size, qty]) => (
                <div
                  key={size}
                  className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{size}:</span>
                  <span className="font-bold text-foreground">{qty}</span>
                </div>
              ))}
          </div>
        )}

        {shawarmaItemStats.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No shawarma orders for {getDisplayLabel(range).toLowerCase()}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shawarmaItemStats.map((s) => (
                  <TableRow key={`${s.productName}__${s.variantLabel}`}>
                    <TableCell className="font-medium">
                      {s.productName}
                    </TableCell>
                    <TableCell>
                      <SizeBadge size={s.variantLabel} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {s.qty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(s.revenueGhs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Teller analytics */}
      <div className="space-y-4">
        <div>
          <p className="text-xl font-semibold text-foreground">
            Teller analytics
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Who is working, how many orders they have processed, and their
            revenue.
          </p>
        </div>

        {activeTellerStats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No tellers added yet.
          </p>
        ) : (
          <>
            {/* Teller bar chart — orders by teller */}
            <div className="rounded-lg border bg-card p-6">
              <p className="text-base font-semibold text-foreground">
                Orders by teller
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Total orders processed per staff member (all time)
              </p>
              <ChartContainer
                config={{
                  orders: { label: "Orders", color: "var(--color-chart-2)" },
                }}
                className="h-52 w-full"
              >
                <BarChart data={activeTellerStats.filter((t) => t.orders > 0)}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={36}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="orders"
                    fill="var(--color-chart-2)"
                    radius={[4, 4, 0, 0]}
                    name="Orders"
                  />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Teller detail table */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teller</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">All time</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg / order</TableHead>
                    <TableHead className="text-right">Last order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTellerStats.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {t.branch}
                      </TableCell>
                      <TableCell>
                        {t.isActive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 border-0 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.ordersToday > 0 ? (
                          <span className="font-semibold text-foreground">
                            {t.ordersToday}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{t.orders}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(t.revenueGhs)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(
                          t.orders > 0 ? t.revenueGhs / t.orders : 0,
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {t.lastOrderAt
                          ? new Date(t.lastOrderAt).toLocaleDateString(
                              "en-GH",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
      {/* Customer insights */}
      {customerStats.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-xl font-semibold text-foreground">
              Customer insights
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Based on phone number. Returning customers have placed more than
              one order.
            </p>
          </div>

          {/* Summary KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Total customers
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {customerStats.length}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Returning customers
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {customerStats.filter((c) => c.isReturning).length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {customerStats.length > 0
                  ? `${Math.round((customerStats.filter((c) => c.isReturning).length / customerStats.length) * 100)}% retention`
                  : ""}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Top spender
              </p>
              <p className="mt-2 text-xl font-bold text-foreground truncate">
                {[...customerStats].sort(
                  (a, b) => b.totalSpendGhs - a.totalSpendGhs,
                )[0]?.name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMoney(
                  [...customerStats].sort(
                    (a, b) => b.totalSpendGhs - a.totalSpendGhs,
                  )[0]?.totalSpendGhs ?? 0,
                )}{" "}
                total
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">
                Most frequent
              </p>
              <p className="mt-2 text-xl font-bold text-foreground truncate">
                {customerStats[0]?.name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {customerStats[0]?.orders ?? 0} orders
              </p>
            </div>
          </div>

          {/* Top customers table */}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total spend</TableHead>
                  <TableHead className="text-right">Avg / order</TableHead>
                  <TableHead className="text-right">Last order</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerStats.slice(0, 20).map((c) => (
                  <TableRow key={c.phone}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {c.phone}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {c.orders}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(c.totalSpendGhs)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(c.avgOrderGhs)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString("en-GH", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {c.isReturning ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 border-0 text-xs">
                          Returning
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          New
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
