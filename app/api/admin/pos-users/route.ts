import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { PosUser, Branch } from "@/lib/database.types";

type PosUserRow = PosUser & { branch: Branch | null };

// GET /api/admin/pos-users
export async function GET() {
  const db = createAdminClient();

  const { data, error } = await db
    .from("pos_users")
    .select("*, branch:branches(*)")
    .order("name", { ascending: true });

  if (error) {
    console.error("POS users fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch POS users" },
      { status: 500 },
    );
  }

  const users = (data ?? []) as unknown as PosUserRow[];

  return NextResponse.json({
    posUsers: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.is_active,
      createdAt: u.created_at,
      branchId: u.branch_id,
      branch: u.branch
        ? { id: u.branch.id, slug: u.branch.slug, name: u.branch.name }
        : null,
    })),
  });
}

// POST /api/admin/pos-users — create a new POS user
export async function POST(req: NextRequest) {
  let body: { email: string; name: string; branchId: number };
  try {
    body = (await req.json()) as {
      email: string;
      name: string;
      branchId: number;
    };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { email, name, branchId } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ message: "email is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  if (!branchId || typeof branchId !== "number") {
    return NextResponse.json(
      { message: "branchId is required and must be a number" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data, error } = await db
    .from("pos_users")
    .insert({
      email: email.trim(),
      name: name.trim(),
      branch_id: branchId,
    } as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { message: `Email "${email}" is already in use` },
        { status: 409 },
      );
    }
    console.error("POS user create error:", error);
    return NextResponse.json(
      { message: "Failed to create POS user" },
      { status: 500 },
    );
  }

  return NextResponse.json({ posUser: data as PosUser }, { status: 201 });
}
