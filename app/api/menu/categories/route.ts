import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

/**
 * GET /api/menu/categories
 *
 * Returns all categories, sorted by sort_order.
 * Useful for building navigation/filter tabs on the menu page.
 */
export async function GET() {
  const db = createAdminClient();

  const { data: categories, error } = await db
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch categories" },
      { status: 500 }
    );
  }

  return NextResponse.json({ categories: categories ?? [] });
}
