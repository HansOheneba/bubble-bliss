"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";

type LogPayload = {
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget admin activity logger.
 * Reads the current Clerk session to get the admin email automatically.
 * Never throws — a logging failure will not break the calling operation.
 */
export async function logAdminAction(payload: LogPayload): Promise<void> {
  try {
    const user = await currentUser();
    const adminEmail =
      user?.emailAddresses
        .find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress?.toLowerCase() ?? "unknown";

    const db = createAdminClient();
    await db.from("admin_logs").insert({
      admin_email: adminEmail,
      action: payload.action,
      description: payload.description,
      metadata: payload.metadata ?? null,
    } as never);
  } catch {
    // Intentionally swallowed — logging must never break the main operation
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
