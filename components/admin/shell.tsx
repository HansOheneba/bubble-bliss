"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  CalendarDays,
  ChartNoAxesColumn,
  CupSoda,
  LogOut,
  ReceiptText,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  matches: string[];
};

const NAV: NavItem[] = [
  { label: "Today", href: "/admin", icon: CalendarDays, matches: [] },
  { label: "Orders", href: "/admin/orders", icon: ReceiptText, matches: ["/admin/orders"] },
  { label: "Sales", href: "/admin/analytics", icon: ChartNoAxesColumn, matches: ["/admin/analytics"] },
  {
    label: "Menu",
    href: "/admin/products",
    icon: CupSoda,
    matches: ["/admin/products", "/admin/inventory", "/admin/categories"],
  },
  {
    label: "Team",
    href: "/admin/tellers",
    icon: Users,
    matches: ["/admin/tellers", "/admin/pos-users", "/admin/logs"],
  },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  return item.matches.some((path) => pathname.startsWith(path));
}

/** Shows at once that a tap registered, while the next page is on its way. */
function PendingLine() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 bg-primary nav-progress"
    />
  );
}

function Logo({ size }: { size: number }) {
  return (
    <>
      <Image
        src="/bbl-black.png"
        alt="Bubble Bliss"
        width={size}
        height={Math.round(size * 0.6)}
        priority
        className="block dark:hidden"
      />
      <Image
        src="/bbl-white.png"
        alt="Bubble Bliss"
        width={size}
        height={Math.round(size * 0.6)}
        priority
        className="hidden dark:block"
      />
    </>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh bg-background">
      {/* Desktop: a slim rail that is always visible */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col border-r bg-sidebar md:flex">
        <Link href="/admin" prefetch={false} className="block px-5 pt-5 pb-6">
          <Logo size={96} />
        </Link>
        <nav aria-label="Main" className="flex flex-col flex-1 gap-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                data-press
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md",
                  active
                    ? "text-primary bg-sidebar-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
                <PendingLine />
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between p-3 border-t border-dashed">
          <ThemeToggle />
          <SignOutButton>
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Phone: logo and settings on top */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 border-b bg-background md:hidden">
        <Link href="/admin" prefetch={false} aria-label="Today" className="block">
          <Logo size={56} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton>
            <button
              type="button"
              aria-label="Sign out"
              className="flex items-center justify-center rounded-md size-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </SignOutButton>
        </div>
      </header>

      <main className="w-full max-w-4xl px-4 pt-5 pb-28 mx-auto md:pl-56 md:pr-8 md:pt-8 md:pb-12 md:max-w-none md:mx-0 lg:pr-16">
        <div className="max-w-4xl">{children}</div>
      </main>

      {/* Phone: everything one thumb tap away */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              data-press
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
              <PendingLine />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
