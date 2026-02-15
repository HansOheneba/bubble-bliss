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
import RangeSelect from "@/components/admin/range-select";

import { ORDERS } from "@/lib/orders";
import { PRODUCTS } from "@/lib/products";
import { CUSTOMERS } from "@/lib/customers";
import {
  buildRangeSeries,
  getRangeLabel,
  getRangeTickStep,
  sparseTickLabel,
  type RangeKey,
} from "@/lib/range-metrics";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(value);
}

function sumOrderTotal(items: (typeof ORDERS)[number]["items"]) {
  return items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AdminPage() {
  const [range, setRange] = React.useState<RangeKey>("7d");
  const now = new Date();

  const ordersToday = ORDERS.filter((o) =>
    isSameDay(new Date(o.createdAt), now),
  );
  const openOrders = ORDERS.filter(
    (o) => o.status === "Pending" || o.status === "Preparing",
  );
  const completedOrders = ORDERS.filter((o) => o.status === "Done");
  const revenueCompleted = completedOrders.reduce(
    (acc, o) => acc + sumOrderTotal(o.items),
    0,
  );
  const avgOrderValue =
    completedOrders.length > 0 ? revenueCompleted / completedOrders.length : 0;

  const activeProducts = PRODUCTS.filter((p) => p.isActive);
  const outOfStockProducts = PRODUCTS.filter((p) => !p.inStock);

  const totalCustomers = CUSTOMERS.length;
  const activeLast30 = CUSTOMERS.filter((c) => {
    const diff = now.getTime() - new Date(c.lastVisit).getTime();
    return diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const recentOrders = ORDERS.slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  const rangeSeries = buildRangeSeries(range, ORDERS, now, {
    getDate: (order) => new Date(order.createdAt),
    getRevenue: (order) =>
      order.status === "Done" ? sumOrderTotal(order.items) : 0,
  });
  const revenueByDay = rangeSeries.map((d) => ({
    label: d.label,
    revenue: d.revenue,
  }));
  const ordersByDay = rangeSeries.map((d) => ({
    label: d.label,
    orders: d.orders,
  }));

  const revenueValues = revenueByDay.map((d) => d.revenue);
  const ordersValues = ordersByDay.map((d) => d.orders);
  const maxRevenue = Math.max(...revenueValues, 1);
  const maxOrders = Math.max(...ordersValues, 1);
  const tickStep = getRangeTickStep(range);
  const rangeLabel = getRangeLabel(range);

  const statusSegments = [
    {
      label: "Done",
      value: completedOrders.length,
      color: "var(--color-chart-1)",
    },
    {
      label: "Preparing",
      value: ORDERS.filter((o) => o.status === "Preparing").length,
      color: "var(--color-chart-2)",
    },
    {
      label: "Pending",
      value: ORDERS.filter((o) => o.status === "Pending").length,
      color: "var(--color-chart-3)",
    },
    {
      label: "Cancelled",
      value: ORDERS.filter((o) => o.status === "Cancelled").length,
      color: "var(--color-chart-4)",
    },
  ];

  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "var(--color-chart-1)",
    },
  };

  const ordersChartConfig = {
    orders: {
      label: "Orders",
      color: "var(--color-chart-3)",
    },
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
          <RangeSelect value={range} onValueChange={setRange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Total Orders Today
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {ordersToday.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Open Orders
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {openOrders.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Active Products
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {activeProducts.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Total Customers
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {totalCustomers}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-foreground">
                Revenue trend (Last {rangeLabel})
              </div>
              <div className="text-sm text-muted-foreground">
                Completed order revenue by day.
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
                  tickFormatter={(value) => value.toLocaleString("en-GH")}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  fill="var(--color-revenue)"
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

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-foreground">
              Orders volume (Last {rangeLabel})
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
                fill="var(--color-orders)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Completed Revenue
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(revenueCompleted)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            From {completedOrders.length} completed orders
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
            Out of Stock Products
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {outOfStockProducts.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Active Customers (30d)
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {activeLast30}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <div className="text-base font-semibold text-foreground">
            Recent Orders
          </div>
          <div className="text-sm text-muted-foreground">
            Latest activity from the orders list.
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {order.status}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(sumOrderTotal(order.items))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("en-GH", {
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
