type Value = string | number | false | null | undefined | Record<string, boolean | undefined | null>;

export function cn(...values: Value[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k);
    } else out.push(String(v));
  }
  return out.join(" ");
}
