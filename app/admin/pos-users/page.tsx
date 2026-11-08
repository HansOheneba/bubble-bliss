import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase";
import type { PosUser, Branch } from "@/lib/database.types";
import PosUsersClient from "./pos-users-client";

export const metadata = { title: "Till logins" };

type PosUserWithBranch = PosUser & { branch: Branch | null };

async function fetchPageData() {
  const supabase = createAdminClient();
  const [posUsersResult, branchesResult] = await Promise.all([
    supabase
      .from("pos_users")
      .select("*, branch:branches(*)")
      .order("name", { ascending: true }),
    supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  return {
    posUsers: (posUsersResult.data ?? []) as unknown as PosUserWithBranch[],
    branches: (branchesResult.data ?? []) as Branch[],
  };
}

export default async function PosUsersPage() {
  await requireAdmin();
  const { posUsers, branches } = await fetchPageData();
  return <PosUsersClient initialPosUsers={posUsers} branches={branches} />;
}
