// lib/customers.ts
export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type OrderItem = {
  name: string;
  qty: number;
  unitPrice: number; // GHS
};

export type CustomerOrder = {
  id: string;
  customerId: string;
  createdAt: string; // ISO
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  joinedAt: string; // ISO
  lastVisit: string; // ISO
  favoriteItem?: string;
  notes?: string;
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  }).format(value);
}

export function sumOrderTotal(order: CustomerOrder) {
  return order.items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);
}

export function daysAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function computeCustomerMetrics(
  customers: Customer[],
  orders: CustomerOrder[],
) {
  const byCustomer: Record<
    string,
    {
      totalSpent: number;
      orderCount: number;
      lastOrderAt: string | null;
      avgOrderValue: number;
      lifetimeValue: number; // for now = totalSpent (dummy definition)
      topItems: { name: string; qty: number }[];
    }
  > = {};

  for (const c of customers) {
    byCustomer[c.id] = {
      totalSpent: 0,
      orderCount: 0,
      lastOrderAt: null,
      avgOrderValue: 0,
      lifetimeValue: 0,
      topItems: [],
    };
  }

  const itemAggByCustomer: Record<string, Record<string, number>> = {};

  for (const o of orders) {
    // Count only "completed" for revenue / LTV (simple + common)
    if (o.status !== "completed") continue;

    const total = sumOrderTotal(o);
    const entry = byCustomer[o.customerId];
    if (!entry) continue;

    entry.totalSpent += total;
    entry.orderCount += 1;

    if (!entry.lastOrderAt) entry.lastOrderAt = o.createdAt;
    else {
      const a = new Date(entry.lastOrderAt).getTime();
      const b = new Date(o.createdAt).getTime();
      if (b > a) entry.lastOrderAt = o.createdAt;
    }

    if (!itemAggByCustomer[o.customerId]) itemAggByCustomer[o.customerId] = {};
    for (const it of o.items) {
      itemAggByCustomer[o.customerId][it.name] =
        (itemAggByCustomer[o.customerId][it.name] ?? 0) + it.qty;
    }
  }

  // finalize
  for (const customerId of Object.keys(byCustomer)) {
    const entry = byCustomer[customerId];
    entry.avgOrderValue =
      entry.orderCount > 0 ? entry.totalSpent / entry.orderCount : 0;
    entry.lifetimeValue = entry.totalSpent;

    const items = itemAggByCustomer[customerId] ?? {};
    const top = Object.entries(items)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);
    entry.topItems = top;
  }

  return byCustomer;
}

/**
 * Dummy data
 */
const now = Date.now();
const days = (n: number) => n * 24 * 60 * 60 * 1000;

