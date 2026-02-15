import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

import { ORDERS as ADMIN_ORDERS } from "@/lib/orders";
import { PRODUCTS } from "@/lib/products";
import {
	CUSTOMERS,
	ORDERS as CUSTOMER_ORDERS,
	computeCustomerMetrics,
	formatMoney,
} from "@/lib/customers";

function sumAdminOrderTotal(order: (typeof ADMIN_ORDERS)[number]) {
	return order.items.reduce(
		(acc, it) => acc + it.quantity * it.unitPrice,
		0,
	);
}

function formatShortDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-GH", {
		month: "short",
		day: "numeric",
	});
}

function getLastNDays(n: number) {
	const days: { key: string; label: string }[] = [];
	for (let i = n - 1; i >= 0; i -= 1) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		days.push({ key, label: formatShortDate(d.toISOString()) });
	}
	return days;
}

export default function ReportsPage() {
	const completedOrders = ADMIN_ORDERS.filter((o) => o.status === "Done");
	const pendingOrders = ADMIN_ORDERS.filter((o) => o.status === "Pending");
	const preparingOrders = ADMIN_ORDERS.filter(
		(o) => o.status === "Preparing",
	);
	const cancelledOrders = ADMIN_ORDERS.filter((o) => o.status === "Cancelled");

	const totalRevenue = completedOrders.reduce(
		(acc, o) => acc + sumAdminOrderTotal(o),
		0,
	);
	const avgOrderValue =
		completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

	const topItems = ADMIN_ORDERS.reduce<Record<string, number>>((acc, o) => {
		for (const item of o.items) {
			acc[item.name] = (acc[item.name] ?? 0) + item.quantity;
		}
		return acc;
	}, {});

	const topItemsList = Object.entries(topItems)
		.map(([name, qty]) => ({ name, qty }))
		.sort((a, b) => b.qty - a.qty)
		.slice(0, 6);

	const last7 = getLastNDays(7);
	const ordersByDay = last7.map((d) => {
		const count = ADMIN_ORDERS.filter((o) => o.createdAt.startsWith(d.key))
			.length;
		return { label: d.label, count };
	});

	const productStats = {
		active: PRODUCTS.filter((p) => p.isActive).length,
		inactive: PRODUCTS.filter((p) => !p.isActive).length,
		outOfStock: PRODUCTS.filter((p) => !p.inStock).length,
	};

	const metricsByCustomer = computeCustomerMetrics(CUSTOMERS, CUSTOMER_ORDERS);
	const customersWithOrders = CUSTOMERS.filter(
		(c) => (metricsByCustomer[c.id]?.orderCount ?? 0) > 0,
	).length;
	const customersWithoutOrders = CUSTOMERS.length - customersWithOrders;
	const topCustomers = CUSTOMERS.map((c) => {
		const m = metricsByCustomer[c.id];
		return {
			id: c.id,
			name: c.name,
			phone: c.phone,
			ltv: m?.lifetimeValue ?? 0,
			orders: m?.orderCount ?? 0,
		};
	})
		.sort((a, b) => b.ltv - a.ltv)
		.slice(0, 6);

	return (
		<div className="space-y-8">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
				<p className="text-sm text-muted-foreground">
					Summary of orders, revenue, and customer performance.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Total revenue (completed)
					</div>
					<div className="mt-2 text-3xl font-bold text-foreground">
						{formatMoney(totalRevenue)}
					</div>
				</div>
				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Avg order value
					</div>
					<div className="mt-2 text-3xl font-bold text-foreground">
						{formatMoney(avgOrderValue)}
					</div>
				</div>
				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Orders (open)
					</div>
					<div className="mt-2 text-3xl font-bold text-foreground">
						{pendingOrders.length + preparingOrders.length}
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Pending: {pendingOrders.length} • Preparing: {preparingOrders.length}
					</div>
				</div>
				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Orders (cancelled)
					</div>
					<div className="mt-2 text-3xl font-bold text-foreground">
						{cancelledOrders.length}
					</div>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-3">
				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Orders (last 7 days)
					</div>
					<div className="mt-3 space-y-2">
						{ordersByDay.map((d) => (
							<div key={d.label} className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">{d.label}</span>
								<span className="text-sm font-semibold text-foreground">
									{d.count}
								</span>
							</div>
						))}
					</div>
				</div>

				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Product availability
					</div>
					<div className="mt-3 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Active</span>
							<span className="text-sm font-semibold text-foreground">
								{productStats.active}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Inactive</span>
							<span className="text-sm font-semibold text-foreground">
								{productStats.inactive}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Out of stock</span>
							<span className="text-sm font-semibold text-foreground">
								{productStats.outOfStock}
							</span>
						</div>
					</div>
				</div>

				<div className="rounded-lg border bg-card p-5">
					<div className="text-sm font-medium text-muted-foreground">
						Customers
					</div>
					<div className="mt-3 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Total</span>
							<span className="text-sm font-semibold text-foreground">
								{CUSTOMERS.length}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">With orders</span>
							<span className="text-sm font-semibold text-foreground">
								{customersWithOrders}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">No orders</span>
							<span className="text-sm font-semibold text-foreground">
								{customersWithoutOrders}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border bg-card p-5">
					<div className="mb-3 text-sm font-medium">Top items ordered</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Item</TableHead>
								<TableHead className="text-right">Qty</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{topItemsList.map((item) => (
								<TableRow key={item.name}>
									<TableCell>{item.name}</TableCell>
									<TableCell className="text-right">{item.qty}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				<div className="rounded-lg border bg-card p-5">
					<div className="mb-3 text-sm font-medium">Top customers by LTV</div>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Customer</TableHead>
								<TableHead className="text-right">Orders</TableHead>
								<TableHead className="text-right">LTV</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{topCustomers.map((c) => (
								<TableRow key={c.id}>
									<TableCell>
										<div className="font-medium text-foreground">{c.name}</div>
										<div className="text-xs text-muted-foreground">
											{c.phone}
										</div>
									</TableCell>
									<TableCell className="text-right">{c.orders}</TableCell>
									<TableCell className="text-right">
										{formatMoney(c.ltv)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>

			<div className="rounded-lg border bg-card p-5">
				<div className="mb-3 text-sm font-medium">Recent completed orders</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Order</TableHead>
							<TableHead>Customer</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead>Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{completedOrders
							.slice()
							.sort(
								(a, b) =>
									new Date(b.createdAt).getTime() -
									new Date(a.createdAt).getTime(),
							)
							.slice(0, 6)
							.map((o) => (
								<TableRow key={o.id}>
									<TableCell className="font-medium">{o.id}</TableCell>
									<TableCell>{o.customerName}</TableCell>
									<TableCell className="text-right">
										{formatMoney(sumAdminOrderTotal(o))}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatShortDate(o.createdAt)}
									</TableCell>
								</TableRow>
							))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
