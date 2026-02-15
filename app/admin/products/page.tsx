"use client";

import * as React from "react";
import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Separator } from "@/components/ui/separator";

import { ChevronDown, Search, X, Plus } from "lucide-react";
import { PRODUCTS, type Product, type ProductCategory } from "@/lib/products";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(price);
}

function StockBadge({ inStock }: { inStock: boolean }) {
  return (
    <Badge
      className={
        inStock
          ? "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30"
          : "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30"
      }
      variant="default"
    >
      {inStock ? "In Stock" : "Out of Stock"}
    </Badge>
  );
}

type ProductFormState = {
  name: string;
  category: ProductCategory;
  image: string;
  mediumPrice: string;
  largePrice: string;
  inStock: boolean;
  isActive: boolean;
};

const CATEGORY_OPTIONS: ProductCategory[] = [
  "Bubble Tea",
  "Ice Tea",
  "Shawarma",
  "HQ Special",
];

function buildFormFromProduct(p: Product | null): ProductFormState {
  return {
    name: p?.name ?? "",
    category: p?.category ?? "Bubble Tea",
    image: p?.image ?? "",
    mediumPrice: p ? String(p.price.medium) : "",
    largePrice: p ? String(p.price.large) : "",
    inStock: p?.inStock ?? true,
    isActive: p?.isActive ?? true,
  };
}

function normalizePrice(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.round(n);
}

export default function ProductsPage() {
  const [query, setQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<
    ProductCategory[]
  >([]);

  // local copy so we can tweak in UI (until you wire API)
  const [products, setProducts] = React.useState<Product[]>(() =>
    PRODUCTS.map((p) => ({ ...p })),
  );

  // modal state
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "create">("edit");
  const [activeProductId, setActiveProductId] = React.useState<string | null>(
    null,
  );

  const activeProduct = React.useMemo(() => {
    if (!activeProductId) return null;
    return products.find((p) => p.id === activeProductId) ?? null;
  }, [products, activeProductId]);

  // form state (single source of truth for modal)
  const [form, setForm] = React.useState<ProductFormState>(() =>
    buildFormFromProduct(null),
  );

  // reset form when modal opens / target changes
  React.useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setForm(buildFormFromProduct(null));
    } else {
      setForm(buildFormFromProduct(activeProduct));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, activeProductId]);

  const filtered = React.useMemo(() => {
    return products.filter((product) => {
      const q = query.trim().toLowerCase();

      if (q) {
        const matchesQuery =
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(product.category)) return false;
      }

      return true;
    });
  }, [products, query, selectedCategories]);

  const hasActiveFilters = selectedCategories.length > 0;

  const clearFilters = () => setSelectedCategories([]);

  const openEdit = (productId: string) => {
    setMode("edit");
    setActiveProductId(productId);
    setOpen(true);
  };

  const openCreate = () => {
    setMode("create");
    setActiveProductId(null);
    setOpen(true);
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setOpen(false);
  };

  const save = () => {
    const name = form.name.trim();
    const image = form.image.trim();
    const medium = normalizePrice(form.mediumPrice);
    const large = normalizePrice(form.largePrice);

    if (!name) {
      alert("Product name is required.");
      return;
    }
    if (!image) {
      alert("Image URL is required.");
      return;
    }
    if (medium === null || large === null) {
      alert("Please enter valid prices for Medium and Large.");
      return;
    }

    if (mode === "create") {
      const newProduct: Product = {
        id: `prod_${Date.now()}`,
        name,
        category: form.category,
        image,
        price: { medium, large },
        inStock: form.inStock,
        isActive: true,
      };
      setProducts((prev) => [newProduct, ...prev]);
      setOpen(false);
      return;
    }

    if (!activeProduct) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === activeProduct.id
          ? {
              ...p,
              name,
              category: form.category,
              image,
              price: { medium, large },
              inStock: form.inStock,
                isActive: form.isActive,
            }
          : p,
      ),
    );
    setOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Manage menu items, pricing, stock status, and images.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or category…"
              className="pl-9"
            />
          </div>

          <Button onClick={openCreate} size="sm" className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                Category
                <ChevronDown className="h-4 w-4 opacity-50" />
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATEGORY_OPTIONS.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) => {
                    setSelectedCategories((prev) =>
                      checked
                        ? [...prev, category]
                        : prev.filter((c) => c !== category),
                    );
                  }}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}

              {selectedCategories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSelectedCategories([])}
                    className="text-sm text-muted-foreground justify-center"
                  >
                    Clear selection
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-2"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableCaption className="text-muted-foreground">
            Showing {filtered.length} product{filtered.length === 1 ? "" : "s"}.
          </TableCaption>

          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Medium</TableHead>
              <TableHead>Large</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.map((product) => (
              <TableRow
                key={product.id}
                className={`cursor-pointer hover:bg-accent/50 ${
                  !product.isActive ? "opacity-60" : ""
                }`}
                onClick={() => openEdit(product.id)}
              >
                <TableCell>
                  <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </TableCell>

                <TableCell className="font-medium">{product.name}</TableCell>

                <TableCell className="text-muted-foreground">
                  {product.category}
                </TableCell>

                <TableCell>{formatPrice(product.price.medium)}</TableCell>

                <TableCell>{formatPrice(product.price.large)}</TableCell>

                <TableCell>
                  <StockBadge inStock={product.inStock} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="default"
                    className={
                      product.isActive
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30"
                    }
                  >
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(product.id);
                    }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No products match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add New Product" : "Edit Product"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a new menu item with pricing, stock, and image."
                : "Update product details including pricing and stock status."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Classic Milk Tea"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, category: v as ProductCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Image URL</label>
                <Input
                  value={form.image}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, image: e.target.value }))
                  }
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">
                  Tip: use a stable image host so your menu stays consistent.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Medium Price (GHS)
                  </label>
                  <Input
                    type="number"
                    value={form.mediumPrice}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, mediumPrice: e.target.value }))
                    }
                    placeholder="38"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Large Price (GHS)
                  </label>
                  <Input
                    type="number"
                    value={form.largePrice}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, largePrice: e.target.value }))
                    }
                    placeholder="45"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Stock status</div>
                  <div className="text-xs text-muted-foreground">
                    Mark as out of stock to hide or prevent ordering.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, inStock: !p.inStock }))
                  }
                  className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition ${
                    form.inStock
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-red-500/30 bg-red-500/10"
                  }`}
                >
                  {form.inStock ? "In Stock" : "Out of Stock"}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    Storefront visibility
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Inactive removes it from the storefront completely (without
                    deleting).
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, isActive: !p.isActive }))
                  }
                  className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition ${
                    form.isActive
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-zinc-500/30 bg-zinc-500/10"
                  }`}
                >
                  {form.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>

            <Separator />

            <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
              {mode === "edit" && activeProduct ? (
                <Button
                  variant="destructive"
                  onClick={() => deleteProduct(activeProduct.id)}
                  className="sm:mr-auto"
                >
                  Delete Product
                </Button>
              ) : (
                <div className="sm:mr-auto" />
              )}

              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button onClick={save}>
                {mode === "create" ? "Create Product" : "Save Changes"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
