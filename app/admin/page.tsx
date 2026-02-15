import React from "react";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome to BubbleBliss Cafe Admin. Manage your orders, products, and
          operations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Total Orders Today
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">0</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Active Products
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">0</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Low Stock Items
          </div>
          <div className="mt-2 text-3xl font-bold text-accent">0</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Total Customers
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">0</div>
        </div>
      </div>
    </div>
  );
}
