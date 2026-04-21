import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { authenticatePosRequest } from "@/lib/pos-auth";
import type { Order } from "@/lib/database.types";

type PaymentMethod = "hubtel" | "cash" | "momo";
type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";
type PaymentStatus = "unpaid" | "paid" | "failed";

type PatchBody = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  tellerId?: number | null;
  notes?: string | null;
};

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "paid", "failed"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["hubtel", "cash", "momo"];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const posUser = await authenticatePosRequest(req);
  const isAdmin = posUser ? false : await requireAdmin();
  if (!posUser && !isAdmin) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!orderId || isNaN(orderId)) {
    return NextResponse.json({ message: "Invalid order id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { status, paymentStatus, paymentMethod, tellerId, notes } = body;

  // Validate each provided field
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { message: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    paymentStatus !== undefined &&
    !VALID_PAYMENT_STATUSES.includes(paymentStatus)
  ) {
    return NextResponse.json(
      {
        message: `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (
    paymentMethod !== undefined &&
    !VALID_PAYMENT_METHODS.includes(paymentMethod)
  ) {
    return NextResponse.json(
      {
        message: `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Build update payload — only include fields that were provided
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status !== undefined) updates.status = status;
  if (paymentStatus !== undefined) updates.payment_status = paymentStatus;
  if (paymentMethod !== undefined) updates.payment_method = paymentMethod;
  if (tellerId !== undefined) updates.teller_id = tellerId;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { message: "No updatable fields provided" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Verify order exists
  const { data: existing } = await db
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .single();

  if (!existing) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  // Verify teller exists and is active if provided
  if (tellerId != null) {
    const { data: tellerData } = await db
      .from("tellers")
      .select("id, is_active")
      .eq("id", tellerId)
      .single();
    const teller = tellerData as { id: number; is_active: boolean } | null;
    if (!teller) {
      return NextResponse.json(
        { message: `Teller ${tellerId} not found` },
        { status: 400 },
      );
    }
    if (!teller.is_active) {
      return NextResponse.json(
        { message: `Teller ${tellerId} is inactive` },
        { status: 400 },
      );
    }
  }

  const { data: updatedData, error } = await db
    .from("orders")
    .update(updates as never)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error || !updatedData) {
    console.error("Order update error:", error);
    return NextResponse.json(
      { message: "Failed to update order" },
      { status: 500 },
    );
  }

  const order = updatedData as Order;

  return NextResponse.json({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    tellerId: order.teller_id,
    notes: order.notes,
    updatedAt: order.updated_at,
  });
}
