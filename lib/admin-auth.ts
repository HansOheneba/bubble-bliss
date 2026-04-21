import { currentUser } from "@clerk/nextjs/server";

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Returns true if the current Clerk session belongs to an allowed admin email.
 * Use in API route handlers to guard admin-only endpoints.
 */
export async function requireAdmin(): Promise<boolean> {
  const user = await currentUser();
  const email = user?.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();
  return !!(email && ALLOWED_EMAILS.includes(email));
}
