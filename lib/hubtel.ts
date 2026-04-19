// ── Phone normalisation ───────────────────────────────────────────────────────

export function normalisePhone(raw: string): string {
  const stripped = raw.replace(/\s+/g, "");
  if (stripped.startsWith("0")) return "233" + stripped.slice(1);
  if (!stripped.startsWith("233")) return "233" + stripped;
  return stripped;
}

// ── Hubtel Payment API ────────────────────────────────────────────────────────

type HubtelInitiateApiResponse = {
  responseCode: string;
  data?: {
    checkoutId: string;
    checkoutUrl: string;
    checkoutDirectUrl: string;
  };
};

export type InitiateCheckoutResult =
  | { checkoutId: string; checkoutUrl: string; checkoutDirectUrl: string }
  | { error: string };

export async function initiateHubtelCheckout(params: {
  totalAmount: number;
  clientReference: string;
  callbackUrl: string;
  returnUrl: string;
  cancellationUrl: string;
  payeeName?: string;
  payeeEmail?: string;
}): Promise<InitiateCheckoutResult> {
  const apiId = process.env.HUBTEL_API_ID;
  const apiKey = process.env.HUBTEL_API_KEY;
  const merchantAccount = process.env.HUBTEL_MERCHANT_ACCOUNT;

  if (!apiId || !apiKey || !merchantAccount) {
    return { error: "Hubtel credentials not configured" };
  }

  const credentials = Buffer.from(`${apiId}:${apiKey}`).toString("base64");

  try {
    const res = await fetch("https://payproxyapi.hubtel.com/items/initiate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        totalAmount: params.totalAmount,
        description: "Bubble Bliss Order",
        callbackUrl: params.callbackUrl,
        returnUrl: params.returnUrl,
        cancellationUrl: params.cancellationUrl,
        merchantAccountNumber: merchantAccount,
        clientReference: params.clientReference,
        payeeName: params.payeeName,
        payeeEmail: params.payeeEmail,
      }),
    });

    const json = (await res.json()) as HubtelInitiateApiResponse;

    if (json.responseCode === "0000" && json.data) {
      return {
        checkoutId: json.data.checkoutId,
        checkoutUrl: json.data.checkoutUrl,
        checkoutDirectUrl: json.data.checkoutDirectUrl,
      };
    }

    return { error: `Hubtel responded with code ${json.responseCode}` };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Hubtel SMS API ────────────────────────────────────────────────────────────

export async function sendSmsConfirmation(phone: string): Promise<void> {
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SENDER_ID;

  if (!clientId || !clientSecret || !senderId) {
    console.warn("Hubtel SMS credentials not configured — skipping SMS");
    return;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const params = new URLSearchParams({
    clientid: clientId,
    clientsecret: clientSecret,
    from: senderId,
    to: phone,
    content:
      "Your Bubble Bliss order has been received and is being prepared! Thank you for ordering with us.",
    registeredDelivery: "true",
  });

  try {
    const res = await fetch(
      `https://smsc.hubtel.com/v1/messages/send?${params.toString()}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
    if (!res.ok) {
      console.error("SMS send failed with status:", res.status);
    }
  } catch (err) {
    console.error("SMS send threw:", err);
  }
}
