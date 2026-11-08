"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";

import { Ledger, LedgerRow, Rule } from "@/components/admin/ledger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { clock, money, paymentName, shortDay } from "@/lib/admin/format";
import type { OrderDetail } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

const OPEN = ["pending", "confirmed", "preparing", "ready"];

type Tone = "good" | "attention" | "muted" | "bad";

/** In plain words, and only loud when something needs a look. */
function statusOf(order: OrderDetail, today: string): { label: string; tone: Tone } {
  if (order.status === "cancelled") return { label: "Cancelled", tone: "bad" };
  if (order.payment_status === "failed") return { label: "Payment failed", tone: "bad" };
  if (order.payment_status !== "paid") return { label: "Not paid", tone: "attention" };
  if (order.status && OPEN.includes(order.status)) {
    // Tonight this is normal. From an earlier day, someone forgot to close it.
    return order.created_at?.startsWith(today)
      ? { label: "In progress", tone: "muted" }
      : { label: "Never completed", tone: "attention" };
  }
  return { label: "Completed", tone: "muted" };
}

const TONE: Record<Tone, string> = {
  good: "text-good",
  attention: "text-attention font-medium",
  muted: "text-muted-foreground",
  bad: "text-destructive font-medium",
};

function itemsLine(order: OrderDetail): string {
  return order.items
    .map((item) => (item.quantity > 1 ? `${item.quantity} ${item.product_name}` : item.product_name))
    .join(", ");
}

function itemsTotal(order: OrderDetail): number {
  return order.items.reduce((sum, item) => {
    const toppings = item.toppings.reduce((s, t) => s + t.price_applied_pesewas, 0);
    return sum + (item.unit_pesewas + toppings) * item.quantity;
  }, 0);
}

type PendingChange =
  | { kind: "cancel" }
  | { kind: "paid"; method: "cash" | "momo" };

