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
  DropdownMenuItem,
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

import { ChevronDown, Search, X } from "lucide-react";
import { ORDERS, type Order, type OrderStatus } from "@/lib/orders";

function daysAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(price);
}

function calcTotal(order: Order) {
  return order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
}

function statusRankForQueue(status: OrderStatus) {
  // First come first serve priority:
  // Pending first, then Preparing, then Done, then Cancelled (bottom).
  // Within each group, oldest first.
  const rank: Record<OrderStatus, number> = {
    Pending: 0,
    Preparing: 1,
    Done: 2,
    Cancelled: 3,
  };
  return rank[status] ?? 99;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    Pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800/50",
    Preparing:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 dark:border dark:border-blue-800/50",
    Done: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 dark:border dark:border-green-800/50",
    Cancelled:
      "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
  };

  return (
    <Badge className={styles[status]} variant="default">
      {status}
    </Badge>
  );
}

export default function OrdersPage() {
  const [query, setQuery] = React.useState("");
  const [selectedStatuses, setSelectedStatuses] = React.useState<OrderStatus[]>(
    [],
  );

  /**
   * Queue sorting modes:
   * - "queue": first-come-first-serve for active work (Pending -> Preparing -> Done -> Cancelled),
   *            and oldest first within each bucket. This will bubble the oldest *not done yet* to the top.
   * - "latest": newest first (useful if you just want to see recent incoming).
   */
  const [sortMode, setSortMode] = React.useState<"queue" | "latest">("queue");

  // local copy so we can update status in the UI (until you wire API)
  const [orders, setOrders] = React.useState<Order[]>(() =>
    ORDERS.map((o) => ({ ...o })),
  );

  // modal state
  const [open, setOpen] = React.useState(false);
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null);

  const activeOrder = React.useMemo(
    () => orders.find((o) => o.id === activeOrderId) ?? null,
    [orders, activeOrderId],
  );

  const statuses: OrderStatus[] = ["Pending", "Preparing", "Done", "Cancelled"];

  const filteredAndSorted = React.useMemo(() => {
    const results = orders.filter((order) => {
      const q = query.trim().toLowerCase();

      if (q) {
        const itemNames = order.items.map((i) => i.name).join(" ");
        const matchesQuery =
          order.customerName.toLowerCase().includes(q) ||
          order.phone.toLowerCase().includes(q) ||
          order.location.toLowerCase().includes(q) ||
          order.id.toLowerCase().includes(q) ||
          itemNames.toLowerCase().includes(q) ||
          order.status.toLowerCase().includes(q);

        if (!matchesQuery) return false;
      }

      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(order.status)) return false;
      }

      return true;
    });

    results.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();

      if (sortMode === "latest") {
        return timeB - timeA; // newest first
      }

      // queue mode:
      // 1) Pending oldest first at the top
      // 2) Preparing oldest first next
      // 3) Done oldest first
      // 4) Cancelled oldest first at the bottom
      const rankA = statusRankForQueue(a.status);
      const rankB = statusRankForQueue(b.status);

      if (rankA !== rankB) return rankA - rankB;
      return timeA - timeB; // oldest first within same status bucket
    });

    return results;
  }, [orders, query, selectedStatuses, sortMode]);

  const hasActiveFilters = selectedStatuses.length > 0 || sortMode !== "queue";

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSortMode("queue");
  };

  const openOrder = (orderId: string) => {
    setActiveOrderId(orderId);
    setOpen(true);
  };

  const setOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Queue mode is showing the oldest active orders first (Pending →
          Preparing), then Done, then Cancelled.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, ID, items…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Filters + Sorting */}
        <div className="flex flex-wrap gap-2">
          {/* Sort Mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Order view
                <ChevronDown className="h-4 w-4 opacity-50" />
                <Badge variant="secondary" className="ml-1">
                  {sortMode === "queue" ? "Queue" : "Latest"}
                </Badge>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Sort orders</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuCheckboxItem
                checked={sortMode === "queue"}
                onCheckedChange={() => setSortMode("queue")}
              >
                First come first serve (Queue)
              </DropdownMenuCheckboxItem>

              <DropdownMenuCheckboxItem
                checked={sortMode === "latest"}
                onCheckedChange={() => setSortMode("latest")}
              >
                Latest orders first
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Status
                <ChevronDown className="h-4 w-4 opacity-50" />
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedStatuses.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={(checked) => {
                    setSelectedStatuses((prev) =>
                      checked
                        ? [...prev, status]
                        : prev.filter((s) => s !== status),
                    );
                  }}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}

              {selectedStatuses.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSelectedStatuses([])}
                    className="text-sm text-muted-foreground justify-center"
                  >
                    Clear selection
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-2"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableCaption className="text-muted-foreground">
            Showing {filteredAndSorted.length} order
            {filteredAndSorted.length === 1 ? "" : "s"}.
          </TableCaption>

          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="max-w-[220px]">Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredAndSorted.map((order) => {
              const total = calcTotal(order);

              return (
                <TableRow
                  key={order.id}
                  className={`cursor-pointer hover:bg-accent/50 ${
                    activeOrderId === order.id ? "bg-accent" : ""
                  }`}
                  onClick={() => openOrder(order.id)}
                >
                  <TableCell className="font-medium">
                    {order.customerName}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {order.location}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {order.phone}
                  </TableCell>

                  <TableCell className="text-sm max-w-[220px] truncate">
                    {order.items
                      .map(
                        (item) =>
                          `${item.name}${item.notes ? ` (${item.notes})` : ""} x${item.quantity}`,
                      )
                      .join(", ")}
                  </TableCell>

                  <TableCell className="font-medium">
                    {formatPrice(total)}
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {daysAgo(order.createdAt)}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrder(order.id);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No orders match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Order Details Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              Update fulfilment status: start preparing, mark done, or cancel
              (can be reopened if cancelled).
            </DialogDescription>
          </DialogHeader>

          {activeOrder ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Order ID</div>
                  <div className="font-medium">{activeOrder.id}</div>
                </div>
                <StatusBadge status={activeOrder.status} />
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Customer</div>
                  <div className="font-medium">{activeOrder.customerName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{activeOrder.phone}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Location</div>
                  <div className="font-medium">{activeOrder.location}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Items</div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Line total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrder.items.map((item, idx) => {
                        const lineTotal = item.unitPrice * item.quantity;
                        return (
                          <TableRow key={`${activeOrder.id}-${idx}`}>
                            <TableCell className="font-medium">
                              {item.name}
                              {item.notes ? (
                                <div className="text-xs text-muted-foreground">
                                  {item.notes}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPrice(lineTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Placed</div>
                <div className="font-medium">
                  {daysAgo(activeOrder.createdAt)}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">
                  {formatPrice(calcTotal(activeOrder))}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                {activeOrder.status === "Cancelled" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOrderStatus(activeOrder.id, "Pending");
                      setOpen(false);
                    }}
                    className="sm:mr-auto"
                  >
                    Reopen Order
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOrderStatus(activeOrder.id, "Cancelled");
                      setOpen(false);
                    }}
                    disabled={activeOrder.status === "Done"}
                    className="sm:mr-auto"
                  >
                    Cancel Order
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setOrderStatus(activeOrder.id, "Preparing");
                    setOpen(false);
                  }}
                  disabled={
                    activeOrder.status === "Preparing" ||
                    activeOrder.status === "Done" ||
                    activeOrder.status === "Cancelled"
                  }
                >
                  Start Preparing
                </Button>

                <Button
                  onClick={() => {
                    setOrderStatus(activeOrder.id, "Done");
                    setOpen(false);
                  }}
                  disabled={
                    activeOrder.status === "Done" ||
                    activeOrder.status === "Cancelled"
                  }
                >
                  Mark as Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No order selected.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
