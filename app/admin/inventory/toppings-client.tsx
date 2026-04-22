"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { createTopping, updateTopping, deleteTopping } from "@/lib/actions";
import type {
  ToppingWithBranchAvailability,
  Branch,
} from "@/lib/database.types";
import type { ToppingInput } from "@/lib/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  initialToppings: ToppingWithBranchAvailability[];
  branches: Branch[];
};

type FormValues = {
  name: string;
  price_ghs: string;
  sort_order: string;
  is_active: boolean;
  in_stock: boolean;
  restrict_branches: boolean;
  branch_ids: number[];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatMoney(pesewas: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(pesewas / 100);
}

function defaultForm(): FormValues {
  return {
    name: "",
    price_ghs: "",
    sort_order: "0",
    is_active: true,
    in_stock: true,
    restrict_branches: false,
    branch_ids: [],
  };
}

function toppingToForm(t: ToppingWithBranchAvailability): FormValues {
  return {
    name: t.name,
    price_ghs: String(t.price_in_pesewas / 100),
    sort_order: String(t.sort_order ?? 0),
    is_active: t.is_active ?? true,
    in_stock: t.in_stock ?? true,
    restrict_branches: (t.branch_availability?.length ?? 0) > 0,
    branch_ids: t.branch_availability?.map((ba) => ba.branch_id) ?? [],
  };
}

function formToPayload(values: FormValues): {
  topping: ToppingInput;
  branchIds: number[];
} {
  return {
    topping: {
      name: values.name.trim(),
      price_in_pesewas: Math.round(parseFloat(values.price_ghs || "0") * 100),
      sort_order: Number(values.sort_order) || 0,
      is_active: values.is_active,
      in_stock: values.in_stock,
    },
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

// ── Topping Form Sheet ────────────────────────────────────────────────────────

function ToppingFormSheet({
  open,
  onClose,
  editingTopping,
  branches,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingTopping: ToppingWithBranchAvailability | null;
  branches: Branch[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormValues>(defaultForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(editingTopping ? toppingToForm(editingTopping) : defaultForm());
      setFormError(null);
    }
  }, [open, editingTopping]);

  function setField<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function toggleBranch(branchId: number) {
    const ids = form.branch_ids.includes(branchId)
      ? form.branch_ids.filter((id) => id !== branchId)
      : [...form.branch_ids, branchId];
    setField("branch_ids", ids);
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Topping name is required.";
    if (!form.price_ghs || parseFloat(form.price_ghs) < 0)
      return "A valid price is required.";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { topping, branchIds } = formToPayload(form);
    const result = editingTopping
      ? await updateTopping(editingTopping.id, topping, branchIds)
      : await createTopping(topping, branchIds);
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
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>
            {editingTopping ? "Edit Topping" : "Add Topping"}
          </SheetTitle>
          <SheetDescription>
            {editingTopping
              ? "Update topping details and branch availability."
              : "Fill in the details to add a new topping."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Name + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tf-name">Name *</Label>
              <Input
                id="tf-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Tapioca Pearls"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-price">Price (GHS) *</Label>
              <Input
                id="tf-price"
                type="number"
                step="0.01"
                min="0"
                value={form.price_ghs}
                onChange={(e) => setField("price_ghs", e.target.value)}
                placeholder="5.00"
              />
            </div>
          </div>

          {/* Sort order */}
          <div className="space-y-1.5">
            <Label htmlFor="tf-sort">Sort order</Label>
            <Input
              id="tf-sort"
              type="number"
              value={form.sort_order}
              onChange={(e) => setField("sort_order", e.target.value)}
              placeholder="0"
            />
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

          {/* Branch Availability */}
          {branches.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4">
              <span className="text-sm font-medium">Branch Availability</span>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tf-branch-mode"
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
                    name="tf-branch-mode"
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
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : editingTopping
                  ? "Save changes"
                  : "Add topping"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ToppingsClient({ initialToppings, branches }: Props) {
  const router = useRouter();
  const [toppings, setToppings] =
    React.useState<ToppingWithBranchAvailability[]>(initialToppings);
  const [query, setQuery] = React.useState("");
  const [updating, setUpdating] = React.useState<Record<number, boolean>>({});
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingTopping, setEditingTopping] =
    React.useState<ToppingWithBranchAvailability | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ToppingWithBranchAvailability | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setToppings(initialToppings);
  }, [initialToppings]);

  async function toggleActive(topping: ToppingWithBranchAvailability) {
    const next = !topping.is_active;
    setUpdating((prev) => ({ ...prev, [topping.id]: true }));
    const { error } = await supabase
      .from("toppings")
      .update({ is_active: next } as never)
      .eq("id", topping.id);
    if (!error) {
      setToppings((prev) =>
        prev.map((t) => (t.id === topping.id ? { ...t, is_active: next } : t)),
      );
    }
    setUpdating((prev) => ({ ...prev, [topping.id]: false }));
  }

  async function toggleStock(topping: ToppingWithBranchAvailability) {
    const next = !topping.in_stock;
    setUpdating((prev) => ({ ...prev, [topping.id]: true }));
    const { error } = await supabase
      .from("toppings")
      .update({ in_stock: next } as never)
      .eq("id", topping.id);
    if (!error) {
      setToppings((prev) =>
        prev.map((t) => (t.id === topping.id ? { ...t, in_stock: next } : t)),
      );
    }
    setUpdating((prev) => ({ ...prev, [topping.id]: false }));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteTopping(deleteTarget.id);
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
    if (!q) return toppings;
    return toppings.filter((t) => t.name.toLowerCase().includes(q));
  }, [toppings, query]);

  const activeCount = toppings.filter((t) => t.is_active).length;
  const inStockCount = toppings.filter((t) => t.in_stock).length;

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Toppings</h1>
            <p className="text-sm text-muted-foreground">
              {activeCount} active, {inStockCount} in stock out of{" "}
              {toppings.length} total.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search toppings..."
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingTopping(null);
                setSheetOpen(true);
              }}
              className="gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add topping
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((topping) => (
            <div
              key={topping.id}
              className={cn(
                "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-opacity",
                !topping.is_active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {topping.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatMoney(topping.price_in_pesewas)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {topping.is_active ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-green-500/30 text-green-700 dark:text-green-400"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs border-red-500/30 text-red-700 dark:text-red-400"
                    >
                      Inactive
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTopping(topping);
                      setSheetOpen(true);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit topping"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(topping);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete topping"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Branch availability */}
              {branches.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(topping.branch_availability?.length ?? 0) === 0 ? (
                    <Badge
                      variant="outline"
                      className="text-xs text-muted-foreground"
                    >
                      All branches
                    </Badge>
                  ) : (
                    topping.branch_availability.map((ba) => {
                      const b = branches.find((br) => br.id === ba.branch_id);
                      return (
                        <Badge
                          key={ba.branch_id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {b?.name ?? `Branch ${ba.branch_id}`}
                        </Badge>
                      );
                    })
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active</span>
                  <Toggle
                    checked={topping.is_active ?? false}
                    onChange={() => toggleActive(topping)}
                    disabled={updating[topping.id]}
                    label="Toggle active"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">In stock</span>
                  <Toggle
                    checked={topping.in_stock ?? false}
                    onChange={() => toggleStock(topping)}
                    disabled={updating[topping.id]}
                    label="Toggle stock"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            {query
              ? "No toppings match your search."
              : "No toppings yet. Add one to get started."}
          </div>
        )}
      </div>

      <ToppingFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingTopping={editingTopping}
        branches={branches}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete topping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>. This
              cannot be undone.
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
