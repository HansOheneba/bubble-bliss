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
  cupsInOrder: number;
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

export type CustomerStat = {
  phone: string;
  name: string;
  orders: number;
  totalSpendGhs: number;
  avgOrderGhs: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  isReturning: boolean;
};

async function fetchAnalyticsData() {
  const db = createAdminClient();

  const [{ data: rawOrders }, { data: rawCategories }] = await Promise.all([
    db
      .from("orders")
      .select(
        "*, branch:branches(*), teller:tellers(*), items:order_items(*, toppings:order_item_toppings(*))",
      )
      .order("created_at", { ascending: false }),
    db.from("categories").select("id, slug"),
  ]);

  const orders = (rawOrders ?? []) as unknown as FullOrder[];

  // ── Cups used (all-time, non-shawarma completed orders) ─────────────────
  const shawarmaCategory = (
    rawCategories as { id: number; slug: string }[] | null
  )?.find((c) => c.slug === "shawarma");

  const shawarmaProductIds = new Set<number>();
  if (shawarmaCategory) {
    const { data: shawarmaProducts } = await db
      .from("products")
      .select("id")
      .eq("category_id", shawarmaCategory.id);
    for (const p of (shawarmaProducts ?? []) as { id: number }[]) {
      shawarmaProductIds.add(p.id);
    }
  }

  let cupsUsed = 0;
  for (const o of orders) {
    if (o.status !== "completed") continue;
    for (const item of o.items) {
      if (
        item.product_id === null ||
        !shawarmaProductIds.has(item.product_id)
      ) {
        cupsUsed += item.quantity;
      }
    }
  }

  // ── Slim orders for client-side time-series ──────────────────────────────
  const slimOrders: SlimOrder[] = orders.map((o) => {
    let cupsInOrder = 0;
    if (o.status === "completed") {
      for (const item of o.items) {
        if (
          item.product_id === null ||
          !shawarmaProductIds.has(item.product_id)
        ) {
          cupsInOrder += item.quantity;
        }
      }
    }
    return {
      id: o.id,
      createdAt: o.created_at ?? new Date().toISOString(),
      totalGhs: o.total_pesewas / 100,
      status: o.status ?? "pending",
      branchName: o.branch?.name ?? "Unknown",
      cupsInOrder,
    };
  });

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

  // ── Per-branch breakdowns for client-side branch filter ─────────────────
  const branches = [...new Set(orders.map((o) => o.branch?.name ?? "Unknown"))]
    .filter(Boolean)
    .sort();

  type BranchAccum = {
    productMap: Map<string, { qty: number; revenueGhs: number }>;
    toppingMap: Map<string, number>;
    paymentMap: Map<string, number>;
    sourceMap: Map<string, number>;
    cupsUsed: number;
  };

  const perBranchAccum = new Map<string, BranchAccum>();
  for (const name of branches) {
    perBranchAccum.set(name, {
      productMap: new Map(),
      toppingMap: new Map(),
      paymentMap: new Map(),
      sourceMap: new Map(),
      cupsUsed: 0,
    });
  }

  for (const o of orders) {
    const branchName = o.branch?.name ?? "Unknown";
    const acc = perBranchAccum.get(branchName);
    if (!acc) continue;

    for (const item of o.items) {
      const cur = acc.productMap.get(item.product_name) ?? {
        qty: 0,
        revenueGhs: 0,
      };
      cur.qty += item.quantity;
      cur.revenueGhs += (item.unit_pesewas * item.quantity) / 100;
      acc.productMap.set(item.product_name, cur);

      for (const t of item.toppings) {
        acc.toppingMap.set(
          t.topping_name,
          (acc.toppingMap.get(t.topping_name) ?? 0) + 1,
        );
      }

      if (o.status === "completed") {
        if (
          item.product_id === null ||
          !shawarmaProductIds.has(item.product_id)
        ) {
          acc.cupsUsed += item.quantity;
        }
      }
    }

    const method = o.payment_method ?? "hubtel";
    acc.paymentMap.set(method, (acc.paymentMap.get(method) ?? 0) + 1);

    const source = o.order_source ?? "online";
    acc.sourceMap.set(source, (acc.sourceMap.get(source) ?? 0) + 1);
  }

  const branchProductStats: Record<string, ProductStat[]> = {};
  const branchToppingStats: Record<string, ToppingStat[]> = {};
  const branchPaymentStats: Record<string, PaymentStat[]> = {};
  const branchSourceStats: Record<string, SourceStat[]> = {};
  const branchCupsUsed: Record<string, number> = {};

  for (const [name, acc] of perBranchAccum) {
    branchProductStats[name] = [...acc.productMap.entries()]
      .map(([n, s]) => ({ name: n, ...s }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
    branchToppingStats[name] = [...acc.toppingMap.entries()]
      .map(([n, qty]) => ({ name: n, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
    branchPaymentStats[name] = [...acc.paymentMap.entries()]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
    branchSourceStats[name] = [...acc.sourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
    branchCupsUsed[name] = acc.cupsUsed;
  }

  // ── Customer insights (grouped by phone number) ──────────────────────────
  type CustomerAccum = {
    name: string;
    orders: number;
    totalSpendGhs: number;
    lastOrderAt: string | null;
    firstOrderAt: string | null;
  };
  const customerMap = new Map<string, CustomerAccum>();
  for (const o of orders) {
    const phone = o.phone?.trim();
    if (!phone) continue;
    const cur = customerMap.get(phone) ?? {
      name: o.customer_name ?? phone,
      orders: 0,
      totalSpendGhs: 0,
      lastOrderAt: null,
      firstOrderAt: null,
    };
    cur.orders += 1;
    cur.totalSpendGhs += o.total_pesewas / 100;
    if (o.customer_name && cur.name === phone) cur.name = o.customer_name;
    const at = o.created_at;
    if (at) {
      if (!cur.lastOrderAt || at > cur.lastOrderAt) cur.lastOrderAt = at;
      if (!cur.firstOrderAt || at < cur.firstOrderAt) cur.firstOrderAt = at;
    }
    customerMap.set(phone, cur);
  }
  const customerStats: CustomerStat[] = [...customerMap.entries()]
    .map(([phone, c]) => ({
      phone,
      name: c.name,
      orders: c.orders,
      totalSpendGhs: c.totalSpendGhs,
      avgOrderGhs: c.orders > 0 ? c.totalSpendGhs / c.orders : 0,
      lastOrderAt: c.lastOrderAt,
      firstOrderAt: c.firstOrderAt,
      isReturning: c.orders > 1,
    }))
    .sort((a, b) => b.orders - a.orders);

  return {
    slimOrders,
    branchStats,
    topProducts,
    topToppings,
    tellerStats,
    paymentStats,
    sourceStats,
    cupsUsed,
    branches,
    branchProductStats,
    branchToppingStats,
    branchPaymentStats,
    branchSourceStats,
    branchCupsUsed,
    customerStats,
  };
}

export default async function AnalyticsPage() {
  const data = await fetchAnalyticsData();
  return <AnalyticsClient {...data} />;
}
