import type { SupabaseClient } from "@supabase/supabase-js";

import { parseOptionalPhone } from "@/lib/hubtel";
import type { Database } from "@/lib/database.types";

// Order logic for the v1 POS API. Pricing mirrors /api/orders/checkout exactly
// (branch price overrides, variant prices, first topping free) so the old and
// new tablets always charge the same amounts.

type Db = SupabaseClient<Database>;

export type PosPaymentMethod = "cash" | "momo";

export type PosItemInput = {
  productId: number;
  variantId?: number | null;
  quantity: number;
  sugarLevel?: string | null;
  spiceLevel?: string | null;
  note?: string | null;
  toppingIds?: number[];
};

export type PosOrderInput = {
  items: PosItemInput[];
  paymentMethod: PosPaymentMethod;
  tellerId: number;
  customerName?: string | null;
  phone?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
};

type PricedTopping = {
  toppingId: number;
  toppingName: string;
  basePesewas: number;
  appliedPesewas: number;
};

type PricedItem = {
  productId: number;
  variantId: number | null;
  productName: string;
  variantLabel: string | null;
  unitPesewas: number;
  quantity: number;
  sugarLevel: string | null;
  spiceLevel: string | null;
  note: string | null;
  toppings: PricedTopping[];
  lineTotalPesewas: number;
};

export class PosInputError extends Error {}

type ProductRow = {
  id: number;
  name: string;
  is_active: boolean | null;
  in_stock: boolean | null;
  price_in_pesewas: number | null;
  branch_prices: unknown;
  availability: { branch_id: number }[];
};
type VariantRow = { id: number; product_id: number | null; label: string; price_in_pesewas: number };
type ToppingRow = {
  id: number;
  name: string;
  price_in_pesewas: number;
  is_active: boolean | null;
  in_stock: boolean | null;
  availability: { branch_id: number }[];
};

function parseBranchPrices(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, number>;
}

function availableAt(rows: { branch_id: number }[], branchId: number): boolean {
  return rows.length === 0 || rows.some((r) => r.branch_id === branchId);
}

function cleanText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function validateOrderInput(body: unknown): PosOrderInput {
  if (!body || typeof body !== "object") throw new PosInputError("Invalid request body");
  const b = body as Record<string, unknown>;

  if (b.paymentMethod !== "cash" && b.paymentMethod !== "momo") {
    throw new PosInputError('paymentMethod must be "cash" or "momo"');
  }
  const tellerId = Number(b.tellerId);
  if (!Number.isInteger(tellerId) || tellerId <= 0) {
    throw new PosInputError("Select a cashier before placing the order");
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new PosInputError("Add at least one item");
  }
  if (b.items.length > 100) throw new PosInputError("Too many items in one order");

  const items: PosItemInput[] = b.items.map((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const productId = Number(it.productId);
    const quantity = Number(it.quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new PosInputError(`Item ${i + 1}: invalid product`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new PosInputError(`Item ${i + 1}: quantity must be between 1 and 99`);
    }
    const variantId = it.variantId == null ? null : Number(it.variantId);
    if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) {
      throw new PosInputError(`Item ${i + 1}: invalid size`);
    }
    const toppingIds = Array.isArray(it.toppingIds)
      ? it.toppingIds.map((t) => Number(t))
      : [];
    if (toppingIds.some((t) => !Number.isInteger(t) || t <= 0)) {
      throw new PosInputError(`Item ${i + 1}: invalid topping`);
    }
    return {
      productId,
      variantId,
      quantity,
      sugarLevel: cleanText(it.sugarLevel, 40),
      spiceLevel: cleanText(it.spiceLevel, 40),
      note: cleanText(it.note, 200),
      toppingIds,
    };
  });

  return {
    items,
    paymentMethod: b.paymentMethod,
    tellerId,
    customerName: cleanText(b.customerName, 120),
    phone: cleanText(b.phone, 20),
    deliveryAddress: cleanText(b.deliveryAddress, 300),
    notes: cleanText(b.notes, 500),
  };
}

