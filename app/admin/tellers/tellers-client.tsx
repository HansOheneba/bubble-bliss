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
import { Plus, Pencil, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Teller, Branch } from "@/lib/database.types";

type TellerWithBranch = Teller & { branch: Branch | null };

type Props = {
  initialTellers: TellerWithBranch[];
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

function tellerToForm(t: TellerWithBranch): FormValues {
  return { name: t.name, email: t.email, branchId: String(t.branch_id) };
}

export default function TellersClient({ initialTellers, branches }: Props) {
  const router = useRouter();
  const [tellers, setTellers] = React.useState(initialTellers);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TellerWithBranch | null>(null);
  const [form, setForm] = React.useState<FormValues>(defaultForm());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [deactivateTarget, setDeactivateTarget] =
    React.useState<TellerWithBranch | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setError("");
    setSheetOpen(true);
  }

  function openEdit(t: TellerWithBranch) {
    setEditing(t);
    setForm(tellerToForm(t));
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
        const res = await fetch(`/api/admin/tellers/${editing.id}`, {
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
          setError(json.message ?? "Failed to update teller.");
          return;
        }
      } else {
        const res = await fetch("/api/admin/tellers", {
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
          setError(json.message ?? "Failed to create teller.");
          return;
        }
      }
      setSheetOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    await fetch(`/api/admin/tellers/${deactivateTarget.id}`, {
      method: "DELETE",
    });
    setDeactivateTarget(null);
    router.refresh();
  }

  async function handleReactivate(t: TellerWithBranch) {
    await fetch(`/api/admin/tellers/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    router.refresh();
  }

  // Keep local state in sync with server refreshes
  React.useEffect(() => {
    setTellers(initialTellers);
  }, [initialTellers]);

  const active = tellers.filter((t) => t.is_active);
  const inactive = tellers.filter((t) => !t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tellers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff accounts and branch assignments.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Teller
        </Button>
      </div>

      {/* Active tellers */}
      <div className="space-y-3">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No tellers yet. Add one to get started.
          </p>
        )}
        {active.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.email}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {t.branch?.name ?? "Unknown branch"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeactivateTarget(t)}
              >
                <UserX className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Inactive tellers */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Inactive
          </p>
          {inactive.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg bg-card opacity-60",
              )}
            >
              <div className="space-y-0.5">
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.email}</p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {t.branch?.name ?? "Unknown branch"}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReactivate(t)}
              >
                Reactivate
              </Button>
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
            <SheetTitle>{editing ? "Edit Teller" : "New Teller"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update this teller&apos;s details."
                : "Add a new teller and assign them to a branch."}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Jane Asante"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="jane@bubbleblisscafe.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch</Label>
              <Select
                value={form.branchId}
                onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
              >
                <SelectTrigger id="branch">
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
                    : "Create Teller"}
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

      {/* Deactivate confirm */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => {
          if (!o) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate teller?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name} will no longer be able to be assigned to
              orders. You can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
