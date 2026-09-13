import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { fetchShawarmaProductIdsOrThrow } from "@/lib/shawarma-products";
import type { OrderWithItems } from "@/lib/database.types";
import OrdersClient from "./orders-client";

async function fetchOrdersPageData() {
  const supabase = createAdminClient();

  const [orders, shawarmaProductIds] = await Promise.all([
    fetchAllPages<OrderWithItems>((from, to) =>
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
    ),
    fetchShawarmaProductIdsOrThrow(supabase),
  ]);

  return { orders, shawarmaProductIds };
}

export default async function OrdersPage() {
  const { orders, shawarmaProductIds } = await fetchOrdersPageData();
  return (
    <Suspense>
      <OrdersClient
        initialOrders={orders}
        shawarmaProductIds={shawarmaProductIds}
      />
    </Suspense>
  );
}
