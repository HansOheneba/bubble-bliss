"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  PlusCircle,
  XCircle,
  Upload,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
} from "@/lib/actions";
import type {
  ProductWithVariants,
  Branch,
  Category,
} from "@/lib/database.types";
import type { ProductInput, VariantInput } from "@/lib/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  initialProducts: ProductWithVariants[];
  branches: Branch[];
  categories: Category[];
};

type VariantDraft = {
  tempId: string;
  key: string;
  label: string;
  price_ghs: string;
  sort_order: number;
};

type FormValues = {
  name: string;
  slug: string;
  description: string;
  category_id: string;
  base_price_ghs: string;
  has_variants: boolean;
  variants: VariantDraft[];
  image: string;
  sort_order: string;
  is_active: boolean;
  in_stock: boolean;
  restrict_branches: boolean;
  branch_ids: number[];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatMoney(pesewas: number | null) {
  if (pesewas === null) return "—";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(pesewas / 100);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultForm(): FormValues {
  return {
    name: "",
    slug: "",
    description: "",
    category_id: "",
    base_price_ghs: "",
    has_variants: false,
    variants: [],
    image: "",
    sort_order: "0",
    is_active: true,
    in_stock: true,
    restrict_branches: false,
    branch_ids: [],
  };
}

function productToForm(product: ProductWithVariants): FormValues {
  const hasVariants = (product.variants?.length ?? 0) > 0;
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    category_id: product.category_id ? String(product.category_id) : "",
    base_price_ghs:
      !hasVariants && product.price_in_pesewas
        ? String(product.price_in_pesewas / 100)
        : "",
    has_variants: hasVariants,
    variants: (product.variants ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((v) => ({
        tempId: String(v.id),
        key: v.key,
        label: v.label,
        price_ghs: String(v.price_in_pesewas / 100),
        sort_order: v.sort_order ?? 0,
      })),
    image: product.image ?? "",
    sort_order: String(product.sort_order ?? 0),
    is_active: product.is_active ?? true,
    in_stock: product.in_stock ?? true,
    restrict_branches: (product.branch_availability?.length ?? 0) > 0,
    branch_ids: product.branch_availability?.map((ba) => ba.branch_id) ?? [],
  };
}

function formToPayload(values: FormValues): {
  product: ProductInput;
  variants: VariantInput[];
  branchIds: number[];
} {
  return {
    product: {
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description.trim() || null,
      category_id: values.category_id ? Number(values.category_id) : null,
      price_in_pesewas:
        !values.has_variants && values.base_price_ghs
          ? Math.round(parseFloat(values.base_price_ghs) * 100)
          : null,
      sort_order: Number(values.sort_order) || 0,
      image: values.image.trim() || null,
      is_active: values.is_active,
      in_stock: values.in_stock,
    },
    variants: values.has_variants
      ? values.variants.map((v, i) => ({
          key: v.key.trim(),
          label: v.label.trim(),
          price_in_pesewas: Math.round(parseFloat(v.price_ghs || "0") * 100),
          sort_order: v.sort_order ?? i,
        }))
      : [],
    branchIds: values.restrict_branches ? values.branch_ids : [],
  };
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-1",
        )}
      />
    </button>
  );
}

// ── Branch availability chips ─────────────────────────────────────────────────

function BranchChips({
  branchIds,
  branches,
}: {
  branchIds: number[];
  branches: Branch[];
}) {
  if (branchIds.length === 0) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        All branches
      </Badge>
    );
  }
  return (
    <>
      {branchIds.map((bid) => {
        const b = branches.find((br) => br.id === bid);
        return (
          <Badge key={bid} variant="secondary" className="text-xs">
            {b?.name ?? `Branch ${bid}`}
          </Badge>
        );
      })}
    </>
  );
}

// ── Product Form Sheet ────────────────────────────────────────────────────────

