import type { OrderItem, OrderItemTopping } from "@/lib/database.types";

export type OrderItemWithToppings = OrderItem & {
  toppings: OrderItemTopping[];
};

type CountableItem = {
  product_id: number | null;
  quantity: number;
};

type OrderLike = {
  status?: string | null;
  payment_status?: string | null;
};

/** Terminal fulfilment statuses that count toward cups and served revenue. */
export const CUP_COUNTABLE_STATUSES = ["completed", "delivered"] as const;

export const REVENUE_PAYMENT_STATUSES = ["paid"] as const;

export function isCupCountableStatus(status: string | null | undefined): boolean {
  return (
    status != null &&
    (CUP_COUNTABLE_STATUSES as readonly string[]).includes(status)
  );
}

export function isPaidOrder(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid";
}

/** Paid, non-cancelled orders count toward POS/day revenue totals. */
export function isRevenueCountable(order: OrderLike): boolean {
  return (
    isPaidOrder(order.payment_status) && order.status !== "cancelled"
  );
}

/** Cups only count once an order is fulfilled (completed/delivered) and paid. */
export function isCupCountableOrder(order: OrderLike): boolean {
  return isCupCountableStatus(order.status) && isPaidOrder(order.payment_status);
}

export function toppingTotalPesewas(
  toppings: Pick<OrderItemTopping, "price_applied_pesewas">[],
): number {
  return toppings.reduce((sum, t) => sum + t.price_applied_pesewas, 0);
}

export function lineTotalPesewas(item: OrderItemWithToppings): number {
  return (
    (item.unit_pesewas + toppingTotalPesewas(item.toppings ?? [])) *
    item.quantity
  );
}

export function orderItemsTotalPesewas(items: OrderItemWithToppings[]): number {
  return items.reduce((sum, item) => sum + lineTotalPesewas(item), 0);
}

export function orderTotalMismatchPesewas(
  totalPesewas: number,
  items: OrderItemWithToppings[],
): number {
  return totalPesewas - orderItemsTotalPesewas(items);
}

export function hasOrderTotalMismatch(
  totalPesewas: number,
  items: OrderItemWithToppings[],
): boolean {
  return orderTotalMismatchPesewas(totalPesewas, items) !== 0;
}

export function countCupsInItems(
  items: CountableItem[],
  shawarmaProductIds: Set<number>,
): number {
  return items.reduce((sum, item) => {
    if (item.product_id === null || !shawarmaProductIds.has(item.product_id)) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);
}

export function countCupsInOrder(
  items: CountableItem[],
  shawarmaProductIds: Set<number>,
  status: string | null | undefined,
  paymentStatus?: string | null,
): number {
  if (paymentStatus !== undefined) {
    if (!isCupCountableOrder({ status, payment_status: paymentStatus })) {
      return 0;
    }
  } else if (!isCupCountableStatus(status)) {
    return 0;
  }

  return countCupsInItems(items, shawarmaProductIds);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100;
}

export function itemRevenueGhs(item: OrderItemWithToppings): number {
  return pesewasToGhs(lineTotalPesewas(item));
}
