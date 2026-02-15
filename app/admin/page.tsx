import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ORDERS } from "@/lib/orders";
import { PRODUCTS } from "@/lib/products";
import { CUSTOMERS } from "@/lib/customers";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(value);
}

function sumOrderTotal(items: typeof ORDERS[number]["items"]) {
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
    completedOrders.length > 0
      ? revenueCompleted / completedOrders.length
      : 0;

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome to BubbleBliss Cafe Admin. Manage your orders, products, and
          operations.
        </p>
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
