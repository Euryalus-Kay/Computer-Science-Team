export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,22}[a-z0-9]$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function checkUsername(u: string): string | null {
  if (u.length < 3) return "Username needs at least 3 characters.";
  if (u.length > 24) return "Username can be at most 24 characters.";
  if (!USERNAME_RE.test(u)) return "Use lowercase letters, numbers, dots, dashes or underscores.";
  return null;
}

export function checkPassword(p: string): string | null {
  if (p.length < 6) return "Password needs at least 6 characters.";
  if (p.length > 200) return "Password is too long.";
  return null;
}

export function checkName(n: string): string | null {
  if (!n.trim()) return "Enter a name.";
  if (n.trim().length > 60) return "Name is too long.";
  return null;
}

/** "Ada Lovelace" -> "alovelace"; falls back to the first name. */
export function usernameFromName(name: string): string {
  const parts = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "member";
  const base = parts.length === 1 ? parts[0] : parts[0][0] + parts[parts.length - 1];
  return base.replace(/-/g, "").slice(0, 20) || "member";
}
