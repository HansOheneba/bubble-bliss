import { NextRequest, NextResponse } from "next/server";

import { countCupsInOrder, isRevenueCountable } from "@/lib/order-metrics";
import { authenticatePos } from "@/lib/pos/auth";
import { fetchShawarmaProductIds } from "@/lib/shawarma-products";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { createAdminClient } from "@/lib/supabase";

type RawOrder = {
  total_pesewas: number;
  payment_method: string;
  payment_status: string | null;
  status: string | null;
  items: { product_id: number | null; quantity: number }[];
};

// GET /api/pos/v1/summary — today's takings at the signed-in branch.
// Same rules as /api/admin/analytics so both tablets report identical numbers.
export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const db = createAdminClient();

  let orders: RawOrder[];
  let shawarmaIds: Set<number>;
  try {
    [orders, shawarmaIds] = await Promise.all([
      fetchAllPages<RawOrder>(
        (from, to) =>
          db
            .from("orders")
            .select("total_pesewas, payment_method, payment_status, status, items:order_items(product_id, quantity)")
            .eq("branch_id", auth.ctx.branch.id)
            .eq("payment_status", "paid")
            .neq("status", "cancelled")
            .gte("created_at", todayStart.toISOString())
            .order("created_at", { ascending: false })
            .range(from, to) as unknown as PromiseLike<{
            data: RawOrder[] | null;
            error: { message: string } | null;
          }>,
      ),
      fetchShawarmaProductIds(db),
    ]);
  } catch (err) {
    console.error("[pos/v1/summary] fetch failed", err);
    return NextResponse.json({ message: "Failed to load today's summary" }, { status: 500 });
  }

  const revenueOrders = orders.filter(isRevenueCountable);
  const byMethod = new Map<string, { method: string; orders: number; revenuePesewas: number }>();
  for (const o of revenueOrders) {
    const entry = byMethod.get(o.payment_method) ?? { method: o.payment_method, orders: 0, revenuePesewas: 0 };
    entry.orders += 1;
    entry.revenuePesewas += o.total_pesewas;
    byMethod.set(o.payment_method, entry);
  }

  const cupsUsed = orders.reduce(
    (sum, o) => sum + countCupsInOrder(o.items, shawarmaIds, o.status, o.payment_status),
    0,
  );

  return NextResponse.json({
    date: todayStart.toISOString().slice(0, 10),
    ordersPaid: revenueOrders.length,
    revenuePesewas: revenueOrders.reduce((s, o) => s + o.total_pesewas, 0),
    cupsUsed,
    paymentBreakdown: [...byMethod.values()],
  });
}