export const CUSTOMERS: Customer[] = [
  {
    id: "cust_001",
    name: "Ama Mensah",
    phone: "+233 54 123 4567",
    lastVisit: new Date(now - days(2)).toISOString(),
    joinedAt: new Date(now - days(220)).toISOString(),
    favoriteItem: "Brown Sugar Boba",
    notes: "Prefers 50% sugar, extra pearls.",
  },
  {
    id: "cust_002",
    name: "Kofi Owusu",
    phone: "+233 20 555 0199",
    lastVisit: new Date(now - days(6)).toISOString(),
    joinedAt: new Date(now - days(90)).toISOString(),
    favoriteItem: "Mango Ice Tea",
  },
  {
    id: "cust_003",
    name: "Esi Boateng",
    phone: "+233 24 777 3011",
    lastVisit: new Date(now - days(1)).toISOString(),
    joinedAt: new Date(now - days(150)).toISOString(),
    favoriteItem: "Strawberry Milk Tea",
  },
  {
    id: "cust_004",
    name: "Yaw Ofori",
    phone: "+233 27 901 5522",
    lastVisit: new Date(now - days(80)).toISOString(),
    joinedAt: new Date(now - days(300)).toISOString(),
    notes: "Moved out of town.",
  },
  {
    id: "cust_005",
    name: "Adwoa Agyeman",
    phone: "+233 50 442 0190",
    lastVisit: new Date(now - days(0)).toISOString(),
    joinedAt: new Date(now - days(14)).toISOString(),
    favoriteItem: "Matcha Milk Tea",
  },
  {
    id: "cust_006",
    name: "Kwame Nkrumah Jr.",
    phone: "+233 24 300 1122",
    lastVisit: new Date(now - days(3)).toISOString(),
    joinedAt: new Date(now - days(480)).toISOString(),
    favoriteItem: "Classic Milk Tea",
    notes: "Allergic to peanuts.",
  },
  {
    id: "cust_007",
    name: "Akosua Boateng-Tay",
    phone: "+233 59 808 7711",
    lastVisit: new Date(now - days(31)).toISOString(),
    joinedAt: new Date(now - days(31)).toISOString(),
    favoriteItem: "Passion Fruit Ice Tea",
  },
  {
    id: "cust_008",
    name: "Samuel " + "Mensah", // simple concatenation to avoid unicode quirks
    phone: "+233 55 918 4400",
    lastVisit: new Date(now - days(365)).toISOString(),
    joinedAt: new Date(now - days(400)).toISOString(),
    notes: "No orders yet (walk-in inquiry only).",
  },
  {
    id: "cust_009",
    name: "Nana Akua",
    phone: "+233 57 200 9090",
    lastVisit: new Date(now - days(7)).toISOString(),
    joinedAt: new Date(now - days(200)).toISOString(),
    favoriteItem: "Taro Milk Tea",
    notes: "Prefers 70% ice.",
  },
  {
    id: "cust_010",
    name: "Prince " + "Boateng",
    phone: "+233 26 602 3303",
    lastVisit: new Date(now - days(1)).toISOString(),
    joinedAt: new Date(now - days(620)).toISOString(),
    favoriteItem: "Caramel Milk Tea",
  },
  {
    id: "cust_011",
    name: "Afia D" + "arko",
    phone: "+233 20 909 5522",
    lastVisit: new Date(now - days(12)).toISOString(),
    joinedAt: new Date(now - days(80)).toISOString(),
    notes: "Uses office delivery address.",
  },
  {
    id: "cust_012",
    name: "Robert Osei",
    phone: "+233 23 441 7788",
    lastVisit: new Date(now - days(180)).toISOString(),
    joinedAt: new Date(now - days(200)).toISOString(),
  },
  {
    id: "cust_013",
    name: "Lydia Quansah",
    phone: "+233 54 123 4567",
    lastVisit: new Date(now - days(4)).toISOString(),
    joinedAt: new Date(now - days(95)).toISOString(),
    favoriteItem: "Honey Lemon Ice Tea",
    notes: "Shares phone with family (duplicate contact).",
  },
  {
    id: "cust_014",
    name: "George K.",
    phone: "+233 27 111 2020",
    lastVisit: new Date(now - days(2)).toISOString(),
    joinedAt: new Date(now - days(720)).toISOString(),
    favoriteItem: "Brown Sugar Boba",
  },
  {
    id: "cust_015",
    name: "Comfort Asare",
    phone: "+233 56 703 1001",
    lastVisit: new Date(now - days(0)).toISOString(),
    joinedAt: new Date(now - days(0)).toISOString(),
    favoriteItem: "Coconut Milk Tea",
    notes: "First visit today.",
  },
];

