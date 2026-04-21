import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { PosUser } from "@/lib/database.types";

// ── Query params ──────────────────────────────────────────────────────────────
// ?pos_user_email=hans@gmail.com  — scope to the teller's branch (preferred)
// ?branchSlug=cape-coast          — scope to a branch by slug (alternative)
// Omit both to get a cross-branch summary for today.
//
// Response:
// {
//   date: "YYYY-MM-DD",
//   ordersCompleted: number,    — paid or completed orders today
//   cupsUsed: number,           — total drink cups consumed today (non-shawarma items)
//   revenueGhs: number          — total revenue from paid or completed orders today (GHS)
//   paymentBreakdown: Array<{
//     method: "cash" | "momo" | "hubtel",
//     orders: number,
//     revenueGhs: number
//   }>
// }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const posUserEmail = searchParams.get("pos_user_email");
  const branchSlug = searchParams.get("branchSlug");

  const db = createAdminClient();

  // ── Resolve branch ────────────────────────────────────────────────────────
  let branchId: number | null = null;

  if (posUserEmail) {
    const { data: posUserData } = await db
      .from("pos_users")
      .select("branch_id, is_active")
      .eq("email", posUserEmail)
      .single();
    const posUser = posUserData as Pick<
      PosUser,
      "branch_id" | "is_active"
    > | null;

    if (!posUser) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" not found` },
        { status: 404 },
      );
    }
    if (!posUser.is_active) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" is inactive` },
        { status: 403 },
      );
    }
    branchId = posUser.branch_id;
  } else if (branchSlug) {
    const { data: branchData } = await db
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .single();
    if (!branchData) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" not found` },
        { status: 404 },
      );
    }
    branchId = (branchData as { id: number }).id;
  }

  // ── Today's date range (UTC) ───────────────────────────────────────────────
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // ── Fetch today's paid/completed orders with their items ────────────────
  type PaymentMethod = "cash" | "momo" | "hubtel";
  type RawItem = { product_id: number | null; quantity: number };
  type RawOrder = {
    total_pesewas: number;
    payment_method: PaymentMethod;
    items: RawItem[];
  };

  let ordersQuery = db
    .from("orders")
    .select(
      "total_pesewas, payment_method, items:order_items(product_id, quantity)",
    )
    .in("status", ["paid", "completed"])
    .gte("created_at", todayStart.toISOString());

  if (branchId !== null) {
    ordersQuery = ordersQuery.eq("branch_id", branchId);
  }

  const [{ data: rawOrders, error: ordersError }, { data: rawCategories }] =
    await Promise.all([ordersQuery, db.from("categories").select("id, slug")]);

  if (ordersError) {
    console.error("POS analytics fetch error:", ordersError);
    return NextResponse.json(
      { message: "Failed to fetch analytics data" },
      { status: 500 },
    );
  }

  // ── Identify shawarma category ────────────────────────────────────────────
  const shawarmaCategory = (
    rawCategories as { id: number; slug: string }[] | null
  )?.find((c) => c.slug === "shawarma");

  // ── Fetch products to determine which are shawarma ────────────────────────
  const shawarmaProductIds = new Set<number>();

  if (shawarmaCategory) {
    const { data: shawarmaProducts } = await db
      .from("products")
      .select("id")
      .eq("category_id", shawarmaCategory.id);

    for (const p of (shawarmaProducts ?? []) as { id: number }[]) {
      shawarmaProductIds.add(p.id);
    }
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const orders = (rawOrders ?? []) as unknown as RawOrder[];

  const ordersCompleted = orders.length;
  const revenueGhs = orders.reduce((acc, o) => acc + o.total_pesewas / 100, 0);

  let cupsUsed = 0;
  for (const o of orders) {
    for (const item of o.items) {
      // A cup is used for every non-shawarma item quantity
      if (
        item.product_id === null ||
        !shawarmaProductIds.has(item.product_id)
      ) {
        cupsUsed += item.quantity;
      }
    }
  }

  // ── Payment method breakdown ──────────────────────────────────────────────
  const methodMap = new Map<
    PaymentMethod,
    { method: PaymentMethod; orders: number; revenueGhs: number }
  >();

  for (const o of orders) {
    const method = o.payment_method;
    const existing = methodMap.get(method);
    const amount = o.total_pesewas / 100;
    if (existing) {
      existing.orders += 1;
      existing.revenueGhs =
        Math.round((existing.revenueGhs + amount) * 100) / 100;
    } else {
      methodMap.set(method, {
        method,
        orders: 1,
        revenueGhs: Math.round(amount * 100) / 100,
      });
    }
  }

  const paymentBreakdown = Array.from(methodMap.values());

  return NextResponse.json({
    date: todayStart.toISOString().split("T")[0],
    ordersCompleted,
    cupsUsed,
    revenueGhs: Math.round(revenueGhs * 100) / 100,
    paymentBreakdown,
  });
}
