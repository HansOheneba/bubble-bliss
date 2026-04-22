"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

const CATEGORY_STYLES: Record<string, string> = {
  product:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 dark:border dark:border-blue-800/50",
  topping:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-400 dark:border dark:border-purple-800/50",
  category:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800/50",
  teller:
    "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400 dark:border dark:border-green-800/50",
  pos_user:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-400 dark:border dark:border-orange-800/50",
};

const ACTION_STYLES: Record<string, string> = {
  create:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border dark:border-emerald-800/50",
  update:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-400 dark:border dark:border-sky-800/50",
  delete:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
  toggle_active:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:border dark:border-slate-700/50",
  toggle_stock:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:border dark:border-slate-700/50",
  deactivate:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800/50",
  reactivate:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border dark:border-emerald-800/50",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function parseAction(action: string): { category: string; verb: string } {
  const [category, ...verbParts] = action.split(".");
  return { category, verb: verbParts.join("_") };
}

const ALL_CATEGORIES = ["product", "topping", "category", "teller", "pos_user"];

export default function LogsClient({ logs }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
        <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A record of all admin actions. Showing the most recent 500 entries.
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

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">When</TableHead>
              <TableHead className="w-52">Admin</TableHead>
              <TableHead className="w-24">Category</TableHead>
              <TableHead className="w-28">Action</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => {
              const { category, verb } = parseAction(log.action);
              return (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-48">
                    {log.admin_email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="default"
                      className={cn(
                        "text-xs capitalize",
                        CATEGORY_STYLES[category] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {category.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="default"
                      className={cn(
                        "text-xs capitalize",
                        ACTION_STYLES[verb] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {verb.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.description}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground text-sm"
                >
                  No activity logs match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
