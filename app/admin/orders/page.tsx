import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import type { OrderWithItems } from "@/lib/database.types";
import OrdersClient from "./orders-client";

async function fetchOrders(): Promise<OrderWithItems[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as OrderWithItems[];
}

export default async function OrdersPage() {
  const orders = await fetchOrders();
  return (
    <Suspense>
      <OrdersClient initialOrders={orders} />
    </Suspense>
  );
}
