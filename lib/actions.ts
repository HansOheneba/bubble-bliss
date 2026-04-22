"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";

// ── Image Upload ─────────────────────────────────────────────────────────────

export async function uploadImage(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) return { error: "Image upload is not configured" };

  const body = new FormData();
  body.append("image", file);
  body.append("key", apiKey);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });

  if (!res.ok) {
    return { error: `Upload failed: ${res.status}` };
  }

  const json = (await res.json()) as {
    success: boolean;
    data: { url: string };
  };

  if (!json.success) return { error: "Upload failed" };

  return { url: json.data.url };
}

// ── Input Types ──────────────────────────────────────────────────────────────

export type ProductInput = {
  name: string;
  slug: string;
  description: string | null;
  category_id: number | null;
  price_in_pesewas: number | null;
  branch_prices: Record<string, number>;
  sort_order: number;
  image: string | null;
  is_active: boolean;
  in_stock: boolean;
};

export type VariantInput = {
  key: string;
  label: string;
  price_in_pesewas: number;
  sort_order: number;
};

export type BranchEntry = {
  branch_id: number;
};

export type ToppingInput = {
  name: string;
  price_in_pesewas: number;
  sort_order: number;
  is_active: boolean;
  in_stock: boolean;
};

export type CategoryInput = {
  name: string;
  slug: string;
  sort_order: number;
};

type ActionResult = { error?: string };
type CreateResult = { id?: number; error?: string };

// ── Products ─────────────────────────────────────────────────────────────────

export async function createProduct(
  product: ProductInput,
  variants: VariantInput[],
  branchEntries: BranchEntry[],
): Promise<CreateResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("products")
      .insert(product as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Insert failed");

    if (variants.length > 0) {
      const { error: varErr } = await supabase.from("product_variants").insert(
        variants.map((v) => ({
          ...v,
          product_id: (data as { id: number }).id,
        })) as never,
      );
      if (varErr) throw new Error(varErr.message);
    }

    if (branchEntries.length > 0) {
      await supabase.from("product_branch_availability").insert(
        branchEntries.map((e) => ({
          product_id: (data as { id: number }).id,
          branch_id: e.branch_id,
        })) as never,
      );
    }

    revalidatePath("/admin/products");
    return { id: (data as { id: number }).id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateProduct(
  id: number,
  product: ProductInput,
  variants: VariantInput[],
  branchEntries: BranchEntry[],
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("products")
      .update(product as never)
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Replace variants entirely
    await supabase.from("product_variants").delete().eq("product_id", id);
    if (variants.length > 0) {
      const { error: varErr } = await supabase
        .from("product_variants")
        .insert(variants.map((v) => ({ ...v, product_id: id })) as never);
      if (varErr) throw new Error(varErr.message);
    }

    // Replace branch availability
    await supabase
      .from("product_branch_availability")
      .delete()
      .eq("product_id", id);
    if (branchEntries.length > 0) {
      await supabase.from("product_branch_availability").insert(
        branchEntries.map((e) => ({
          product_id: id,
          branch_id: e.branch_id,
        })) as never,
      );
    }

    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("product_branch_availability")
      .delete()
      .eq("product_id", id);
    await supabase.from("product_variants").delete().eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Toppings ─────────────────────────────────────────────────────────────────

export async function createTopping(
  topping: ToppingInput,
  branchIds: number[],
): Promise<CreateResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("toppings")
      .insert(topping as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Insert failed");

    if (branchIds.length > 0) {
      await supabase.from("topping_branch_availability").insert(
        branchIds.map((bid) => ({
          topping_id: (data as { id: number }).id,
          branch_id: bid,
        })) as never,
      );
    }

    revalidatePath("/admin/inventory");
    return { id: (data as { id: number }).id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateTopping(
  id: number,
  topping: ToppingInput,
  branchIds: number[],
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("toppings")
      .update(topping as never)
      .eq("id", id);
    if (error) throw new Error(error.message);

    await supabase
      .from("topping_branch_availability")
      .delete()
      .eq("topping_id", id);
    if (branchIds.length > 0) {
      await supabase
        .from("topping_branch_availability")
        .insert(
          branchIds.map((bid) => ({ topping_id: id, branch_id: bid })) as never,
        );
    }

    revalidatePath("/admin/inventory");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteTopping(id: number): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("topping_branch_availability")
      .delete()
      .eq("topping_id", id);
    const { error } = await supabase.from("toppings").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/inventory");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(
  category: CategoryInput,
): Promise<CreateResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("categories")
      .insert(category as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Insert failed");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return { id: (data as { id: number }).id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateCategory(
  id: number,
  category: CategoryInput,
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("categories")
      .update(category as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteCategory(
  id: number,
): Promise<ActionResult & { productCount?: number }> {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if ((count ?? 0) > 0) {
      return {
        error: `Cannot delete: ${count} product${count === 1 ? "" : "s"} use this category. Reassign them first.`,
        productCount: count ?? 0,
      };
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
