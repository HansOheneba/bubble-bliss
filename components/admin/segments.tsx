"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { Fragment, useState, useTransition } from "react";

import { useShowPending } from "@/components/admin/pending";
import { cn } from "@/lib/utils";

export type SegmentOption = { label: string; href: string; active: boolean; breakBefore?: boolean };

/** One-tap filters. The tapped one lights up at once, with a spinner until it lands. */
export function Segments({
  options,
  label,
  className,
}: {
  options: SegmentOption[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tapped, setTapped] = useState<string | null>(null);
  useShowPending(pending);

  function onClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    setTapped(href);
    start(() => router.push(href, { scroll: false }));
  }

  return (
    <nav
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]", className)}
    >
      {options.map((option) => {
        const isTapped = pending && tapped === option.href;
        const lit = pending && tapped ? isTapped : option.active;
        return (
          <Fragment key={option.href}>
            {option.breakBefore && (
              <span aria-hidden className="mx-1 my-1 border-l border-dashed shrink-0 border-border" />
            )}
            <a
              href={option.href}
              onClick={(event) => onClick(event, option.href)}
              data-press
              aria-current={option.active ? "true" : undefined}
              className={cn(
                "flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-md",
                lit
                  ? "text-background bg-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {option.label}
              {isTapped && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            </a>
          </Fragment>
        );
      })}
    </nav>
  );
}
