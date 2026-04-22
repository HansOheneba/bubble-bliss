import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Product, ProductVariant, Category } from "@/lib/database.types";

type ProductRow = Product & {
  category: Category | null;
  variants: ProductVariant[];
  branch_availability: { branch_id: number }[];
};

/**
 * Shared handler for GET and POST.
 * GET  /api/menu/products?pos_user_email=x&branchSlug=y&categorySlug=z
 * POST /api/menu/products  { "pos_user_email": "x", "branchSlug": "y", "categorySlug": "z" }
 */
async function handleRequest(params: {
  posUserEmail: string | null;
  branchSlug: string | null;
  categorySlug: string | null;
}): Promise<NextResponse> {
  const { posUserEmail, branchSlug, categorySlug } = params;
  const db = createAdminClient();

  // Resolve branchId — from pos_user_email first, then branchSlug
  let branchId: number | null = null;

  if (posUserEmail) {
    const { data: posUserData } = await db
      .from("pos_users")
      .select("branch_id, is_active")
      .ilike("email", posUserEmail)
      .single();
    const posUser = posUserData as {
      branch_id: number;
      is_active: boolean;
    } | null;

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
    console.log(
      `[menu/products] POS user: ${posUserEmail} → branch_id: ${branchId}`,
    );
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
    console.log(
      `[menu/products] branchSlug: "${branchSlug}" → branch_id: ${branchId}`,
    );
  } else {
    console.log(
      `[menu/products] No user/branch supplied — returning global menu`,
    );
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
        // No rows = available at all branches
        if (p.branch_availability.length === 0) return true;
        return p.branch_availability.some((a) => a.branch_id === branchId);
      })
    : products;

  // Sort variants by sort_order within each product
  const shaped = filtered.map((p) => {
    const variants = [...p.variants].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    // Use branch-specific price from branch_prices JSONB if set
    const rawBp = p.branch_prices ?? {};
    const branchPrices: Record<string, number> =
      typeof rawBp === "string"
        ? (JSON.parse(rawBp) as Record<string, number>)
        : (rawBp as Record<string, number>);
    const effectivePrice =
      branchId !== null
        ? (branchPrices[String(branchId)] ?? p.price_in_pesewas)
        : p.price_in_pesewas;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      image: p.image,
      price_in_pesewas: effectivePrice,
      in_stock: p.in_stock,
      sort_order: p.sort_order,
      category: p.category,
      variants,
      // empty array = available at all branches
      available_branch_ids: p.branch_availability.map((a) => a.branch_id),
    };
  });

  console.log(
    `[menu/products] Returning ${shaped.length} product(s) for branch_id: ${branchId ?? "all"}`,
  );
  return NextResponse.json({ products: shaped });
}

/** GET — all params via query string */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleRequest({
    posUserEmail: searchParams.get("pos_user_email"),
    branchSlug: searchParams.get("branchSlug"),
    categorySlug: searchParams.get("categorySlug"),
  });
}

/** POST — params via JSON body (or query string, body takes precedence) */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // No body or not JSON
  }

  const str = (key: string) => {
    const v = body[key] ?? searchParams.get(key);
    return typeof v === "string" ? v : null;
  };

  return handleRequest({
    posUserEmail: str("pos_user_email"),
    branchSlug: str("branchSlug"),
    categorySlug: str("categorySlug"),
  });
}
