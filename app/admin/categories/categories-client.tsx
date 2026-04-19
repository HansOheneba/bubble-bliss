"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions";
import type { Category } from "@/lib/database.types";
import type { CategoryInput } from "@/lib/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  initialCategories: Category[];
  countByCat: Record<number, number>;
};

type FormValues = {
  name: string;
  slug: string;
  sort_order: string;
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultForm(): FormValues {
  return { name: "", slug: "", sort_order: "0" };
}

function categoryToForm(cat: Category): FormValues {
  return {
    name: cat.name,
    slug: cat.slug,
    sort_order: String(cat.sort_order ?? 0),
  };
}

function formToPayload(values: FormValues): CategoryInput {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    sort_order: Number(values.sort_order) || 0,
  };
}

// ── Category Form Sheet ───────────────────────────────────────────────────────

function CategoryFormSheet({
  open,
  onClose,
  editingCategory,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingCategory: Category | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormValues>(defaultForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(
        editingCategory ? categoryToForm(editingCategory) : defaultForm(),
      );
      setFormError(null);
    }
  }, [open, editingCategory]);

  function setField<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : slugify(name),
    }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Category name is required.";
    if (!form.slug.trim()) return "Slug is required.";
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
    const payload = formToPayload(form);
    const result = editingCategory
      ? await updateCategory(editingCategory.id, payload)
      : await createCategory(payload);
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
      <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>
            {editingCategory ? "Edit Category" : "Add Category"}
          </SheetTitle>
          <SheetDescription>
            {editingCategory
              ? "Update category name, slug, and display order."
              : "Create a new product category."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Name + Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">Name *</Label>
            <Input
              id="cf-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Milk Tea"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-slug">Slug *</Label>
            <Input
              id="cf-slug"
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              placeholder="milk-tea"
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs. Auto-generated from name.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-sort">Sort order</Label>
            <Input
              id="cf-sort"
              type="number"
              value={form.sort_order}
              onChange={(e) => setField("sort_order", e.target.value)}
              placeholder="0"
            />
          </div>

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
                : editingCategory
                  ? "Save changes"
                  : "Add category"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CategoriesClient({
  initialCategories,
  countByCat,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] =
    React.useState<Category[]>(initialCategories);
  const [productCounts, setProductCounts] =
    React.useState<Record<number, number>>(countByCat);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCategories(initialCategories);
    setProductCounts(countByCat);
  }, [initialCategories, countByCat]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteCategory(deleteTarget.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleting(false);
    } else {
      setDeleteTarget(null);
      setDeleting(false);
      router.refresh();
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Categories
            </h1>
            <p className="text-sm text-muted-foreground">
              {categories.length}{" "}
              {categories.length === 1 ? "category" : "categories"} total
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingCategory(null);
              setSheetOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        </div>

        <div className="rounded-xl border overflow-hidden">
          {categories.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No categories yet. Add one to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Products
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {cat.slug}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {productCounts[cat.id] ?? 0} products
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cat.sort_order ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setSheetOpen(true);
                          }}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Edit category"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(cat);
                          }}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CategoryFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editingCategory={editingCategory}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>{" "}
              category. Products in this category must be reassigned first.
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
