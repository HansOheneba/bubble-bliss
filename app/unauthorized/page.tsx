"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Access denied
          </h1>
          <p className="text-sm text-muted-foreground">
            The account you signed in with is not authorised to access the admin
            panel. Sign out and try again with an authorised email address.
          </p>
        </div>

        <SignOutButton redirectUrl="/admin">
          <Button className="w-full">Sign out and try again</Button>
        </SignOutButton>
      </div>
    </div>
  );
}
