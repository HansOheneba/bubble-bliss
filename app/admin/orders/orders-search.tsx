"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useShowPending } from "@/components/admin/pending";
import { Input } from "@/components/ui/input";

export default function OrdersSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  useShowPending(pending);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function onChange(next: string) {
    setValue(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    // Wait for a pause in typing, so one search is one request.
    timer.current = window.setTimeout(() => {
      const query = new URLSearchParams(searchParams.toString());
      query.delete("limit");
      if (next.trim()) {
        query.set("q", next.trim());
        query.delete("day");
        query.delete("date");
      } else {
        query.delete("q");
      }
      const text = query.toString();
      startTransition(() => {
        router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
      });
    }, 300);
  }

  return (
    <div className="relative">
      {pending ? (
        <Loader2 className="absolute -translate-y-1/2 pointer-events-none size-4 left-3 top-1/2 text-muted-foreground animate-spin" aria-hidden />
      ) : (
        <Search className="absolute -translate-y-1/2 pointer-events-none size-4 left-3 top-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Order number, name, phone or item"
        aria-label="Search orders"
        className="pl-9 h-11"
      />
    </div>
  );
}
