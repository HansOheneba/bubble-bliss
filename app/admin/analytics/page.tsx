import {
  Bars,
  Empty,
  Ledger,
  LedgerRow,
  PageHeader,
  Rule,
  Section,
  Segments,
  ShareRow,
} from "@/components/admin/ledger";
import { requireAdmin } from "@/lib/admin/auth";
import { money, paymentName, plural, shortDay } from "@/lib/admin/format";
import { getBranches } from "@/lib/admin/queries";
import { getSalesView, type PeriodKey } from "@/lib/admin/sales";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "all", label: "All time" },
];

type PageProps = {
  searchParams: Promise<{ period?: string; branch?: string }>;
};

function monthName(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString("en-GH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export default async function SalesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period)
    ? (params.period as PeriodKey)
    : "7d";

  const branches = await getBranches();
  const branch = branches.find((b) => b.slug === params.branch) ?? null;
  const branchId = branch?.id ?? null;

  const {
    summary,
    history,
    bars,
    useMonths,
    bestDay,
    hourBars,
    customerCount,
    returning,
    topCustomers,
    moneyDelta,
    isUp,
    average,
    compareLabel,
  } = await getSalesView(period, branchId, branches);
  const maxItem = Math.max(1, ...summary.items.slice(0, 10).map((item) => item.qty));

  const href = (next: { period?: string; branch?: string | null }) => {
    const query = new URLSearchParams();
    const nextPeriod = next.period ?? period;
    const nextBranch = next.branch === undefined ? branch?.slug : next.branch;
    if (nextPeriod !== "7d") query.set("period", nextPeriod);
    if (nextBranch) query.set("branch", nextBranch);
    const text = query.toString();
    return text ? `/admin/analytics?${text}` : "/admin/analytics";
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Sales" />
        <div className="flex flex-col gap-2 -mt-3">
          <Segments
            label="Period"
            options={PERIODS.map((p) => ({
              label: p.label,
              href: href({ period: p.key }),
              active: period === p.key,
            }))}
          />
          <Segments
            label="Branch"
            options={[
              { label: "All branches", href: href({ branch: null }), active: !branch },
              ...branches.map((b) => ({
                label: b.name.replace(" Branch", ""),
                href: href({ branch: b.slug }),
                active: branch?.id === b.id,
              })),
            ]}
          />
        </div>
      </div>

      <div>
        <p className="font-display text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
          {money(summary.pesewas)}
        </p>
        <p className="mt-2 text-base">
          {plural(summary.orders, "paid order")}
          {average > 0 && `, about ${money(average)} each`}.{" "}
          {moneyDelta && (
            <span className={cn("font-medium", isUp ? "text-good" : "text-attention")}>
              {moneyDelta} on {compareLabel}.
            </span>
          )}
        </p>
        {bestDay && bestDay[1].pesewas > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Best day: {shortDay(`${bestDay[0]}T00:00:00Z`)}, {money(bestDay[1].pesewas)}.
          </p>
        )}
      </div>

      {bars.length > 0 && (
        <Section title={useMonths ? "Month by month" : "Day by day"}>
          <Bars bars={bars} labelEvery={bars.length > 14 ? 7 : 1} />
        </Section>
      )}

      <div className="grid gap-8 md:grid-cols-2 md:gap-x-12">
        <Section
          title="Shawarma"
          note={summary.shawarma.qty > 0 ? `${summary.shawarma.qty.toLocaleString("en-GH")} sold, ${money(summary.shawarma.pesewas)}` : undefined}
        >
          {summary.shawarma.qty === 0 ? (
            <Empty>No shawarma sold in this period.</Empty>
          ) : (
            <Ledger>
              {summary.shawarma.sizes.map((row) => (
                <LedgerRow key={row.size} label={row.size} value={row.qty.toLocaleString("en-GH")} strong />
              ))}
              <Rule className="my-1" />
              {summary.shawarma.items.map((item) => (
                <LedgerRow
                  key={`${item.name}${item.size}`}
                  label={item.name}
                  detail={item.size ?? undefined}
                  value={`${item.qty.toLocaleString("en-GH")} sold`}
                />
              ))}
            </Ledger>
          )}
        </Section>

        <Section title="Drinks and food">
          <Ledger>
            <LedgerRow label="Drinks" detail={`${summary.drinks.qty.toLocaleString("en-GH")} sold`} value={money(summary.drinks.pesewas)} />
            <LedgerRow label="Shawarma" detail={`${summary.shawarma.qty.toLocaleString("en-GH")} sold`} value={money(summary.shawarma.pesewas)} />
          </Ledger>
        </Section>

        <Section title="How people paid">
          <Ledger>
            {summary.methods.map((row) => (
              <LedgerRow
                key={row.key}
                label={paymentName(row.key)}
                detail={`${Math.round((row.pesewas / Math.max(1, summary.pesewas)) * 100)}%`}
                value={money(row.pesewas)}
              />
            ))}
            {summary.methods.length === 0 && <Empty>No sales in this period.</Empty>}
            <Rule className="my-1" />
            <LedgerRow label="Cups used" detail="completed orders" value={summary.cups.toLocaleString("en-GH")} />
          </Ledger>
        </Section>

        <Section title="At the till">
          {summary.tellers.length === 0 ? (
            <Empty>No cashier sales in this period.</Empty>
          ) : (
            <Ledger>
              {summary.tellers.map((row) => (
                <LedgerRow
                  key={row.key}
                  label={row.label}
                  detail={plural(row.orders, "order")}
                  value={money(row.pesewas)}
                />
              ))}
            </Ledger>
          )}
        </Section>

        <Section title="Selling most" className="md:row-span-2">
          {summary.items.length === 0 ? (
            <Empty>Nothing sold in this period.</Empty>
          ) : (
            summary.items.slice(0, 10).map((item) => (
              <ShareRow
                key={`${item.name}${item.size}`}
                label={item.name}
                detail={item.size ?? undefined}
                value={`${item.qty.toLocaleString("en-GH")} sold`}
                share={item.qty / maxItem}
              />
            ))
          )}
        </Section>

        {summary.toppings.length > 0 && (
          <Section title="Favourite toppings">
            <Ledger>
              {summary.toppings.slice(0, 5).map((topping) => (
                <LedgerRow key={topping.name} label={topping.name} value={topping.qty.toLocaleString("en-GH")} />
              ))}
            </Ledger>
          </Section>
        )}

        {hourBars.length > 0 && (
          <Section title="When it gets busy" note="Orders by hour">
            <Bars bars={hourBars} labelEvery={2} />
          </Section>
        )}

        <Section
          title="Regulars"
          note={customerCount > 0 ? `${returning} of ${customerCount} came back` : undefined}
        >
          {topCustomers.length === 0 ? (
            <Empty>No phone numbers were recorded in this period.</Empty>
          ) : (
            <Ledger>
              {topCustomers.map((customer) => (
                <LedgerRow
                  key={customer.phone}
                  label={customer.name ?? customer.phone}
                  detail={plural(customer.orders, "order")}
                  value={money(customer.pesewas)}
                />
              ))}
            </Ledger>
          )}
        </Section>
      </div>

      <Section title="Every month">
        <Ledger>
          {history.map((row) => (
            <LedgerRow
              key={row.month}
              label={monthName(row.month)}
              detail={
                branches.length > 1 && !branch
                  ? branches
                      .filter((b) => row.branches[String(b.id)])
                      .map((b) => `${b.name.replace(" Branch", "")} ${money(row.branches[String(b.id)])}`)
                      .join(", ")
                  : undefined
              }
              value={money(branch ? (row.branches[String(branch.id)] ?? 0) : row.pesewas)}
            />
          ))}
        </Ledger>
      </Section>
    </div>
  );
}
