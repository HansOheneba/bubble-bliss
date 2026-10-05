"use client";

import { Button } from "@/components/ui/button";

type AdminErrorProps = {
  reset: () => void;
};

export default function AdminError({ reset }: AdminErrorProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        The dashboard could not be loaded
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Something went wrong while opening the admin panel. Try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
