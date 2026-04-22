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
};

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

export default function DashboardClient({ orders, products, toppings }: Props) {
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
    (searchParams.get("range") as RangeKey) ?? "7d",
  );
  const now = new Date();

  const cutoff = getRangeCutoff(range, now);
  const rangeOrders = orders.filter((o) =>
    o.created_at ? new Date(o.created_at) >= cutoff : false,
  );
  const rangeRevenuePaid = rangeOrders
    .filter((o) => o.payment_status === "paid")
    .reduce((acc, o) => acc + pesewasToGhs(o.total_pesewas), 0);

  const openOrders = orders.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "confirmed" ||
      o.status === "preparing",
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
    getDate: (o) => new Date(o.created_at ?? Date.now()),
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
  const rangeLabel = getRangeLabel(range);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome to BubbleBliss Cafe Admin. Manage your orders, products, and
            operations.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Time range</span>
          <RangeSelect
            value={range}
            onValueChange={(v) => {
              setRange(v);
              syncToUrl({ range: v === "7d" ? null : v });
            }}
          />
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Orders
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {rangeOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Revenue: {formatMoney(rangeRevenuePaid)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Open Orders
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {openOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pending + Preparing
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Active Products
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {activeProducts.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {outOfStockProducts.length} out of stock
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Completed
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(revenueDelivered)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            From {deliveredOrders.length} delivered orders
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Avg Order Value
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(avgOrderValue)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Out of Stock
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {outOfStockProducts.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {outOfStockToppings.length} toppings also out
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
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

      {/* Recent Orders */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <div className="text-base font-semibold text-foreground">
            Recent Orders
          </div>
          <div className="text-sm text-muted-foreground">
            Latest 10 orders across all branches.
          </div>
        </div>
        <Table>
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
  );
}
