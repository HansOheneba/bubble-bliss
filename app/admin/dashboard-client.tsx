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
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
  getRangeLabel,
  getDisplayLabel,
  getRangeTickStep,
  sparseTickLabel,
  type RangeKey,
} from "@/lib/range-metrics";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { OrderWithItems } from "@/lib/database.types";

type ProductRow = {
  id: number;
  is_active: boolean | null;
  in_stock: boolean | null;
};
type ToppingRow = {
  id: number;
  is_active: boolean | null;
  in_stock: boolean | null;
};

type Props = {
  orders: OrderWithItems[];
  products: ProductRow[];
  toppings: ToppingRow[];
  shawarmaProductIds: number[];
};

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

function pesewasToGhs(pesewas: number) {
  return pesewas / 100;
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800/50",
    confirmed:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 dark:border dark:border-blue-800/50",
    preparing:
      "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-400 dark:border dark:border-orange-800/50",
    ready:
      "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 dark:border dark:border-green-800/50",
    delivered:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 dark:border dark:border-slate-700/50",
    cancelled:
      "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
  };

  return (
    <Badge
      className={
        styles[status?.toLowerCase()] ?? "bg-muted text-muted-foreground"
      }
      variant="default"
    >
      {status}
    </Badge>
  );
}

export default function DashboardClient({
  orders,
  products,
  toppings,
  shawarmaProductIds,
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

  const branches = [...new Set(orders.map((o) => o.branch?.name ?? "Unknown"))]
    .filter(Boolean)
    .sort();

  const cutoff = getRangeCutoff(range, now);
  const rangeOrders = orders.filter((o) => {
    const inRange = o.created_at ? new Date(o.created_at) >= cutoff : false;
    const inBranch =
      selectedBranch === "all" ||
      (o.branch?.name ?? "Unknown") === selectedBranch;
    return inRange && inBranch;
  });
  const rangeRevenuePaid = rangeOrders
    .filter((o) => o.payment_status === "paid")
    .reduce((acc, o) => acc + pesewasToGhs(o.total_pesewas), 0);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const openOrders = orders.filter(
    (o) =>
      (o.status === "pending" ||
        o.status === "confirmed" ||
        o.status === "preparing") &&
      (o.created_at ? new Date(o.created_at) >= todayStart : false),
  );

  const shawarmaIdSet = new Set(shawarmaProductIds);

  // Revenue breakdown by payment method (paid orders only)
  const revenueByPayment = (() => {
    const map = new Map<string, { ghs: number; count: number }>();
    for (const o of rangeOrders.filter((o) => o.payment_status === "paid")) {
      const method = o.payment_method ?? "hubtel";
      const cur = map.get(method) ?? { ghs: 0, count: 0 };
      cur.ghs += pesewasToGhs(o.total_pesewas);
      cur.count += 1;
      map.set(method, cur);
    }
    return [...map.entries()]
      .map(([method, s]) => ({ method, ...s }))
      .sort((a, b) => b.ghs - a.ghs);
  })();

  // Shawarma analytics
  type ShawarmaItemStat = {
    productName: string;
    variantLabel: string;
    qty: number;
    revenueGhs: number;
  };
  const shawarmaStatMap = new Map<string, ShawarmaItemStat>();
  for (const order of rangeOrders.filter((o) => o.status !== "cancelled")) {
    for (const item of order.items) {
      if (item.product_id !== null && shawarmaIdSet.has(item.product_id)) {
        const variantLabel = item.variant_label ?? "Regular";
        const key = `${item.product_name}__${variantLabel}`;
        const cur = shawarmaStatMap.get(key) ?? {
          productName: item.product_name,
          variantLabel,
          qty: 0,
          revenueGhs: 0,
        };
        cur.qty += item.quantity;
        cur.revenueGhs += (item.unit_pesewas * item.quantity) / 100;
        shawarmaStatMap.set(key, cur);
      }
    }
  }
  const shawarmaItemStats = [...shawarmaStatMap.values()].sort(
    (a, b) => b.qty - a.qty,
  );
  const shawarmaBySize: Record<string, number> = {};
  for (const stat of shawarmaItemStats) {
    shawarmaBySize[stat.variantLabel] =
      (shawarmaBySize[stat.variantLabel] ?? 0) + stat.qty;
  }
  const totalShawarmasSold = shawarmaItemStats.reduce(
    (acc, s) => acc + s.qty,
    0,
  );

  const cupsInRange = rangeOrders
    .filter((o) => o.status === "completed")
    .reduce(
      (acc, o) =>
        acc +
        o.items.reduce(
          (s, item) =>
            s +
            (item.product_id === null || !shawarmaIdSet.has(item.product_id)
              ? (item.quantity ?? 0)
              : 0),
          0,
        ),
      0,
    );

  const deliveredOrders = rangeOrders.filter((o) => o.status === "delivered");
  const revenueDelivered = deliveredOrders.reduce(
    (acc, o) => acc + pesewasToGhs(o.total_pesewas),
    0,
  );

  const avgOrderValue =
    deliveredOrders.length > 0 ? revenueDelivered / deliveredOrders.length : 0;

  const activeProducts = products.filter((p) => p.is_active);
  const outOfStockProducts = products.filter((p) => !p.in_stock);
  const outOfStockToppings = toppings.filter((t) => !t.in_stock);

  // Branch breakdown
  const branchCounts: Record<string, number> = {};
  for (const o of rangeOrders) {
    const branchName = o.branch?.name ?? "Unknown";
    branchCounts[branchName] = (branchCounts[branchName] ?? 0) + 1;
  }

  const recentOrders = orders.slice(0, 10);

  const rangeSeries = buildRangeSeries(range, orders, now, {
    getDate: (o) => new Date(o.created_at ?? now),
    getRevenue: (o) =>
      o.status === "delivered" ? pesewasToGhs(o.total_pesewas) : 0,
  });

  const revenueByDay = rangeSeries.map((d) => ({
    label: d.label,
    revenue: d.revenue,
  }));
  const ordersByDay = rangeSeries.map((d) => ({
    label: d.label,
    orders: d.orders,
  }));

  const maxRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1);
  const maxOrders = Math.max(...ordersByDay.map((d) => d.orders), 1);
  const tickStep = getRangeTickStep(range);

  const statusSegments = [
    {
      label: "Delivered",
      value: orders.filter((o) => o.status === "delivered").length,
      color: "var(--color-chart-1)",
    },
    {
      label: "Preparing",
      value: orders.filter((o) => o.status === "preparing").length,
      color: "var(--color-chart-2)",
    },
    {
      label: "Pending",
      value: orders.filter((o) => o.status === "pending").length,
      color: "var(--color-chart-3)",
    },
    {
      label: "Cancelled",
      value: orders.filter((o) => o.status === "cancelled").length,
      color: "var(--color-chart-4)",
    },
    {
      label: "Ready",
      value: orders.filter((o) => o.status === "ready").length,
      color: "var(--color-chart-5)",
    },
  ];

  const revenueChartConfig = {
    revenue: { label: "Revenue (GHS)", color: "var(--color-chart-1)" },
  };
  const ordersChartConfig = {
    orders: { label: "Orders", color: "var(--color-chart-3)" },
  };
  const statusChartConfig = statusSegments.reduce(
    (acc, seg) => {
      acc[seg.label] = { label: seg.label, color: seg.color };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );
  const statusData = statusSegments.map((seg) => ({
    status: seg.label,
    value: seg.value,
    fill: seg.color,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome to BubbleBliss Cafe Admin. Metrics below are for{" "}
            <span className="font-medium text-foreground">
              {getDisplayLabel(range)}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Branch</span>
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              syncToUrl({ branch: v === "all" ? null : v });
            }}
          >
            <SelectTrigger size="sm" className="min-w-36">
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
          <span className="text-xs text-muted-foreground">Range</span>
          <RangeSelect
            value={range}
            onValueChange={(v) => {
              setRange(v);
              syncToUrl({ range: v === "today" ? null : v });
            }}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/analytics">View Analytics</Link>
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Orders
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {rangeOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Revenue: {formatMoney(rangeRevenuePaid)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Open Orders Today
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {openOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pending + Preparing
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Cups Served
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {cupsInRange}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {getDisplayLabel(range)}, completed orders
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Active Products
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {activeProducts.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {outOfStockProducts.length} out of stock
          </div>
        </div>
        <div className="col-span-2 rounded-lg border bg-card p-4 sm:col-span-1 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Completed
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {deliveredOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {getRangeLabel(range)}
          </div>
        </div>
      </div>

      {/* Revenue + Status charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-foreground">
                Revenue trend ({getDisplayLabel(range)})
              </div>
              <div className="text-sm text-muted-foreground">
                Delivered order revenue.
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Peak</div>
              <div className="text-sm font-semibold text-foreground">
                {formatMoney(maxRevenue)}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <ChartContainer
              config={revenueChartConfig}
              className="h-52 w-full aspect-auto"
            >
              <AreaChart data={revenueByDay} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={12}
                  tickFormatter={(value, index) =>
                    sparseTickLabel(value, index, tickStep)
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) =>
                    value.toLocaleString("en-GH")
                  }
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-base font-semibold text-foreground">
            Order status mix
          </div>
          <div className="text-sm text-muted-foreground">
            Distribution of all orders.
          </div>
          <div className="mt-4">
            <ChartContainer
              config={statusChartConfig}
              className="h-52 w-full aspect-auto"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="status" />}
                />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={48}
                  outerRadius={76}
                  strokeWidth={2}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="status" />}
                />
              </PieChart>
            </ChartContainer>
          </div>
        </div>
      </div>

      {/* Orders Volume Chart */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-foreground">
              Orders volume ({getDisplayLabel(range)})
            </div>
            <div className="text-sm text-muted-foreground">
              Daily order count across all statuses.
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Max</div>
            <div className="text-sm font-semibold text-foreground">
              {maxOrders}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ChartContainer
            config={ordersChartConfig}
            className="h-52 w-full aspect-auto"
          >
            <BarChart data={ordersByDay} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={12}
                tickFormatter={(value, index) =>
                  sparseTickLabel(value, index, tickStep)
                }
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="orders"
                fill="var(--color-chart-3)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Secondary KPI + Branch breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Revenue by Payment
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {formatMoney(rangeRevenuePaid)}
          </div>
          <div className="mt-2 space-y-1">
            {revenueByPayment.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No paid orders
              </div>
            ) : (
              revenueByPayment.map((p) => (
                <div
                  key={p.method}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">
                    {paymentLabel(p.method)}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatMoney(p.ghs)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Avg Order Value
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {formatMoney(avgOrderValue)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Out of Stock
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {outOfStockProducts.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {outOfStockToppings.length} toppings also out
          </div>
        </div>
        <div className="col-span-2 rounded-lg border bg-card p-4 sm:col-span-1 sm:p-6 lg:col-span-1">
          <div className="text-xs font-medium text-muted-foreground sm:text-sm">
            Orders by Branch
          </div>
          <div className="mt-2 space-y-1">
            {Object.entries(branchCounts).map(([branch, count]) => (
              <div
                key={branch}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{branch}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shawarma Sales */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-foreground">
              Shawarma Sales
            </div>
            <div className="text-sm text-muted-foreground">
              Breakdown by product and size for {getDisplayLabel(range)}
            </div>
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

      {/* Recent Orders */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-foreground">
              Recent Orders
            </div>
            <div className="text-sm text-muted-foreground">
              Latest 10 orders across all branches.
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/orders">See all</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-140">
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium font-mono text-xs">
                    {order.order_number ?? `#${order.id}`}
                  </TableCell>
                  <TableCell>{order.customer_name ?? order.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.branch?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status ?? "pending"} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(pesewasToGhs(order.total_pesewas))}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("en-GH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
