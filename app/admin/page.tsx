import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import type { OrderWithItems } from "@/lib/database.types";
import DashboardClient from "./dashboard-client";

async function fetchDashboardData() {
  const supabase = createAdminClient();

  const [ordersResult, productsResult, toppingsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("products").select("id, is_active, in_stock"),
    supabase.from("toppings").select("id, is_active, in_stock"),
  ]);

  return {
    orders: (ordersResult.data ?? []) as OrderWithItems[],
    products: productsResult.data ?? [],
    toppings: toppingsResult.data ?? [],
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
