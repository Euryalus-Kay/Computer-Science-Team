// Applies bundled migrations before `next build`. Skips quietly when no database
// is configured so local builds and first deploys never fail on this step.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping");
  process.exit(0);
}
const migrations = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../src/lib/db/migrations.json"), "utf8"),
);
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.unsafe(
    "create table if not exists _migrations (id text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await sql.unsafe("select id from _migrations")).map((r) => r.id));
  let applied = 0;
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe("select pg_advisory_xact_lock(4815162342)");
      const again = await tx.unsafe("select 1 from _migrations where id = $1", [m.id]);
      if (again.length) return;
      for (const s of m.statements) await tx.unsafe(s);
      await tx.unsafe("insert into _migrations (id) values ($1)", [m.id]);
      applied++;
    });
  }
  console.log(`migrate: ${applied} applied, ${migrations.length} total`);
} catch (e) {
  console.error("migrate: failed", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
