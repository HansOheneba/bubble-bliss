"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

import { cn } from "@/lib/utils";

/** Jump straight to any past day. Uses the phone's own date wheel. */
export default function DatePicker({
  value,
  label,
  max,
  defaultValue,
  className,
}: {
  /** The date on screen, as YYYY-MM-DD. Empty when no single day is chosen. */
  value: string;
  label: string;
  max: string;
  /** Picking this date clears it from the URL, as it is what the page shows anyway. */
  defaultValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    if (!next) return;
    const query = new URLSearchParams(searchParams.toString());
    query.delete("day");
    query.delete("limit");
    if (next === defaultValue) query.delete("date");
    else query.set("date", next);
    const text = query.toString();
    startTransition(() => {
      router.push(text ? `${pathname}?${text}` : pathname, { scroll: false });
    });
  }

  return (
    <label
      className={cn(
        "relative flex items-center gap-2 h-9 px-3 text-sm font-medium border rounded-md shrink-0 hover:bg-accent",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CalendarDays className="size-4" aria-hidden />
      )}
      {label}
      <input
        ref={input}
        type="date"
        aria-label="Choose a date"
        value={value}
        max={max}
        onChange={(event) => choose(event.target.value)}
        onClick={() => input.current?.showPicker?.()}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );
}
