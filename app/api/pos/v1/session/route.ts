import { NextRequest, NextResponse } from "next/server";

import { authenticatePos } from "@/lib/pos/auth";

// GET /api/pos/v1/session — who is signed in and which branch they belong to.
export async function GET(req: NextRequest) {
  const auth = await authenticatePos(req);
  if (!auth.ok) return auth.response;

  const { ctx } = auth;
  return NextResponse.json({
    user: { id: ctx.posUserId, email: ctx.email, name: ctx.name },
    branch: {
      id: ctx.branch.id,
      slug: ctx.branch.slug,
      name: ctx.branch.name,
      receipt: ctx.branch.profile,
    },
  });
}
