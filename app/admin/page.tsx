import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { fetchShawarmaProductIdsOrThrow } from "@/lib/shawarma-products";
import type { OrderWithItems } from "@/lib/database.types";
import DashboardClient from "./dashboard-client";

async function fetchDashboardData() {
  const supabase = createAdminClient();

  const [orders, productsResult, toppingsResult, shawarmaProductIds] =
    await Promise.all([
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
      supabase.from("products").select("id, is_active, in_stock"),
      supabase.from("toppings").select("id, is_active, in_stock"),
      fetchShawarmaProductIdsOrThrow(supabase),
    ]);

  return {
    orders,
    products: productsResult.data ?? [],
    toppings: toppingsResult.data ?? [],
    shawarmaProductIds,
  };
}

export default async function AdminPage() {
  const data = await fetchDashboardData();
  return (
    <Suspense>
      <DashboardClient {...data} />
    </Suspense>
  );
}
