import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { normalisePhone, initiateHubtelCheckout } from "@/lib/hubtel";

// ── Request shape ─────────────────────────────────────────────────────────────

type ToppingInput = {
  toppingId: number | string;
};

type ItemInput = {
  productId: number | string;
  variantId?: number | string | null;
  quantity: number;
  sugarLevel?: string | null;
  spiceLevel?: string | null;
  note?: string | null;
  toppings?: ToppingInput[];
};

type CheckoutBody = {
  phone: string;
  locationText: string;
  payeeName?: string;
  payeeEmail?: string;
  notes?: string;
  branchSlug?: string;
  orderSource?: string;
  items: ItemInput[];
};

// ── Processed internals ───────────────────────────────────────────────────────

type ProcessedTopping = {
  toppingId: number;
  toppingName: string;
  basePesewas: number;
  appliedPesewas: number;
};

type ProcessedItem = {
  productId: number;
  variantId: number | null;
  productName: string;
  variantLabel: string | null;
  unitPesewas: number;
  quantity: number;
  sugarLevel: string | null;
  spiceLevel: string | null;
  note: string | null;
  toppings: ProcessedTopping[];
  lineTotalPesewas: number;
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Parse body
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    phone,
    locationText,
    payeeName,
    payeeEmail,
    notes,
    branchSlug,
    orderSource,
    items,
  } = body;

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!phone || typeof phone !== "string") {
    return NextResponse.json(
      { message: "phone is required" },
      { status: 400 }
    );
  }

  if (!locationText || typeof locationText !== "string") {
    return NextResponse.json(
      { message: "locationText is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { message: "items must be a non-empty array" },
      { status: 400 }
    );
  }

  const normalisedPhone = normalisePhone(phone);
  if (!/^233\d{9}$/.test(normalisedPhone)) {
    return NextResponse.json(
      { message: "Invalid phone number — expected 10-digit Ghanaian number" },
      { status: 400 }
    );
  }

  const db = createAdminClient();

  // ── Resolve branch ────────────────────────────────────────────────────────

  let branchId: number | null = null;

  if (branchSlug) {
    const { data: branch } = await db
      .from("branches")
      .select("id, is_active")
      .eq("slug", branchSlug)
      .single();

    if (!branch) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" not found` },
        { status: 400 }
      );
    }
    if (!branch.is_active) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" is currently inactive` },
        { status: 400 }
      );
    }
    branchId = branch.id;
  }

  // ── Process items ─────────────────────────────────────────────────────────

  const processedItems: ProcessedItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const productId = Number(item.productId);

    if (!productId) {
      return NextResponse.json(
        { message: `Item ${i + 1}: productId is required` },
        { status: 400 }
      );
    }

    if (!item.quantity || item.quantity < 1) {
      return NextResponse.json(
        { message: `Item ${i + 1}: quantity must be at least 1` },
        { status: 400 }
      );
    }

    // Fetch + validate product
    const { data: product } = await db
      .from("products")
      .select("id, name, price_in_pesewas, is_active, in_stock")
      .eq("id", productId)
      .single();

    if (!product) {
      return NextResponse.json(
        { message: `Item ${i + 1}: product ${productId} not found` },
        { status: 400 }
      );
    }
    if (!product.is_active) {
      return NextResponse.json(
        {
          message: `Item ${i + 1}: product "${product.name}" is not currently available`,
        },
        { status: 400 }
      );
    }
    if (!product.in_stock) {
      return NextResponse.json(
        { message: `Item ${i + 1}: product "${product.name}" is out of stock` },
        { status: 400 }
      );
    }

    // Resolve variant + unit price
    let variantId: number | null = null;
    let variantLabel: string | null = null;
    let unitPesewas: number;

    if (item.variantId) {
      const vid = Number(item.variantId);
      const { data: variant } = await db
        .from("product_variants")
        .select("id, label, price_in_pesewas, product_id")
        .eq("id", vid)
        .single();

      if (!variant || variant.product_id !== productId) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: variant ${vid} not found for product ${productId}`,
          },
          { status: 400 }
        );
      }

      variantId = variant.id;
      variantLabel = variant.label;
      unitPesewas = variant.price_in_pesewas;
    } else if (product.price_in_pesewas !== null) {
      unitPesewas = product.price_in_pesewas;
    } else {
      return NextResponse.json(
        {
          message: `Item ${i + 1}: product "${product.name}" requires a size variant to be selected`,
        },
        { status: 400 }
      );
    }

    // Process toppings — first one is always free
    const processedToppings: ProcessedTopping[] = [];
    const inputToppings = item.toppings ?? [];

    for (let t = 0; t < inputToppings.length; t++) {
      const toppingId = Number(inputToppings[t].toppingId);

      const { data: topping } = await db
        .from("toppings")
        .select("id, name, price_in_pesewas, is_active, in_stock")
        .eq("id", toppingId)
        .single();

      if (!topping) {
        return NextResponse.json(
          { message: `Item ${i + 1}: topping ${toppingId} not found` },
          { status: 400 }
        );
      }
      if (!topping.is_active) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: topping "${topping.name}" is not currently available`,
          },
          { status: 400 }
        );
      }
      if (!topping.in_stock) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: topping "${topping.name}" is out of stock`,
          },
          { status: 400 }
        );
      }

      processedToppings.push({
        toppingId: topping.id,
        toppingName: topping.name,
        basePesewas: topping.price_in_pesewas,
        appliedPesewas: t === 0 ? 0 : topping.price_in_pesewas, // first topping free
      });
    }

    const toppingTotal = processedToppings.reduce(
      (sum, t) => sum + t.appliedPesewas,
      0
    );
    const lineTotalPesewas = (unitPesewas + toppingTotal) * item.quantity;

    processedItems.push({
      productId,
      variantId,
      productName: product.name,
      variantLabel,
      unitPesewas,
      quantity: item.quantity,
      sugarLevel: item.sugarLevel ?? null,
      spiceLevel: item.spiceLevel ?? null,
      note: item.note ?? null,
      toppings: processedToppings,
      lineTotalPesewas,
    });
  }

  const totalPesewas = processedItems.reduce(
    (sum, item) => sum + item.lineTotalPesewas,
    0
  );

  // ── Generate client reference ─────────────────────────────────────────────

  const clientReference = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 32);

  // ── Insert order ──────────────────────────────────────────────────────────

  const now = new Date().toISOString();

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      phone: normalisedPhone,
      customer_name: payeeName ?? null,
      location_text: locationText,
      notes: notes ?? null,
      status: "pending",
      payment_status: "unpaid",
      total_pesewas: totalPesewas,
      client_reference: clientReference,
      branch_id: branchId,
      order_source: orderSource ?? "online",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Order insert error:", orderError);
    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 }
    );
  }

  const orderId = order.id;
  const orderNumber = `BB-${orderId}`;

  // Set order_number now that we have the id
  await db
    .from("orders")
    .update({ order_number: orderNumber })
    .eq("id", orderId);

  // ── Insert order_items + order_item_toppings ──────────────────────────────

  for (const item of processedItems) {
    const { data: orderItem, error: itemError } = await db
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        variant_label: item.variantLabel,
        unit_pesewas: item.unitPesewas,
        quantity: item.quantity,
        sugar_level: item.sugarLevel,
        spice_level: item.spiceLevel,
        note: item.note,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      console.error("Order item insert error:", itemError);
      continue; // order is saved — don't fail the whole request
    }

    if (item.toppings.length > 0) {
      const { error: toppingError } = await db
        .from("order_item_toppings")
        .insert(
          item.toppings.map((t) => ({
            order_item_id: orderItem.id,
            topping_id: t.toppingId,
            topping_name: t.toppingName,
            topping_base_pesewas: t.basePesewas,
            price_applied_pesewas: t.appliedPesewas,
          }))
        );

      if (toppingError) {
        console.error("Topping insert error:", toppingError);
      }
    }
  }

  // ── Initiate Hubtel checkout ──────────────────────────────────────────────

  const callbackUrl = process.env.HUBTEL_CALLBACK_URL ?? "";
  const baseReturnUrl = process.env.HUBTEL_RETURN_URL ?? "";
  const baseCancelUrl = process.env.HUBTEL_CANCEL_URL ?? "";

  const hubtelResult = await initiateHubtelCheckout({
    totalAmount: totalPesewas / 100,
    clientReference,
    callbackUrl,
    returnUrl: `${baseReturnUrl}?ref=${clientReference}`,
    cancellationUrl: `${baseCancelUrl}?ref=${clientReference}`,
    payeeName,
    payeeEmail,
  });

  if ("checkoutId" in hubtelResult) {
    await db
      .from("orders")
      .update({ hubtel_checkout_id: hubtelResult.checkoutId })
      .eq("id", orderId);
  } else {
    console.error("Hubtel initiate error:", hubtelResult.error);
  }

  // ── Respond ───────────────────────────────────────────────────────────────

  return NextResponse.json({
    orderId,
    orderNumber,
    clientReference,
    status: "pending",
    totalGhs: totalPesewas / 100,
    totalPesewas,
    message: "Order placed successfully",
    checkoutUrl: "checkoutId" in hubtelResult ? hubtelResult.checkoutUrl : null,
    checkoutDirectUrl:
      "checkoutId" in hubtelResult ? hubtelResult.checkoutDirectUrl : null,
  });
}
