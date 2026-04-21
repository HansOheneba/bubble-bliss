import { createAdminClient } from "@/lib/supabase";
import type {
  ProductWithVariants,
  Branch,
  Category,
} from "@/lib/database.types";
import ProductsClient from "./products-client";

async function fetchPageData() {
  const supabase = createAdminClient();
  const [productsResult, branchesResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        `*, variants:product_variants(*), category:categories(*), branch_availability:product_branch_availability(branch_id, price_in_pesewas)`,
      )
      .order("sort_order", { ascending: true }),
    supabase.from("branches").select("*").order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  return {
    products: (productsResult.data ?? []) as ProductWithVariants[],
    branches: (branchesResult.data ?? []) as Branch[],
    categories: (categoriesResult.data ?? []) as Category[],
  };
}

export default async function ProductsPage() {
  const { products, branches, categories } = await fetchPageData();
  return (
    <ProductsClient
      initialProducts={products}
      branches={branches}
      categories={categories}
    />
  );
}
