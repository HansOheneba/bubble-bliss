import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import type { OrderWithItems } from "@/lib/database.types";
import DashboardClient from "./dashboard-client";

async function fetchDashboardData() {
  const supabase = createAdminClient();

  const [orders, productsResult, toppingsResult, categoriesResult] =
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
      supabase.from("categories").select("id, slug"),
    ]);

  const shawarmaCategory = (
    categoriesResult.data as { id: number; slug: string }[] | null
  )?.find((c) => c.slug === "shawarma");

  let shawarmaProductIds: number[] = [];
  if (shawarmaCategory) {
    const { data: shawarmaProducts } = await supabase
      .from("products")
      .select("id")
      .eq("category_id", shawarmaCategory.id);
    shawarmaProductIds =
      (shawarmaProducts as { id: number }[] | null)?.map((p) => p.id) ?? [];
  }

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
