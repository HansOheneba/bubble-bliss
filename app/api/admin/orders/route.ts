import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type {
  Order,
  OrderItem,
  OrderItemTopping,
  Branch,
  PosUser,
} from "@/lib/database.types";

type OrderRow = Order & {
  branch: Branch | null;
  items: (OrderItem & { toppings: OrderItemTopping[] })[];
};

// ── Query params ──────────────────────────────────────────────────────────────
// ?pos_user_email=hans@gmail.com  — resolve branch from POS user (preferred for POS)
// ?branchSlug=cape-coast          — filter by branch slug (alternative)
// ?status=pending                 — filter by order status
// ?paymentStatus=unpaid           — filter by payment status
// ?orderSource=instore            — filter by source
// ?limit=50                       — max records (default 50, max 200)
// ?offset=0                       — pagination offset

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const posUserEmail = searchParams.get("pos_user_email");
  const branchSlug = searchParams.get("branchSlug");
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const orderSource = searchParams.get("orderSource");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const db = createAdminClient();

  // Resolve branchId — from POS user email, or from branchSlug
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

  // When scoped to a POS user, only return today's orders
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let query = db
    .from("orders")
    .select(
      `*, branch:branches(*), items:order_items(*, toppings:order_item_toppings(*))`,
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (branchId !== null) query = query.eq("branch_id", branchId);
  if (posUserEmail) query = query.gte("created_at", todayStart.toISOString());
  if (status) query = query.eq("status", status);
  if (paymentStatus) query = query.eq("payment_status", paymentStatus);
  if (orderSource) query = query.eq("order_source", orderSource);

  const { data: rawOrders, error } = await query;

  if (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 },
    );
  }

  const orders = (rawOrders ?? []) as unknown as OrderRow[];

  const shaped = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    clientReference: o.client_reference,
    phone: o.phone,
    customerName: o.customer_name,
    locationText: o.location_text,
    notes: o.notes,
    status: o.status,
    paymentStatus: o.payment_status,
    orderSource: o.order_source,
    totalGhs: o.total_pesewas / 100,
    totalPesewas: o.total_pesewas,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    branch: o.branch
      ? {
          id: o.branch.id,
          slug: o.branch.slug,
          name: o.branch.name,
          email: o.branch.email ?? null,
        }
      : null,
    items: o.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      variantLabel: item.variant_label,
      unitPesewas: item.unit_pesewas,
      quantity: item.quantity,
      sugarLevel: item.sugar_level,
      spiceLevel: item.spice_level,
      note: item.note,
      toppings: item.toppings.map((t) => ({
        id: t.id,
        toppingId: t.topping_id,
        toppingName: t.topping_name,
        basePesewas: t.topping_base_pesewas,
        priceAppliedPesewas: t.price_applied_pesewas,
      })),
    })),
  }));

  return NextResponse.json({
    orders: shaped,
    pagination: {
      limit,
      offset,
      count: shaped.length,
    },
  });
}
