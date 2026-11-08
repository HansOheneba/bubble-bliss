"use client";

import { Empty, PageHeader } from "@/components/admin/ledger";
import { TeamTabs } from "@/components/admin/tabs";

import * as React from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

type AdminLog = {
  id: number;
  admin_email: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Props = {
  logs: AdminLog[];
};

const ACTION_CATEGORY: Record<string, string> = {
  "product.create": "product",
  "product.update": "product",
  "product.delete": "product",
  "product.toggle_active": "product",
  "product.toggle_stock": "product",
  "topping.create": "topping",
  "topping.update": "topping",
  "topping.delete": "topping",
  "topping.toggle_active": "topping",
  "topping.toggle_stock": "topping",
  "category.create": "category",
  "category.update": "category",
  "category.delete": "category",
  "teller.create": "teller",
  "teller.update": "teller",
  "teller.deactivate": "teller",
  "teller.reactivate": "teller",
  "pos_user.create": "pos_user",
  "pos_user.update": "pos_user",
  "pos_user.deactivate": "pos_user",
  "pos_user.reactivate": "pos_user",
  "pos_user.delete": "pos_user",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const ALL_CATEGORIES = ["product", "topping", "category", "teller", "pos_user"];

export default function LogsClient({ logs }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function syncToUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Filters are applied in the browser. Update the URL without re-running the
    // server page, which would reload every order on each click and keystroke.
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = React.useState(
    searchParams.get("category") ?? "all",
  );

  const admins = React.useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.admin_email))).sort();
  }, [logs]);

  const [adminFilter, setAdminFilter] = React.useState(
    searchParams.get("admin") ?? "all",
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (
        categoryFilter !== "all" &&
        ACTION_CATEGORY[log.action] !== categoryFilter
      )
        return false;
      if (adminFilter !== "all" && log.admin_email !== adminFilter)
        return false;
      if (q) {
        const searchable = [log.admin_email, log.action, log.description]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [logs, query, categoryFilter, adminFilter]);

  const hasFilters =
    query !== "" || categoryFilter !== "all" || adminFilter !== "all";

  function clearFilters() {
    setQuery("");
    setCategoryFilter("all");
    setAdminFilter("all");
    syncToUrl({ q: null, category: null, admin: null });
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Team" />
        <TeamTabs active="activity" />
        <p className="text-sm text-muted-foreground">
          Who changed what in this admin, newest first.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              syncToUrl({ q: e.target.value || null });
            }}
            placeholder="Search descriptions, actions..."
            className="pl-9"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            syncToUrl({ category: v === "all" ? null : v });
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {admins.length > 1 && (
          <Select
            value={adminFilter}
            onValueChange={(v) => {
              setAdminFilter(v);
              syncToUrl({ admin: v === "all" ? null : v });
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All admins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {admins.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1.5"
          >
            <X className="h-4 w-4" />
            Reset
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Empty>Nothing matches that.</Empty>
      ) : (
        <ul className="border-t border-dashed">
          {filtered.map((log) => (
            <li key={log.id} className="py-3 border-b border-dashed">
              <p className="text-sm">{log.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(log.created_at)}, {log.admin_email}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
