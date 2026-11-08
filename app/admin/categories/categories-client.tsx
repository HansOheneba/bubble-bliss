"use client";

import { Empty, PageHeader } from "@/components/admin/ledger";
import { MenuTabs } from "@/components/admin/tabs";

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
import { Plus, Trash2 } from "lucide-react";
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
      <div>
        <PageHeader
          title="Menu"
          action={
            <Button
              onClick={() => {
                setEditingCategory(null);
                setSheetOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="size-4" aria-hidden />
              Add category
            </Button>
          }
        />
        <MenuTabs active="categories" />

        {categories.length === 0 ? (
          <Empty>No categories yet. Add the first one.</Empty>
        ) : (
          <ul className="border-t border-dashed">
            {categories.map((cat) => {
              const count = productCounts[cat.id] ?? 0;
              return (
                <li key={cat.id} className="flex items-center gap-2 py-2 border-b border-dashed">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(cat);
                      setSheetOpen(true);
                    }}
                    className="flex-1 min-w-0 text-left active:!scale-[0.99]"
                  >
                    <span className="block text-sm font-medium truncate">{cat.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {count} {count === 1 ? "item" : "items"}, position {cat.sort_order ?? 0} on the till
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(cat);
                    }}
                    className="flex items-center justify-center rounded-md size-9 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