function ProductFormSheet({
  open,
  onClose,
  editingProduct,
  categories,
  branches,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingProduct: ProductWithVariants | null;
  categories: Category[];
  branches: Branch[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormValues>(defaultForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(editingProduct ? productToForm(editingProduct) : defaultForm());
      setFormError(null);
    }
  }, [open, editingProduct]);

  function setField<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingProduct ? prev.slug : slugify(name),
    }));
  }

  function addVariant() {
    setField("variants", [
      ...form.variants,
      {
        tempId: crypto.randomUUID(),
        key: "",
        label: "",
        price_ghs: "",
        sort_order: form.variants.length,
      },
    ]);
  }

  function removeVariant(tempId: string) {
    setField(
      "variants",
      form.variants.filter((v) => v.tempId !== tempId),
    );
  }

  function updateVariant(
    tempId: string,
    field: keyof VariantDraft,
    value: string | number,
  ) {
    setField(
      "variants",
      form.variants.map((v) =>
        v.tempId === tempId ? { ...v, [field]: value } : v,
      ),
    );
  }

  function toggleBranch(branchId: number) {
    const ids = form.branch_ids.includes(branchId)
      ? form.branch_ids.filter((id) => id !== branchId)
      : [...form.branch_ids, branchId];
    setField("branch_ids", ids);
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Product name is required.";
    if (!form.slug.trim()) return "Slug is required.";
    if (!form.category_id) return "Please select a category.";
    if (!form.has_variants && !form.base_price_ghs)
      return "Base price is required when no variants are defined.";
    if (form.has_variants && form.variants.length === 0)
      return "Add at least one size variant.";
    for (const v of form.variants) {
      if (!v.key.trim() || !v.label.trim() || !v.price_ghs)
        return "All variant fields (key, label, price) are required.";
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { product, variants, branchIds } = formToPayload(form);
    const result = editingProduct
      ? await updateProduct(editingProduct.id, product, variants, branchIds)
      : await createProduct(product, variants, branchIds);
    if (result.error) {
      setFormError(result.error);
    } else {
      onSaved();
      onClose();
    }
    setSubmitting(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>
            {editingProduct ? "Edit Product" : "Add Product"}
          </SheetTitle>
          <SheetDescription>
            {editingProduct
              ? "Update product details, variants, and availability."
              : "Fill in the details to add a new product."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Name *</Label>
              <Input
                id="pf-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Taro Milk Tea"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-slug">Slug *</Label>
              <Input
                id="pf-slug"
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="taro-milk-tea"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Description</Label>
            <Textarea
              id="pf-desc"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="A creamy taro bubble tea..."
              rows={2}
            />
          </div>

          {/* Category + Sort order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setField("category_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-sort">Sort order</Label>
              <Input
                id="pf-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setField("sort_order", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label>Product Image</Label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="pf-image-file"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent transition-colors",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {form.image ? "Replace image" : "Upload image"}
                  </>
                )}
                <input
                  id="pf-image-file"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading || submitting}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setFormError(null);
                    const fd = new FormData();
                    fd.append("image", file);
                    const result = await uploadImage(fd);
                    setUploading(false);
                    if ("error" in result) {
                      setFormError(result.error);
                    } else {
                      setField("image", result.url);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {form.image && (
                <button
                  type="button"
                  onClick={() => setField("image", "")}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            {form.image && (
              <div className="relative mt-2 h-28 w-full rounded-md overflow-hidden bg-muted">
                <Image
                  src={form.image}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>
            )}
          </div>

          {/* Active + In stock */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Toggle
                checked={form.is_active}
                onChange={(v) => setField("is_active", v)}
                label="Active"
              />
              <span>Active (visible)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Toggle
                checked={form.in_stock}
                onChange={(v) => setField("in_stock", v)}
                label="In stock"
              />
              <span>In stock</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pricing</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_variants}
                  onChange={(e) => setField("has_variants", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Has size variants
              </label>
            </div>

            {!form.has_variants ? (
              <div className="space-y-1.5">
                <Label htmlFor="pf-price">Base price (GHS) *</Label>
                <Input
                  id="pf-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.base_price_ghs}
                  onChange={(e) => setField("base_price_ghs", e.target.value)}
                  placeholder="25.00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {form.variants.map((v) => (
                  <div
                    key={v.tempId}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Key
                      </Label>
                      <Input
                        value={v.key}
                        onChange={(e) =>
                          updateVariant(v.tempId, "key", e.target.value)
                        }
                        placeholder="medium"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Label
                      </Label>
                      <Input
                        value={v.label}
                        onChange={(e) =>
                          updateVariant(v.tempId, "label", e.target.value)
                        }
                        placeholder="Medium"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Price (GHS)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.price_ghs}
                        onChange={(e) =>
                          updateVariant(v.tempId, "price_ghs", e.target.value)
                        }
                        placeholder="25.00"
                        className="h-8 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariant(v.tempId)}
                      className="text-muted-foreground hover:text-destructive transition-colors pb-0.5"
                      aria-label="Remove variant"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={addVariant}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add variant
                </Button>
              </div>
            )}
          </div>

          {/* Branch Availability */}
          {branches.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4">
              <span className="text-sm font-medium">Branch Availability</span>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="branch-mode"
                    checked={!form.restrict_branches}
                    onChange={() => {
                      setField("restrict_branches", false);
                      setField("branch_ids", []);
                    }}
                    className="h-4 w-4"
                  />
                  Available at all branches
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="branch-mode"
                    checked={form.restrict_branches}
                    onChange={() => setField("restrict_branches", true)}
                    className="h-4 w-4"
                  />
                  Restrict to specific branches
                </label>
              </div>
              {form.restrict_branches && (
                <div className="space-y-1.5 pl-6">
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.branch_ids.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      {branch.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting || uploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || uploading}
            >
              {submitting
                ? "Saving..."
                : editingProduct
                  ? "Save changes"
                  : "Add product"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductsClient({
  initialProducts,
  branches,
  categories,
}: Props) {
  const router = useRouter();
  const [products, setProducts] =
    React.useState<ProductWithVariants[]>(initialProducts);
  const [query, setQuery] = React.useState("");
  const [updating, setUpdating] = React.useState<Record<number, boolean>>({});
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] =
    React.useState<ProductWithVariants | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ProductWithVariants | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  async function toggleActive(product: ProductWithVariants) {
    const next = !product.is_active;
    setUpdating((prev) => ({ ...prev, [product.id]: true }));
    const { error } = await supabase
      .from("products")
      .update({ is_active: next } as never)
      .eq("id", product.id);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: next } : p)),
      );
    }
    setUpdating((prev) => ({ ...prev, [product.id]: false }));
  }

  async function toggleStock(product: ProductWithVariants) {
    const next = !product.in_stock;
    setUpdating((prev) => ({ ...prev, [product.id]: true }));
    const { error } = await supabase
      .from("products")
      .update({ in_stock: next } as never)
      .eq("id", product.id);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, in_stock: next } : p)),
      );
    }
    setUpdating((prev) => ({ ...prev, [product.id]: false }));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteProduct(deleteTarget.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleting(false);
    } else {
      setDeleteTarget(null);
      setDeleting(false);
      router.refresh();
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  // Group by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, ProductWithVariants[]>();
    for (const p of filtered) {
      const cat = p.category?.name ?? "Uncategorised";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} products across {grouped.size}{" "}
              {grouped.size === 1 ? "category" : "categories"}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setSheetOpen(true);
              }}
              className="gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          </div>
        </div>

        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-foreground">
                {category}
              </h2>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {items.length} items
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <div
                  key={product.id}
                  className={cn(
                    "rounded-xl border bg-card overflow-hidden flex flex-col transition-opacity",
                    !product.is_active && "opacity-60",
                  )}
                >
                  {product.image ? (
                    <div className="relative h-36 w-full bg-muted">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="h-36 w-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      No image
                    </div>
                  )}

                  <div className="p-3 flex flex-col gap-2.5 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-snug truncate">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setSheetOpen(true);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Edit product"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(product);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {product.variants && product.variants.length > 0 ? (
                        product.variants
                          .sort(
                            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                          )
                          .map((v) => (
                            <Badge
                              key={v.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {v.label}: {formatMoney(v.price_in_pesewas)}
                            </Badge>
                          ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {formatMoney(product.price_in_pesewas)}
                        </Badge>
                      )}
                    </div>

                    {branches.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <BranchChips
                          branchIds={
                            product.branch_availability?.map(
                              (ba) => ba.branch_id,
                            ) ?? []
                          }
                          branches={branches}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 mt-auto pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active</span>
                        <Toggle
                          checked={product.is_active ?? false}
                          onChange={() => toggleActive(product)}
                          disabled={updating[product.id]}
                          label="Toggle active"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">In stock</span>
                        <Toggle
                          checked={product.in_stock ?? false}
                          onChange={() => toggleStock(product)}
                          disabled={updating[product.id]}
                          label="Toggle stock"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            {query
              ? "No products match your search."
              : "No products yet. Add one to get started."}
          </div>
        )}
      </div>

      <ProductFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingProduct={editingProduct}
        categories={categories}
        branches={branches}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> and
              all its variants. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
