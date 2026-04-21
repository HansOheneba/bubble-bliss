import { createAdminClient } from "@/lib/supabase";
import type {
  ToppingWithBranchAvailability,
  Branch,
} from "@/lib/database.types";
import ToppingsClient from "./toppings-client";

async function fetchPageData() {
  const supabase = createAdminClient();
  const [toppingsResult, branchesResult] = await Promise.all([
    supabase
      .from("toppings")
      .select(`*, branch_availability:topping_branch_availability(branch_id, price_in_pesewas)`)
      .order("sort_order", { ascending: true }),
    supabase.from("branches").select("*").order("name", { ascending: true }),
  ]);

  return {
    toppings: (toppingsResult.data ?? []) as ToppingWithBranchAvailability[],
    branches: (branchesResult.data ?? []) as Branch[],
  };
}

export default async function InventoryPage() {
  const { toppings, branches } = await fetchPageData();
  return <ToppingsClient initialToppings={toppings} branches={branches} />;
}
