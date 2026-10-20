/**
 * Whether a saved response actually answers the question. Blank text, an empty
 * program or an untouched puzzle doesn't count, so it isn't graded as wrong.
 */
export function hasContent(response: unknown, widget?: string): boolean {
  if (response == null || typeof response !== "object") return false;
  return Object.entries(response as Record<string, unknown>).some(([k, v]) => {
    if (k === "marks" || k === "interacted") return false;
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) {
      if (widget === "network") return v.length > 1;
      if (widget === "logic-grid") return v.some((x) => x !== -1);
      return v.length > 0;
    }
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  });
}
