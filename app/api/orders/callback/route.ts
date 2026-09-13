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

export async function POST(req: NextRequest) {
  let payload: HubtelCallbackPayload;
  try {
    payload = (await req.json()) as HubtelCallbackPayload;
  } catch {
    console.error("Hubtel callback: invalid JSON payload");
    return NextResponse.json({ received: true });
  }

  const clientReference =
    payload.Data?.ClientReference ??
    payload.Data?.clientReference ??
    payload.data?.ClientReference ??
    payload.data?.clientReference ??
    payload.ClientReference ??
    payload.clientReference ??
    null;

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

  const { data: orderData, error: fetchError } = await db
    .from("orders")
    .select("*")
    .eq("client_reference", clientReference)
    .single();

  if (fetchError) {
    console.error("Hubtel callback: order fetch failed", {
      clientReference,
      error: fetchError,
    });
    return NextResponse.json(
      { message: "Failed to load order for callback" },
      { status: 500 },
    );
  }

  const order = orderData as Order | null;

  if (!order) {
    console.warn("Hubtel callback: order not found for ref", clientReference);
    return NextResponse.json({ received: true });
  }

  if (status === "success") {
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
      return NextResponse.json(
        { message: "Failed to record payment" },
        { status: 500 },
      );
    }

    if (order.phone) await sendSmsConfirmation(order.phone);
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
      return NextResponse.json(
        { message: "Failed to record payment failure" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}
