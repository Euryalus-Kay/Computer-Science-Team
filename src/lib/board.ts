import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { board, decks, type BoardState } from "@/lib/db/schema";
import { getContest } from "@/lib/tests/attempts";
import { liveSnapshot } from "@/lib/admin/live";
import { getSettings } from "@/lib/settings";
import { renderMarkdown } from "@/lib/markdown";

// The board polls every second or two; rendering a slide once is enough.
const slideCache = new Map<string, string>();
async function slideHtml(deckId: string, version: number, i: number, md: string) {
  const key = `${deckId}:${version}:${i}`;
  let html = slideCache.get(key);
  if (html === undefined) {
    html = await renderMarkdown(md);
    slideCache.set(key, html);
    if (slideCache.size > 200) slideCache.delete(slideCache.keys().next().value!);
  }
  return html;
}

const ID = "main";

export const DEFAULT_BOARD: BoardState = {
  view: "join",
  contestId: null,
  showLeaderboard: false,
  showNames: true,
  timer: { label: "", durationMs: 5 * 60_000, endsAt: null, remainingMs: 5 * 60_000 },
  deckId: null,
  slide: 0,
  message: "",
};

export async function getBoard(): Promise<BoardState> {
  const d = await db();
  const [row] = await d.select().from(board).where(eq(board.id, ID)).limit(1);
  return { ...DEFAULT_BOARD, ...(row?.state ?? {}), timer: { ...DEFAULT_BOARD.timer, ...(row?.state?.timer ?? {}) } };
}

export type TimerAction = { action: "start" | "pause" | "reset" | "set" | "add"; durationMs?: number; label?: string; ms?: number };
export type BoardPatch = Partial<Omit<BoardState, "timer">> & { timer?: TimerAction };

function applyTimer(t: BoardState["timer"], a: TimerAction, now: number): BoardState["timer"] {
  const left = t.endsAt ? Math.max(0, Date.parse(t.endsAt) - now) : (t.remainingMs ?? t.durationMs);
  switch (a.action) {
    case "start":
      return { ...t, endsAt: new Date(now + (left > 0 ? left : t.durationMs)).toISOString(), remainingMs: null };
    case "pause":
      return { ...t, endsAt: null, remainingMs: left };
    case "reset":
      return { ...t, endsAt: null, remainingMs: t.durationMs };
    case "add": {
      const ms = Math.round(a.ms ?? 60_000);
      if (t.endsAt) return { ...t, endsAt: new Date(Math.max(now, Date.parse(t.endsAt) + ms)).toISOString() };
      return { ...t, remainingMs: Math.max(0, left + ms) };
    }
    case "set": {
      const durationMs = Math.max(1000, Math.min(24 * 3_600_000, Math.round(a.durationMs ?? t.durationMs)));
      return { label: a.label ?? t.label, durationMs, endsAt: null, remainingMs: durationMs };
    }
  }
}

export async function patchBoard(patch: BoardPatch): Promise<BoardState> {
  const cur = await getBoard();
  const { timer, ...rest } = patch;
  const next: BoardState = { ...cur };
  const allowed: (keyof BoardState)[] = ["view", "contestId", "showLeaderboard", "showNames", "deckId", "slide", "message"];
  for (const k of allowed) if (k in rest) (next as Record<string, unknown>)[k] = (rest as Record<string, unknown>)[k];
  if (!["timer", "test", "join", "slides", "blank"].includes(next.view)) next.view = cur.view;
  next.message = String(next.message ?? "").slice(0, 400);
  next.slide = Math.max(0, Math.round(Number(next.slide) || 0));
  if (timer) next.timer = applyTimer(cur.timer, timer, Date.now());
  const d = await db();
  await d
    .insert(board)
    .values({ id: ID, state: next })
    .onConflictDoUpdate({ target: board.id, set: { state: next, updatedAt: new Date() } });
  return next;
}

export type BoardTest = {
  id: string;
  slug: string;
  title: string;
  startMode: "open" | "live";
  durationMin: number | null;
  state: Awaited<ReturnType<typeof liveSnapshot>>["state"];
  paused: boolean;
  questions: number;
  working: number;
  submitted: number;
  notStarted: number;
  progress: number[];
  leaders: { name: string; score: number; answered: number }[];
  maxScore: number;
};

export type BoardDeck = {
  id: string;
  title: string;
  kind: "markdown" | "pdf" | "link";
  /** Null until known: a PDF's pages are counted in the browser, and a link has none. */
  count: number | null;
  slide: number;
  html: string;
  fileUrl: string | null;
  url: string | null;
  embed: string | null;
};

/** Everything the projector shows, in one payload. */
export async function boardPayload() {
  const [state, settings] = await Promise.all([getBoard(), getSettings()]);
  let test: BoardTest | null = null;
  if (state.contestId) {
    const c = await getContest(state.contestId);
    if (c) {
      const snap = await liveSnapshot(c, { feed: false });
      const rows = snap.rows.filter((r) => !r.preview);
      const leaders = [...rows]
        .sort((a, b) => b.score - a.score || b.answered - a.answered)
        .slice(0, 10)
        .map((r) => ({ name: state.showNames ? r.name : initials(r.name), score: r.score, answered: r.answered }));
      test = {
        id: c.id,
        slug: c.slug,
        title: c.title,
        startMode: c.startMode,
        durationMin: c.durationMin,
        state: snap.state,
        paused: snap.paused,
        questions: snap.questions,
        working: rows.filter((r) => r.status === "active").length,
        submitted: rows.filter((r) => r.status !== "active").length,
        notStarted: snap.waiting.length,
        progress: rows.map((r) => (snap.questions ? r.answered / snap.questions : 0)),
        leaders: state.showLeaderboard ? leaders : [],
        maxScore: snap.points,
      };
    }
  }
  let deck: BoardDeck | null = null;
  if (state.view === "slides" && state.deckId) {
    const d = await db();
    const [row] = await d.select().from(decks).where(eq(decks.id, state.deckId)).limit(1);
    if (row) {
      const base = { id: row.id, title: row.title, kind: row.kind, html: "", fileUrl: null, url: row.url, embed: row.url ? embedUrl(row.url) : null };
      if (row.kind === "markdown") {
        const slides = splitSlides(row.body);
        const i = Math.min(state.slide, Math.max(0, slides.length - 1));
        deck = { ...base, count: slides.length, slide: i, html: await slideHtml(row.id, row.updatedAt.getTime(), i, slides[i] ?? "") };
      } else {
        // Only the browser drawing a PDF learns its page count, so the board fills it in.
        deck = { ...base, count: null, slide: state.slide, fileUrl: row.kind === "pdf" && row.fileId ? `/api/files/${row.fileId}` : null };
      }
    }
  }
  return {
    state,
    test,
    deck,
    join: { code: settings.signupEnabled ? settings.joinCode : null, siteName: settings.siteName, timezone: settings.timezone },
    serverNow: Date.now(),
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + ".")
    .join(" ");
}

/** Google Slides and Canva links work best as their embed view. */
export function embedUrl(url: string): string | null {
  const m = url.match(/^https:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/);
  if (m) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
  const c = url.match(/^https:\/\/www\.canva\.com\/design\/([\w-]+)\/([\w-]+)/);
  if (c) return `https://www.canva.com/design/${c[1]}/${c[2]}/view?embed`;
  return null;
}

/** Slides in a markdown deck are separated by a line with three dashes. */
export function splitSlides(md: string): string[] {
  return md
    .split(/\n\s*---+\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
