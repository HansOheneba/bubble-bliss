import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { authenticatePosRequest } from "@/lib/pos-auth";
import type { Teller, Branch } from "@/lib/database.types";

type TellerRow = Teller & { branch: Branch | null };

// GET /api/admin/tellers
// Auth: POS Bearer key (scopes to their branch) OR admin Clerk session
// ?branchSlug=cape-coast — admin only: filter by branch slug
// No branchSlug + admin = all tellers

export async function GET(req: NextRequest) {
  const posUser = await authenticatePosRequest(req);
  const isAdmin = posUser ? false : await requireAdmin();
  if (!posUser && !isAdmin) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branchSlug");

  const db = createAdminClient();

  let branchId: number | null = null;

  // POS key — branch is always the one tied to their API key
  if (posUser) {
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

// POST /api/admin/tellers — create a new teller (admin only)
export async function POST(req: NextRequest) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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
