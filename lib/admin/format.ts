const whole = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 298000 to "GH₵2,980". Pesewas are only shown when they are not zero. */
export function money(pesewas: number): string {
  const value = pesewas / 100;
  return `GH₵${Number.isInteger(value) ? whole.format(value) : exact.format(value)}`;
}

/** Times are Ghana time, which is UTC all year. */
export function clock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GH", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function hourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GH", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

export function plural(count: number, word: string): string {
  return `${whole.format(count)} ${word}${count === 1 ? "" : "s"}`;
}

export function paymentName(method: string): string {
  const names: Record<string, string> = {
    cash: "Cash",
    momo: "Mobile Money",
    hubtel: "Hubtel",
  };
  return names[method] ?? method;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
