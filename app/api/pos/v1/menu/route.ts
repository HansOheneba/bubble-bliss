import { NextRequest, NextResponse } from "next/server";

import { authenticatePos } from "@/lib/pos/auth";
import { createAdminClient } from "@/lib/supabase";

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  price_in_pesewas: number | null;
  in_stock: boolean | null;
  sort_order: number | null;
  category_id: number | null;
  branch_prices: unknown;
  variants: { id: number; key: string; label: string; price_in_pesewas: number; sort_order: number | null }[];
  availability: { branch_id: number }[];
};

type ToppingRow = {
  id: number;
  name: string;
  price_in_pesewas: number;
  sort_order: number | null;
  availability: { branch_id: number }[];
};

function branchPrice(raw: unknown, branchId: number): number | null {
  let prices: Record<string, number> = {};
  if (typeof raw === "string") {
    try {
      prices = JSON.parse(raw) as Record<string, number>;
    } catch {
      prices = {};
    }
  } else if (raw && typeof raw === "object") {
    prices = raw as Record<string, number>;
  }
  return prices[String(branchId)] ?? null;
}

const availableAt = (rows: { branch_id: number }[], branchId: number) =>
  rows.length === 0 || rows.some((r) => r.branch_id === branchId);

// GET /api/pos/v1/menu — categories, products and toppings for the signed-in branch.
export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;
  const branchId = auth.ctx.branch.id;

  const db = createAdminClient();
  const [categoriesRes, productsRes, toppingsRes] = await Promise.all([
    db.from("categories").select("id, slug, name, sort_order").order("sort_order", { ascending: true }),
    db
      .from("products")
      .select(
        "id, name, description, image, price_in_pesewas, in_stock, sort_order, category_id, branch_prices, variants:product_variants(id, key, label, price_in_pesewas, sort_order), availability:product_branch_availability(branch_id)",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    db
      .from("toppings")
      .select("id, name, price_in_pesewas, sort_order, availability:topping_branch_availability(branch_id)")
      .eq("is_active", true)
      .eq("in_stock", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (categoriesRes.error || productsRes.error || toppingsRes.error) {
    console.error("[pos/v1/menu] fetch failed", {
      categories: categoriesRes.error,
      products: productsRes.error,
      toppings: toppingsRes.error,
    });
    return NextResponse.json({ message: "Failed to load the menu" }, { status: 500 });
  }

  const products = ((productsRes.data ?? []) as unknown as ProductRow[])
    .filter((p) => availableAt(p.availability, branchId))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image: p.image,
      categoryId: p.category_id,
      pricePesewas: branchPrice(p.branch_prices, branchId) ?? p.price_in_pesewas,
      inStock: p.in_stock !== false,
      variants: [...p.variants]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((v) => ({ id: v.id, key: v.key, label: v.label, pricePesewas: v.price_in_pesewas })),
    }));

  const usedCategoryIds = new Set(products.map((p) => p.categoryId));
  const categories = ((categoriesRes.data ?? []) as { id: number; slug: string; name: string }[])
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name }));

  const toppings = ((toppingsRes.data ?? []) as unknown as ToppingRow[])
    .filter((t) => availableAt(t.availability, branchId))
    .map((t) => ({ id: t.id, name: t.name, pricePesewas: t.price_in_pesewas }));

  return NextResponse.json({ categories, products, toppings });
}
