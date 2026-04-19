import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { normalisePhone, initiateHubtelCheckout } from "@/lib/hubtel";
import type {
  Branch,
  Product,
  ProductVariant,
  Topping,
} from "@/lib/database.types";

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

type OrderSource = "online" | "instore";

type CheckoutBody = {
  phone: string;
  locationText: string;
  branchSlug: string;
  payeeName?: string;
  payeeEmail?: string;
  notes?: string;
  orderSource?: OrderSource;
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
    return NextResponse.json({ message: "phone is required" }, { status: 400 });
  }

  if (!locationText || typeof locationText !== "string") {
    return NextResponse.json(
      { message: "locationText is required" },
      { status: 400 },
    );
  }

  if (!branchSlug || typeof branchSlug !== "string") {
    return NextResponse.json(
      { message: "branchSlug is required" },
      { status: 400 },
    );
  }

  const validSources: OrderSource[] = ["online", "instore"];
  if (orderSource !== undefined && !validSources.includes(orderSource)) {
    return NextResponse.json(
      { message: 'orderSource must be "online" or "instore"' },
      { status: 400 },
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { message: "items must be a non-empty array" },
      { status: 400 },
    );
  }

  const normalisedPhone = normalisePhone(phone);
  if (!/^233\d{9}$/.test(normalisedPhone)) {
    return NextResponse.json(
      { message: "Invalid phone number — expected 10-digit Ghanaian number" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // ── Resolve branch ────────────────────────────────────────────────────────

  const { data: branchData } = await db
    .from("branches")
    .select("*")
    .eq("slug", branchSlug)
    .single();
  const branch = branchData as Branch | null;

  if (!branch) {
    return NextResponse.json(
      { message: `Branch "${branchSlug}" not found` },
      { status: 400 },
    );
  }
  if (!branch.is_active) {
    return NextResponse.json(
      { message: `Branch "${branchSlug}" is currently inactive` },
      { status: 400 },
    );
  }

  const branchId = branch.id;

  // ── Process items ─────────────────────────────────────────────────────────

  const processedItems: ProcessedItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const productId = Number(item.productId);

    if (!productId) {
      return NextResponse.json(
        { message: `Item ${i + 1}: productId is required` },
        { status: 400 },
      );
    }

    if (!item.quantity || item.quantity < 1) {
      return NextResponse.json(
        { message: `Item ${i + 1}: quantity must be at least 1` },
        { status: 400 },
      );
    }

    // Fetch + validate product
    const { data: productData } = await db
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
    const product = productData as Product | null;

    if (!product) {
      return NextResponse.json(
        { message: `Item ${i + 1}: product ${productId} not found` },
        { status: 400 },
      );
    }
    if (!product.is_active) {
      return NextResponse.json(
        {
          message: `Item ${i + 1}: product "${product.name}" is not currently available`,
        },
        { status: 400 },
      );
    }
    if (!product.in_stock) {
      return NextResponse.json(
        { message: `Item ${i + 1}: product "${product.name}" is out of stock` },
        { status: 400 },
      );
    }

    // Check product is available at this branch
    const { data: prodAvail } = await db
      .from("product_branch_availability")
      .select("branch_id")
      .eq("product_id", productId);
    // No rows = available at all branches; rows present = restricted
    if (prodAvail && prodAvail.length > 0) {
      const availableBranchIds = (prodAvail as { branch_id: number }[]).map(
        (r) => r.branch_id,
      );
      if (!availableBranchIds.includes(branchId)) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: product "${product.name}" is not available at this branch`,
          },
          { status: 400 },
        );
      }
    }

    // Resolve variant + unit price
    let variantId: number | null = null;
    let variantLabel: string | null = null;
    let unitPesewas: number;

    if (item.variantId) {
      const vid = Number(item.variantId);
      const { data: variantData } = await db
        .from("product_variants")
        .select("*")
        .eq("id", vid)
        .single();
      const variant = variantData as ProductVariant | null;

      if (!variant || variant.product_id !== productId) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: variant ${vid} not found for product ${productId}`,
          },
          { status: 400 },
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
        { status: 400 },
      );
    }

    // Process toppings — first one is always free
    const processedToppings: ProcessedTopping[] = [];
    const inputToppings = item.toppings ?? [];

    for (let t = 0; t < inputToppings.length; t++) {
      const toppingId = Number(inputToppings[t].toppingId);

      const { data: toppingData } = await db
        .from("toppings")
        .select("*")
        .eq("id", toppingId)
        .single();
      const topping = toppingData as Topping | null;

      if (!topping) {
        return NextResponse.json(
          { message: `Item ${i + 1}: topping ${toppingId} not found` },
          { status: 400 },
        );
      }
      if (!topping.is_active) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: topping "${topping.name}" is not currently available`,
          },
          { status: 400 },
        );
      }
      if (!topping.in_stock) {
        return NextResponse.json(
          {
            message: `Item ${i + 1}: topping "${topping.name}" is out of stock`,
          },
          { status: 400 },
        );
      }

      // Check topping is available at this branch
      const { data: topAvail } = await db
        .from("topping_branch_availability")
        .select("branch_id")
        .eq("topping_id", toppingId);
      if (topAvail && topAvail.length > 0) {
        const availableBranchIds = (topAvail as { branch_id: number }[]).map(
          (r) => r.branch_id,
        );
        if (!availableBranchIds.includes(branchId)) {
          return NextResponse.json(
            {
              message: `Item ${i + 1}: topping "${topping.name}" is not available at this branch`,
            },
            { status: 400 },
          );
        }
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
      0,
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
    0,
  );

  // ── Generate client reference ─────────────────────────────────────────────

  const clientReference = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  // ── Insert order ──────────────────────────────────────────────────────────

  const now = new Date().toISOString();

  const { data: orderData, error: orderError } = await db
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
    } as never)
    .select("id")
    .single();

  if (orderError || !orderData) {
    console.error("Order insert error:", orderError);
    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 },
    );
  }

  const orderId = (orderData as { id: number }).id;
  const orderNumber = `BB-${orderId}`;

  // Set order_number now that we have the id
  await db
    .from("orders")
    .update({ order_number: orderNumber } as never)
    .eq("id", orderId);

  // ── Insert order_items + order_item_toppings ──────────────────────────────

  for (const item of processedItems) {
    const { data: orderItemData, error: itemError } = await db
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
      } as never)
      .select("id")
      .single();

    if (itemError || !orderItemData) {
      console.error("Order item insert error:", itemError);
      continue; // order is saved — don't fail the whole request
    }

    const orderItemId = (orderItemData as { id: string }).id;

    if (item.toppings.length > 0) {
      const { error: toppingError } = await db
        .from("order_item_toppings")
        .insert(
          item.toppings.map((t) => ({
            order_item_id: orderItemId,
            topping_id: t.toppingId,
            topping_name: t.toppingName,
            topping_base_pesewas: t.basePesewas,
            price_applied_pesewas: t.appliedPesewas,
          })) as never,
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
      .update({ hubtel_checkout_id: hubtelResult.checkoutId } as never)
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
