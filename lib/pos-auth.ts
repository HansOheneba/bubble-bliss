import { verifyToken, clerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { Branch } from "@/lib/database.types";

export type AuthenticatedPosUser = {
  id: number;
  email: string;
  name: string | null;
  branch_id: number;
  is_active: boolean;
  branch: Branch | null;
};

/**
 * Verifies the Clerk session token in the `Authorization: Bearer <token>` header.
 * Resolves the Clerk user's primary email and matches it against pos_users.
 *
 * Returns the authenticated POS user (with their branch) on success,
 * or null if the token is missing, invalid, or has no matching active pos_user.
 */
export async function authenticatePosRequest(
  req: NextRequest,
): Promise<AuthenticatedPosUser | null> {
  const authHeader = req.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  // Verify the Clerk-issued JWT
  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    clerkUserId = payload.sub;
  } catch {
    return null;
  }

  // Resolve the primary email from Clerk — must match pos_users.email
  let email: string | undefined;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    email = user.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();
  } catch {
    return null;
  }

  if (!email) return null;

  // Look up the POS user record by email
  const db = createAdminClient();
  const { data } = await db
    .from("pos_users")
    .select("id, email, name, branch_id, is_active, branch:branches(*)")
    .eq("email", email)
    .single();

  if (!data) return null;

  const posUser = data as unknown as AuthenticatedPosUser;
  if (!posUser.is_active) return null;

  return posUser;
}

