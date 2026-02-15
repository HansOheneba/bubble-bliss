export type ProductCategory =
  | "Bubble Tea"
  | "Ice Tea"
  | "Shawarma"
  | "HQ Special";

export type ProductPrice = {
  medium: number;
  large: number;
};

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  image: string;
  price: ProductPrice;
  inStock: boolean;
  isActive: boolean; // ✅ NEW: controls storefront visibility
};

export const PRODUCTS: Product[] = [
  {
    id: "prod_001",
    name: "Classic Milk Tea",
    category: "Bubble Tea",
    image: "https://i.ibb.co/LkJ8XQ9/classic-milk-tea.jpg",
    price: { medium: 38, large: 45 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_002",
    name: "Taro Milk Tea",
    category: "Bubble Tea",
    image: "https://i.ibb.co/kHvZLkX/taro-milk-tea.jpg",
    price: { medium: 40, large: 48 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_003",
    name: "Brown Sugar Pearl",
    category: "Bubble Tea",
    image: "https://i.ibb.co/kq3YJvN/brown-sugar-pearl.jpg",
    price: { medium: 38, large: 42 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_004",
    name: "Caramel Dream Milk",
    category: "Bubble Tea",
    image: "https://i.ibb.co/Wk9kZXX/caramel-dream.jpg",
    price: { medium: 38, large: 40 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_005",
    name: "Honeydew Milk Tea",
    category: "Bubble Tea",
    image: "https://i.ibb.co/3z5k8YJ/honeydew.jpg",
    price: { medium: 40, large: 40 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_006",
    name: "Matcha Green Tea",
    category: "Bubble Tea",
    image: "https://i.ibb.co/RbJ5QkF/matcha.jpg",
    price: { medium: 35, large: 42 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_007",
    name: "Vanilla Bliss",
    category: "HQ Special",
    image: "https://i.ibb.co/7bzF9pK/vanilla-bliss.jpg",
    price: { medium: 37, large: 40 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_008",
    name: "Lychee Yakult Tea",
    category: "Ice Tea",
    image: "https://i.ibb.co/ypJ3kQT/lychee-yakult.jpg",
    price: { medium: 36, large: 42 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_009",
    name: "Passion Fruit Tea",
    category: "Ice Tea",
    image: "https://i.ibb.co/zQkF3fJ/passion-fruit.jpg",
    price: { medium: 37, large: 40 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_010",
    name: "Chicken Shawarma",
    category: "Shawarma",
    image: "https://i.ibb.co/k5pGQkJ/chicken-shawarma.jpg",
    price: { medium: 45, large: 48 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_011",
    name: "Beef Shawarma",
    category: "Shawarma",
    image: "https://i.ibb.co/qkF3sJX/beef-shawarma.jpg",
    price: { medium: 48, large: 52 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_012",
    name: "Lamb Shawarma",
    category: "Shawarma",
    image: "https://i.ibb.co/pJ3kQkJ/lamb-shawarma.jpg",
    price: { medium: 48, large: 52 },
    inStock: false,
    isActive: true,
  },
  {
    id: "prod_013",
    name: "Falafel Shawarma",
    category: "Shawarma",
    image: "https://i.ibb.co/sJ3kQkF/falafel-shawarma.jpg",
    price: { medium: 42, large: 45 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_014",
    name: "Hokkaido Milk Tea",
    category: "HQ Special",
    image: "https://i.ibb.co/9pJ3kQk/hokkaido.jpg",
    price: { medium: 40, large: 42 },
    inStock: true,
    isActive: true,
  },
  {
    id: "prod_015",
    name: "Taro Coconut Tea",
    category: "Ice Tea",
    image: "https://i.ibb.co/3kF3kQk/taro-coconut.jpg",
    price: { medium: 40, large: 42 },
    inStock: true,
    isActive: false,
  },
];
