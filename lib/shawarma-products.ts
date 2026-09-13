import type { SupabaseClient } from "@supabase/supabase-js";

type CategoryRow = { id: number; slug: string };
type ProductRow = { id: number };

export class ShawarmaLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShawarmaLookupError";
  }
}

/** Load shawarma product IDs. Throws if classification cannot be resolved safely. */
export async function fetchShawarmaProductIds(
  db: SupabaseClient,
): Promise<Set<number>> {
  const { data: categories, error: categoriesError } = await db
    .from("categories")
    .select("id, slug");

  if (categoriesError) {
    throw new ShawarmaLookupError(
      `Failed to load categories: ${categoriesError.message}`,
    );
  }

  const shawarmaCategory = (categories as CategoryRow[] | null)?.find(
    (c) => c.slug === "shawarma",
  );

  if (!shawarmaCategory) {
    throw new ShawarmaLookupError('Shawarma category with slug "shawarma" not found');
  }

  const { data: shawarmaProducts, error: productsError } = await db
    .from("products")
    .select("id")
    .eq("category_id", shawarmaCategory.id);

  if (productsError) {
    throw new ShawarmaLookupError(
      `Failed to load shawarma products: ${productsError.message}`,
    );
  }

  return new Set((shawarmaProducts as ProductRow[] | null)?.map((p) => p.id) ?? []);
}

/** Safe wrapper returning empty set only when shawarma category truly has no products. */
export async function fetchShawarmaProductIdsOrThrow(
  db: SupabaseClient,
): Promise<number[]> {
  const ids = await fetchShawarmaProductIds(db);
  return [...ids];
}
