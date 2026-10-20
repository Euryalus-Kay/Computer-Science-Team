import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  bigserial,
  serial,
  index,
  uniqueIndex,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/* ------------------------------------------------------------------ people */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    isOwner: boolean("is_owner").notNull().default(false),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    disabled: boolean("disabled").notNull().default(false),
    grade: text("grade"),
    notes: text("notes"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    desktopSeenAt: ts("desktop_seen_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["web", "desktop", "seb"] }).notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    meta: jsonb("meta").$type<{ sebConfigKey?: string; appVersion?: string }>(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Short-lived, single-use tokens: desktop app launch, SEB launch. */
export const launchTokens = pgTable("launch_tokens", {
  id: text("id").primaryKey(), // sha256 of token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose", { enum: ["desktop", "seb"] }).notNull(),
  target: text("target").notNull(), // path to open after sign-in
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------- problems */

export const problems = pgTable(
  "problems",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    statement: text("statement").notNull().default(""),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull().default("easy"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    timeLimitMs: integer("time_limit_ms").notNull().default(2000),
    memoryLimitMb: integer("memory_limit_mb").notNull().default(256),
    checker: text("checker", { enum: ["tokens", "exact", "float", "lines"] }).notNull().default("tokens"),
    starter: jsonb("starter").$type<Record<string, string>>().notNull().default({}),
    published: boolean("published").notNull().default(true),
    source: text("source"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("problems_slug_idx").on(t.slug)],
);

export const problemTests = pgTable(
  "problem_tests",
  {
    id: serial("id").primaryKey(),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull().default(0),
    input: text("input").notNull().default(""),
    output: text("output").notNull().default(""),
    sample: boolean("sample").notNull().default(false),
    explanation: text("explanation"),
  },
  (t) => [index("problem_tests_problem_idx").on(t.problemId)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    attemptId: text("attempt_id"),
    itemId: text("item_id"),
    language: text("language").notNull(),
    code: text("code").notNull(),
    status: text("status", { enum: ["running", "done", "error"] }).notNull().default("running"),
    verdict: text("verdict"),
    passed: integer("passed").notNull().default(0),
    total: integer("total").notNull().default(0),
    timeMs: integer("time_ms"),
    memoryKb: integer("memory_kb"),
    details: jsonb("details").$type<SubmissionDetail[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("submissions_user_idx").on(t.userId, t.createdAt),
    index("submissions_problem_idx").on(t.problemId),
    index("submissions_attempt_idx").on(t.attemptId),
  ],
);

export type SubmissionDetail = {
  verdict: string;
  timeMs?: number | null;
  memoryKb?: number | null;
  sample?: boolean;
  // only populated for sample tests
  input?: string;
  expected?: string;
  output?: string;
  message?: string;
};

/* ------------------------------------------------------------------- tests */

export type IntegrityConfig = {
  /** none: browser; app: desktop app required; seb: Safe Exam Browser; any: app or SEB */
  lockdown: "none" | "app" | "seb" | "any";
  requireFullscreen: boolean;
  warnOnLeave: boolean;
  blockPaste: boolean;
  camera: boolean;
  /** quit code for the desktop app / SEB, shown to admins */
  exitCode: string;
  /** optional SEB Config Key; when set, SEB requests are cryptographically checked */
  sebConfigKey?: string | null;
  /** desktop app reports known assistant, chat and remote-control apps that are running */
  scanApps?: boolean;
};

export type ContestResource = { id: string; title: string; body: string };
export type PauseWindow = { start: string; end: string | null };

export const contests = pgTable(
  "contests",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    durationMin: integer("duration_min"),
    opensAt: ts("opens_at"),
    closesAt: ts("closes_at"),
    startMode: text("start_mode", { enum: ["open", "live"] }).notNull().default("open"),
    liveStartAt: ts("live_start_at"),
    liveEndAt: ts("live_end_at"),
    pauses: jsonb("pauses").$type<PauseWindow[]>().notNull().default([]),
    extraSeconds: integer("extra_seconds").notNull().default(0),
    visibility: text("visibility", { enum: ["everyone", "assigned", "code"] }).notNull().default("everyone"),
    accessCode: text("access_code"),
    assignees: jsonb("assignees").$type<{ groups: string[]; users: string[] }>().notNull().default({ groups: [], users: [] }),
    showResults: text("show_results", { enum: ["never", "after_submit", "after_close"] }).notNull().default("after_submit"),
    resultsDetail: text("results_detail", { enum: ["score", "full"] }).notNull().default("full"),
    leaderboard: text("leaderboard", { enum: ["off", "live", "after_close"] }).notNull().default("off"),
    integrity: jsonb("integrity").$type<IntegrityConfig>().notNull(),
    shuffleItems: boolean("shuffle_items").notNull().default(false),
    resources: jsonb("resources").$type<ContestResource[]>().notNull().default([]),
    maxAttempts: integer("max_attempts").notNull().default(1),
    tag: text("tag"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contests_slug_idx").on(t.slug)],
);

export const contestItems = pgTable(
  "contest_items",
  {
    id: text("id").primaryKey(),
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull().default(0),
    section: text("section"),
    type: text("type").notNull(),
    title: text("title").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    points: real("points").notNull().default(1),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    grading: text("grading", { enum: ["auto", "ai", "manual"] }).notNull().default("auto"),
    rubric: text("rubric"),
    problemId: text("problem_id").references(() => problems.id, { onDelete: "set null" }),
  },
  (t) => [index("contest_items_contest_idx").on(t.contestId, t.ord)],
);

export type AttemptClient = {
  kind: "web" | "desktop" | "seb";
  ua?: string;
  ip?: string;
  appVersion?: string;
  displays?: number;
};

export type IntegritySummary = {
  risk: number; // 0-100
  level: "clear" | "low" | "medium" | "high";
  flags: { code: string; severity: "low" | "medium" | "high"; message: string; at?: string }[];
  stats: {
    leaves: number;
    awayMs: number;
    longestAwayMs: number;
    blurs: number;
    pastes: number;
    pastedChars: number;
    fullscreenExits: number;
    devtools: number;
    camera: number;
    resizes: number;
    reloads: number;
  };
  computedAt: string;
};

export type AiReview = {
  verdict: "no_concern" | "minor" | "review" | "likely";
  summary: string;
  evidence: string[];
  model: string;
  at: string;
};

export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull().default(1),
    status: text("status", { enum: ["active", "submitted", "expired"] }).notNull().default("active"),
    isPreview: boolean("is_preview").notNull().default(false),
    seed: integer("seed").notNull(),
    order: jsonb("order").$type<string[]>().notNull().default([]),
    startedAt: ts("started_at").notNull().defaultNow(),
    submittedAt: ts("submitted_at"),
    extraSeconds: integer("extra_seconds").notNull().default(0),
    score: real("score").notNull().default(0),
    maxScore: real("max_score").notNull().default(0),
    frontier: integer("frontier").notNull().default(0),
    lastActiveAt: ts("last_active_at"),
    lastItemId: text("last_item_id"),
    client: jsonb("client").$type<AttemptClient>(),
    integrity: jsonb("integrity").$type<IntegritySummary>(),
    aiReview: jsonb("ai_review").$type<AiReview>(),
    reviewed: boolean("reviewed").notNull().default(false),
  },
  (t) => [
    index("attempts_contest_idx").on(t.contestId),
    index("attempts_user_idx").on(t.userId),
    uniqueIndex("attempts_unique_idx").on(t.contestId, t.userId, t.attemptNo, t.isPreview),
  ],
);

export const answers = pgTable(
  "answers",
  {
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => contestItems.id, { onDelete: "cascade" }),
    response: jsonb("response"),
    state: jsonb("state"),
    score: real("score"),
    maxScore: real("max_score").notNull().default(0),
    status: text("status", { enum: ["empty", "saved", "graded", "pending", "error"] }).notNull().default("empty"),
    correct: boolean("correct"),
    feedback: text("feedback"),
    /** teacher-only note, e.g. Claude's reasoning */
    note: text("note"),
    gradedBy: text("graded_by", { enum: ["auto", "ai", "admin"] }),
    firstViewedAt: ts("first_viewed_at"),
    firstSavedAt: ts("first_saved_at"),
    lastSavedAt: ts("last_saved_at"),
    timeSpentMs: integer("time_spent_ms").notNull().default(0),
    saves: integer("saves").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.itemId] })],
);

export const integrityEvents = pgTable(
  "integrity_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    contestId: text("contest_id").notNull(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    severity: text("severity", { enum: ["info", "low", "medium", "high"] }).notNull().default("info"),
    at: ts("at").notNull(),
    itemId: text("item_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
  },
  (t) => [index("integrity_attempt_idx").on(t.attemptId, t.at), index("integrity_contest_idx").on(t.contestId, t.id)],
);

/* ------------------------------------------------------------ slides, posts */

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data"),
  blobUrl: text("blob_url"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["markdown", "pdf", "link"] }).notNull().default("markdown"),
  body: text("body").notNull().default(""),
  url: text("url"),
  fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
  published: boolean("published").notNull().default(true),
  ord: integer("ord").notNull().default(0),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------- board */

export type BoardState = {
  view: "timer" | "test" | "join" | "slides" | "blank";
  contestId: string | null;
  showLeaderboard: boolean;
  showNames: boolean;
  timer: { label: string; durationMs: number; endsAt: string | null; remainingMs: number | null };
  deckId: string | null;
  slide: number;
  message: string;
};

export const board = pgTable("board", {
  id: text("id").primaryKey(),
  state: jsonb("state").$type<BoardState>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ drills */

export const drillStats = pgTable(
  "drill_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    attempted: integer("attempted").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    best: integer("best").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topic] })],
);
