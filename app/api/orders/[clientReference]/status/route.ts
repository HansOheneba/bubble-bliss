import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Order } from "@/lib/database.types";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ clientReference: string }> },
) {
  const { clientReference } = await context.params;

  const db = createAdminClient();

  const { data: orderData } = await db
    .from("orders")
    .select("*")
    .eq("client_reference", clientReference)
    .single();
  const order = orderData as Order | null;

  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    paymentStatus: order.payment_status,
    totalGhs: order.total_pesewas / 100,
    createdAt: order.created_at,
  });
}
