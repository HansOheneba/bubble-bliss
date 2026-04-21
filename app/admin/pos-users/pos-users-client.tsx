"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PosUser, Branch } from "@/lib/database.types";

type PosUserWithBranch = PosUser & { branch: Branch | null };

type Props = {
  initialPosUsers: PosUserWithBranch[];
  branches: Branch[];
};

type FormValues = {
  name: string;
  email: string;
  branchId: string;
};

function defaultForm(): FormValues {
  return { name: "", email: "", branchId: "" };
}

function posUserToForm(u: PosUserWithBranch): FormValues {
  return {
    name: u.name ?? "",
    email: u.email,
    branchId: String(u.branch_id),
  };
}

export default function PosUsersClient({ initialPosUsers, branches }: Props) {
  const router = useRouter();
  const [posUsers, setPosUsers] = React.useState(initialPosUsers);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PosUserWithBranch | null>(null);
  const [form, setForm] = React.useState<FormValues>(defaultForm());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [deleteTarget, setDeleteTarget] =
    React.useState<PosUserWithBranch | null>(null);

  React.useEffect(() => {
    setPosUsers(initialPosUsers);
  }, [initialPosUsers]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setError("");
    setSheetOpen(true);
  }

  function openEdit(u: PosUserWithBranch) {
    setEditing(u);
    setForm(posUserToForm(u));
    setError("");
    setSheetOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.branchId) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/admin/pos-users/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            branchId: Number(form.branchId),
          }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { message: string };
          setError(json.message ?? "Failed to update POS user.");
          return;
        }
      } else {
        const res = await fetch("/api/admin/pos-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            branchId: Number(form.branchId),
          }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { message: string };
          setError(json.message ?? "Failed to create POS user.");
          return;
        }
      }
      setSheetOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u: PosUserWithBranch) {
    await fetch(`/api/admin/pos-users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.is_active }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/pos-users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    router.refresh();
  }

  const active = posUsers.filter((u) => u.is_active);
  const inactive = posUsers.filter((u) => !u.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">POS Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage point-of-sale login accounts and branch assignments.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add POS User
        </Button>
      </div>

      {/* Active POS users */}
      <div className="space-y-3">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No POS users yet. Add one to get started.
          </p>
        )}
        {active.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-sm">{u.name ?? u.email}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {u.branch?.name ?? "Unknown branch"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleActive(u)}
              >
                Deactivate
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(u)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Inactive POS users */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Inactive
          </p>
          {inactive.map((u) => (
            <div
              key={u.id}
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg bg-card opacity-60",
              )}
            >
              <div className="space-y-0.5">
                <p className="font-medium text-sm">{u.name ?? u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {u.branch?.name ?? "Unknown branch"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(u)}
                >
                  Reactivate
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(u)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit POS User" : "New POS User"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "Update this POS user&apos;s details."
                : "Add a new POS login account and assign it to a branch."}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pos-name">Display Name</Label>
              <Input
                id="pos-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Accra POS"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-email">Email</Label>
              <Input
                id="pos-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="accra@bubbleblisscafe.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-branch">Branch</Label>
              <Select
                value={form.branchId}
                onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
              >
                <SelectTrigger id="pos-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create POS User"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete POS user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">
                {deleteTarget?.name ?? deleteTarget?.email}
              </span>{" "}
              and cannot be undone. To temporarily disable access instead, use
              Deactivate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
