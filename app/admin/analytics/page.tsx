import { createAdminClient } from "@/lib/supabase";
import type {
  Order,
  Branch,
  Teller,
  OrderItem,
  OrderItemTopping,
} from "@/lib/database.types";
import AnalyticsClient from "./analytics-client";

type TellerWithBranch = Teller & { branch: Branch | null };

type FullOrder = Order & {
  branch: Branch | null;
  teller: Teller | null;
  items: (OrderItem & { toppings: OrderItemTopping[] })[];
};

export type SlimOrder = {
  id: number;
  createdAt: string;
  totalGhs: number;
  status: string;
  branchName: string;
};

export type BranchStat = {
  name: string;
  orders: number;
  revenueGhs: number;
};

export type ProductStat = {
  name: string;
  qty: number;
  revenueGhs: number;
};

export type ToppingStat = {
  name: string;
  qty: number;
};

export type TellerStat = {
  id: number;
  name: string;
  branch: string;
  isActive: boolean;
  orders: number;
  revenueGhs: number;
  ordersToday: number;
  lastOrderAt: string | null;
};

export type PaymentStat = {
  method: string;
  count: number;
};

export type SourceStat = {
  source: string;
  count: number;
};

async function fetchAnalyticsData() {
  const db = createAdminClient();

  const { data: rawOrders } = await db
    .from("orders")
    .select(
      "*, branch:branches(*), teller:tellers(*), items:order_items(*, toppings:order_item_toppings(*))",
    )
    .order("created_at", { ascending: false });

  const orders = (rawOrders ?? []) as unknown as FullOrder[];

  // ── Slim orders for client-side time-series ──────────────────────────────
  const slimOrders: SlimOrder[] = orders.map((o) => ({
    id: o.id,
    createdAt: o.created_at ?? new Date().toISOString(),
    totalGhs: o.total_pesewas / 100,
    status: o.status ?? "pending",
    branchName: o.branch?.name ?? "Unknown",
  }));

  // ── Revenue + orders by branch ───────────────────────────────────────────
  const branchMap = new Map<string, { orders: number; revenueGhs: number }>();
  for (const o of orders) {
    const name = o.branch?.name ?? "Unknown";
    const cur = branchMap.get(name) ?? { orders: 0, revenueGhs: 0 };
    cur.orders += 1;
    cur.revenueGhs += o.total_pesewas / 100;
    branchMap.set(name, cur);
  }
  const branchStats: BranchStat[] = [...branchMap.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenueGhs - a.revenueGhs);

  // ── Top products by units sold ───────────────────────────────────────────
  const productMap = new Map<string, { qty: number; revenueGhs: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      const cur = productMap.get(item.product_name) ?? {
        qty: 0,
        revenueGhs: 0,
      };
      cur.qty += item.quantity;
      cur.revenueGhs += (item.unit_pesewas * item.quantity) / 100;
      productMap.set(item.product_name, cur);
    }
  }
  const topProducts: ProductStat[] = [...productMap.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // ── Top toppings by count ────────────────────────────────────────────────
  const toppingMap = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.items) {
      for (const t of item.toppings) {
        toppingMap.set(
          t.topping_name,
          (toppingMap.get(t.topping_name) ?? 0) + 1,
        );
      }
    }
  }
  const topToppings: ToppingStat[] = [...toppingMap.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // ── Orders + revenue by teller (all tellers, including zero-order ones) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: rawTellers } = await db
    .from("tellers")
    .select("*, branch:branches(*)")
    .order("name", { ascending: true });

  const allTellers = (rawTellers ?? []) as unknown as TellerWithBranch[];

  type TellerAccum = {
    orders: number;
    revenueGhs: number;
    ordersToday: number;
    lastOrderAt: string | null;
  };

  const tellerAccumMap = new Map<number, TellerAccum>();
  for (const t of allTellers) {
    tellerAccumMap.set(t.id, {
      orders: 0,
      revenueGhs: 0,
      ordersToday: 0,
      lastOrderAt: null,
    });
  }

  for (const o of orders) {
    if (!o.teller_id) continue;
    const acc = tellerAccumMap.get(o.teller_id);
    if (!acc) continue;
    acc.orders += 1;
    acc.revenueGhs += o.total_pesewas / 100;
    const orderDate = new Date(o.created_at ?? Date.now());
    if (orderDate >= today) acc.ordersToday += 1;
    if (!acc.lastOrderAt || orderDate > new Date(acc.lastOrderAt)) {
      acc.lastOrderAt = o.created_at;
    }
  }

  const tellerStats: TellerStat[] = allTellers
    .map((t) => {
      const acc = tellerAccumMap.get(t.id) ?? {
        orders: 0,
        revenueGhs: 0,
        ordersToday: 0,
        lastOrderAt: null,
      };
      return {
        id: t.id,
        name: t.name,
        branch: t.branch?.name ?? "Unknown",
        isActive: t.is_active,
        ...acc,
      };
    })
    .sort((a, b) => b.orders - a.orders);

  // ── Payment method breakdown ─────────────────────────────────────────────
  const paymentMap = new Map<string, number>();
  for (const o of orders) {
    const method = o.payment_method ?? "hubtel";
    paymentMap.set(method, (paymentMap.get(method) ?? 0) + 1);
  }
  const paymentStats: PaymentStat[] = [...paymentMap.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);

  // ── Order source breakdown ───────────────────────────────────────────────
  const sourceMap = new Map<string, number>();
  for (const o of orders) {
    const source = o.order_source ?? "online";
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  }
  const sourceStats: SourceStat[] = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    slimOrders,
    branchStats,
    topProducts,
    topToppings,
    tellerStats,
    paymentStats,
    sourceStats,
  };
}

export default async function AnalyticsPage() {
  const data = await fetchAnalyticsData();
  return <AnalyticsClient {...data} />;
}
