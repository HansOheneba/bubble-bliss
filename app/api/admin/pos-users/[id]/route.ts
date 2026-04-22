import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import { logAdminActionWithEmail } from "@/lib/admin-logger";
import type { PosUser } from "@/lib/database.types";

// PATCH /api/admin/pos-users/[id] — update name, email, branchId, isActive
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const posUserId = Number(id);

  if (!posUserId || isNaN(posUserId)) {
    return NextResponse.json(
      { message: "Invalid POS user id" },
      { status: 400 },
    );
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
    .from("pos_users")
    .select("id, name, email, branch_id")
    .eq("id", posUserId)
    .single();

  if (!existing) {
    return NextResponse.json(
      { message: "POS user not found" },
      { status: 404 },
    );
  }

  const { data: updatedData, error } = await db
    .from("pos_users")
    .update(updates as never)
    .eq("id", posUserId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { message: `Email "${body.email}" is already in use` },
        { status: 409 },
      );
    }
    console.error("POS user update error:", error);
    return NextResponse.json(
      { message: "Failed to update POS user" },
      { status: 500 },
    );
  }

  const posUser = updatedData as PosUser;
  const adminUser = await currentUser();
  const adminEmail =
    adminUser?.emailAddresses
      .find((e) => e.id === adminUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase() ?? "unknown";
  if (body.isActive !== undefined) {
    void logAdminActionWithEmail(adminEmail, {
      action: body.isActive ? "pos_user.reactivate" : "pos_user.deactivate",
      description: `${body.isActive ? "Reactivated" : "Deactivated"} POS user "${posUser.name}"`,
      metadata: { id: posUser.id, name: posUser.name },
    });
  } else {
    const oldPosUser = existing as {
      name: string;
      email: string;
      branch_id: number;
    } | null;
    const posUserChanges: string[] = [];
    if (
      body.name !== undefined &&
      oldPosUser?.name &&
      oldPosUser.name !== body.name
    )
      posUserChanges.push(
        `name changed from "${oldPosUser.name}" to "${body.name}"`,
      );
    if (
      body.email !== undefined &&
      oldPosUser?.email &&
      oldPosUser.email !== body.email
    )
      posUserChanges.push(
        `email changed from "${oldPosUser.email}" to "${body.email}"`,
      );
    if (body.branchId !== undefined && oldPosUser?.branch_id !== body.branchId)
      posUserChanges.push(`branch reassigned`);
    const posUserDesc =
      posUserChanges.length > 0
        ? `Updated POS user "${posUser.name}": ${posUserChanges.join("; ")}`
        : `Updated POS user "${posUser.name}"`;
    void logAdminActionWithEmail(adminEmail, {
      action: "pos_user.update",
      description: posUserDesc,
      metadata: {
        id: posUser.id,
        name: posUser.name,
        email: posUser.email,
        branchId: posUser.branch_id,
        changes: posUserChanges,
      },
    });
  }

  return NextResponse.json({ posUser: posUser });
}

// DELETE /api/admin/pos-users/[id] — permanently delete a POS user
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const posUserId = Number(id);

  if (!posUserId || isNaN(posUserId)) {
    return NextResponse.json(
      { message: "Invalid POS user id" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: posUserRow } = await db
    .from("pos_users")
    .select("name, email")
    .eq("id", posUserId)
    .single();

  const { error } = await db.from("pos_users").delete().eq("id", posUserId);

  if (error) {
    console.error("POS user delete error:", error);
    return NextResponse.json(
      { message: "Failed to delete POS user" },
      { status: 500 },
    );
  }

  const adminUser = await currentUser();
  const adminEmail =
    adminUser?.emailAddresses
      .find((e) => e.id === adminUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase() ?? "unknown";
  void logAdminActionWithEmail(adminEmail, {
    action: "pos_user.delete",
    description: `Deleted POS user "${(posUserRow as { name: string } | null)?.name ?? posUserId}"`,
    metadata: { id: posUserId },
  });

  return new NextResponse(null, { status: 204 });
}
