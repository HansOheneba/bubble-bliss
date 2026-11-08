"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useShowPending } from "@/components/admin/pending";
import { Segments } from "@/components/admin/segments";
import { cn } from "@/lib/utils";

type Choice = { value: string; label: string };

/** Pick any two days or months. Uses the phone's own list picker. */
export default function CompareControls({
  mode,
  a,
  b,
  choices,
}: {
  mode: "days" | "months";
  a: string;
  b: string;
  choices: Choice[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  useShowPending(pending);

  function setValue(key: "ca" | "cb", value: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("view", "compare");
    query.set("cmode", mode);
    query.set(key === "ca" ? "ca" : "cb", value);
    query.set(key === "ca" ? "cb" : "ca", key === "ca" ? b : a);
    startTransition(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  const branch = searchParams.get("branch");
  const base = `/admin/analytics?view=compare${branch ? `&branch=${branch}` : ""}`;

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-60")}>
      <Segments
        label="Compare by"
        options={[
          { label: "Months", href: `${base}&cmode=months`, active: mode === "months" },
          { label: "Days", href: `${base}&cmode=days`, active: mode === "days" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["ca", "A", a],
            ["cb", "B", b],
          ] as const
        ).map(([key, name, current]) => (
          <label key={key} className="min-w-0 text-xs font-medium text-muted-foreground">
            {name}
            <select
              value={current}
              onChange={(event) => setValue(key, event.target.value)}
              className="block w-full h-11 px-2 mt-1 text-sm font-medium border rounded-md bg-card text-foreground"
            >
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
