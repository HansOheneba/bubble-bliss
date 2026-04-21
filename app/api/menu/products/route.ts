import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Product, ProductVariant, Category } from "@/lib/database.types";

type ProductRow = Product & {
  category: Category | null;
  variants: ProductVariant[];
  branch_availability: { branch_id: number }[];
};

/**
 * GET /api/menu/products
 *
 * Returns all active products with their variants, category, and branch
 * availability. Inactive products are excluded.
 *
 * Optional query params:
 *   ?branchSlug=osu          — filter to products available at a specific branch
 *   ?pos_user_email=x@y.com  — resolve branch from POS user email (alternative to branchSlug)
 *   ?categorySlug=tea        — filter to a specific category
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branchSlug");
  const posUserEmail = searchParams.get("pos_user_email");
  const categorySlug = searchParams.get("categorySlug");

  const db = createAdminClient();

  // Resolve branchId — from pos_user_email first, then branchSlug
  let branchId: number | null = null;

  if (posUserEmail) {
    const { data: posUserData } = await db
      .from("pos_users")
      .select("branch_id, is_active")
      .ilike("email", posUserEmail)
      .single();
    const posUser = posUserData as { branch_id: number; is_active: boolean } | null;

    if (!posUser) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" not found` },
        { status: 404 },
      );
    }
    if (!posUser.is_active) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" is inactive` },
        { status: 403 },
      );
    }
    branchId = posUser.branch_id;
  } else if (branchSlug) {
    const { data: branch } = await db
      .from("branches")
      .select("*")
      .eq("slug", branchSlug)
      .eq("is_active", true)
      .single();

    if (!branch) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" not found or inactive` },
        { status: 404 },
      );
    }
    branchId = (branch as { id: number }).id;
  }

  // Resolve categoryId from slug if provided
  let categoryId: number | null = null;
  if (categorySlug) {
    const { data: category } = await db
      .from("categories")
      .select("*")
      .eq("slug", categorySlug)
      .single();

    if (!category) {
      return NextResponse.json(
        { message: `Category "${categorySlug}" not found` },
        { status: 404 },
      );
    }
    categoryId = (category as { id: number }).id;
  }

  // Fetch active products with variants + category + branch availability
  let query = db
    .from("products")
    .select(
      `
      *,
      category:categories(*),
      variants:product_variants(*),
      branch_availability:product_branch_availability(branch_id)
      `,
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (categoryId !== null) {
    query = query.eq("category_id", categoryId);
  }

  const { data: rawProducts, error } = await query;

  if (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch products" },
      { status: 500 },
    );
  }

  const products = (rawProducts ?? []) as unknown as ProductRow[];

  const filtered = branchId
    ? products.filter((p) => {
        return (
          p.branch_availability.length === 0 ||
          p.branch_availability.some((a) => a.branch_id === branchId)
        );
      })
    : products;

  // Sort variants by sort_order within each product
  const shaped = filtered.map((p) => {
    const variants = [...p.variants].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      image: p.image,
      price_in_pesewas: p.price_in_pesewas,
      in_stock: p.in_stock,
      sort_order: p.sort_order,
      category: p.category,
      variants,
      // empty array = available at all branches
      available_branch_ids: p.branch_availability.map((a) => a.branch_id),
    };
  });

  return NextResponse.json({ products: shaped });
}
