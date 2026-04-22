export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_logs: {
        Row: {
          id: number;
          admin_email: string;
          action: string;
          description: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          admin_email: string;
          action: string;
          description: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          admin_email?: string;
          action?: string;
          description?: string;
          metadata?: Json | null;
        };
      };
      branches: {
        Row: {
          id: number;
          slug: string;
          name: string;
          email: string | null;
          is_active: boolean | null;
        };
        Insert: {
          slug: string;
          name: string;
          email?: string | null;
          is_active?: boolean | null;
        };
        Update: {
          slug?: string;
          name?: string;
          email?: string | null;
          is_active?: boolean | null;
        };
      };
      categories: {
        Row: {
          id: number;
          slug: string;
          name: string;
          sort_order: number | null;
        };
        Insert: {
          slug: string;
          name: string;
          sort_order?: number | null;
        };
        Update: {
          slug?: string;
          name?: string;
          sort_order?: number | null;
        };
      };
      products: {
        Row: {
          id: number;
          slug: string;
          name: string;
          description: string | null;
          category_id: number | null;
          price_in_pesewas: number | null;
          is_active: boolean | null;
          in_stock: boolean | null;
          sort_order: number | null;
          image: string | null;
          branch_prices: Json;
        };
        Insert: {
          slug: string;
          name: string;
          description?: string | null;
          category_id?: number | null;
          price_in_pesewas?: number | null;
          is_active?: boolean | null;
          in_stock?: boolean | null;
          sort_order?: number | null;
          image?: string | null;
          branch_prices?: Json;
        };
        Update: {
          slug?: string;
          name?: string;
          description?: string | null;
          category_id?: number | null;
          price_in_pesewas?: number | null;
          is_active?: boolean | null;
          in_stock?: boolean | null;
          sort_order?: number | null;
          image?: string | null;
          branch_prices?: Json;
        };
      };
      product_variants: {
        Row: {
          id: number;
          product_id: number | null;
          key: string;
          label: string;
          price_in_pesewas: number;
          sort_order: number | null;
        };
        Insert: {
          product_id?: number | null;
          key: string;
          label: string;
          price_in_pesewas: number;
          sort_order?: number | null;
        };
        Update: {
          product_id?: number | null;
          key?: string;
          label?: string;
          price_in_pesewas?: number;
          sort_order?: number | null;
        };
      };
      toppings: {
        Row: {
          id: number;
          name: string;
          price_in_pesewas: number;
          is_active: boolean | null;
          in_stock: boolean | null;
          sort_order: number | null;
        };
        Insert: {
          name: string;
          price_in_pesewas: number;
          is_active?: boolean | null;
          in_stock?: boolean | null;
          sort_order?: number | null;
        };
        Update: {
          name?: string;
          price_in_pesewas?: number;
          is_active?: boolean | null;
          in_stock?: boolean | null;
          sort_order?: number | null;
        };
      };
      orders: {
        Row: {
          id: number;
          phone: string;
          customer_name: string | null;
          location_text: string;
          notes: string | null;
          status: string | null;
          payment_status: string | null;
          payment_method: string;
          total_pesewas: number;
          client_reference: string;
          hubtel_checkout_id: string | null;
          created_at: string | null;
          updated_at: string | null;
          branch_id: number | null;
          order_source: string | null;
          order_number: string | null;
          teller_id: number | null;
        };
        Insert: {
          phone: string;
          customer_name?: string | null;
          location_text: string;
          notes?: string | null;
          status?: string | null;
          payment_status?: string | null;
          payment_method?: string;
          total_pesewas: number;
          client_reference: string;
          hubtel_checkout_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          branch_id?: number | null;
          order_source?: string | null;
          order_number?: string | null;
          teller_id?: number | null;
        };
        Update: {
          phone?: string;
          customer_name?: string | null;
          location_text?: string;
          notes?: string | null;
          status?: string | null;
          payment_status?: string | null;
          payment_method?: string;
          total_pesewas?: number;
          client_reference?: string;
          hubtel_checkout_id?: string | null;
          updated_at?: string | null;
          branch_id?: number | null;
          order_source?: string | null;
          order_number?: string | null;
          teller_id?: number | null;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: number | null;
          product_id: number | null;
          variant_id: number | null;
          product_name: string;
          variant_label: string | null;
          unit_pesewas: number;
          quantity: number;
          sugar_level: string | null;
          spice_level: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          order_id?: number | null;
          product_id?: number | null;
          variant_id?: number | null;
          product_name: string;
          variant_label?: string | null;
          unit_pesewas: number;
          quantity: number;
          sugar_level?: string | null;
          spice_level?: string | null;
          note?: string | null;
        };
        Update: {
          order_id?: number | null;
          product_id?: number | null;
          variant_id?: number | null;
          product_name?: string;
          variant_label?: string | null;
          unit_pesewas?: number;
          quantity?: number;
          sugar_level?: string | null;
          spice_level?: string | null;
          note?: string | null;
        };
      };
      order_item_toppings: {
        Row: {
          id: string;
          order_item_id: string | null;
          topping_id: number | null;
          topping_name: string;
          topping_base_pesewas: number;
          price_applied_pesewas: number;
        };
        Insert: {
          id?: string;
          order_item_id?: string | null;
          topping_id?: number | null;
          topping_name: string;
          topping_base_pesewas: number;
          price_applied_pesewas: number;
        };
        Update: {
          order_item_id?: string | null;
          topping_id?: number | null;
          topping_name?: string;
          topping_base_pesewas?: number;
          price_applied_pesewas?: number;
        };
      };
      product_branch_availability: {
        Row: {
          product_id: number;
          branch_id: number;
        };
        Insert: {
          product_id: number;
          branch_id: number;
        };
        Update: {
          product_id?: number;
          branch_id?: number;
        };
      };
      topping_branch_availability: {
        Row: {
          topping_id: number;
          branch_id: number;
        };
        Insert: {
          topping_id: number;
          branch_id: number;
        };
        Update: {
          topping_id?: number;
          branch_id?: number;
        };
      };
      tellers: {
        Row: {
          id: number;
          email: string;
          name: string;
          branch_id: number;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: {
          email: string;
          name: string;
          branch_id: number;
          is_active?: boolean;
          created_at?: string | null;
        };
        Update: {
          email?: string;
          name?: string;
          branch_id?: number;
          is_active?: boolean;
        };
      };
      pos_users: {
        Row: {
          id: number;
          email: string;
          name: string | null;
          branch_id: number;
          is_active: boolean;
          created_at: string | null;
        };
        Insert: {
          email: string;
          name?: string | null;
          branch_id: number;
          is_active?: boolean;
          created_at?: string | null;
        };
        Update: {
          email?: string;
          name?: string | null;
          branch_id?: number;
          is_active?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Convenience row types
export type Branch = Database["public"]["Tables"]["branches"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductVariant =
  Database["public"]["Tables"]["product_variants"]["Row"];
export type Topping = Database["public"]["Tables"]["toppings"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemTopping =
  Database["public"]["Tables"]["order_item_toppings"]["Row"];
export type PosUser = Database["public"]["Tables"]["pos_users"]["Row"];
export type Teller = Database["public"]["Tables"]["tellers"]["Row"];

export type OrderWithItems = Order & {
  items: (OrderItem & { toppings: OrderItemTopping[] })[];
  branch: Branch | null;
};

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  category: Category | null;
  branch_availability: { branch_id: number }[];
};

export type ToppingWithBranchAvailability = Topping & {
  branch_availability: { branch_id: number }[];
};

export type CategoryWithCount = Category & {
  product_count: number;
};
