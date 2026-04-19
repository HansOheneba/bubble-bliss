import { createAdminClient } from "@/lib/supabase";
import type { Category } from "@/lib/database.types";
import CategoriesClient from "./categories-client";

async function fetchPageData() {
  const supabase = createAdminClient();
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("products").select("id, category_id"),
  ]);

  const categories = (categoriesResult.data ?? []) as Category[];
  const products = (productsResult.data ?? []) as {
    id: number;
    category_id: number | null;
  }[];

  const countByCat = products.reduce<Record<number, number>>((acc, p) => {
    if (p.category_id) {
      acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    categories,
    countByCat,
  };
}

export default async function CategoriesPage() {
  const { categories, countByCat } = await fetchPageData();
  return (
    <CategoriesClient initialCategories={categories} countByCat={countByCat} />
  );
}
