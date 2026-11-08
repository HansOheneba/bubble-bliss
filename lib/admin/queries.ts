import { unstable_cache } from "next/cache";

import { countCupsInOrder, isRevenueCountable } from "@/lib/order-metrics";
import { fetchShawarmaProductIds } from "@/lib/shawarma-products";
import { fetchAllPages } from "@/lib/supabase-fetch";
import { createAdminClient } from "@/lib/supabase";

// Every number here uses the same definitions as the POS and the old admin pages
// (lib/order-metrics), so the admin and the tablets always agree.

export const OPEN_STATUSES = ["pending", "confirmed", "preparing", "ready"];

const SLIM_SELECT =
  "id, created_at, total_pesewas, status, payment_method, payment_status, phone, customer_name, teller_id, branch_id, items:order_items(product_id, product_name, variant_label, quantity, unit_pesewas, toppings:order_item_toppings(topping_name, price_applied_pesewas))";

type SlimItem = {
  product_id: number | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_pesewas: number;
  toppings: { topping_name: string; price_applied_pesewas: number }[];
};

export type SlimOrder = {
  id: number;
  created_at: string | null;
  total_pesewas: number;
  status: string | null;
  payment_method: string;
  payment_status: string | null;
  phone: string | null;
  customer_name: string | null;
  teller_id: number | null;
  branch_id: number | null;
  items: SlimItem[];
};

export type Row = { key: string; label: string; orders: number; pesewas: number };
export type ItemRow = { name: string; size: string | null; qty: number; pesewas: number };

export type Summary = {
  pesewas: number;
  orders: number;
  cups: number;
  methods: Row[];
  branches: Row[];
  tellers: Row[];
  items: ItemRow[];
  toppings: { name: string; qty: number }[];
  hours: { hour: number; pesewas: number; orders: number }[];
  lastOrderAt: string | null;
};

export type BranchOption = { id: number; name: string; slug: string };

// ── Rarely-changing lookups, cached so page changes stay quick ────────────────

export const getBranches = unstable_cache(
  async (): Promise<BranchOption[]> => {
    const { data, error } = await createAdminClient()
      .from("branches")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(`Branches: ${error.message}`);
    return (data ?? []) as BranchOption[];
  },
  ["admin-branches"],
  { revalidate: 300 },
);

const getTellerNames = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { data, error } = await createAdminClient().from("tellers").select("id, name");
    if (error) throw new Error(`Tellers: ${error.message}`);
    const rows = (data ?? []) as { id: number; name: string }[];
    return Object.fromEntries(rows.map((t) => [String(t.id), t.name]));
  },
  ["admin-teller-names"],
  { revalidate: 300 },
);

const getShawarmaIds = unstable_cache(
  async (): Promise<number[]> => [...(await fetchShawarmaProductIds(createAdminClient()))],
  ["admin-shawarma-ids"],
  { revalidate: 300 },
);

// ── Reading orders for a period ───────────────────────────────────────────────

export function fetchPeriod(
  from: Date | null,
  to: Date | null,
  branchId: number | null,
): Promise<SlimOrder[]> {
  const db = createAdminClient();
  return fetchAllPages<SlimOrder>((rangeFrom, rangeTo) => {
    let query = db
      .from("orders")
      .select(SLIM_SELECT)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(rangeFrom, rangeTo);
    if (from) query = query.gte("created_at", from.toISOString());
    if (to) query = query.lt("created_at", to.toISOString());
    if (branchId !== null) query = query.eq("branch_id", branchId);
    return query as unknown as PromiseLike<{
      data: SlimOrder[] | null;
      error: { message: string } | null;
    }>;
  });
}

type TotalRow = { total_pesewas: number; status: string | null; payment_status: string | null };

/** Just the totals for a comparison period, without any items. */
export async function fetchTotals(
  from: Date,
  to: Date,
  branchId: number | null,
): Promise<{ pesewas: number; orders: number }> {
  const db = createAdminClient();
  const rows = await fetchAllPages<TotalRow>((rangeFrom, rangeTo) => {
    let query = db
      .from("orders")
      .select("total_pesewas, status, payment_status")
      .eq("payment_status", "paid")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .order("id", { ascending: false })
      .range(rangeFrom, rangeTo);
    if (branchId !== null) query = query.eq("branch_id", branchId);
    return query as unknown as PromiseLike<{
      data: TotalRow[] | null;
      error: { message: string } | null;
    }>;
  });
  const counted = rows.filter(isRevenueCountable);
  return {
    pesewas: counted.reduce((sum, o) => sum + o.total_pesewas, 0),
    orders: counted.length,
  };
}

