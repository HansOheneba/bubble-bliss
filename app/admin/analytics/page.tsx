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
import { clock, money, paymentName, plural, shortDay } from "@/lib/admin/format";
import { getBranches, getMonthlyHistory } from "@/lib/admin/queries";
import { ghanaToday } from "@/lib/range-metrics";
import { compareChoices, getCompare, getSalesView, type CompareMode, type PeriodKey } from "@/lib/admin/sales";
import { Change, MonthBars } from "@/components/admin/glance";
import CompareControls from "./compare-controls";
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
  searchParams: Promise<{
    period?: string;
    branch?: string;
    view?: string;
    cmode?: string;
    ca?: string;
    cb?: string;
  }>;
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

  const view = params.view === "monthly" || params.view === "compare" ? params.view : "overview";
  const viewHref = (next: string) => {
    const query = new URLSearchParams();
    if (next !== "overview") query.set("view", next);
    if (branch) query.set("branch", branch.slug);
    const text = query.toString();
    return text ? `/admin/analytics?${text}` : "/admin/analytics";
  };
  const viewTabs = (
    <Segments
      label="View"
      className="mb-2"
      options={[
        { label: "Overview", href: viewHref("overview"), active: view === "overview" },
        { label: "Monthly", href: viewHref("monthly"), active: view === "monthly" },
        { label: "Compare", href: viewHref("compare"), active: view === "compare" },
      ]}
    />
  );
  const branchTabs = (hrefFor: (slug: string | null) => string) => (
    <Segments
      label="Branch"
      options={[
        { label: "All branches", href: hrefFor(null), active: !branch },
        ...branches.map((b) => ({
          label: b.name.replace(" Branch", ""),
          href: hrefFor(b.slug),
          active: branch?.id === b.id,
        })),
      ]}
    />
  );

  if (view === "monthly") {
    const history = await getMonthlyHistory();
    const shown = branch ? [branch] : branches;
    const rowsFor = (branchKey: string | null) => {
      const values = history.map((row) => ({
        key: row.month,
        label: monthName(row.month),
        orders: branchKey ? (row.branches[branchKey]?.orders ?? 0) : row.orders,
        pesewas: branchKey ? (row.branches[branchKey]?.pesewas ?? 0) : row.pesewas,
      }));
      return values.slice(0, 12).map((row, index) => ({
        ...row,
        money: money(row.pesewas),
        previous: values[index + 1] ?? null,
        partial: row.key === ghanaToday().slice(0, 7),
      }));
    };
    return (
      <div className="flex flex-col gap-8">
        <div>
          <PageHeader title="Sales" />
          <div className="-mt-3">
            {viewTabs}
            {branchTabs((slug) => `/admin/analytics?view=monthly${slug ? `&branch=${slug}` : ""}`)}
          </div>
        </div>
        {!branch && (
          <Section title="All branches" note="Each month against the one before">
            <MonthBars rows={rowsFor(null)} />
          </Section>
        )}
        {shown.map((b) => (
          <Section key={b.id} title={b.name.replace(" Branch", "")} note="Each month against the one before">
            <MonthBars rows={rowsFor(String(b.id))} />
          </Section>
        ))}
      </div>
    );
  }

  if (view === "compare") {
    const mode: CompareMode = params.cmode === "days" ? "days" : "months";
    const choices = compareChoices(mode);
    const a = choices.some((c) => c.value === params.ca) ? (params.ca as string) : choices[0].value;
    const b = choices.some((c) => c.value === params.cb) ? (params.cb as string) : choices[1].value;
    const { a: first, b: second } = await getCompare(mode, a, b, branchId, branches);
    const nameOf = (value: string) => choices.find((c) => c.value === value)?.label ?? value;
    const avg = (x: { pesewas: number; orders: number }) => (x.orders ? Math.round(x.pesewas / x.orders) : 0);
    const metric = (label: string, x: number, y: number, show: (n: number) => string) => (
      <div className="grid items-baseline grid-cols-[1fr_auto_auto_3.5rem] gap-x-3 py-2 text-sm border-b border-dashed" key={label}>
        <span>{label}</span>
        <span className="font-semibold text-right tabular-nums">{show(x)}</span>
        <span className="text-right tabular-nums text-muted-foreground">{show(y)}</span>
        <span className="text-right"><Change now={x} before={y} /></span>
      </div>
    );
    const count = (n: number) => n.toLocaleString("en-GH");
    const methods = [...new Set([...first.methods, ...second.methods].map((row) => row.key))];
    const items = [...new Set(first.items.slice(0, 10).map((item) => `${item.name}__${item.size ?? ""}`))];
    const qtyIn = (list: typeof first.items, key: string) =>
      list.find((item) => `${item.name}__${item.size ?? ""}` === key)?.qty ?? 0;
    return (
      <div className="flex flex-col gap-6">
        <div>
          <PageHeader title="Sales" />
          <div className="-mt-3">
            {viewTabs}
            {branchTabs((slug) => `/admin/analytics?view=compare&cmode=${mode}&ca=${a}&cb=${b}${slug ? `&branch=${slug}` : ""}`)}
          </div>
        </div>
        <CompareControls mode={mode} a={a} b={b} choices={choices} />
        <Section title="Side by side">
          <div className="grid grid-cols-[1fr_auto_auto_3.5rem] gap-x-3 pb-1 text-xs text-muted-foreground border-b border-dashed">
            <span />
            <span className="text-right text-foreground">A</span>
            <span className="text-right">B</span>
            <span className="text-right">Change</span>
          </div>
          {metric("Money", first.pesewas, second.pesewas, money)}
          {metric("Paid orders", first.orders, second.orders, count)}
          {metric("Average order", avg(first), avg(second), money)}
          {metric("Completed", first.statuses.completed, second.statuses.completed, count)}
          {metric("Cups used", first.cups, second.cups, count)}
          {metric("Shawarmas", first.shawarma.qty, second.shawarma.qty, count)}
          {metric("Drinks/Tea", first.drinks.qty, second.drinks.qty, count)}
          <p className="pt-2 text-xs text-muted-foreground">A is {nameOf(a)}. B is {nameOf(b)}.</p>
        </Section>
        <Section title="How people paid">
          {methods.map((key) =>
            metric(
              paymentName(key),
              first.methods.find((row) => row.key === key)?.pesewas ?? 0,
              second.methods.find((row) => row.key === key)?.pesewas ?? 0,
              money,
            ),
          )}
        </Section>
        <Section title="Top items" note="Number sold in A">
          {items.map((key) => metric(key.replace("__", " ").trim(), qtyIn(first.items, key), qtyIn(second.items, key), count))}
        </Section>
      </div>
    );
  }

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
    mostFrequent,
    orderBars,
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
          {viewTabs}
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

      {orderBars.length > 0 && (
        <Section title="Number of orders">
          <Bars bars={orderBars} labelEvery={orderBars.length > 14 ? 7 : 1} />
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
                  value={`${item.qty.toLocaleString("en-GH")}, ${money(item.pesewas)}`}
                />
              ))}
            </Ledger>
          )}
        </Section>

        <Section title="Drinks/Tea and food">
          <Ledger>
            <LedgerRow label="Drinks/Tea" detail={`${summary.drinks.qty.toLocaleString("en-GH")} sold`} value={money(summary.drinks.pesewas)} />
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
                  detail={`${plural(row.orders, "order")}, about ${money(Math.round(row.pesewas / Math.max(1, row.orders)))} each${row.lastAt ? `, last ${shortDay(row.lastAt)} ${clock(row.lastAt)}` : ""}`}
                  value={money(row.pesewas)}
                />
              ))}
            </Ledger>
          )}
        </Section>

        <Section title="Where orders came from">
          <Ledger>
            {summary.sources.map((row) => (
              <LedgerRow key={row.key} label={row.label} detail={plural(row.orders, "order")} value={money(row.pesewas)} />
            ))}
            {summary.sources.length === 0 && <Empty>No sales in this period.</Empty>}
          </Ledger>
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
                value={`${item.qty.toLocaleString("en-GH")}, ${money(item.pesewas)}`}
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
          note={customerCount > 0 ? `${returning} of ${customerCount} came back (${Math.round((returning / customerCount) * 100)}%)` : undefined}
        >
          {topCustomers.length === 0 ? (
            <Empty>No phone numbers were recorded in this period.</Empty>
          ) : (
            <Ledger>
              {topCustomers.map((customer) => (
                <LedgerRow
                  key={customer.phone}
                  label={customer.name ?? customer.phone}
                  detail={`${customer.phone}, ${plural(customer.orders, "order")}`}
                  value={money(customer.pesewas)}
                />
              ))}
            </Ledger>
          )}
          {mostFrequent && (
            <p className="mt-2 text-xs text-muted-foreground">
              Most frequent: {mostFrequent.name ?? mostFrequent.phone}, {plural(mostFrequent.orders, "order")}.
            </p>
          )}
        </Section>
      </div>

      <Section title="Every month" note="Against the month before">
        <MonthBars
          rows={history.map((row, index) => {
            const key = branch ? String(branch.id) : null;
            const pick = (r: typeof row) => ({
              orders: key ? (r.branches[key]?.orders ?? 0) : r.orders,
              pesewas: key ? (r.branches[key]?.pesewas ?? 0) : r.pesewas,
            });
            const current = pick(row);
            return {
              key: row.month,
              label: monthName(row.month),
              ...current,
              money: money(current.pesewas),
              previous: history[index + 1] ? pick(history[index + 1]) : null,
              partial: row.month === ghanaToday().slice(0, 7),
            };
          })}
        />
      </Section>
    </div>
  );
}
