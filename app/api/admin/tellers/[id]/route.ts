import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import { logAdminActionWithEmail } from "@/lib/admin-logger";
import type { Teller } from "@/lib/database.types";

// PATCH /api/admin/tellers/[id] — update name, email, branchId, isActive
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tellerId = Number(id);

  if (!tellerId || isNaN(tellerId)) {
    return NextResponse.json({ message: "Invalid teller id" }, { status: 400 });
  }

  let body: {
    name?: string;
    email?: string;
    branchId?: number;
    isActive?: boolean;
  };
  try {
    body = (await req.json()) as {
      name?: string;
      email?: string;
      branchId?: number;
      isActive?: boolean;
    };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.branchId !== undefined) updates.branch_id = body.branchId;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { message: "No updatable fields provided" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: existing } = await db
    .from("tellers")
    .select("id, name, email, branch_id")
    .eq("id", tellerId)
    .single();

  if (!existing) {
    return NextResponse.json({ message: "Teller not found" }, { status: 404 });
  }

  const { data: updatedData, error } = await db
    .from("tellers")
    .update(updates as never)
    .eq("id", tellerId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { message: `Email "${body.email}" is already in use` },
        { status: 409 },
      );
    }
    console.error("Teller update error:", error);
    return NextResponse.json(
      { message: "Failed to update teller" },
      { status: 500 },
    );
  }

  const teller = updatedData as Teller;
  const adminUser = await currentUser();
  const adminEmail =
    adminUser?.emailAddresses
      .find((e) => e.id === adminUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase() ?? "unknown";
  if (body.isActive !== undefined) {
    void logAdminActionWithEmail(adminEmail, {
      action: body.isActive ? "teller.reactivate" : "teller.deactivate",
      description: `${body.isActive ? "Reactivated" : "Deactivated"} teller "${teller.name}"`,
      metadata: { id: teller.id, name: teller.name },
    });
  } else {
    const oldTeller = existing as {
      name: string;
      email: string;
      branch_id: number;
    } | null;
    const tellerChanges: string[] = [];
    if (
      body.name !== undefined &&
      oldTeller?.name &&
      oldTeller.name !== body.name
    )
      tellerChanges.push(
        `name changed from "${oldTeller.name}" to "${body.name}"`,
      );
    if (
      body.email !== undefined &&
      oldTeller?.email &&
      oldTeller.email !== body.email
    )
      tellerChanges.push(
        `email changed from "${oldTeller.email}" to "${body.email}"`,
      );
    if (body.branchId !== undefined && oldTeller?.branch_id !== body.branchId)
      tellerChanges.push(`branch reassigned`);
    const tellerDesc =
      tellerChanges.length > 0
        ? `Updated teller "${teller.name}": ${tellerChanges.join("; ")}`
        : `Updated teller "${teller.name}"`;
    void logAdminActionWithEmail(adminEmail, {
      action: "teller.update",
      description: tellerDesc,
      metadata: {
        id: teller.id,
        name: teller.name,
        email: teller.email,
        branchId: teller.branch_id,
        changes: tellerChanges,
      },
    });
  }

  return NextResponse.json({
    id: teller.id,
    email: teller.email,
    name: teller.name,
    isActive: teller.is_active,
    branchId: teller.branch_id,
  });
}

// DELETE /api/admin/tellers/[id] — deactivate (soft delete)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tellerId = Number(id);

  if (!tellerId || isNaN(tellerId)) {
    return NextResponse.json({ message: "Invalid teller id" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: existing } = await db
    .from("tellers")
    .select("id")
    .eq("id", tellerId)
    .single();

  if (!existing) {
    return NextResponse.json({ message: "Teller not found" }, { status: 404 });
  }

  await db
    .from("tellers")
    .update({ is_active: false } as never)
    .eq("id", tellerId);

  const adminUser = await currentUser();
  const adminEmail =
    adminUser?.emailAddresses
      .find((e) => e.id === adminUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase() ?? "unknown";
  const { data: tellerRow } = await db
    .from("tellers")
    .select("name")
    .eq("id", tellerId)
    .single();
  void logAdminActionWithEmail(adminEmail, {
    action: "teller.deactivate",
    description: `Deactivated teller "${(tellerRow as { name: string } | null)?.name ?? tellerId}"`,
    metadata: { id: tellerId },
  });

  return NextResponse.json({ success: true });
}
