"use client";

import { Button } from "@/components/ui/button";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="text-2xl font-bold tracking-tight">This page did not load</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Nothing has been lost. Your sales and orders are safe. Check your
        connection and try again.
      </p>
      <Button onClick={reset}>Try again</Button>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
    </div>
  );
}
