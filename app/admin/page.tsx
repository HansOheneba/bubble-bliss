import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { fetchShawarmaProductIdsOrThrow } from "@/lib/shawarma-products";
import { getDayBoundsUtc, ghanaToday } from "@/lib/range-metrics";
import type { OrderWithItems } from "@/lib/database.types";
import DashboardClient, {
  type RecentOrder,
  type StatusCounts,
} from "./dashboard-client";

export const dynamic = "force-dynamic";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_STATUSES = ["pending", "confirmed", "preparing"] as const;

type AdminPageProps = {
  searchParams: Promise<{ date?: string }>;
};

function resolveDashboardDate(value: string | undefined): string {
  if (!value || !DATE_KEY.test(value)) return ghanaToday();
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return ghanaToday();
  }
  return value;
}

function queryError(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function fetchDashboardData(date: string) {
  const supabase = createAdminClient();
  const [dayStart, dayEnd] = getDayBoundsUtc(date);
  const [todayStart, todayEnd] = getDayBoundsUtc(ghanaToday());

  const countStatus = (statuses: readonly string[]) =>
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", [...statuses]);

  const [
    orders,
    recentResult,
    openResult,
    completedResult,
    preparingResult,
    pendingResult,
    cancelledResult,
    readyResult,
    productsResult,
    toppingsResult,
    branchesResult,
    shawarmaProductIds,
  ] = await Promise.all([
    fetchAllPages<OrderWithItems>((from, to) =>
      supabase
        .from("orders")
        .select(
          `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
        )
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{
        data: OrderWithItems[] | null;
        error: { message: string } | null;
      }>,
    ),
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, phone, status, total_pesewas, created_at, branch_id",
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", todayEnd.toISOString())
      .in("status", [...OPEN_STATUSES]),
    countStatus(["completed", "delivered"]),
    countStatus(["preparing"]),
    countStatus(["pending"]),
    countStatus(["cancelled"]),
    countStatus(["ready"]),
    supabase.from("products").select("id, is_active, in_stock"),
    supabase.from("toppings").select("id, is_active, in_stock"),
    supabase.from("branches").select("id, name").order("name"),
    fetchShawarmaProductIdsOrThrow(supabase),
  ]);

  queryError(recentResult.error, "Recent orders");
  queryError(openResult.error, "Open orders");
  queryError(completedResult.error, "Completed orders");
  queryError(preparingResult.error, "Preparing orders");
  queryError(pendingResult.error, "Pending orders");
  queryError(cancelledResult.error, "Cancelled orders");
  queryError(readyResult.error, "Ready orders");
  queryError(productsResult.error, "Products");
  queryError(toppingsResult.error, "Toppings");
  queryError(branchesResult.error, "Branches");

  const statusCounts: StatusCounts = {
    completed: completedResult.count ?? 0,
    preparing: preparingResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    cancelled: cancelledResult.count ?? 0,
    ready: readyResult.count ?? 0,
  };

  const branchRows = (branchesResult.data ?? []) as unknown as {
    id: number;
    name: string;
  }[];
  const branchNameById = new Map(
    branchRows.map((branch) => [branch.id, branch.name]),
  );
  const recentRows = (recentResult.data ?? []) as unknown as {
    id: number;
    order_number: string | null;
    customer_name: string | null;
    phone: string | null;
    status: string | null;
    total_pesewas: number;
    created_at: string | null;
    branch_id: number | null;
  }[];
  const recentOrders: RecentOrder[] = recentRows.map((row) => {
    const branchName =
      row.branch_id === null
        ? null
        : (branchNameById.get(row.branch_id) ?? null);
    return {
      id: row.id,
      order_number: row.order_number,
      customer_name: row.customer_name,
      phone: row.phone,
      status: row.status,
      total_pesewas: row.total_pesewas,
      created_at: row.created_at,
      branch: branchName ? { name: branchName } : null,
    };
  });

  return {
    orders,
    recentOrders,
    openOrderCount: openResult.count ?? 0,
    statusCounts,
    branches: branchRows.map((branch) => branch.name),
    products: productsResult.data ?? [],
    toppings: toppingsResult.data ?? [],
    shawarmaProductIds,
  };
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const date = resolveDashboardDate(params.date);
  const data = await fetchDashboardData(date);
  return (
    <Suspense>
      <DashboardClient {...data} />
    </Suspense>
  );
}