// ── Turning orders into the numbers on screen ─────────────────────────────────

function add(map: Map<string, Row>, key: string, label: string, pesewas: number) {
  const row = map.get(key) ?? { key, label, orders: 0, pesewas: 0 };
  row.orders += 1;
  row.pesewas += pesewas;
  map.set(key, row);
}

function byMoney(rows: Iterable<Row>): Row[] {
  return [...rows].sort((a, b) => b.pesewas - a.pesewas);
}

export async function summarize(
  orders: SlimOrder[],
  branches: BranchOption[],
): Promise<Summary> {
  const [tellerNames, shawarmaIdList] = await Promise.all([getTellerNames(), getShawarmaIds()]);
  const shawarmaIds = new Set(shawarmaIdList);
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));

  const methods = new Map<string, Row>();
  const branchRows = new Map<string, Row>();
  const tellers = new Map<string, Row>();
  const items = new Map<string, ItemRow>();
  const toppings = new Map<string, number>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, pesewas: 0, orders: 0 }));

  let pesewas = 0;
  let count = 0;
  let cups = 0;
  let lastOrderAt: string | null = null;

  for (const order of orders) {
    cups += countCupsInOrder(order.items, shawarmaIds, order.status, order.payment_status);
    if (!isRevenueCountable(order)) continue;

    pesewas += order.total_pesewas;
    count += 1;
    if (order.created_at && (!lastOrderAt || order.created_at > lastOrderAt)) {
      lastOrderAt = order.created_at;
    }

    add(methods, order.payment_method, order.payment_method, order.total_pesewas);
    if (order.branch_id !== null) {
      add(
        branchRows,
        String(order.branch_id),
        branchNames.get(order.branch_id) ?? "Other",
        order.total_pesewas,
      );
    }
    if (order.teller_id !== null) {
      add(
        tellers,
        String(order.teller_id),
        tellerNames[String(order.teller_id)] ?? "Former cashier",
        order.total_pesewas,
      );
    }
    if (order.created_at) {
      const bucket = hours[new Date(order.created_at).getUTCHours()];
      bucket.pesewas += order.total_pesewas;
      bucket.orders += 1;
    }

    for (const item of order.items) {
      const key = `${item.product_name}__${item.variant_label ?? ""}`;
      const row = items.get(key) ?? {
        name: item.product_name,
        size: item.variant_label,
        qty: 0,
        pesewas: 0,
      };
      const toppingTotal = item.toppings.reduce((s, t) => s + t.price_applied_pesewas, 0);
      row.qty += item.quantity;
      row.pesewas += (item.unit_pesewas + toppingTotal) * item.quantity;
      items.set(key, row);
      for (const topping of item.toppings) {
        toppings.set(topping.topping_name, (toppings.get(topping.topping_name) ?? 0) + 1);
      }
    }
  }

  return {
    pesewas,
    orders: count,
    cups,
    methods: byMoney(methods.values()),
    branches: byMoney(branchRows.values()),
    tellers: byMoney(tellers.values()),
    items: [...items.values()].sort((a, b) => b.qty - a.qty),
    toppings: [...toppings.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty),
    hours,
    lastOrderAt,
  };
}

// ── Month-by-month history, shared and refreshed every 10 minutes ─────────────

export type MonthRow = {
  month: string;
  pesewas: number;
  orders: number;
  branches: Record<string, number>;
};

type HistoryRow = TotalRow & { created_at: string | null; branch_id: number | null };

export const getMonthlyHistory = unstable_cache(
  async (): Promise<MonthRow[]> => {
    const db = createAdminClient();
    const rows = await fetchAllPages<HistoryRow>((from, to) =>
      db
        .from("orders")
        .select("created_at, total_pesewas, status, payment_status, branch_id")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{
        data: HistoryRow[] | null;
        error: { message: string } | null;
      }>,
    );
    const months = new Map<string, MonthRow>();
    for (const order of rows) {
      if (!isRevenueCountable(order) || !order.created_at) continue;
      const month = order.created_at.slice(0, 7);
      const row = months.get(month) ?? { month, pesewas: 0, orders: 0, branches: {} };
      row.pesewas += order.total_pesewas;
      row.orders += 1;
      const branch = String(order.branch_id ?? "");
      row.branches[branch] = (row.branches[branch] ?? 0) + order.total_pesewas;
      months.set(month, row);
    }
    return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
  },
  ["admin-monthly-history"],
  { revalidate: 600 },
);

// ── The Orders screen ─────────────────────────────────────────────────────────