async function priceItems(db: Db, branchId: number, items: PosItemInput[]): Promise<PricedItem[]> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.flatMap((i) => (i.variantId ? [i.variantId] : [])))];
  const toppingIds = [...new Set(items.flatMap((i) => i.toppingIds ?? []))];

  const [productsRes, variantsRes, toppingsRes] = await Promise.all([
    db
      .from("products")
      .select(
        "id, name, is_active, in_stock, price_in_pesewas, branch_prices, availability:product_branch_availability(branch_id)",
      )
      .in("id", productIds),
    variantIds.length
      ? db.from("product_variants").select("id, product_id, label, price_in_pesewas").in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
    toppingIds.length
      ? db
          .from("toppings")
          .select(
            "id, name, price_in_pesewas, is_active, in_stock, availability:topping_branch_availability(branch_id)",
          )
          .in("id", toppingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error || variantsRes.error || toppingsRes.error) {
    throw new Error(
      `Pricing lookup failed: ${productsRes.error?.message ?? variantsRes.error?.message ?? toppingsRes.error?.message}`,
    );
  }

  const products = new Map(
    ((productsRes.data ?? []) as unknown as ProductRow[]).map((p) => [p.id, p]),
  );
  const variants = new Map(((variantsRes.data ?? []) as VariantRow[]).map((v) => [v.id, v]));
  const toppings = new Map(
    ((toppingsRes.data ?? []) as unknown as ToppingRow[]).map((t) => [t.id, t]),
  );

  return items.map((item, i) => {
    const label = `Item ${i + 1}`;
    const product = products.get(item.productId);
    if (!product) throw new PosInputError(`${label}: product not found`);
    if (!product.is_active) throw new PosInputError(`${label}: "${product.name}" is not available`);
    if (!product.in_stock) throw new PosInputError(`${label}: "${product.name}" is out of stock`);
    if (!availableAt(product.availability, branchId)) {
      throw new PosInputError(`${label}: "${product.name}" is not sold at this branch`);
    }

    const branchPrice = parseBranchPrices(product.branch_prices)[String(branchId)] ?? null;

    let variantId: number | null = null;
    let variantLabel: string | null = null;
    let unitPesewas: number;

    if (item.variantId) {
      const variant = variants.get(item.variantId);
      if (!variant || variant.product_id !== product.id) {
        throw new PosInputError(`${label}: size not found for "${product.name}"`);
      }
      variantId = variant.id;
      variantLabel = variant.label;
      unitPesewas = variant.price_in_pesewas;
    } else if (branchPrice !== null) {
      unitPesewas = branchPrice;
    } else if (product.price_in_pesewas !== null) {
      unitPesewas = product.price_in_pesewas;
    } else {
      throw new PosInputError(`${label}: choose a size for "${product.name}"`);
    }

    const pricedToppings: PricedTopping[] = (item.toppingIds ?? []).map((toppingId, t) => {
      const topping = toppings.get(toppingId);
      if (!topping) throw new PosInputError(`${label}: topping not found`);
      if (!topping.is_active || !topping.in_stock) {
        throw new PosInputError(`${label}: topping "${topping.name}" is unavailable`);
      }
      if (!availableAt(topping.availability, branchId)) {
        throw new PosInputError(`${label}: topping "${topping.name}" is not sold at this branch`);
      }
      return {
        toppingId: topping.id,
        toppingName: topping.name,
        basePesewas: topping.price_in_pesewas,
        appliedPesewas: t === 0 ? 0 : topping.price_in_pesewas, // first topping free
      };
    });

    const toppingTotal = pricedToppings.reduce((s, t) => s + t.appliedPesewas, 0);

    return {
      productId: product.id,
      variantId,
      productName: product.name,
      variantLabel,
      unitPesewas,
      quantity: item.quantity,
      sugarLevel: item.sugarLevel ?? null,
      spiceLevel: item.spiceLevel ?? null,
      note: item.note ?? null,
      toppings: pricedToppings,
      lineTotalPesewas: (unitPesewas + toppingTotal) * item.quantity,
    };
  });
}

export async function assertTellerAtBranch(db: Db, tellerId: number, branchId: number): Promise<void> {
  const { data } = await db
    .from("tellers")
    .select("id, is_active, branch_id")
    .eq("id", tellerId)
    .maybeSingle();
  const teller = data as { id: number; is_active: boolean; branch_id: number } | null;
  if (!teller || teller.branch_id !== branchId) {
    throw new PosInputError("That cashier does not belong to this branch");
  }
  if (!teller.is_active) throw new PosInputError("That cashier is inactive");
}

export type CreatedOrder = {
  orderId: number;
  orderNumber: string;
  clientReference: string;
  totalPesewas: number;
};

export async function createPosOrder(
  db: Db,
  branchId: number,
  input: PosOrderInput,
): Promise<CreatedOrder> {
  const { phone, error: phoneError } = parseOptionalPhone(input.phone);
  if (phoneError) throw new PosInputError(phoneError);

  await assertTellerAtBranch(db, input.tellerId, branchId);
  const priced = await priceItems(db, branchId, input.items);
  const totalPesewas = priced.reduce((s, i) => s + i.lineTotalPesewas, 0);

  const clientReference = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const now = new Date().toISOString();
  const isCash = input.paymentMethod === "cash";

  const { data: orderData, error: orderError } = await db
    .from("orders")
    .insert({
      phone,
      customer_name: input.customerName ?? null,
      location_text: input.deliveryAddress ?? "In-store",
      notes: input.notes ?? null,
      status: isCash ? "confirmed" : "pending",
      payment_status: isCash ? "paid" : "unpaid",
      payment_method: input.paymentMethod,
      total_pesewas: totalPesewas,
      client_reference: clientReference,
      branch_id: branchId,
      order_source: "instore",
      teller_id: input.tellerId,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id")
    .single();

  if (orderError || !orderData) {
    throw new Error(`Order insert failed: ${orderError?.message ?? "no row returned"}`);
  }

  const orderId = (orderData as { id: number }).id;
  const orderNumber = `BB-${orderId}`;

  const rollback = async (reason: string): Promise<never> => {
    await db.from("order_items").delete().eq("order_id", orderId);
    await db.from("orders").delete().eq("id", orderId);
    throw new Error(`Order ${orderId} rolled back: ${reason}`);
  };

  const { error: numberError } = await db
    .from("orders")
    .update({ order_number: orderNumber } as never)
    .eq("id", orderId);
  if (numberError) await rollback(`order_number: ${numberError.message}`);

  for (const item of priced) {
    const { data: itemData, error: itemError } = await db
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
    if (itemError || !itemData) {
      return rollback(`item insert: ${itemError?.message ?? "no row returned"}`);
    }
    const orderItemId = (itemData as { id: string }).id;

    if (item.toppings.length > 0) {
      const { error: toppingError } = await db.from("order_item_toppings").insert(
        item.toppings.map((t) => ({
          order_item_id: orderItemId,
          topping_id: t.toppingId,
          topping_name: t.toppingName,
          topping_base_pesewas: t.basePesewas,
          price_applied_pesewas: t.appliedPesewas,
        })) as never,
      );
      if (toppingError) await rollback(`topping insert: ${toppingError.message}`);
    }
  }

  return { orderId, orderNumber, clientReference, totalPesewas };
}

// ── Shaping ────────────────────────────────────────────────────────────────────

export const ORDER_SELECT =
  "id, order_number, client_reference, phone, customer_name, location_text, notes, status, payment_status, payment_method, total_pesewas, teller_id, branch_id, created_at, updated_at, teller:tellers(id, name), items:order_items(id, product_name, variant_label, unit_pesewas, quantity, sugar_level, spice_level, note, toppings:order_item_toppings(topping_name, price_applied_pesewas))";

type OrderQueryRow = {
  id: number;
  order_number: string | null;
  client_reference: string;
  phone: string | null;
  customer_name: string | null;
  location_text: string;
  notes: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string;
  total_pesewas: number;
  teller_id: number | null;
  branch_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  teller: { id: number; name: string } | null;
  items: {
    id: string;
    product_name: string;
    variant_label: string | null;
    unit_pesewas: number;
    quantity: number;
    sugar_level: string | null;
    spice_level: string | null;
    note: string | null;
    toppings: { topping_name: string; price_applied_pesewas: number }[];
  }[];
};

export function shapeOrder(raw: unknown) {
  const o = raw as OrderQueryRow;
  return {
    id: o.id,
    orderNumber: o.order_number ?? `BB-${o.id}`,
    clientReference: o.client_reference,
    customerName: o.customer_name,
    phone: o.phone,
    deliveryAddress: o.location_text && o.location_text !== "In-store" ? o.location_text : null,
    notes: o.notes,
    status: o.status ?? "pending",
    paymentStatus: o.payment_status ?? "unpaid",
    paymentMethod: o.payment_method,
    totalPesewas: o.total_pesewas,
    teller: o.teller ? { id: o.teller.id, name: o.teller.name } : null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: (o.items ?? []).map((it) => ({
      id: it.id,
      productName: it.product_name,
      variantLabel: it.variant_label,
      unitPesewas: it.unit_pesewas,
      quantity: it.quantity,
      sugarLevel: it.sugar_level,
      spiceLevel: it.spice_level,
      note: it.note,
      toppings: (it.toppings ?? []).map((t) => ({
        name: t.topping_name,
        pricePesewas: t.price_applied_pesewas,
      })),
    })),
  };
}

export type ShapedOrder = ReturnType<typeof shapeOrder>;
