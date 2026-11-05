import { NextRequest, NextResponse } from "next/server";

import { settleIfPaid } from "@/lib/pos/payments";
import { createAdminClient } from "@/lib/supabase";

// POST /api/pos/v1/payments/callback — Hubtel webhook for orders placed by the v1 POS app.
// The payload is only used to find the order. Whether it is paid is decided by
// asking Hubtel's Transaction Status API, so a forged callback cannot mark anything paid.

type CallbackPayload = {
  Data?: { ClientReference?: string; clientReference?: string };
  data?: { ClientReference?: string; clientReference?: string };
  ClientReference?: string;
  clientReference?: string;
};

export async function POST(req: NextRequest) {
  let payload: CallbackPayload;
  try {
    payload = (await req.json()) as CallbackPayload;
  } catch {
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

  if (!clientReference || typeof clientReference !== "string" || clientReference.length > 64) {
    return NextResponse.json({ received: true });
  }

  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("id, client_reference, total_pesewas, payment_status, status, phone")
    .eq("client_reference", clientReference)
    .maybeSingle();

  const order = data as {
    id: number;
    client_reference: string;
    total_pesewas: number;
    payment_status: string | null;
    status: string | null;
    phone: string | null;
  } | null;

  if (!order) return NextResponse.json({ received: true });

  const result = await settleIfPaid(db, order);
  if (result === "unknown") {
    // Ask Hubtel to retry later; the tablet also re-checks while it waits.
    return NextResponse.json({ received: false }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
