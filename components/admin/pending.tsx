"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useTransition } from "react";

/**
 * While something is loading, tells the whole page: a progress line appears at
 * the top and the content dims, so a tap always gets an answer straight away.
 */
export function useShowPending(pending: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.dataset.navPending = "true";
    else delete root.dataset.navPending;
    return () => {
      delete root.dataset.navPending;
    };
  }, [pending]);
}

/** A link that shows the page is working the moment it is tapped. */
export function PendingLink({
  href,
  children,
  className,
  ...aria
}: {
  href: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "true";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useShowPending(pending);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    start(() => router.push(href, { scroll: false }));
  }

  return (
    <a href={href} onClick={onClick} data-press className={className} {...aria}>
      {children}
    </a>
  );
}
