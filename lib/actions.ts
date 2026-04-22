"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/admin-logger";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(pesewas: number | null | undefined): string {
  if (pesewas == null) return "n/a";
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

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

    const productId = (data as { id: number }).id;
    void logAdminAction({
      action: "product.create",
      description: `Created product "${product.name}"`,
      metadata: { id: productId, name: product.name, slug: product.slug },
    });
    revalidatePath("/admin/products");
    return { id: productId };
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

    const { data: currentRow } = await supabase
      .from("products")
      .select("name, price_in_pesewas, is_active, in_stock, description")
      .eq("id", id)
      .single();
    const old = currentRow as {
      name: string;
      price_in_pesewas: number | null;
      is_active: boolean | null;
      in_stock: boolean | null;
      description: string | null;
    } | null;

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

    const productChanges: string[] = [];
    if (old?.name && old.name !== product.name)
      productChanges.push(`renamed from "${old.name}" to "${product.name}"`);
    if (old && old.price_in_pesewas !== product.price_in_pesewas)
      productChanges.push(
        `price changed from ${fmt(old.price_in_pesewas)} to ${fmt(product.price_in_pesewas)}`,
      );
    if (old && old.is_active != null && old.is_active !== product.is_active)
      productChanges.push(product.is_active ? "activated" : "deactivated");
    if (old && old.in_stock != null && old.in_stock !== product.in_stock)
      productChanges.push(
        product.in_stock ? "marked in stock" : "marked out of stock",
      );
    if (old && old.description !== product.description)
      productChanges.push("description updated");
    const productDesc =
      productChanges.length > 0
        ? `Updated product "${product.name}": ${productChanges.join("; ")}`
        : `Updated product "${product.name}"`;
    void logAdminAction({
      action: "product.update",
      description: productDesc,
      metadata: {
        id,
        name: product.name,
        slug: product.slug,
        changes: productChanges,
      },
    });
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
    const { data: productRow } = await supabase
      .from("products")
      .select("name")
      .eq("id", id)
      .single();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "product.delete",
      description: `Deleted product "${(productRow as { name: string } | null)?.name ?? id}"`,
      metadata: { id },
    });
    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleProductActive(
  id: number,
  value: boolean,
  productName: string,
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ is_active: value } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "product.toggle_active",
      description: `${value ? "Activated" : "Deactivated"} product "${productName}"`,
      metadata: { id, name: productName, is_active: value },
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleProductStock(
  id: number,
  value: boolean,
  productName: string,
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ in_stock: value } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "product.toggle_stock",
      description: `Marked product "${productName}" as ${value ? "in stock" : "out of stock"}`,
      metadata: { id, name: productName, in_stock: value },
    });
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

    const toppingId = (data as { id: number }).id;
    void logAdminAction({
      action: "topping.create",
      description: `Created topping "${topping.name}"`,
      metadata: { id: toppingId, name: topping.name },
    });
    revalidatePath("/admin/inventory");
    return { id: toppingId };
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

    const { data: currentTopping } = await supabase
      .from("toppings")
      .select("name, price_in_pesewas, is_active, in_stock")
      .eq("id", id)
      .single();
    const oldTopping = currentTopping as {
      name: string;
      price_in_pesewas: number;
      is_active: boolean | null;
      in_stock: boolean | null;
    } | null;

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

    const toppingChanges: string[] = [];
    if (oldTopping?.name && oldTopping.name !== topping.name)
      toppingChanges.push(
        `renamed from "${oldTopping.name}" to "${topping.name}"`,
      );
    if (oldTopping && oldTopping.price_in_pesewas !== topping.price_in_pesewas)
      toppingChanges.push(
        `price changed from ${fmt(oldTopping.price_in_pesewas)} to ${fmt(topping.price_in_pesewas)}`,
      );
    if (
      oldTopping &&
      oldTopping.is_active != null &&
      oldTopping.is_active !== topping.is_active
    )
      toppingChanges.push(topping.is_active ? "activated" : "deactivated");
    if (
      oldTopping &&
      oldTopping.in_stock != null &&
      oldTopping.in_stock !== topping.in_stock
    )
      toppingChanges.push(
        topping.in_stock ? "marked in stock" : "marked out of stock",
      );
    const toppingDesc =
      toppingChanges.length > 0
        ? `Updated topping "${topping.name}": ${toppingChanges.join("; ")}`
        : `Updated topping "${topping.name}"`;
    void logAdminAction({
      action: "topping.update",
      description: toppingDesc,
      metadata: { id, name: topping.name, changes: toppingChanges },
    });
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
    const { data: toppingRow } = await supabase
      .from("toppings")
      .select("name")
      .eq("id", id)
      .single();
    const { error } = await supabase.from("toppings").delete().eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "topping.delete",
      description: `Deleted topping "${(toppingRow as { name: string } | null)?.name ?? id}"`,
      metadata: { id },
    });
    revalidatePath("/admin/inventory");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleToppingActive(
  id: number,
  value: boolean,
  toppingName: string,
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("toppings")
      .update({ is_active: value } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "topping.toggle_active",
      description: `${value ? "Activated" : "Deactivated"} topping "${toppingName}"`,
      metadata: { id, name: toppingName, is_active: value },
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleToppingStock(
  id: number,
  value: boolean,
  toppingName: string,
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("toppings")
      .update({ in_stock: value } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "topping.toggle_stock",
      description: `Marked topping "${toppingName}" as ${value ? "in stock" : "out of stock"}`,
      metadata: { id, name: toppingName, in_stock: value },
    });
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
    const catId = (data as { id: number }).id;
    void logAdminAction({
      action: "category.create",
      description: `Created category "${category.name}"`,
      metadata: { id: catId, name: category.name, slug: category.slug },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return { id: catId };
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

    const { data: currentCategory } = await supabase
      .from("categories")
      .select("name, slug, sort_order")
      .eq("id", id)
      .single();
    const oldCategory = currentCategory as {
      name: string;
      slug: string;
      sort_order: number | null;
    } | null;

    const { error } = await supabase
      .from("categories")
      .update(category as never)
      .eq("id", id);
    if (error) throw new Error(error.message);

    const categoryChanges: string[] = [];
    if (oldCategory?.name && oldCategory.name !== category.name)
      categoryChanges.push(
        `renamed from "${oldCategory.name}" to "${category.name}"`,
      );
    if (oldCategory?.slug && oldCategory.slug !== category.slug)
      categoryChanges.push(
        `slug changed from "${oldCategory.slug}" to "${category.slug}"`,
      );
    if (oldCategory && oldCategory.sort_order !== category.sort_order)
      categoryChanges.push(
        `sort order changed from ${oldCategory.sort_order ?? 0} to ${category.sort_order}`,
      );
    const categoryDesc =
      categoryChanges.length > 0
        ? `Updated category "${category.name}": ${categoryChanges.join("; ")}`
        : `Updated category "${category.name}"`;
    void logAdminAction({
      action: "category.update",
      description: categoryDesc,
      metadata: {
        id,
        name: category.name,
        slug: category.slug,
        changes: categoryChanges,
      },
    });
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

    const { data: catRow } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("id", id)
      .single();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    void logAdminAction({
      action: "category.delete",
      description: `Deleted category "${(catRow as { name: string } | null)?.name ?? id}"`,
      metadata: { id },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