export const ORDERS: CustomerOrder[] = [
  // Ama
  {
    id: "ord_1001",
    customerId: "cust_001",
    createdAt: new Date(now - days(35)).toISOString(),
    status: "completed",
    items: [
      { name: "Brown Sugar Boba", qty: 2, unitPrice: 28 },
      { name: "Chicken Shawarma (Large)", qty: 1, unitPrice: 45 },
    ],
    notes: "Extra pearls",
  },
  {
    id: "ord_1016",
    customerId: "cust_001",
    createdAt: new Date(now - days(9)).toISOString(),
    status: "completed",
    items: [{ name: "Brown Sugar Boba", qty: 2, unitPrice: 28 }],
  },
  {
    id: "ord_1021",
    customerId: "cust_001",
    createdAt: new Date(now - days(2)).toISOString(),
    status: "completed",
    items: [
      { name: "Brown Sugar Boba", qty: 1, unitPrice: 28 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
    ],
  },

  // Kofi
  {
    id: "ord_1007",
    customerId: "cust_002",
    createdAt: new Date(now - days(28)).toISOString(),
    status: "completed",
    items: [
      { name: "Mango Ice Tea", qty: 2, unitPrice: 22 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
    ],
  },
  {
    id: "ord_1019",
    customerId: "cust_002",
    createdAt: new Date(now - days(6)).toISOString(),
    status: "completed",
    items: [{ name: "Mango Ice Tea", qty: 1, unitPrice: 22 }],
  },
  {
    id: "ord_1025",
    customerId: "cust_002",
    createdAt: new Date(now - days(1)).toISOString(),
    status: "pending",
    items: [
      { name: "Chicken Shawarma (Large)", qty: 1, unitPrice: 45 },
      { name: "Mango Ice Tea", qty: 1, unitPrice: 22 },
    ],
    notes: "No onions",
  },

  // Esi
  {
    id: "ord_1003",
    customerId: "cust_003",
    createdAt: new Date(now - days(60)).toISOString(),
    status: "completed",
    items: [{ name: "Strawberry Milk Tea", qty: 2, unitPrice: 26 }],
  },
  {
    id: "ord_1012",
    customerId: "cust_003",
    createdAt: new Date(now - days(14)).toISOString(),
    status: "completed",
    items: [
      { name: "Strawberry Milk Tea", qty: 1, unitPrice: 26 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
    ],
  },
  {
    id: "ord_1028",
    customerId: "cust_003",
    createdAt: new Date(now - days(1)).toISOString(),
    status: "completed",
    items: [{ name: "Strawberry Milk Tea", qty: 1, unitPrice: 26 }],
  },

  // Yaw (inactive)
  {
    id: "ord_0999",
    customerId: "cust_004",
    createdAt: new Date(now - days(120)).toISOString(),
    status: "completed",
    items: [{ name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 }],
  },
  {
    id: "ord_1008",
    customerId: "cust_004",
    createdAt: new Date(now - days(80)).toISOString(),
    status: "completed",
    items: [{ name: "Vanilla Milk Tea", qty: 1, unitPrice: 26 }],
  },

  // Adwoa (new, recent)
  {
    id: "ord_1032",
    customerId: "cust_005",
    createdAt: new Date(now - days(0)).toISOString(),
    status: "completed",
    items: [
      { name: "Matcha Milk Tea", qty: 1, unitPrice: 28 },
      { name: "Oreo Milk Tea", qty: 1, unitPrice: 30 },
    ],
  },

  // Kwame Jr. (VIP, mixed)
  {
    id: "ord_1011",
    customerId: "cust_006",
    createdAt: new Date(now - days(20)).toISOString(),
    status: "completed",
    items: [
      { name: "Classic Milk Tea", qty: 2, unitPrice: 25 },
      { name: "Chicken Shawarma (Large)", qty: 1, unitPrice: 45 },
    ],
    notes: "No peanuts in sauce.",
  },
  {
    id: "ord_1022",
    customerId: "cust_006",
    createdAt: new Date(now - days(3)).toISOString(),
    status: "ready",
    items: [{ name: "Classic Milk Tea", qty: 1, unitPrice: 25 }],
  },

  // Akosua (just outside 30d)
  {
    id: "ord_1002",
    customerId: "cust_007",
    createdAt: new Date(now - days(31)).toISOString(),
    status: "completed",
    items: [{ name: "Passion Fruit Ice Tea", qty: 1, unitPrice: 20 }],
  },

  // Nana Akua (multiple items)
  {
    id: "ord_1014",
    customerId: "cust_009",
    createdAt: new Date(now - days(18)).toISOString(),
    status: "completed",
    items: [
      { name: "Taro Milk Tea", qty: 1, unitPrice: 28 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
      { name: "Cheese Sticks", qty: 2, unitPrice: 12 },
    ],
  },
  {
    id: "ord_1035",
    customerId: "cust_009",
    createdAt: new Date(now - days(7)).toISOString(),
    status: "completed",
    items: [{ name: "Taro Milk Tea", qty: 2, unitPrice: 28 }],
  },

  // Prince (VIP, high value)
  {
    id: "ord_1030",
    customerId: "cust_010",
    createdAt: new Date(now - days(1)).toISOString(),
    status: "completed",
    items: [
      { name: "Caramel Milk Tea", qty: 3, unitPrice: 30 },
      { name: "Chicken Shawarma (Large)", qty: 2, unitPrice: 45 },
    ],
    notes: "Add extra napkins.",
  },

  // Afia (pending only - edge for LTV)
  {
    id: "ord_1027",
    customerId: "cust_011",
    createdAt: new Date(now - days(12)).toISOString(),
    status: "pending",
    items: [{ name: "Vanilla Milk Tea", qty: 1, unitPrice: 26 }],
  },

  // Robert (cancelled order)
  {
    id: "ord_0988",
    customerId: "cust_012",
    createdAt: new Date(now - days(180)).toISOString(),
    status: "cancelled",
    items: [
      { name: "Oreo Milk Tea", qty: 1, unitPrice: 30 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
    ],
    notes: "Customer unreachable.",
  },

  // Lydia (duplicate phone edge)
  {
    id: "ord_1033",
    customerId: "cust_013",
    createdAt: new Date(now - days(4)).toISOString(),
    status: "completed",
    items: [{ name: "Honey Lemon Ice Tea", qty: 1, unitPrice: 20 }],
  },

  // George (VIP with many items)
  {
    id: "ord_1036",
    customerId: "cust_014",
    createdAt: new Date(now - days(2)).toISOString(),
    status: "completed",
    items: [
      { name: "Brown Sugar Boba", qty: 1, unitPrice: 28 },
      { name: "Classic Milk Tea", qty: 1, unitPrice: 25 },
      { name: "Strawberry Milk Tea", qty: 1, unitPrice: 26 },
      { name: "Taro Milk Tea", qty: 1, unitPrice: 28 },
      { name: "Chicken Shawarma (Regular)", qty: 1, unitPrice: 35 },
    ],
  },

  // Comfort (first visit today)
  {
    id: "ord_1037",
    customerId: "cust_015",
    createdAt: new Date(now - days(0)).toISOString(),
    status: "completed",
    items: [{ name: "Coconut Milk Tea", qty: 1, unitPrice: 28 }],
  },
];
