import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendSmsConfirmation } from "@/lib/hubtel";
import type { Order } from "@/lib/database.types";

// Hubtel is inconsistent with field casing — handle all variants
type HubtelCallbackPayload = {
  ResponseCode?: string;
  responseCode?: string;
  Data?: {
    ClientReference?: string;
    clientReference?: string;
    Status?: string;
    status?: string;
    Amount?: number;
    TransactionId?: string;
  };
  data?: {
    ClientReference?: string;
    clientReference?: string;
    Status?: string;
    status?: string;
  };
  ClientReference?: string;
  clientReference?: string;
  Status?: string;
  status?: string;
};

// Always return 200 — Hubtel retries on any non-2xx response
export async function POST(req: NextRequest) {
  let payload: HubtelCallbackPayload;
  try {
    payload = (await req.json()) as HubtelCallbackPayload;
  } catch {
    return NextResponse.json({ received: true });
  }

  // Extract clientReference — check every possible location Hubtel might use
  const clientReference =
    payload.Data?.ClientReference ??
    payload.Data?.clientReference ??
    payload.data?.ClientReference ??
    payload.data?.clientReference ??
    payload.ClientReference ??
    payload.clientReference ??
    null;

  // Extract status
  const rawStatus =
    payload.Data?.Status ??
    payload.Data?.status ??
    payload.data?.Status ??
    payload.data?.status ??
    payload.Status ??
    payload.status ??
    null;

  if (!clientReference || !rawStatus) {
    console.warn("Hubtel callback missing clientReference or status", payload);
    return NextResponse.json({ received: true });
  }

  const status = rawStatus.toLowerCase();
  const db = createAdminClient();

  const { data: orderData } = await db
    .from("orders")
    .select("*")
    .eq("client_reference", clientReference)
    .single();
  const order = orderData as Order | null;

  if (!order) {
    // Not found — still 200 so Hubtel stops retrying
    console.warn("Hubtel callback: order not found for ref", clientReference);
    return NextResponse.json({ received: true });
  }

  if (status === "success") {
    // Idempotency — skip if already marked paid
    if (order.payment_status === "paid") {
      return NextResponse.json({ received: true });
    }

    const { error: updateError } = await db
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", order.id);

    if (updateError) {
      console.error("Failed to update order on payment success:", updateError);
    }

    // Non-fatal SMS
    await sendSmsConfirmation(order.phone);
  } else if (status === "failed") {
    const { error: updateError } = await db
      .from("orders")
      .update({
        payment_status: "failed",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", order.id);

    if (updateError) {
      console.error("Failed to update order on payment failure:", updateError);
    }
  }

  return NextResponse.json({ received: true });
}
