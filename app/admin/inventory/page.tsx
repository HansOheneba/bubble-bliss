"use client";

import * as React from "react";

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

import {
  ChevronDown,
  Search,
  X,
  Plus,
  AlertTriangle,
  Minus,
  Pencil,
} from "lucide-react";

type InventoryCategory =
  | "Cups"
  | "Lids"
  | "Straws"
  | "Wraps"
  | "Packaging"
  | "Ingredients"
  | "Sauces"
  | "Other";

type InventoryUnit = "pcs" | "packs" | "boxes" | "ml" | "g" | "kg";

type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  quantity: number;
  reorderLevel: number;
  location?: string;
  notes?: string;
  isActive: boolean;
  updatedAt: string; // ISO
};

const CATEGORY_OPTIONS: InventoryCategory[] = [
  "Cups",
  "Lids",
  "Straws",
  "Wraps",
  "Packaging",
  "Ingredients",
  "Sauces",
  "Other",
];

const UNIT_OPTIONS: InventoryUnit[] = [
  "pcs",
  "packs",
  "boxes",
  "ml",
  "g",
  "kg",
];

// Demo data (replace later with DB/API)
const INVENTORY: InventoryItem[] = [
  {
    id: "inv_001",
    name: "Bubble Tea Cup (Medium)",
    category: "Cups",
    unit: "pcs",
    quantity: 180,
    reorderLevel: 80,
    location: "Store room",
    notes: "Clear cups",
    isActive: true,
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "inv_002",
    name: "Bubble Tea Cup (Large)",
    category: "Cups",
    unit: "pcs",
    quantity: 55,
    reorderLevel: 80,
    location: "Store room",
    notes: "Large size cups",
    isActive: true,
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "inv_003",
    name: "Shawarma Wraps",
    category: "Wraps",
    unit: "packs",
    quantity: 9,
    reorderLevel: 6,
    location: "Back fridge",
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inv_004",
    name: "Straws (Wide)",
    category: "Straws",
    unit: "pcs",
    quantity: 120,
    reorderLevel: 100,
    location: "Front counter",
    isActive: true,
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function daysAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function StockLevelBadge({ item }: { item: InventoryItem }) {
  const low = item.quantity <= item.reorderLevel;
  return (
    <Badge
      className={
        low
          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
          : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
      }
      variant="default"
    >
      {low ? "Low" : "OK"}
    </Badge>
  );
}

type ItemFormState = {
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  quantity: string;
  reorderLevel: string;
  location: string;
  notes: string;
  isActive: boolean;
};

function buildFormFromItem(item: InventoryItem | null): ItemFormState {
  return {
    name: item?.name ?? "",
    category: item?.category ?? "Cups",
    unit: item?.unit ?? "pcs",
    quantity: item ? String(item.quantity) : "",
    reorderLevel: item ? String(item.reorderLevel) : "",
    location: item?.location ?? "",
    notes: item?.notes ?? "",
    isActive: item?.isActive ?? true,
  };
}

function parseNonNegativeInt(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.floor(n);
}

export default function InventoryPage() {
  const [query, setQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<
    InventoryCategory[]
  >([]);
  const [showInactive, setShowInactive] = React.useState(false);
  const [onlyLowStock, setOnlyLowStock] = React.useState(false);

  const [items, setItems] = React.useState<InventoryItem[]>(() =>
    INVENTORY.map((i) => ({ ...i })),
  );

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "create">("edit");
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);

  const activeItem = React.useMemo(() => {
    if (!activeItemId) return null;
    return items.find((i) => i.id === activeItemId) ?? null;
  }, [items, activeItemId]);

  const [form, setForm] = React.useState<ItemFormState>(() =>
    buildFormFromItem(null),
  );

  React.useEffect(() => {
    if (!open) return;
    if (mode === "create") setForm(buildFormFromItem(null));
    else setForm(buildFormFromItem(activeItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, activeItemId]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (!showInactive && !item.isActive) return false;

        if (q) {
          const matches =
            item.name.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            (item.location ?? "").toLowerCase().includes(q);
          if (!matches) return false;
        }

        if (selectedCategories.length > 0) {
          if (!selectedCategories.includes(item.category)) return false;
        }

        if (onlyLowStock) {
          if (item.quantity > item.reorderLevel) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Low stock first, then alphabetical
        const lowA = a.quantity <= a.reorderLevel ? 0 : 1;
        const lowB = b.quantity <= b.reorderLevel ? 0 : 1;
        if (lowA !== lowB) return lowA - lowB;
        return a.name.localeCompare(b.name);
      });
  }, [items, query, selectedCategories, showInactive, onlyLowStock]);

  const hasActiveFilters =
    selectedCategories.length > 0 || showInactive || onlyLowStock;

  const clearFilters = () => {
    setSelectedCategories([]);
    setShowInactive(false);
    setOnlyLowStock(false);
  };

  const openEdit = (id: string) => {
    setMode("edit");
    setActiveItemId(id);
    setOpen(true);
  };

  const openCreate = () => {
    setMode("create");
    setActiveItemId(null);
    setOpen(true);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setOpen(false);
  };

  const save = () => {
    const name = form.name.trim();
    const quantity = parseNonNegativeInt(form.quantity);
    const reorderLevel = parseNonNegativeInt(form.reorderLevel);

    if (!name) {
      alert("Item name is required.");
      return;
    }
    if (quantity === null) {
      alert("Please enter a valid quantity (0 or more).");
      return;
    }
    if (reorderLevel === null) {
      alert("Please enter a valid reorder level (0 or more).");
      return;
    }

    const payload = {
      name,
      category: form.category,
      unit: form.unit,
      quantity,
      reorderLevel,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
      updatedAt: new Date().toISOString(),
    };

    if (mode === "create") {
      const newItem: InventoryItem = {
        id: `inv_${Date.now()}`,
        ...payload,
      };
      setItems((prev) => [newItem, ...prev]);
      setOpen(false);
      return;
    }

    if (!activeItem) return;

    setItems((prev) =>
      prev.map((i) => (i.id === activeItem.id ? { ...i, ...payload } : i)),
    );
    setOpen(false);
  };

  const quickAdjust = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = Math.max(0, i.quantity + delta);
        return { ...i, quantity: next, updatedAt: new Date().toISOString() };
      }),
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Tablet-first view: cards on small/medium screens, table on desktop.
          Low-stock items float to the top.
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
              placeholder="Search by item, category, location…"
              className="pl-9"
            />
          </div>

          <Button onClick={openCreate} size="sm" className="h-10 gap-2">
            <Plus className="h-4 w-4" />
            Add Inventory Item
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Category */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
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

          {/* Low stock only */}
          <Button
            variant={onlyLowStock ? "default" : "outline"}
            size="sm"
            className="h-10 gap-2"
            onClick={() => setOnlyLowStock((v) => !v)}
          >
            <AlertTriangle className="h-4 w-4" />
            Low stock
          </Button>

          {/* Show inactive */}
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            className="h-10 gap-2"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Showing inactive" : "Hide inactive"}
          </Button>

          {/* Reset */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-10 gap-2"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ✅ Cards (tablet + mobile) */}
      <div className="grid gap-3 xl:hidden">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border bg-background p-4 shadow-sm ${
              !item.isActive ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold truncate">{item.name}</div>
                  {!item.isActive ? (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  ) : null}
                  <StockLevelBadge item={item} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.category} • {item.location ?? "—"}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3 gap-2"
                onClick={() => openEdit(item.id)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">In stock</div>
                <div className="text-2xl font-bold leading-none">
                  {item.quantity}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {item.unit}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Reorder at {item.reorderLevel} • Updated{" "}
                  {daysAgo(item.updatedAt)}
                </div>
              </div>

              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 w-12 p-0"
                  onClick={() => quickAdjust(item.id, -1)}
                  disabled={!item.isActive}
                  aria-label="Decrease by 1"
                >
                  <Minus className="h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 px-4"
                  onClick={() => quickAdjust(item.id, +1)}
                  disabled={!item.isActive}
                >
                  +1
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 px-4"
                  onClick={() => quickAdjust(item.id, +10)}
                  disabled={!item.isActive}
                >
                  +10
                </Button>
              </div>
            </div>

            {item.notes ? (
              <div className="mt-3 text-sm text-muted-foreground">
                {item.notes}
              </div>
            ) : null}
          </div>
        ))}

        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-background p-10 text-center text-muted-foreground">
            No inventory items match your filters.
          </div>
        ) : null}
      </div>

      {/* ✅ Table (desktop only) */}
      <div className="hidden xl:block rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableCaption className="text-muted-foreground">
            Showing {filtered.length} item{filtered.length === 1 ? "" : "s"}.
          </TableCaption>

          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Reorder</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Quick adjust</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.map((item) => (
              <TableRow
                key={item.id}
                className={`cursor-pointer hover:bg-accent/50 ${
                  !item.isActive ? "opacity-60" : ""
                }`}
                onClick={() => openEdit(item.id)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.name}
                    {!item.isActive ? (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  {item.notes ? (
                    <div className="text-xs text-muted-foreground">
                      {item.notes}
                    </div>
                  ) : null}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {item.category}
                </TableCell>

                <TableCell className="font-medium">{item.quantity}</TableCell>

                <TableCell className="text-muted-foreground">
                  {item.unit}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {item.reorderLevel}
                </TableCell>

                <TableCell>
                  <StockLevelBadge item={item} />
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {item.location ?? "—"}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {daysAgo(item.updatedAt)}
                </TableCell>

                <TableCell className="text-right">
                  <div
                    className="inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2"
                      onClick={() => quickAdjust(item.id, -1)}
                      disabled={!item.isActive}
                    >
                      -1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2"
                      onClick={() => quickAdjust(item.id, +1)}
                      disabled={!item.isActive}
                    >
                      +1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2"
                      onClick={() => quickAdjust(item.id, +10)}
                      disabled={!item.isActive}
                    >
                      +10
                    </Button>
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(item.id);
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
                  colSpan={10}
                  className="py-10 text-center text-muted-foreground"
                >
                  No inventory items match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Modal (unchanged) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add Inventory Item" : "Edit Inventory Item"}
            </DialogTitle>
            <DialogDescription>
              Track quantity, reorder threshold, and whether you’re actively
              tracking the item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Bubble Tea Cup (Medium)"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        category: v as InventoryCategory,
                      }))
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
                  <label className="text-sm font-medium">Unit</label>
                  <Select
                    value={form.unit}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, unit: v as InventoryUnit }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity</label>
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quantity: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Reorder level</label>
                  <Input
                    type="number"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, reorderLevel: e.target.value }))
                    }
                    placeholder="e.g., 50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Location (optional)
                </label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g., Store room, Front counter"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Supplier, pack size, expiry notes…"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Tracking</div>
                  <div className="text-xs text-muted-foreground">
                    Inactive keeps the record but hides it from the default
                    list.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, isActive: !p.isActive }))
                  }
                  className={`inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition ${
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
              {mode === "edit" && activeItem ? (
                <Button
                  variant="destructive"
                  onClick={() => deleteItem(activeItem.id)}
                  className="sm:mr-auto"
                >
                  Delete Item
                </Button>
              ) : (
                <div className="sm:mr-auto" />
              )}

              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button onClick={save}>
                {mode === "create" ? "Create Item" : "Save Changes"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
