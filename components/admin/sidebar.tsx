"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Package,
  ClipboardList,
  BarChart3,
  LifeBuoy,
  LogOut,
} from "lucide-react";

const nav = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { label: "Products", href: "/admin/products", icon: ShoppingBag },
  { label: "Inventory", href: "/admin/inventory", icon: Package },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className=" pt-2">
        <Link href="/admin" className="flex items-center gap-3 rounded-md py-2">
          <div className="flex flex-col items-center justify-center w-full gap-1">
            <div className="text-2xl font-bold text-primary">BubbleBliss</div>
            <div className="text-xs text-muted-foreground tracking-wider">
              CAFE ADMIN
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:data-[active=true]:bg-primary/90"
                >
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Support">
              <Link href="/admin/support" className="flex items-center gap-2">
                <LifeBuoy />
                <span>Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => {
                // replace with your auth signOut()
                console.log("sign out");
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
