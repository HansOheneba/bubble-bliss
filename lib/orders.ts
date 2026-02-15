export type OrderStatus = "Pending" | "Preparing" | "Done" | "Cancelled";

export type OrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export type Order = {
  id: string;
  customerName: string;
  location: string;
  phone: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
};

export const ORDERS: Order[] = [
  {
    id: "32854514",
    customerName: "Carrick Kwenin",
    location: "Superannuation Hall",
    phone: "0501202993",
    createdAt: new Date(Date.now() - 271 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Caramel Dream Milk (Medium)",
        quantity: 1,
        unitPrice: 38,
        notes: "with Cheese Foam",
      },
      {
        name: "Vanilla Bliss (Medium)",
        quantity: 1,
        unitPrice: 37,
      },
      {
        name: "Chicken Shawarma (Medium)",
        quantity: 1,
        unitPrice: 45,
      },
    ],
  },
  {
    id: "32854515",
    customerName: "Sarah Johnson",
    location: "Library Building",
    phone: "0501234567",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Matcha Green Tea (Medium)",
        quantity: 2,
        unitPrice: 35,
        notes: "with Cheese Foam",
      },
      {
        name: "Brown Sugar Pearl Milk Tea (Large)",
        quantity: 1,
        unitPrice: 42,
        notes: "Less sugar",
      },
    ],
  },
  {
    id: "32854516",
    customerName: "Michael Chen",
    location: "Engineering Block",
    phone: "0502345678",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Classic Milk Tea (Large)",
        quantity: 1,
        unitPrice: 38,
        notes: "Extra pearls",
      },
      {
        name: "Beef Shawarma (Large)",
        quantity: 1,
        unitPrice: 52,
      },
    ],
  },
  {
    id: "32854517",
    customerName: "Emma Williams",
    location: "Student Center",
    phone: "0503456789",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Taro Milk Tea (Medium)",
        quantity: 3,
        unitPrice: 36,
        notes: "with Oreo Crumble",
      },
      {
        name: "Mango Passion Fruit Tea (Large)",
        quantity: 2,
        unitPrice: 40,
        notes: "No ice",
      },
      {
        name: "Falafel Shawarma (Medium)",
        quantity: 1,
        unitPrice: 42,
      },
    ],
  },
  {
    id: "32854518",
    customerName: "David Park",
    location: "Sports Complex",
    phone: "0504567890",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Cancelled",
    items: [
      {
        name: "Strawberry Milk Tea (Small)",
        quantity: 1,
        unitPrice: 32,
        notes: "with Popping Boba",
      },
    ],
  },
  {
    id: "32854519",
    customerName: "Lisa Anderson",
    location: "Medical Building",
    phone: "0505678901",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Preparing",
    items: [
      {
        name: "Honeydew Milk Tea (Large)",
        quantity: 2,
        unitPrice: 40,
        notes: "with Cheese Foam and extra ice",
      },
      {
        name: "Passion Fruit Green Tea (Medium)",
        quantity: 1,
        unitPrice: 37,
      },
      {
        name: "Mixed Shawarma Platter (Large)",
        quantity: 1,
        unitPrice: 65,
      },
    ],
  },
  {
    id: "32854520",
    customerName: "James Rodriguez",
    location: "Arts Building",
    phone: "0506789012",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Thai Milk Tea (Large)",
        quantity: 1,
        unitPrice: 39,
        notes: "with Tapioca Pearls",
      },
      {
        name: "Lamb Shawarma (Medium)",
        quantity: 1,
        unitPrice: 48,
      },
    ],
  },
  {
    id: "32854521",
    customerName: "Sophie Taylor",
    location: "Cafeteria Block",
    phone: "0507890123",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Peach Oolong Tea (Medium)",
        quantity: 2,
        unitPrice: 36,
        notes: "50% sugar, with Aloe Vera",
      },
      {
        name: "Lychee Rose Tea (Large)",
        quantity: 1,
        unitPrice: 41,
        notes: "with Lychee Jelly",
      },
      {
        name: "Chicken Shawarma (Small)",
        quantity: 2,
        unitPrice: 40,
      },
    ],
  },
  {
    id: "32854522",
    customerName: "Daniel Kim",
    location: "Residential Hall A",
    phone: "0508901234",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Winter Melon Tea (Large)",
        quantity: 1,
        unitPrice: 38,
        notes: "Less ice, no sugar",
      },
      {
        name: "Vanilla Bliss (Large)",
        quantity: 1,
        unitPrice: 40,
        notes: "with Whipped Cream",
      },
    ],
  },
  {
    id: "32854523",
    customerName: "Olivia Martinez",
    location: "Administration Building",
    phone: "0509012345",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Preparing",
    items: [
      {
        name: "Chocolate Milk Tea (Medium)",
        quantity: 2,
        unitPrice: 37,
        notes: "with Oreo Crumble",
      },
      {
        name: "Caramel Dream Milk (Small)",
        quantity: 1,
        unitPrice: 34,
        notes: "with Cheese Foam",
      },
      {
        name: "Beef Shawarma (Medium)",
        quantity: 1,
        unitPrice: 48,
      },
    ],
  },
  {
    id: "32854524",
    customerName: "Ryan Thompson",
    location: "Computer Lab",
    phone: "0500123456",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Jasmine Green Tea (Large)",
        quantity: 1,
        unitPrice: 35,
        notes: "Extra pearls, less ice",
      },
      {
        name: "Chicken Shawarma (Large)",
        quantity: 1,
        unitPrice: 48,
      },
    ],
  },
  {
    id: "32854525",
    customerName: "Isabella Garcia",
    location: "Music Hall",
    phone: "0501234560",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Cancelled",
    items: [
      {
        name: "Rose Milk Tea (Medium)",
        quantity: 1,
        unitPrice: 36,
        notes: "with Rose Jelly",
      },
      {
        name: "Brown Sugar Pearl Milk Tea (Medium)",
        quantity: 1,
        unitPrice: 38,
      },
    ],
  },
  {
    id: "32854526",
    customerName: "Nathan Brooks",
    location: "Business School",
    phone: "0501112233",
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    status: "Preparing",
    items: [
      {
        name: "Oolong Milk Tea (Medium)",
        quantity: 1,
        unitPrice: 36,
        notes: "with Cheese Foam",
      },
      {
        name: "Falafel Shawarma (Large)",
        quantity: 2,
        unitPrice: 45,
      },
      {
        name: "Vanilla Bliss (Small)",
        quantity: 1,
        unitPrice: 34,
      },
    ],
  },
  {
    id: "32854527",
    customerName: "Amara Osei",
    location: "Science Complex",
    phone: "0502223344",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Mango Green Tea (Large)",
        quantity: 2,
        unitPrice: 40,
        notes: "with Mango Popping Boba",
      },
      {
        name: "Lamb Shawarma (Large)",
        quantity: 1,
        unitPrice: 52,
      },
    ],
  },
  {
    id: "32854528",
    customerName: "Lucas Weber",
    location: "Law Building",
    phone: "0503334455",
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Hokkaido Milk Tea (Large)",
        quantity: 1,
        unitPrice: 42,
        notes: "with Cheese Foam and Pearls",
      },
      {
        name: "Chicken Shawarma (Medium)",
        quantity: 2,
        unitPrice: 45,
      },
    ],
  },
  {
    id: "32854529",
    customerName: "Zara Ahmed",
    location: "Gymnasium",
    phone: "0504445566",
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Strawberry Jasmine Tea (Medium)",
        quantity: 1,
        unitPrice: 38,
        notes: "with Strawberry Jelly",
      },
      {
        name: "Caramel Dream Milk (Large)",
        quantity: 1,
        unitPrice: 40,
        notes: "with Whipped Cream and Drizzle",
      },
      {
        name: "Mixed Shawarma Platter (Medium)",
        quantity: 1,
        unitPrice: 58,
      },
    ],
  },
  {
    id: "32854530",
    customerName: "Ethan Morrison",
    location: "Theater Building",
    phone: "0505556677",
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Black Sugar Milk Tea (Medium)",
        quantity: 3,
        unitPrice: 38,
        notes: "with Cheese Foam",
      },
    ],
  },
  {
    id: "32854531",
    customerName: "Priya Patel",
    location: "Chemistry Lab",
    phone: "0506667788",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "Pending",
    items: [
      {
        name: "Taro Coconut Tea (Large)",
        quantity: 1,
        unitPrice: 42,
        notes: "with Coconut Jelly and Taro Balls",
      },
      {
        name: "Vanilla Bliss (Medium)",
        quantity: 1,
        unitPrice: 37,
      },
      {
        name: "Beef Shawarma (Large)",
        quantity: 1,
        unitPrice: 52,
        notes: "Extra sauce",
      },
    ],
  },
  {
    id: "32854532",
    customerName: "Marcus Lee",
    location: "Parking Lot C",
    phone: "0507778899",
    createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Cancelled",
    items: [
      {
        name: "Honeydew Smoothie (Large)",
        quantity: 1,
        unitPrice: 44,
      },
      {
        name: "Chicken Shawarma (Small)",
        quantity: 1,
        unitPrice: 40,
      },
    ],
  },
  {
    id: "32854533",
    customerName: "Fatima Hassan",
    location: "Main Quad",
    phone: "0508889900",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "Preparing",
    items: [
      {
        name: "Earl Grey Milk Tea (Medium)",
        quantity: 2,
        unitPrice: 36,
        notes: "with Cheese Foam",
      },
      {
        name: "Lamb Shawarma (Medium)",
        quantity: 2,
        unitPrice: 48,
      },
      {
        name: "Caramel Dream Milk (Small)",
        quantity: 1,
        unitPrice: 34,
      },
    ],
  },
  {
    id: "32854534",
    customerName: "Oscar Chen",
    location: "Design Studio",
    phone: "0509990011",
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    status: "Done",
    items: [
      {
        name: "Lychee Yakult Tea (Large)",
        quantity: 1,
        unitPrice: 42,
        notes: "with Lychee Jelly and Aloe",
      },
      {
        name: "Falafel Shawarma (Medium)",
        quantity: 1,
        unitPrice: 42,
      },
    ],
  },
];
