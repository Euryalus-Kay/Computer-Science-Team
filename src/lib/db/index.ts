import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import migrations from "./migrations.json";

export type DB = PostgresJsDatabase<typeof schema>;

type Migration = { id: string; statements: string[] };

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("DATABASE_URL is not set");
  }
}

export function databaseUrl(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

/** Minimal driver surface used by the migrator, so it runs on postgres.js and PGlite alike. */
type Exec = {
  query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;
  transaction: (fn: (tx: TxExec) => Promise<void>) => Promise<void>;
};
type TxExec = {
  exec: (sql: string) => Promise<unknown>;
  rows: (sql: string) => Promise<Record<string, unknown>[]>;
};

const LOCK_KEY = 4815162342;

export async function runMigrations(exec: Exec) {
  await exec.query(
    `create table if not exists _migrations (id text primary key, applied_at timestamptz not null default now())`,
  );
  const done = new Set((await exec.query(`select id from _migrations`)).rows.map((r) => String(r.id)));
  for (const m of migrations as Migration[]) {
    if (done.has(m.id)) continue;
    await exec.transaction(async (tx) => {
      await tx.exec(`select pg_advisory_xact_lock(${LOCK_KEY})`);
      const again = await tx.rows(`select 1 from _migrations where id = '${m.id.replace(/'/g, "''")}'`);
      if (again.length) return;
      for (const s of m.statements) await tx.exec(s);
      await tx.exec(`insert into _migrations (id) values ('${m.id.replace(/'/g, "''")}')`);
    });
  }
}

async function createPostgres(url: string): Promise<DB> {
  const client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX || 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  await runMigrations({
    query: async (sql) => ({ rows: (await client.unsafe(sql)) as unknown as Record<string, unknown>[] }),
    transaction: async (fn) => {
      await client.begin(async (tx) => {
        await fn({
          exec: (s) => tx.unsafe(s),
          rows: async (s) => (await tx.unsafe(s)) as unknown as Record<string, unknown>[],
        });
      });
    },
  });
  return drizzle(client, { schema });
}

async function createPglite(): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  // PGlite only creates the last folder, and a fresh checkout has no .data yet.
  if (!dir.includes("://")) (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await runMigrations({
    query: async (sql) => {
      const r = await client.query<Record<string, unknown>>(sql);
      return { rows: r.rows };
    },
    transaction: async (fn) => {
      await client.transaction(async (tx) => {
        await fn({
          exec: (s) => tx.exec(s),
          rows: async (s) => (await tx.query<Record<string, unknown>>(s)).rows,
        });
      });
    },
  });
  return drizzlePglite(client, { schema }) as unknown as DB;
}

const g = globalThis as unknown as { __labcsDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__labcsDb) {
    const url = databaseUrl();
    let p: Promise<DB>;
    if (url) p = createPostgres(url);
    else if (process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE)) {
      p = Promise.reject(new DatabaseNotConfigured());
    } else p = createPglite();
    // Do not cache failures: a transient connection error should not poison the process.
    g.__labcsDb = p.catch((e) => {
      g.__labcsDb = undefined;
      throw e;
    });
  }
  return g.__labcsDb;
}

export const db = getDb;
export { schema };
