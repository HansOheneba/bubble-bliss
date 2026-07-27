import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/supabase-fetch";
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

  // Accept email/slug from query params OR JSON body (some clients send body with GET)
  let posUserEmail = searchParams.get("pos_user_email");
  let branchSlug = searchParams.get("branchSlug");

  if (!posUserEmail && !branchSlug) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (typeof body.pos_user_email === "string")
        posUserEmail = body.pos_user_email;
      if (typeof body.branchSlug === "string") branchSlug = body.branchSlug;
    } catch {
      // no body or non-JSON body — that's fine, just use query params
    }
  }

  const db = createAdminClient();

  // ── Resolve branch ────────────────────────────────────────────────────────
  let branchId: number | null = null;

  if (posUserEmail) {
    const { data: posUserData } = await db
      .from("pos_users")
      .select("branch_id, is_active")
      .ilike("email", posUserEmail)
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

  let rawOrders: RawOrder[] = [];
  let rawCategories: { id: number; slug: string }[] | null = null;

  try {
    const [orders, categoriesResult] = await Promise.all([
      fetchAllPages<RawOrder>((from, to) => {
        let query = db
          .from("orders")
          .select(
            "total_pesewas, payment_method, items:order_items(product_id, quantity)",
          )
          .in("status", ["paid", "completed"])
          .gte("created_at", todayStart.toISOString())
          .order("created_at", { ascending: false })
          .range(from, to);

        if (branchId !== null) {
          query = query.eq("branch_id", branchId);
        }

        return query as unknown as PromiseLike<{
          data: RawOrder[] | null;
          error: { message: string } | null;
        }>;
      }),
      db.from("categories").select("id, slug"),
    ]);
    rawOrders = orders;
    rawCategories = categoriesResult.data as
      | { id: number; slug: string }[]
      | null;
  } catch (err) {
    console.error("POS analytics fetch error:", err);
    return NextResponse.json(
      { message: "Failed to fetch analytics data" },
      { status: 500 },
    );
  }

  // ── Identify shawarma category ────────────────────────────────────────────
  const shawarmaCategory = rawCategories?.find((c) => c.slug === "shawarma");

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
  const ordersCompleted = rawOrders.length;
  const revenueGhs = rawOrders.reduce(
    (acc, o) => acc + o.total_pesewas / 100,
    0,
  );

  let cupsUsed = 0;
  for (const o of rawOrders) {
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

  for (const o of rawOrders) {
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
