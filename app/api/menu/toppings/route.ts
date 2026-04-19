import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Topping } from "@/lib/database.types";

type ToppingRow = Topping & {
  branch_availability: { branch_id: number }[];
};

/**
 * GET /api/menu/toppings
 *
 * Returns all active, in-stock toppings with branch availability.
 *
 * Optional query params:
 *   ?branchSlug=osu — filter to toppings available at a specific branch
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branchSlug");

  const db = createAdminClient();

  let branchId: number | null = null;
  if (branchSlug) {
    const { data: branch } = await db
      .from("branches")
      .select("*")
      .eq("slug", branchSlug)
      .eq("is_active", true)
      .single();

    if (!branch) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" not found or inactive` },
        { status: 404 }
      );
    }
    branchId = (branch as { id: number }).id;
  }

  const { data: rawToppings, error } = await db
    .from("toppings")
    .select(
      `
      *,
      branch_availability:topping_branch_availability(branch_id)
      `
    )
    .eq("is_active", true)
    .eq("in_stock", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Toppings fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch toppings" },
      { status: 500 }
    );
  }

  const toppings = (rawToppings ?? []) as unknown as ToppingRow[];

  const filtered = branchId
    ? toppings.filter((t) => {
        return (
          t.branch_availability.length === 0 ||
          t.branch_availability.some((a) => a.branch_id === branchId)
        );
      })
    : toppings;

  const shaped = filtered.map((t) => ({
    id: t.id,
    name: t.name,
    price_in_pesewas: t.price_in_pesewas,
    sort_order: t.sort_order,
    available_branch_ids: t.branch_availability.map((a) => a.branch_id),
  }));

  return NextResponse.json({ toppings: shaped });
}