export const ORDER_DETAIL_SELECT =
  "id, order_number, created_at, total_pesewas, status, payment_method, payment_status, order_source, phone, customer_name, location_text, notes, teller_id, branch_id, branch:branches(name), teller:tellers(name), items:order_items(id, product_name, variant_label, quantity, unit_pesewas, sugar_level, spice_level, note, toppings:order_item_toppings(topping_name, price_applied_pesewas))";

export type OrderDetail = {
  id: number;
  order_number: string | null;
  created_at: string | null;
  total_pesewas: number;
  status: string | null;
  payment_method: string;
  payment_status: string | null;
  order_source: string | null;
  phone: string | null;
  customer_name: string | null;
  location_text: string;
  notes: string | null;
  teller_id: number | null;
  branch_id: number | null;
  branch: { name: string } | null;
  teller: { name: string } | null;
  items: {
    id: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_pesewas: number;
    sugar_level: string | null;
    spice_level: string | null;
    note: string | null;
    toppings: { topping_name: string; price_applied_pesewas: number }[];
  }[];
};

export type OrderFilters = {
  from: Date | null;
  to: Date | null;
  branchId: number | null;
  show: "all" | "open" | "unpaid";
  search: string;
  limit: number;
};

export async function fetchOrders(
  filters: OrderFilters,
): Promise<{ orders: OrderDetail[]; total: number }> {
  const db = createAdminClient();
  const search = filters.search.replace(/[^\p{L}\p{N} +-]/gu, " ").trim();

  // Searching by what was ordered finds the orders first, then filters on them.
  let itemMatches: number[] = [];
  if (search) {
    const { data, error } = await db
      .from("order_items")
      .select("order_id")
      .ilike("product_name", `%${search}%`)
      .order("order_id", { ascending: false })
      .limit(300);
    if (error) throw new Error(`Order search: ${error.message}`);
    itemMatches = [
      ...new Set(
        ((data ?? []) as { order_id: number | null }[]).flatMap((row) =>
          row.order_id === null ? [] : [row.order_id],
        ),
      ),
    ];
  }

  let query = db
    .from("orders")
    .select(ORDER_DETAIL_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filters.limit);

  if (filters.from) query = query.gte("created_at", filters.from.toISOString());
  if (filters.to) query = query.lt("created_at", filters.to.toISOString());
  if (filters.branchId !== null) query = query.eq("branch_id", filters.branchId);
  if (filters.show === "open") query = query.in("status", OPEN_STATUSES);
  if (filters.show === "unpaid") {
    query = query.neq("payment_status", "paid").neq("status", "cancelled");
  }
  if (search) {
    const like = `*${search}*`;
    const conditions = [
      `order_number.ilike.${like}`,
      `customer_name.ilike.${like}`,
      `phone.ilike.${like}`,
    ];
    if (itemMatches.length > 0) conditions.push(`id.in.(${itemMatches.join(",")})`);
    query = query.or(conditions.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Orders: ${error.message}`);
  return { orders: (data ?? []) as unknown as OrderDetail[], total: count ?? 0 };
}

// ── What needs a look ─────────────────────────────────────────────────────────

export async function fetchAttention(
  dayStart: Date,
  dayEnd: Date,
  branchId: number | null,
): Promise<{ unpaidToday: number; staleOpen: number }> {
  const db = createAdminClient();
  let unpaid = db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .neq("payment_status", "paid")
    .neq("status", "cancelled")
    .gte("created_at", dayStart.toISOString())
    .lt("created_at", dayEnd.toISOString());
  let stale = db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "paid")
    .in("status", OPEN_STATUSES)
    .lt("created_at", dayStart.toISOString());
  if (branchId !== null) {
    unpaid = unpaid.eq("branch_id", branchId);
    stale = stale.eq("branch_id", branchId);
  }
  const [unpaidResult, staleResult] = await Promise.all([unpaid, stale]);
  if (unpaidResult.error) throw new Error(`Unpaid: ${unpaidResult.error.message}`);
  if (staleResult.error) throw new Error(`Open orders: ${staleResult.error.message}`);
  return { unpaidToday: unpaidResult.count ?? 0, staleOpen: staleResult.count ?? 0 };
}

// ── Sold-out items, for the Today screen ──────────────────────────────────────

export async function fetchSoldOut(): Promise<string[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .select("name")
    .eq("is_active", true)
    .eq("in_stock", false)
    .order("name");
  if (error) throw new Error(`Products: ${error.message}`);
  return ((data ?? []) as { name: string }[]).map((p) => p.name);
}
