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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { OrderWithItems } from "@/lib/database.types";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

type Props = {
  initialOrders: OrderWithItems[];
};

function formatMoney(pesewas: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(pesewas / 100);
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
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

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 dark:border dark:border-green-800/50",
  unpaid:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
  failed:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")}
      variant="default"
    >
      {status}
    </Badge>
  );
}

function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(PAYMENT_STYLES[status] ?? "bg-muted text-muted-foreground")}
      variant="default"
    >
      {status}
    </Badge>
  );
}

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["pending"],
};

function statusRank(status: string): number {
  const ranks: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    preparing: 2,
    ready: 3,
    delivered: 4,
    cancelled: 5,
  };
  return ranks[status] ?? 99;
}

export default function OrdersClient({ initialOrders }: Props) {
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

  const [orders, setOrders] = React.useState<OrderWithItems[]>(initialOrders);
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const [selectedStatuses, setSelectedStatuses] = React.useState<OrderStatus[]>(
    (searchParams.get("statuses")?.split(",").filter(Boolean) ??
      []) as OrderStatus[],
  );
  const [selectedBranches, setSelectedBranches] = React.useState<string[]>(
    searchParams.get("branches")?.split(",").filter(Boolean) ?? [],
  );
  const [selectedPayment, setSelectedPayment] = React.useState<string[]>(
    searchParams.get("payment")?.split(",").filter(Boolean) ?? [],
  );
  const [selectedSource, setSelectedSource] = React.useState<string[]>(
    searchParams.get("source")?.split(",").filter(Boolean) ?? [],
  );
  const [sortMode, setSortMode] = React.useState<"queue" | "latest">(
    (searchParams.get("sort") as "queue" | "latest") ?? "queue",
  );
  const [dateRange, setDateRange] = React.useState<
    "all" | "today" | "yesterday" | "7d"
  >(
    (searchParams.get("date") as "all" | "today" | "yesterday" | "7d") ?? "all",
  );
  const [open, setOpen] = React.useState(false);
  const [activeOrderId, setActiveOrderId] = React.useState<number | null>(null);
  const [updatingId, setUpdatingId] = React.useState<number | null>(null);

  const branches = React.useMemo(() => {
    const seen = new Set<string>();
    for (const o of orders) {
      if (o.branch?.name) seen.add(o.branch.name);
    }
    return Array.from(seen);
  }, [orders]);

  const activeOrder = React.useMemo(
    () => orders.find((o) => o.id === activeOrderId) ?? null,
    [orders, activeOrderId],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const results = orders.filter((o) => {
      if (q) {
        const searchable = [
          o.order_number ?? "",
          o.customer_name ?? "",
          o.phone,
          o.location_text,
          o.branch?.name ?? "",
          ...(o.items?.map((i) => i.product_name) ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes((o.status ?? "pending") as OrderStatus)
      )
        return false;
      if (
        selectedBranches.length > 0 &&
        !selectedBranches.includes(o.branch?.name ?? "")
      )
        return false;
      if (
        selectedPayment.length > 0 &&
        !selectedPayment.includes(o.payment_status ?? "")
      )
        return false;
      if (
        selectedSource.length > 0 &&
        !selectedSource.includes(o.order_source ?? "")
      )
        return false;

      // Date range filter
      if (dateRange !== "all") {
        const created = new Date(o.created_at ?? 0);
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        if (dateRange === "today") {
          if (created < todayStart) return false;
        } else if (dateRange === "yesterday") {
          const yStart = new Date(todayStart);
          yStart.setDate(yStart.getDate() - 1);
          if (created < yStart || created >= todayStart) return false;
        } else if (dateRange === "7d") {
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - 7);
          if (created < cutoff) return false;
        }
      }

      return true;
    });

    results.sort((a, b) => {
      const timeA = new Date(a.created_at ?? 0).getTime();
      const timeB = new Date(b.created_at ?? 0).getTime();
      if (sortMode === "latest") return timeB - timeA;
      const rankA = statusRank(a.status ?? "");
      const rankB = statusRank(b.status ?? "");
      if (rankA !== rankB) return rankA - rankB;
      return timeA - timeB;
    });

    return results;
  }, [
    orders,
    query,
    selectedStatuses,
    selectedBranches,
    selectedPayment,
    selectedSource,
    dateRange,
    sortMode,
  ]);

  const hasFilters =
    selectedStatuses.length > 0 ||
    selectedBranches.length > 0 ||
    selectedPayment.length > 0 ||
    selectedSource.length > 0 ||
    dateRange !== "all" ||
    sortMode !== "queue";

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    setUpdatingId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
    }
    setUpdatingId(null);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Queue mode shows oldest active orders first. Click any row to see
          details and update status.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              syncToUrl({ q: e.target.value || null });
            }}
            placeholder="Search by order #, name, phone, items..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                View
                <ChevronDown className="h-4 w-4 opacity-50" />
                <Badge variant="secondary" className="ml-1">
                  {sortMode === "queue" ? "Queue" : "Latest"}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Sort orders</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortMode === "queue"}
                onCheckedChange={() => {
                  setSortMode("queue");
                  syncToUrl({ sort: null });
                }}
              >
                First come first serve
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortMode === "latest"}
                onCheckedChange={() => {
                  setSortMode("latest");
                  syncToUrl({ sort: "latest" });
                }}
              >
                Latest first
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date range filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Date
                <ChevronDown className="h-4 w-4 opacity-50" />
                <Badge variant="secondary" className="ml-1">
                  {dateRange === "all"
                    ? "All time"
                    : dateRange === "today"
                      ? "Today"
                      : dateRange === "yesterday"
                        ? "Yesterday"
                        : "Last 7 days"}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Filter by date</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(
                [
                  ["all", "All time"],
                  ["today", "Today"],
                  ["yesterday", "Yesterday"],
                  ["7d", "Last 7 days"],
                ] as const
              ).map(([val, label]) => (
                <DropdownMenuCheckboxItem
                  key={val}
                  checked={dateRange === val}
                  onCheckedChange={() => {
                    setDateRange(val);
                    syncToUrl({ date: val === "all" ? null : val });
                  }}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
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
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={selectedStatuses.includes(s)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedStatuses, s]
                      : selectedStatuses.filter((x) => x !== s);
                    setSelectedStatuses(next);
                    syncToUrl({ statuses: next.join(",") || null });
                  }}
                >
                  {s}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Branch filter */}
          {branches.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  Branch
                  <ChevronDown className="h-4 w-4 opacity-50" />
                  {selectedBranches.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedBranches.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Filter by branch</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {branches.map((b) => (
                  <DropdownMenuCheckboxItem
                    key={b}
                    checked={selectedBranches.includes(b)}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...selectedBranches, b]
                        : selectedBranches.filter((x) => x !== b);
                      setSelectedBranches(next);
                      syncToUrl({ branches: next.join(",") || null });
                    }}
                  >
                    {b}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Payment filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Payment
                <ChevronDown className="h-4 w-4 opacity-50" />
                {selectedPayment.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedPayment.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Payment status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["paid", "unpaid", "failed"].map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={selectedPayment.includes(p)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedPayment, p]
                      : selectedPayment.filter((x) => x !== p);
                    setSelectedPayment(next);
                    syncToUrl({ payment: next.join(",") || null });
                  }}
                >
                  {p}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Source
                <ChevronDown className="h-4 w-4 opacity-50" />
                {selectedSource.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedSource.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Order source</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["online", "instore"].map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={selectedSource.includes(s)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedSource, s]
                      : selectedSource.filter((x) => x !== s);
                    setSelectedSource(next);
                    syncToUrl({ source: next.join(",") || null });
                  }}
                >
                  {s}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2"
              onClick={() => {
                setSelectedStatuses([]);
                setSelectedBranches([]);
                setSelectedPayment([]);
                setSelectedSource([]);
                setDateRange("all");
                setSortMode("queue");
                syncToUrl({
                  statuses: null,
                  branches: null,
                  payment: null,
                  source: null,
                  date: null,
                  sort: null,
                });
              }}
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
            Showing {filtered.length} order{filtered.length === 1 ? "" : "s"}.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow
                key={order.id}
                className={cn(
                  "cursor-pointer hover:bg-accent/50",
                  activeOrderId === order.id && "bg-accent",
                )}
                onClick={() => {
                  setActiveOrderId(order.id);
                  setOpen(true);
                }}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {order.order_number ?? `#${order.id}`}
                </TableCell>
                <TableCell className="font-medium">
                  {order.customer_name ?? order.phone}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.branch?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      order.order_source === "online"
                        ? "border-blue-500/30 text-blue-700 dark:text-blue-400"
                        : "border-purple-500/30 text-purple-700 dark:text-purple-400",
                    )}
                  >
                    {order.order_source ?? "online"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PaymentBadge status={order.payment_status ?? "unpaid"} />
                </TableCell>
                <TableCell className="font-medium">
                  {formatMoney(order.total_pesewas)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status ?? "pending"} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {timeAgo(order.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOrderId(order.id);
                      setOpen(true);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-muted-foreground"
                >
                  No orders match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Details Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              View order items and update fulfilment status.
            </DialogDescription>
          </DialogHeader>

          {activeOrder ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Order</div>
                  <div className="font-mono font-medium">
                    {activeOrder.order_number ?? `#${activeOrder.id}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <PaymentBadge
                    status={activeOrder.payment_status ?? "unpaid"}
                  />
                  <StatusBadge status={activeOrder.status ?? "pending"} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Customer</div>
                  <div className="font-medium">
                    {activeOrder.customer_name ?? "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{activeOrder.phone}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Branch</div>
                  <div className="font-medium">
                    {activeOrder.branch?.name ?? "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Location</div>
                  <div className="font-medium">{activeOrder.location_text}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Source</div>
                  <div className="font-medium capitalize">
                    {activeOrder.order_source ?? "online"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Placed</div>
                  <div className="font-medium">
                    {timeAgo(activeOrder.created_at)}
                  </div>
                </div>
              </div>

              {activeOrder.notes && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">Note:</span> {activeOrder.notes}
                </div>
              )}

              <Separator />

              {/* Items */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Items</div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrder.items?.map((item) => (
                        <React.Fragment key={item.id}>
                          <TableRow>
                            <TableCell className="font-medium">
                              {item.product_name}
                              {item.variant_label && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({item.variant_label})
                                </span>
                              )}
                              {(item.sugar_level || item.spice_level) && (
                                <div className="text-xs text-muted-foreground">
                                  {[item.sugar_level, item.spice_level]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                              {item.note && (
                                <div className="text-xs text-muted-foreground italic">
                                  {item.note}
                                </div>
                              )}
                              {item.toppings?.map((t) => (
                                <div
                                  key={t.id}
                                  className="text-xs text-muted-foreground"
                                >
                                  + {t.topping_name} (
                                  {formatMoney(t.price_applied_pesewas)})
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(item.unit_pesewas)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(item.unit_pesewas * item.quantity)}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm text-muted-foreground">Order Total</div>
                <div className="text-lg font-semibold">
                  {formatMoney(activeOrder.total_pesewas)}
                </div>
              </div>

              {/* Status actions */}
              <DialogFooter className="gap-2 flex-wrap sm:flex-row">
                {(
                  STATUS_TRANSITIONS[
                    (activeOrder.status ?? "pending") as OrderStatus
                  ] ?? []
                ).map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    variant={nextStatus === "cancelled" ? "outline" : "default"}
                    disabled={updatingId === activeOrder.id}
                    onClick={async () => {
                      await updateOrderStatus(activeOrder.id, nextStatus);
                      setOpen(false);
                    }}
                  >
                    {nextStatus === "cancelled"
                      ? "Cancel order"
                      : nextStatus === "pending"
                        ? "Reopen order"
                        : `Mark as ${nextStatus}`}
                  </Button>
                ))}
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
