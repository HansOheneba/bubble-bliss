import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Server-side client with service role for admin operations
export function createAdminClient() {
  const secret = process.env.SUPABASE_API_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_API_SECRET_KEY");
  return createClient<Database>(supabaseUrl, secret);
}
