import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import type { OrderWithItems } from "@/lib/database.types";
import OrdersClient from "./orders-client";

async function fetchOrders(): Promise<OrderWithItems[]> {
  const supabase = createAdminClient();
  return fetchAllPages<OrderWithItems>((from, to) =>
    supabase
      .from("orders")
      .select(
        `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
      )
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{
      data: OrderWithItems[] | null;
      error: { message: string } | null;
    }>,
  );
}

export default async function OrdersPage() {
  const orders = await fetchOrders();
  return (
    <Suspense>
      <OrdersClient initialOrders={orders} />
    </Suspense>
  );
}
