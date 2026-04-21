import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
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
    .select("id")
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

  return NextResponse.json({ posUser: updatedData as PosUser });
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

  const { error } = await db
    .from("pos_users")
    .delete()
    .eq("id", posUserId);

  if (error) {
    console.error("POS user delete error:", error);
    return NextResponse.json(
      { message: "Failed to delete POS user" },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
