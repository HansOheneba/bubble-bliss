"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs() {
  const pathname = usePathname();

  const segments = React.useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, index) => {
      const href = "/" + parts.slice(0, index + 1).join("/");
      // Format the label: capitalize and replace hyphens with spaces
      const label =
        part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
      const isLast = index === parts.length - 1;
      return { href, label, isLast };
    });
  }, [pathname]);

  return (
    <nav className="flex items-center text-sm">
      {segments.map((segment, index) => (
        <React.Fragment key={segment.href}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
          )}
          {segment.isLast ? (
            <span className="font-medium text-foreground">{segment.label}</span>
          ) : (
            <Link
              href={segment.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {segment.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
