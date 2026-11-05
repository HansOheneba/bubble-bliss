import type { SupabaseClient } from "@supabase/supabase-js";

import { sendSmsConfirmation } from "@/lib/hubtel";
import type { Database } from "@/lib/database.types";

// Payment verification for the v1 POS API. An order is only ever marked paid
// after Hubtel's own Transaction Status API confirms it, never on the word of
// an incoming callback alone.

type Db = SupabaseClient<Database>;

export type HubtelVerification =
  | { state: "paid"; amountGhs: number; transactionId: string | null }
  | { state: "unpaid" }
  | { state: "unknown"; reason: string };

type HubtelStatusResponse = {
  responseCode?: string;
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    transactionId?: string | null;
    clientReference?: string;
  };
};

export async function verifyHubtelPayment(clientReference: string): Promise<HubtelVerification> {
  const apiId = process.env.HUBTEL_API_ID;
  const apiKey = process.env.HUBTEL_API_KEY;
  const merchantAccount = process.env.HUBTEL_MERCHANT_ACCOUNT;
  if (!apiId || !apiKey || !merchantAccount) {
    return { state: "unknown", reason: "Hubtel credentials not configured" };
  }

  const credentials = Buffer.from(`${apiId}:${apiKey}`).toString("base64");
  const url = `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(merchantAccount)}/status?clientReference=${encodeURIComponent(clientReference)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { state: "unknown", reason: `Hubtel status HTTP ${res.status}` };

    const json = (await res.json()) as HubtelStatusResponse;
    const status = json.data?.status?.toLowerCase();
    if (json.responseCode === "0000" && status === "paid") {
      return {
        state: "paid",
        amountGhs: Number(json.data?.amount ?? 0),
        transactionId: json.data?.transactionId ?? null,
      };
    }
    if (status === "unpaid" || status === "pending") return { state: "unpaid" };
    return { state: "unknown", reason: `Hubtel status ${json.responseCode ?? "?"} ${status ?? ""}`.trim() };
  } catch (err) {
    return { state: "unknown", reason: String(err) };
  }
}

type PayableOrder = {
  id: number;
  client_reference: string;
  total_pesewas: number;
  payment_status: string | null;
  status: string | null;
  phone: string | null;
};

/**
 * Checks Hubtel and, if the payment is confirmed for the full amount,
 * marks the order paid. Returns the resulting payment status.
 */
export async function settleIfPaid(db: Db, order: PayableOrder): Promise<"paid" | "unpaid" | "unknown"> {
  if (order.payment_status === "paid") return "paid";
  if (order.status === "cancelled") return "unpaid";

  const result = await verifyHubtelPayment(order.client_reference);
  if (result.state !== "paid") {
    if (result.state === "unknown") {
      console.warn(`[pos/v1] Hubtel verification unavailable for order ${order.id}: ${result.reason}`);
    }
    return result.state;
  }

  const paidPesewas = Math.round(result.amountGhs * 100);
  if (paidPesewas < order.total_pesewas) {
    console.error(
      `[pos/v1] Hubtel amount ${paidPesewas} below order total ${order.total_pesewas} for order ${order.id}`,
    );
    return "unpaid";
  }

  const { data, error } = await db
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .select("id");

  if (error) {
    console.error(`[pos/v1] Failed to mark order ${order.id} paid:`, error);
    return "unknown";
  }

  // Only the request that actually flipped the row sends the SMS.
  if ((data ?? []).length > 0 && order.phone) {
    await sendSmsConfirmation(order.phone);
  }
  return "paid";
}

export function posCallbackUrl(): string {
  if (process.env.POS_V1_HUBTEL_CALLBACK_URL) return process.env.POS_V1_HUBTEL_CALLBACK_URL;
  const legacy = process.env.HUBTEL_CALLBACK_URL;
  if (!legacy) return "";
  try {
    return `${new URL(legacy).origin}/api/pos/v1/payments/callback`;
  } catch {
    return "";
  }
}