function OrderSheet({
  order,
  today,
  shawarmaIds,
  onClose,
}: {
  order: OrderDetail | null;
  today: string;
  shawarmaIds: number[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingChange | null>(null);

  function send(body: Record<string, string>) {
    if (!order) return;
    setError(null);
    startSaving(async () => {
      try {
        const response = await fetch(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(data?.message ?? "That did not save. Try again.");
          return;
        }
        router.refresh();
        onClose();
      } catch {
        setError("That did not save. Check your connection and try again.");
      }
    });
  }

  const status = order ? statusOf(order, today) : null;
  const isOpen = order?.status ? OPEN.includes(order.status) : false;
  const isPaid = order?.payment_status === "paid";
  const isCancelled = order?.status === "cancelled";
  const mismatch = order ? itemsTotal(order) !== order.total_pesewas : false;
  const cups = order
    ? order.items.reduce(
        (sum, item) =>
          item.product_id !== null && shawarmaIds.includes(item.product_id) ? sum : sum + item.quantity,
        0,
      )
    : 0;

  return (
    <>
      <Sheet open={order !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex flex-col w-full gap-0 overflow-y-auto sm:max-w-md">
          {order && status && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-2xl font-bold font-display">
                  {order.order_number ?? `#${order.id}`}
                </SheetTitle>
                <SheetDescription>
                  {order.created_at && `${shortDay(order.created_at)} at ${clock(order.created_at)}`}
                  {order.branch && `, ${order.branch.name.replace(" Branch", "")}`}
                </SheetDescription>
                <p className={cn("text-sm", TONE[status.tone])}>{status.label}</p>
              </SheetHeader>

              <div className="flex flex-col flex-1 gap-4 px-4 pb-4">
                <Rule />
                <Ledger>
                  {order.items.map((item) => {
                    const toppings = item.toppings.reduce((s, t) => s + t.price_applied_pesewas, 0);
                    const extras = [
                      item.variant_label,
                      item.sugar_level && `${item.sugar_level} sugar`,
                      item.spice_level && `${item.spice_level} spice`,
                      ...item.toppings.map((t) => t.topping_name),
                    ].filter(Boolean);
                    return (
                      <Fragment key={item.id}>
                        <LedgerRow
                          label={`${item.quantity} ${item.product_name}`}
                          detail={item.quantity > 1 ? `${money(item.unit_pesewas + toppings)} each` : undefined}
                          value={money((item.unit_pesewas + toppings) * item.quantity)}
                        />
                        {extras.length > 0 && (
                          <p className="pb-1 -mt-1 text-xs text-muted-foreground">{extras.join(", ")}</p>
                        )}
                        {item.note && (
                          <p className="pb-1 -mt-1 text-xs text-muted-foreground">Note: {item.note}</p>
                        )}
                      </Fragment>
                    );
                  })}
                  <Rule className="my-1" />
                  <LedgerRow label="Total" value={money(order.total_pesewas)} strong />
                </Ledger>

                {mismatch && (
                  <p className="p-2 text-sm rounded-md bg-attention-soft">
                    The items add up to {money(itemsTotal(order))}, not {money(order.total_pesewas)}.
                    Worth checking with the cashier.
                  </p>
                )}

                <Ledger>
                  <LedgerRow label="Paid by" value={paymentName(order.payment_method)} />
                  <LedgerRow label="Came from" value={order.order_source === "instore" ? "In store" : "Online"} />
                  <LedgerRow label="Cups" value={cups} />
                  {order.teller && <LedgerRow label="Teller" value={order.teller.name} />}
                  {order.customer_name && <LedgerRow label="Customer" value={order.customer_name} />}
                  {order.phone && (
                    <LedgerRow
                      label="Phone"
                      value={
                        <a href={`tel:+${order.phone}`} className="underline underline-offset-4">
                          {order.phone}
                        </a>
                      }
                    />
                  )}
                  {order.location_text && order.location_text !== "In-store" && (
                    <LedgerRow label="Where" value={order.location_text} />
                  )}
                </Ledger>
                {order.notes && <p className="text-sm text-muted-foreground">Note: {order.notes}</p>}

                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

                <div className="flex flex-col gap-2 mt-auto">
                  {!isCancelled && !isPaid && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button disabled={saving} onClick={() => setConfirming({ kind: "paid", method: "cash" })}>
                        Paid with cash
                      </Button>
                      <Button disabled={saving} onClick={() => setConfirming({ kind: "paid", method: "momo" })}>
                        Paid with MoMo
                      </Button>
                    </div>
                  )}
                  {isOpen && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ["confirmed", "Confirmed"],
                          ["preparing", "Preparing"],
                          ["ready", "Ready"],
                        ].map(([value, label]) => (
                          <Button
                            key={value}
                            variant={order.status === value ? "secondary" : "outline"}
                            disabled={saving || order.status === value}
                            onClick={() => send({ status: value })}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <Button disabled={saving} onClick={() => send({ status: "completed" })}>
                        {saving ? "Saving" : "Mark completed"}
                      </Button>
                    </>
                  )}
                  {isCancelled && (
                    <Button variant="outline" disabled={saving} onClick={() => send({ status: "pending" })}>
                      Reopen this order
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={saving}
                      onClick={() => setConfirming({ kind: "cancel" })}
                    >
                      Cancel order
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.kind === "cancel"
                ? "Cancel this order?"
                : `Mark as paid with ${confirming?.kind === "paid" && confirming.method === "cash" ? "cash" : "MoMo"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.kind === "cancel"
                ? isPaid
                  ? `This takes ${order ? money(order.total_pesewas) : ""} out of the takings. It does not refund the customer.`
                  : "It stays in the list as cancelled."
                : `This adds ${order ? money(order.total_pesewas) : ""} to the takings. Only do this if the money has been received.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming?.kind === "cancel") send({ status: "cancelled" });
                if (confirming?.kind === "paid") {
                  send({ paymentStatus: "paid", paymentMethod: confirming.method });
                }
                setConfirming(null);
              }}
            >
              {confirming?.kind === "cancel" ? "Cancel order" : "Yes, it is paid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function OrdersList({
  orders,
  today,
  shawarmaIds,
  groupByDay,
}: {
  orders: OrderDetail[];
  today: string;
  shawarmaIds: number[];
  groupByDay: boolean;
}) {
  // The list refreshes after a change, so only the id is kept here.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <>
      <ul className="flex flex-col border-t border-dashed">
        {orders.map((order, index) => {
          const status = statusOf(order, today);
          const day = order.created_at?.slice(0, 10) ?? "";
          const showDay =
            groupByDay && (index === 0 || orders[index - 1].created_at?.slice(0, 10) !== day);
          const dim = order.status === "cancelled";
          return (
            <Fragment key={order.id}>
              {showDay && order.created_at && (
                <li className="pt-4 pb-1 text-sm font-semibold font-display">
                  {new Date(order.created_at).toLocaleDateString("en-GH", {
                    timeZone: "UTC",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </li>
              )}
              <li className="border-b border-dashed">
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className="block w-full px-1 py-3 text-left rounded-md hover:bg-accent/60 active:!scale-[0.99]"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline min-w-0 gap-2">
                      <span className="font-semibold tabular-nums">{order.order_number ?? `#${order.id}`}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{clock(order.created_at)}</span>
                    </span>
                    <span className={cn("font-semibold tabular-nums shrink-0", dim && "line-through text-muted-foreground")}>
                      {money(order.total_pesewas)}
                    </span>
                  </span>
                  <span className="block mt-0.5 text-sm truncate text-muted-foreground">
                    {itemsLine(order) || "No items"}
                  </span>
                  <span className="flex items-baseline justify-between gap-3 mt-0.5 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {[
                        paymentName(order.payment_method),
                        order.teller?.name,
                        order.customer_name,
                        order.branch?.name.replace(" Branch", ""),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    {status.label !== "Completed" && (
                      <span className={cn("shrink-0", TONE[status.tone])}>{status.label}</span>
                    )}
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ul>

      <OrderSheet order={selected} today={today} shawarmaIds={shawarmaIds} onClose={() => setSelectedId(null)} />
    </>
  );
}
