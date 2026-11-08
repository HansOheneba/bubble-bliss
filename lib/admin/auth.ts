import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Clerk user id to email. Keeps page changes fast by avoiding a Clerk API call on each one.
const CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string | null; expiresAt: number }>();

async function emailFor(userId: string): Promise<string | null> {
  const hit = emailCache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.email;

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email =
    user.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase() ?? null;
  emailCache.set(userId, { email, expiresAt: Date.now() + CACHE_TTL_MS });
  return email;
}

/** Allows only signed-in, allow-listed admins. Call at the top of every admin page. */
export async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/unauthorized");
  const email = await emailFor(userId);
  if (!email || !ALLOWED_EMAILS.includes(email)) redirect("/unauthorized");
  return email;
}
