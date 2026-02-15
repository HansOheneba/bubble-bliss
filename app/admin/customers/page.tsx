"use client";

import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import { ChevronDown, Search } from "lucide-react";

import {
  CUSTOMERS,
  ORDERS,
  type Customer,
  type CustomerOrder,
  type OrderStatus,
  computeCustomerMetrics,
  daysAgo,
  formatMoney,
  sumOrderTotal,
} from "@/lib/customers";

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30",
    preparing:
      "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30",
    ready:
      "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30",
    completed:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30",
    cancelled:
      "bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30",
  };

  const label =
    status === "pending"
      ? "Pending"
      : status === "preparing"
        ? "Preparing"
        : status === "ready"
          ? "Ready"
          : status === "completed"
            ? "Completed"
            : "Cancelled";

  return (
    <Badge className={styles[status]} variant="default">
      {label}
    </Badge>
  );
}

export default function CustomersPage() {
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<
    "recent" | "lifetimeValue" | "orders"
  >("recent");

  const [customers] = React.useState<Customer[]>(() =>
    CUSTOMERS.map((c) => ({ ...c })),
  );
  const [orders] = React.useState<CustomerOrder[]>(() =>
    ORDERS.map((o) => ({ ...o })),
  );

  const [open, setOpen] = React.useState(false);
  const [activeCustomerId, setActiveCustomerId] = React.useState<string | null>(
    null,
  );

  const [now] = React.useState(() => Date.now());

  const metricsByCustomer = React.useMemo(
    () => computeCustomerMetrics(customers, orders),
    [customers, orders],
  );

  const activeCustomer = React.useMemo(() => {
    if (!activeCustomerId) return null;
    return customers.find((c) => c.id === activeCustomerId) ?? null;
  }, [customers, activeCustomerId]);

  const activeCustomerOrders = React.useMemo(() => {
    if (!activeCustomer) return [];
    return orders
      .filter((o) => o.customerId === activeCustomer.id)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, activeCustomer]);

  const filteredAndSorted = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const results = customers.filter((c) => {
      if (!q) return true;

      const m = metricsByCustomer[c.id];
      const topItems = (m?.topItems ?? [])
        .map((t) => t.name)
        .join(" ")
        .toLowerCase();

      const matches =
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.favoriteItem ?? "").toLowerCase().includes(q) ||
        topItems.includes(q);

      return matches;
    });

    results.sort((a, b) => {
      const am = metricsByCustomer[a.id];
      const bm = metricsByCustomer[b.id];

      if (sortMode === "lifetimeValue")
        return (bm?.lifetimeValue ?? 0) - (am?.lifetimeValue ?? 0);
      if (sortMode === "orders")
        return (bm?.orderCount ?? 0) - (am?.orderCount ?? 0);

      // recent: prefer actual last order time, fallback to customer.lastVisit
      const aRecent = am?.lastOrderAt
        ? new Date(am.lastOrderAt).getTime()
        : new Date(a.lastVisit).getTime();
      const bRecent = bm?.lastOrderAt
        ? new Date(bm.lastOrderAt).getTime()
        : new Date(b.lastVisit).getTime();
      return bRecent - aRecent;
    });

    return results;
  }, [customers, query, sortMode, metricsByCustomer]);

  // Top stats
  const totalCustomers = customers.length;
  const activeLast30 = customers.filter((c) => {
    const diff = now - new Date(c.lastVisit).getTime();
    return diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const totalRevenue = React.useMemo(() => {
    return orders.reduce(
      (acc, o) => (o.status === "completed" ? acc + sumOrderTotal(o) : acc),
      0,
    );
  }, [orders]);

  const avgLtv = React.useMemo(() => {
    if (customers.length === 0) return 0;
    const total = customers.reduce(
      (acc, c) => acc + (metricsByCustomer[c.id]?.lifetimeValue ?? 0),
      0,
    );
    return total / customers.length;
  }, [customers, metricsByCustomer]);

  const openCustomer = (customerId: string) => {
    setActiveCustomerId(customerId);
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Track customers, their order history, and loyalty value.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Total Customers
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {totalCustomers}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Active (Last 30 days)
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {activeLast30}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Avg customer LTV
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">
            {formatMoney(avgLtv)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Based on completed orders.
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Total revenue (completed)
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatMoney(totalRevenue)}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Tip: later you can switch “LTV” to a predictive version (repeat rate
            × AOV × margin).
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, favorite item..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Sort by
                <ChevronDown className="h-4 w-4 opacity-50" />
                <Badge variant="secondary" className="ml-1">
                  {sortMode === "recent"
                    ? "Recent"
                    : sortMode === "lifetimeValue"
                      ? "Top LTV"
                      : "Most orders"}
                </Badge>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Sort customers</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortMode === "recent"}
                onCheckedChange={() => setSortMode("recent")}
              >
                Recent orders
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === "lifetimeValue"}
                onCheckedChange={() => setSortMode("lifetimeValue")}
              >
                Top lifetime value
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === "orders"}
                onCheckedChange={() => setSortMode("orders")}
              >
                Most orders
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableCaption>
            Customers with loyalty and spending overview.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">LTV</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredAndSorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <div className="text-sm text-muted-foreground">
                    No customers match your filters.
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filteredAndSorted.map((customer) => {
              const m = metricsByCustomer[customer.id];
              const orderCount = m?.orderCount ?? 0;
              const ltv = m?.lifetimeValue ?? 0;
              const lastOrderAt = m?.lastOrderAt;

              return (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {customer.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {customer.phone}
                    </div>

                    {m?.topItems?.length ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Top:{" "}
                        {m.topItems.map((t, idx) => (
                          <span key={t.name}>
                            {t.name}
                            {idx < m.topItems.length - 1 ? " • " : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right">{orderCount}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(ltv)}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {lastOrderAt
                      ? daysAgo(lastOrderAt)
                      : daysAgo(customer.lastVisit)}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCustomer(customer.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Details dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer profile</DialogTitle>
            <DialogDescription>
              View details, loyalty value, and full order log.
            </DialogDescription>
          </DialogHeader>

          {activeCustomer ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {activeCustomer.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activeCustomer.phone}
                  </div>
                  {activeCustomer.favoriteItem ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Favorite:{" "}
                      <span className="text-foreground/90">
                        {activeCustomer.favoriteItem}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div />
              </div>

              <Separator />

              {(() => {
                const m = metricsByCustomer[activeCustomer.id];
                const orderCount = m?.orderCount ?? 0;
                const totalSpent = m?.totalSpent ?? 0;
                const avgOrderValue = m?.avgOrderValue ?? 0;
                const ltv = m?.lifetimeValue ?? 0;

                return (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        Orders (completed)
                      </div>
                      <div className="mt-1 text-base font-semibold">
                        {orderCount}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        Total spent
                      </div>
                      <div className="mt-1 text-base font-semibold">
                        {formatMoney(totalSpent)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        Avg order value
                      </div>
                      <div className="mt-1 text-base font-semibold">
                        {formatMoney(avgOrderValue)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs text-muted-foreground">
                        Lifetime value
                      </div>
                      <div className="mt-1 text-base font-semibold">
                        {formatMoney(ltv)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background p-3">
                  <div className="text-xs text-muted-foreground">Joined</div>
                  <div className="mt-1 text-sm">
                    {new Date(activeCustomer.joinedAt).toLocaleDateString(
                      "en-GH",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>
                </div>

                <div className="rounded-md border bg-background p-3">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="mt-1 text-sm">
                    {activeCustomer.notes ?? "No notes yet."}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Order log */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Order log</div>
                  <div className="text-xs text-muted-foreground">
                    {activeCustomerOrders.length} total (includes pending)
                  </div>
                </div>

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[260px]">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeCustomerOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center">
                            <div className="text-sm text-muted-foreground">
                              No orders for this customer yet.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        activeCustomerOrders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">
                              {o.id}
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={o.status} />
                            </TableCell>
                            <TableCell className="w-[260px] max-w-[260px] whitespace-normal break-words text-muted-foreground">
                              {o.items
                                .map((it) => `${it.qty}× ${it.name}`)
                                .join(", ")}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(sumOrderTotal(o))}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {daysAgo(o.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No customer.</div>
          )}

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
