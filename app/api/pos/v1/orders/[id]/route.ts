import { NextRequest, NextResponse } from "next/server";

import { logAdminActionWithEmail } from "@/lib/admin-logger";
import { authenticatePos } from "@/lib/pos/auth";
import { ORDER_SELECT, shapeOrder } from "@/lib/pos/orders";
import { settleIfPaid } from "@/lib/pos/payments";
import { createAdminClient } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

type OrderState = {
  id: number;
  branch_id: number | null;
  client_reference: string;
  total_pesewas: number;
  payment_status: string | null;
  payment_method: string;
  status: string | null;
  phone: string | null;
  order_number: string | null;
};

type Action =
  | { action: "set_status"; status: "preparing" | "ready" | "completed" | "cancelled" }
  | { action: "pay_cash" }
  | { action: "confirm_momo_manually" };

const STATUSES = ["preparing", "ready", "completed", "cancelled"] as const;

async function loadOwnOrder(id: string, branchId: number) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("id, branch_id, client_reference, total_pesewas, payment_status, payment_method, status, phone, order_number")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as OrderState | null;
  // Orders from other branches look exactly like missing ones.
  if (!order || order.branch_id !== branchId) return null;
  return { db, order };
}

async function respondWithOrder(db: ReturnType<typeof createAdminClient>, orderId: number) {
  const { data } = await db.from("orders").select(ORDER_SELECT).eq("id", orderId).single();
  return NextResponse.json({ order: data ? shapeOrder(data) : null });
}

// GET /api/pos/v1/orders/:id[?verify=1] — verify=1 asks Hubtel whether a MoMo order was paid.
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const found = await loadOwnOrder(id, auth.ctx.branch.id);
  if (!found) return NextResponse.json({ message: "Order not found" }, { status: 404 });

  const { db, order } = found;
  let verification: string | null = null;
  if (req.nextUrl.searchParams.get("verify") === "1" && order.payment_method === "momo") {
    verification = await settleIfPaid(db, order);
  }

  const { data } = await db.from("orders").select(ORDER_SELECT).eq("id", order.id).single();
  return NextResponse.json({ order: data ? shapeOrder(data) : null, verification });
}

// PATCH /api/pos/v1/orders/:id — move an order along, or settle an unpaid one.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await context.params;
  const found = await loadOwnOrder(id, auth.ctx.branch.id);
  if (!found) return NextResponse.json({ message: "Order not found" }, { status: 404 });
  const { db, order } = found;
  const now = new Date().toISOString();

  if (body.action === "set_status") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }
    if (body.status !== "cancelled" && order.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Take payment before preparing this order." },
        { status: 409 },
      );
    }
    const { error } = await db
      .from("orders")
      .update({ status: body.status, updated_at: now } as never)
      .eq("id", order.id);
    if (error) {
      console.error("[pos/v1/orders/:id] status update failed", error);
      return NextResponse.json({ message: "Could not update the order" }, { status: 500 });
    }
    if (body.status === "cancelled") {
      await logAdminActionWithEmail(auth.ctx.email, {
        action: "pos.order.cancel",
        description: `Cancelled order ${order.order_number ?? order.id} on the POS (${auth.ctx.branch.name})`,
        metadata: { orderId: order.id, paymentStatus: order.payment_status },
      });
    }
    return respondWithOrder(db, order.id);
  }

  if (body.action === "pay_cash" || body.action === "confirm_momo_manually") {
    if (order.payment_status === "paid") return respondWithOrder(db, order.id);
    if (order.status === "cancelled") {
      return NextResponse.json({ message: "This order was cancelled." }, { status: 409 });
    }
    const method = body.action === "pay_cash" ? "cash" : "momo";
    const { error } = await db
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: method,
        status: "confirmed",
        updated_at: now,
      } as never)
      .eq("id", order.id)
      .neq("payment_status", "paid");
    if (error) {
      console.error("[pos/v1/orders/:id] payment update failed", error);
      return NextResponse.json({ message: "Could not record the payment" }, { status: 500 });
    }
    await logAdminActionWithEmail(auth.ctx.email, {
      action: body.action === "pay_cash" ? "pos.order.pay_cash" : "pos.order.confirm_momo_manually",
      description:
        body.action === "pay_cash"
          ? `Took cash for order ${order.order_number ?? order.id} (${auth.ctx.branch.name})`
          : `Manually confirmed MoMo for order ${order.order_number ?? order.id} (${auth.ctx.branch.name})`,
      metadata: { orderId: order.id, totalPesewas: order.total_pesewas },
    });
    return respondWithOrder(db, order.id);
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
