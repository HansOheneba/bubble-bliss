import { NextRequest, NextResponse } from "next/server";
import { clerkClient, verifyToken } from "@clerk/nextjs/server";

import { createAdminClient } from "@/lib/supabase";
import { getBranchProfile, type BranchProfile } from "@/lib/pos/branch-profiles";

// Auth for the v1 POS API (the new tablet app).
// The tablet sends its Clerk session token as `Authorization: Bearer <jwt>`.
// The branch is always derived from the signed-in user's email on the server,
// never from anything the client sends.

export type PosBranch = {
  id: number;
  slug: string;
  name: string;
  profile: BranchProfile;
};

export type PosContext = {
  posUserId: number;
  email: string;
  name: string;
  branch: PosBranch;
};

type PosUserLookup = {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  branch: { id: number; slug: string; name: string; is_active: boolean | null } | null;
};

type AuthResult = { ok: true; ctx: PosContext } | { ok: false; response: NextResponse };

// Clerk user id -> primary email. Avoids a Clerk API round-trip on every request.
const EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string; expiresAt: number }>();

async function primaryEmailFor(clerkUserId: string): Promise<string | null> {
  const cached = emailCache.get(clerkUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  const email = user.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();

  if (!email) return null;
  emailCache.set(clerkUserId, { email, expiresAt: Date.now() + EMAIL_CACHE_TTL_MS });
  return email;
}

function deny(status: number, code: string, message: string): AuthResult {
  return { ok: false, response: NextResponse.json({ code, message }, { status }) };
}

export async function authenticatePos(req: NextRequest): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return deny(401, "unauthenticated", "Sign in to continue.");

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    clerkUserId = payload.sub;
  } catch {
    return deny(401, "session_expired", "Your session has expired. Sign in again.");
  }

  let email: string | null;
  try {
    email = await primaryEmailFor(clerkUserId);
  } catch (err) {
    console.error("[pos/v1] Clerk user lookup failed:", err);
    return deny(503, "auth_unavailable", "Could not verify your account. Try again.");
  }
  if (!email) {
    return deny(403, "no_email", "This account has no primary email address.");
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("pos_users")
    .select("id, email, name, is_active, branch:branches(id, slug, name, is_active)")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.error("[pos/v1] POS user lookup failed:", error);
    return deny(500, "lookup_failed", "Could not load your POS account.");
  }

  const posUser = data as unknown as PosUserLookup | null;
  if (!posUser) {
    return deny(
      403,
      "not_a_pos_user",
      `${email} is not set up as a POS user. Ask an admin to add it.`,
    );
  }
  if (!posUser.is_active) {
    return deny(403, "pos_user_inactive", "This POS account has been deactivated.");
  }
  if (!posUser.branch || posUser.branch.is_active === false) {
    return deny(403, "branch_inactive", "The branch linked to this account is inactive.");
  }

  return {
    ok: true,
    ctx: {
      posUserId: posUser.id,
      email,
      name: posUser.name,
      branch: {
        id: posUser.branch.id,
        slug: posUser.branch.slug,
        name: posUser.branch.name,
        profile: getBranchProfile(posUser.branch.slug),
      },
    },
  };
}
