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
  buildRangeSeries,
  getRangeTickStep,
  sparseTickLabel,
  type RangeKey,
} from "@/lib/range-metrics";
import type {
  SlimOrder,
  BranchStat,
  ProductStat,
  ToppingStat,
  TellerStat,
  PaymentStat,
  SourceStat,
} from "./page";

type Props = {
  slimOrders: SlimOrder[];
  branchStats: BranchStat[];
  topProducts: ProductStat[];
  topToppings: ToppingStat[];
  tellerStats: TellerStat[];
  paymentStats: PaymentStat[];
  sourceStats: SourceStat[];
};

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AnalyticsClient({
  slimOrders,
  branchStats,
  topProducts,
  topToppings,
  tellerStats,
  paymentStats,
  sourceStats,
}: Props) {
  const [range, setRange] = React.useState<RangeKey>("7d");
  const now = new Date();

  // ── KPI computations ────────────────────────────────────────────────────
  const totalOrders = slimOrders.length;
  const totalRevenueGhs = slimOrders.reduce((acc, o) => acc + o.totalGhs, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenueGhs / totalOrders : 0;
  const ordersToday = slimOrders.filter((o) =>
    isSameDay(new Date(o.createdAt), now),
  ).length;

  // ── Range time series ───────────────────────────────────────────────────
  const rangeSeries = buildRangeSeries(range, slimOrders, now, {
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
  const paymentConfig = paymentStats.reduce(
    (acc, s, i) => {
      acc[s.method] = {
        label: s.method.charAt(0).toUpperCase() + s.method.slice(1),
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );
  const sourceConfig = sourceStats.reduce(
    (acc, s, i) => {
      acc[s.source] = {
        label: s.source.charAt(0).toUpperCase() + s.source.slice(1),
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );

  const paymentPieData = paymentStats.map((s, i) => ({
    name: s.method,
    value: s.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const sourcePieData = sourceStats.map((s, i) => ({
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
            All-time performance across branches, products, and tellers.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Trend range</span>
          <RangeSelect value={range} onValueChange={setRange} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {totalOrders}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">All time</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(totalRevenueGhs)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">All time</p>
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
            Orders Today
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {ordersToday}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-GH", {
              month: "short",
              day: "numeric",
            })}
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
          {branchStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer
              config={branchRevenueConfig}
              className="h-52 w-full"
            >
              <BarChart data={branchStats}>
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

        {/* Payment + Source pies stacked */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-card p-6 flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">
              Payment methods
            </p>
            {paymentPieData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No data.
              </p>
            ) : (
              <ChartContainer config={paymentConfig} className="h-32 w-full">
                <PieChart>
                  <Pie
                    data={paymentPieData}
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
                    {paymentPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
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
            By units sold across all branches
          </p>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer config={productConfig} className="h-64 w-full">
              <BarChart data={topProducts} layout="vertical">
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
          {topToppings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer config={toppingConfig} className="h-64 w-full">
              <BarChart data={topToppings} layout="vertical">
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

        {tellerStats.length === 0 ? (
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
                <BarChart data={tellerStats.filter((t) => t.orders > 0)}>
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
                  {tellerStats.map((t) => (
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
    </div>
  );
}
