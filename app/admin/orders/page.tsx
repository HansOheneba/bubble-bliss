import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { fetchShawarmaProductIdsOrThrow } from "@/lib/shawarma-products";
import type { OrderWithItems } from "@/lib/database.types";
import OrdersClient from "./orders-client";

// The default view is bounded so this page stays fast as orders grow. Eight days
// covers the Today, Yesterday and Last 7 days filters, which run in the browser.
const RECENT_DAYS = 8;
const OPEN_STATUSES = "pending,confirmed,preparing,ready";

type OrdersPageProps = {
  searchParams: Promise<{ date?: string }>;
};

async function fetchOrdersPageData(loadAll: boolean) {
  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [orders, shawarmaProductIds] = await Promise.all([
    fetchAllPages<OrderWithItems>((from, to) => {
      const query = supabase
        .from("orders")
        .select(
          `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      // Older orders that are still open must never drop out of the queue.
      const scoped = loadAll
        ? query
        : query.or(
            `created_at.gte.${cutoff},status.in.(${OPEN_STATUSES})`,
          );

      return scoped as unknown as PromiseLike<{
        data: OrderWithItems[] | null;
        error: { message: string } | null;
      }>;
    }),
    fetchShawarmaProductIdsOrThrow(supabase),
  ]);

  return { orders, shawarmaProductIds };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { date } = await searchParams;
  const loadAll = date === "all";
  const { orders, shawarmaProductIds } = await fetchOrdersPageData(loadAll);
  return (
    <Suspense>
      <OrdersClient
        key={loadAll ? "all" : "recent"}
        initialOrders={orders}
        shawarmaProductIds={shawarmaProductIds}
      />
    </Suspense>
  );
}
