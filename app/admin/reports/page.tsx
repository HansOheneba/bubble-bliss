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
import RangeSelect from "@/components/admin/range-select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ORDERS as ADMIN_ORDERS } from "@/lib/orders";
import { PRODUCTS } from "@/lib/products";
import {
  CUSTOMERS,
  ORDERS as CUSTOMER_ORDERS,
  computeCustomerMetrics,
  formatMoney,
} from "@/lib/customers";
import {
  buildRangeSeries,
  getRangeLabel,
  getRangeTickStep,
  sparseTickLabel,
  type RangeKey,
} from "@/lib/range-metrics";

function sumAdminOrderTotal(order: (typeof ADMIN_ORDERS)[number]) {
  return order.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
}

export default function ReportsPage() {
  const [range, setRange] = React.useState<RangeKey>("30d");
  const completedOrders = ADMIN_ORDERS.filter((o) => o.status === "Done");
  const pendingOrders = ADMIN_ORDERS.filter((o) => o.status === "Pending");
  const preparingOrders = ADMIN_ORDERS.filter((o) => o.status === "Preparing");
  const cancelledOrders = ADMIN_ORDERS.filter((o) => o.status === "Cancelled");

  const totalRevenue = completedOrders.reduce(
    (acc, o) => acc + sumAdminOrderTotal(o),
    0,
  );
  const avgOrderValue =
    completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  const topItems = ADMIN_ORDERS.reduce<Record<string, number>>((acc, o) => {
    for (const item of o.items) {
      acc[item.name] = (acc[item.name] ?? 0) + item.quantity;
    }
    return acc;
  }, {});

  const topItemsList = Object.entries(topItems)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  const now = new Date();
  const rangeSeries = buildRangeSeries(range, ADMIN_ORDERS, now, {
    getDate: (order) => new Date(order.createdAt),
    getRevenue: (order) =>
      order.status === "Done" ? sumAdminOrderTotal(order) : 0,
  });
  const revenueByDay = rangeSeries.map((d) => ({
    label: d.label,
    revenue: d.revenue,
  }));
  const ordersByDay14 = rangeSeries.map((d) => ({
    label: d.label,
    orders: d.orders,
  }));
  const avgValueByPeriod = rangeSeries.map((d) => ({
    label: d.label,
    avg: d.orders > 0 ? d.revenue / d.orders : 0,
  }));
  const revenueValues = revenueByDay.map((d) => d.revenue);
  const orderValues = ordersByDay14.map((d) => d.orders);
  const maxRevenue = Math.max(...revenueValues, 1);
  const maxOrders = Math.max(...orderValues, 1);
  const tickStep = getRangeTickStep(range);
  const rangeLabel = getRangeLabel(range);

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

  const avgOrderValueChartConfig = {
    avg: {
      label: "Avg order value",
      color: "var(--color-chart-2)",
    },
  };

  const productChartConfig = {
    active: { label: "Active", color: "var(--color-chart-1)" },
    inactive: { label: "Inactive", color: "var(--color-chart-2)" },
    outOfStock: { label: "Out of stock", color: "var(--color-chart-4)" },
  };

  const customerChartConfig = {
    withOrders: { label: "With orders", color: "var(--color-chart-1)" },
    withoutOrders: { label: "No orders", color: "var(--color-chart-5)" },
  };

  const productStats = {
    active: PRODUCTS.filter((p) => p.isActive).length,
    inactive: PRODUCTS.filter((p) => !p.isActive).length,
    outOfStock: PRODUCTS.filter((p) => !p.inStock).length,
  };

  const metricsByCustomer = computeCustomerMetrics(CUSTOMERS, CUSTOMER_ORDERS);
  const customersWithOrders = CUSTOMERS.filter(
    (c) => (metricsByCustomer[c.id]?.orderCount ?? 0) > 0,
  ).length;
  const customersWithoutOrders = CUSTOMERS.length - customersWithOrders;
  const productChartData = [
    {
      category: "active",
      value: productStats.active,
      fill: "var(--color-chart-1)",
    },
    {
      category: "inactive",
      value: productStats.inactive,
      fill: "var(--color-chart-2)",
    },
    {
      category: "outOfStock",
      value: productStats.outOfStock,
      fill: "var(--color-chart-4)",
    },
  ];
  const customerChartData = [
    {
      segment: "withOrders",
      value: customersWithOrders,
      fill: "var(--color-chart-1)",
    },
    {
      segment: "withoutOrders",
      value: customersWithoutOrders,
      fill: "var(--color-chart-5)",
    },
  ];
  const topCustomers = CUSTOMERS.map((c) => {
    const m = metricsByCustomer[c.id];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      ltv: m?.lifetimeValue ?? 0,
      orders: m?.orderCount ?? 0,
    };
  })
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 6);

  function formatShortDate(createdAt: string): React.ReactNode {
    return new Date(createdAt).toLocaleDateString("en-GH", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Summary of orders, revenue, and customer performance.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Time range</span>
          <RangeSelect value={range} onValueChange={setRange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Total revenue (completed)
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(totalRevenue)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Avg order value
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(avgOrderValue)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Orders (open)
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {pendingOrders.length + preparingOrders.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pending: {pendingOrders.length} • Preparing:{" "}
            {preparingOrders.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Orders (cancelled)
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {cancelledOrders.length}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Revenue trend (Last {rangeLabel})
              </div>
              <div className="text-xs text-muted-foreground">
                Completed order revenue per day.
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
              className="h-40 w-full aspect-auto"
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

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Order volume (Last {rangeLabel})
              </div>
              <div className="text-xs text-muted-foreground">
                All order statuses combined.
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
              className="h-32 w-full aspect-auto"
            >
              <BarChart data={ordersByDay14} margin={{ left: 8, right: 8 }}>
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Avg order value (Last {rangeLabel})
          </div>
          <div className="mt-4">
            <ChartContainer
              config={avgOrderValueChartConfig}
              className="h-52 w-full aspect-auto"
            >
              <AreaChart
                data={avgValueByPeriod}
                margin={{ left: 12, right: 12 }}
              >
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
                  tickFormatter={(value) => formatMoney(Number(value))}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => formatMoney(Number(value))}
                />
                <Area
                  dataKey="avg"
                  type="monotone"
                  stroke="var(--color-avg)"
                  fill="var(--color-avg)"
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Product availability
          </div>
          <div className="mt-4">
            <ChartContainer
              config={productChartConfig}
              className="h-52 w-full aspect-auto"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="category" />}
                />
                <Pie
                  data={productChartData}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={36}
                  outerRadius={56}
                  strokeWidth={2}
                >
                  {productChartData.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="category" />}
                />
              </PieChart>
            </ChartContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Customers
          </div>
          <div className="mt-4">
            <ChartContainer
              config={customerChartConfig}
              className="h-52 w-full aspect-auto"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="segment" />}
                />
                <Pie
                  data={customerChartData}
                  dataKey="value"
                  nameKey="segment"
                  innerRadius={36}
                  outerRadius={56}
                  strokeWidth={2}
                >
                  {customerChartData.map((entry) => (
                    <Cell key={entry.segment} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="segment" />}
                />
              </PieChart>
            </ChartContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Top items ordered</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topItemsList.map((item) => (
                <TableRow key={item.name}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Top customers by LTV</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">LTV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.orders}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(c.ltv)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 text-sm font-medium">Recent completed orders</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {completedOrders
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .slice(0, 6)
              .map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.id}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(sumAdminOrderTotal(o))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatShortDate(o.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
