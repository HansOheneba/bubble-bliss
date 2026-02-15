"use client";

import * as React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Breadcrumbs from "./breadcrumbs";
import { ThemeToggle } from "@/components/theme-toggle";

function getGreeting() {
  const hour = new Date().getHours();
  console.log(hour);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export default function AdminTopbar() {
  const [greeting, setGreeting] = React.useState("");

  React.useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 backdrop-blur px-6 py-3">
      <div className="flex gap-2">
        <SidebarTrigger />
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          {greeting}, welcome to BubbleBliss Cafe
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
