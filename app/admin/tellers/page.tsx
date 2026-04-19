import { createAdminClient } from "@/lib/supabase";
import type { Teller, Branch } from "@/lib/database.types";
import TellersClient from "./tellers-client";

type TellerWithBranch = Teller & { branch: Branch | null };

async function fetchPageData() {
  const supabase = createAdminClient();
  const [tellersResult, branchesResult] = await Promise.all([
    supabase
      .from("tellers")
      .select("*, branch:branches(*)")
      .order("name", { ascending: true }),
    supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  return {
    tellers: (tellersResult.data ?? []) as unknown as TellerWithBranch[],
    branches: (branchesResult.data ?? []) as Branch[],
  };
}

export default async function TellersPage() {
  const { tellers, branches } = await fetchPageData();
  return <TellersClient initialTellers={tellers} branches={branches} />;
}
