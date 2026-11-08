import { Segments } from "@/components/admin/ledger";

export function MenuTabs({ active }: { active: "items" | "toppings" | "categories" }) {
  return (
    <Segments
      label="Menu sections"
      className="mb-5"
      options={[
        { label: "Products", href: "/admin/products", active: active === "items" },
        { label: "Toppings", href: "/admin/inventory", active: active === "toppings" },
        { label: "Categories", href: "/admin/categories", active: active === "categories" },
      ]}
    />
  );
}

export function TeamTabs({ active }: { active: "cashiers" | "logins" | "activity" }) {
  return (
    <Segments
      label="Team sections"
      className="mb-5"
      options={[
        { label: "Tellers", href: "/admin/tellers", active: active === "cashiers" },
        { label: "POS Users", href: "/admin/pos-users", active: active === "logins" },
        { label: "Logs", href: "/admin/logs", active: active === "activity" },
      ]}
    />
  );
}
