"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";

type LogPayload = {
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
};

/**
 * Admin activity logger.
 * Reads the current Clerk session to get the admin email automatically.
 * Await it: on Vercel, work still running after a server action returns can be cut off.
 * Never throws, so a logging failure will not break the calling operation.
 */
export async function logAdminAction(payload: LogPayload): Promise<void> {
  try {
    const user = await currentUser();
    const adminEmail =
      user?.emailAddresses
        .find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress?.toLowerCase() ?? "unknown";

    const db = createAdminClient();
    const { error } = await db.from("admin_logs").insert({
      admin_email: adminEmail,
      action: payload.action,
      description: payload.description,
      metadata: payload.metadata ?? null,
    } as never);
    if (error) console.error("Admin log insert failed:", payload.action, error.message);
  } catch (err) {
    console.error("Admin log failed:", payload.action, err);
  }
}

/**
 * Synchronous variant for use inside API Route handlers where you already
 * have the admin email from Clerk.
 */
export async function logAdminActionWithEmail(
  adminEmail: string,
  payload: LogPayload,
): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from("admin_logs").insert({
      admin_email: adminEmail,
      action: payload.action,
      description: payload.description,
      metadata: payload.metadata ?? null,
    } as never);
  } catch {
    // Intentionally swallowed
  }
}
