export function relativeTime(date: Date | string | number | null | undefined, now = Date.now()): string {
  if (!date) return "Never";
  const t = new Date(date).getTime();
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  if (m < 1) return future ? "in a moment" : "just now";
  if (m < 60) return future ? `in ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return future ? `in ${h} h` : `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return future ? `in ${days} d` : `${days} d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(date: Date | string | number | null | undefined, tz?: string): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function formatDate(date: Date | string | number | null | undefined, tz?: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });
}

export function formatTime(date: Date | string | number | null | undefined, tz?: string): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function pluralize(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Formats points without trailing ".0". */
export function pts(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(r * 10 === Math.round(r * 10) ? 1 : 2);
}
