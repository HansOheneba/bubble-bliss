import Link from "next/link";

import { Empty, PageHeader, Segments } from "@/components/admin/ledger";
import { requireAdmin } from "@/lib/admin/auth";
import { money, plural } from "@/lib/admin/format";
import { fetchOrders, getBranches } from "@/lib/admin/queries";
import { getDayBoundsUtc, ghanaToday } from "@/lib/range-metrics";
import OrdersList from "./orders-list";
import OrdersSearch from "./orders-search";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const MAX_LIMIT = 400;
const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    day?: string;
    date?: string;
    branch?: string;
    show?: string;
    limit?: string;
  }>;
};

type DayChoice = "today" | "yesterday" | "week" | "all" | "date";

function resolveDays(choice: DayChoice, dateKey: string | null): [Date | null, Date | null] {
  const [todayStart, todayEnd] = getDayBoundsUtc(ghanaToday());
  if (choice === "date" && dateKey) return getDayBoundsUtc(dateKey);
  if (choice === "today") return [todayStart, todayEnd];
  if (choice === "yesterday") return [new Date(todayStart.getTime() - DAY_MS), todayStart];
  if (choice === "week") return [new Date(todayEnd.getTime() - 7 * DAY_MS), todayEnd];
  return [null, null];
}

export default async function OrdersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  const search = (params.q ?? "").slice(0, 60);
  const dateKey = params.date && DATE_KEY.test(params.date) ? params.date : null;
  // Searching looks through everything, unless a day was chosen on purpose.
  const day: DayChoice = dateKey
    ? "date"
    : params.day === "yesterday" || params.day === "week" || params.day === "all" || params.day === "today"
      ? params.day
      : search
        ? "all"
        : "today";
  const show = params.show === "open" || params.show === "unpaid" ? params.show : "all";
  const limit = Math.min(MAX_LIMIT, Math.max(PAGE_SIZE, Number(params.limit) || PAGE_SIZE));

  const branches = await getBranches();
  const branch = branches.find((b) => b.slug === params.branch) ?? null;
  const [from, to] = resolveDays(day, dateKey);

  const { orders, total } = await fetchOrders({
    from,
    to,
    branchId: branch?.id ?? null,
    show,
    search,
    limit,
  });

  const href = (next: { day?: string | null; branch?: string | null; show?: string | null; limit?: number }) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    const nextDay = next.day === undefined ? (day === "date" ? null : day) : next.day;
    if (nextDay && !(nextDay === "today" && !search)) query.set("day", nextDay);
    if (dateKey && next.day === undefined) query.set("date", dateKey);
    const nextBranch = next.branch === undefined ? branch?.slug : next.branch;
    if (nextBranch) query.set("branch", nextBranch);
    const nextShow = next.show === undefined ? show : next.show;
    if (nextShow && nextShow !== "all") query.set("show", nextShow);
    if (next.limit) query.set("limit", String(next.limit));
    const text = query.toString();
    return text ? `/admin/orders?${text}` : "/admin/orders";
  };

  const shownMoney = orders
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_pesewas, 0);

  return (
    <div>
      <PageHeader title="Orders">
        {plural(total, "order")}
        {total <= orders.length && shownMoney > 0 && `, ${money(shownMoney)} paid`}
        {day === "date" && dateKey && ` on ${dateKey}`}
      </PageHeader>

      <div className="flex flex-col gap-2 mb-4">
        <OrdersSearch initial={search} />
        <Segments
          label="Which days"
          options={[
            { label: "Today", href: href({ day: "today" }), active: day === "today" },
            { label: "Yesterday", href: href({ day: "yesterday" }), active: day === "yesterday" },
            { label: "7 days", href: href({ day: "week" }), active: day === "week" },
            { label: "All", href: href({ day: "all" }), active: day === "all" },
          ]}
        />
        <Segments
          label="Which orders"
          options={[
            { label: "Every order", href: href({ show: null }), active: show === "all" },
            { label: "Still open", href: href({ show: "open" }), active: show === "open" },
            { label: "Not paid", href: href({ show: "unpaid" }), active: show === "unpaid" },
            ...branches.map((b, index) => ({
              label: b.name.replace(" Branch", ""),
              href: href({ branch: branch?.id === b.id ? null : b.slug }),
              active: branch?.id === b.id,
              breakBefore: index === 0,
            })),
          ]}
        />
      </div>

      {orders.length === 0 ? (
        <Empty>
          {search
            ? `Nothing found for "${search}" here. Try All.`
            : show === "all"
              ? "No orders here yet."
              : "None. Everything is tidy here."}
        </Empty>
      ) : (
        <OrdersList orders={orders} today={ghanaToday()} groupByDay={day !== "today" && day !== "yesterday" && day !== "date"} />
      )}

      {orders.length < total && limit < MAX_LIMIT && (
        <div className="mt-4">
          <Link
            href={href({ limit: limit + PAGE_SIZE })}
            prefetch={false}
            scroll={false}
            data-press
            className="block w-full py-2.5 text-sm font-medium text-center border rounded-md hover:bg-accent"
          >
            Show {Math.min(PAGE_SIZE, total - orders.length)} more of {total.toLocaleString("en-GH")}
          </Link>
        </div>
      )}
      {orders.length < total && limit >= MAX_LIMIT && (
        <p className="mt-4 text-sm text-center text-muted-foreground">
          Showing the newest {MAX_LIMIT}. Search or pick a shorter period to narrow it down.
        </p>
      )}
    </div>
  );
}
