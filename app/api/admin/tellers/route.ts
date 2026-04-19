import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Teller, Branch, PosUser } from "@/lib/database.types";

type TellerRow = Teller & { branch: Branch | null };

// GET /api/admin/tellers
// ?pos_user_email=hans@gmail.com  — fetch tellers for the branch linked to this POS user
// ?branchSlug=cape-coast           — fetch tellers for a specific branch (alternative)
// No filter returns all tellers (admin use)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const posUserEmail = searchParams.get("pos_user_email");
  const branchSlug = searchParams.get("branchSlug");

  const db = createAdminClient();

  let branchId: number | null = null;

  if (posUserEmail) {
    const { data: posUserData } = await db
      .from("pos_users")
      .select("branch_id, is_active")
      .eq("email", posUserEmail)
      .single();
    const posUser = posUserData as Pick<
      PosUser,
      "branch_id" | "is_active"
    > | null;

    if (!posUser) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" not found` },
        { status: 404 },
      );
    }
    if (!posUser.is_active) {
      return NextResponse.json(
        { message: `POS user "${posUserEmail}" is inactive` },
        { status: 403 },
      );
    }
    branchId = posUser.branch_id;
  } else if (branchSlug) {
    const { data: branchData } = await db
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .single();
    if (!branchData) {
      return NextResponse.json(
        { message: `Branch "${branchSlug}" not found` },
        { status: 404 },
      );
    }
    branchId = (branchData as { id: number }).id;
  }

  let query = db
    .from("tellers")
    .select("*, branch:branches(*)")
    .order("name", { ascending: true });

  if (branchId !== null) {
    query = query.eq("branch_id", branchId);
  }

  const { data: rawTellers, error } = await query;

  if (error) {
    console.error("Tellers fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch tellers" },
      { status: 500 },
    );
  }

  const tellers = (rawTellers ?? []) as unknown as TellerRow[];

  return NextResponse.json({
    tellers: tellers.map((t) => ({
      id: t.id,
      email: t.email,
      name: t.name,
      isActive: t.is_active,
      createdAt: t.created_at,
      branch: t.branch
        ? { id: t.branch.id, slug: t.branch.slug, name: t.branch.name }
        : null,
    })),
  });
}

// POST /api/admin/tellers — create a new teller
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

  // Verify branch exists
  const { data: branchData } = await db
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .single();
  if (!branchData) {
    return NextResponse.json(
      { message: `Branch ${branchId} not found` },
      { status: 400 },
    );
  }

  const { data: inserted, error } = await db
    .from("tellers")
    .insert({ email, name, branch_id: branchId } as never)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { message: `A teller with email "${email}" already exists` },
        { status: 409 },
      );
    }
    console.error("Teller create error:", error);
    return NextResponse.json(
      { message: "Failed to create teller" },
      { status: 500 },
    );
  }

  const teller = inserted as Teller;

  return NextResponse.json(
    {
      id: teller.id,
      email: teller.email,
      name: teller.name,
      isActive: teller.is_active,
      branchId: teller.branch_id,
    },
    { status: 201 },
  );
}
