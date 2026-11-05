import { NextRequest, NextResponse } from "next/server";

import { initiateHubtelCheckout } from "@/lib/hubtel";
import { authenticatePos } from "@/lib/pos/auth";
import {
  ORDER_SELECT,
  PosInputError,
  createPosOrder,
  shapeOrder,
  validateOrderInput,
} from "@/lib/pos/orders";
import { posCallbackUrl } from "@/lib/pos/payments";
import { createAdminClient } from "@/lib/supabase";

// GET /api/pos/v1/orders — today's orders at the signed-in branch (Ghana time = UTC).
export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const db = createAdminClient();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("branch_id", auth.ctx.branch.id)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[pos/v1/orders] fetch failed", error);
    return NextResponse.json({ message: "Failed to load orders" }, { status: 500 });
  }

  return NextResponse.json({ orders: (data ?? []).map(shapeOrder) });
}

// POST /api/pos/v1/orders — place an in-store order.
// cash: saved as paid immediately (staff has collected the cash).
// momo: saved unpaid; a Hubtel checkout link is returned for the customer to pay.
export async function POST(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const db = createAdminClient();

  try {
    const input = validateOrderInput(body);
    const created = await createPosOrder(db, auth.ctx.branch.id, input);

    let checkoutUrl: string | null = null;
    let paymentInitError: string | null = null;

    if (input.paymentMethod === "momo") {
      const hubtel = await initiateHubtelCheckout({
        totalAmount: created.totalPesewas / 100,
        clientReference: created.clientReference,
        callbackUrl: posCallbackUrl(),
        returnUrl: `${process.env.HUBTEL_RETURN_URL ?? ""}?ref=${created.clientReference}`,
        cancellationUrl: `${process.env.HUBTEL_CANCEL_URL ?? ""}?ref=${created.clientReference}`,
        payeeName: input.customerName ?? undefined,
      });

      if ("checkoutId" in hubtel) {
        checkoutUrl = hubtel.checkoutUrl;
        await db
          .from("orders")
          .update({ hubtel_checkout_id: hubtel.checkoutId } as never)
          .eq("id", created.orderId);
      } else {
        paymentInitError = "Mobile money could not be started. Take cash instead, or retry.";
        console.error(`[pos/v1/orders] Hubtel initiate failed for ${created.orderId}:`, hubtel.error);
      }
    }

    const { data: full } = await db
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", created.orderId)
      .single();

    return NextResponse.json(
      {
        order: full ? shapeOrder(full) : null,
        checkoutUrl,
        paymentInitError,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PosInputError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    console.error("[pos/v1/orders] create failed", err);
    return NextResponse.json({ message: "Could not save the order. Try again." }, { status: 500 });
  }
}
