import { NextRequest, NextResponse } from "next/server";

import { authenticatePos } from "@/lib/pos/auth";
import { createAdminClient } from "@/lib/supabase";

// GET /api/pos/v1/tellers — active cashiers at the signed-in branch.
export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  const db = createAdminClient();
  const { data, error } = await db
    .from("tellers")
    .select("id, name")
    .eq("branch_id", auth.ctx.branch.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[pos/v1/tellers] fetch failed", error);
    return NextResponse.json({ message: "Failed to load cashiers" }, { status: 500 });
  }

  return NextResponse.json({ tellers: data ?? [] });
}
