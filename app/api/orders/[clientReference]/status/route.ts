import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import {
  hasOrderTotalMismatch,
  orderItemsTotalPesewas,
} from "@/lib/order-metrics";
import type { Order, OrderItem, OrderItemTopping } from "@/lib/database.types";

type OrderWithItems = Order & {
  items: (OrderItem & { toppings: OrderItemTopping[] })[];
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ clientReference: string }> },
) {
  const { clientReference } = await context.params;

  const db = createAdminClient();

  const { data: orderData, error: fetchError } = await db
    .from("orders")
    .select("*, items:order_items(*, toppings:order_item_toppings(*))")
    .eq("client_reference", clientReference)
    .single();

  if (fetchError) {
    console.error("Order status fetch error:", fetchError);
    return NextResponse.json(
      { message: "Failed to load order status" },
      { status: 500 },
    );
  }

  const order = orderData as OrderWithItems | null;

  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  const items = order.items ?? [];
  const itemsTotalPesewas = orderItemsTotalPesewas(items);

  return NextResponse.json({
    status: order.status,
    paymentStatus: order.payment_status,
    totalGhs: order.total_pesewas / 100,
    itemsTotalGhs: itemsTotalPesewas / 100,
    itemCount: items.length,
    hasTotalMismatch: hasOrderTotalMismatch(order.total_pesewas, items),
    createdAt: order.created_at,
  });
}
