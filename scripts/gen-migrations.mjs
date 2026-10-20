// Bundles drizzle-kit SQL migrations into a JSON module so the app can apply
// them at runtime without reading the filesystem (works on serverless hosts).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const journal = JSON.parse(fs.readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
const out = journal.entries.map((e) => {
  const sql = fs.readFileSync(path.join(root, "drizzle", `${e.tag}.sql`), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  return { id: e.tag, statements };
});
fs.writeFileSync(path.join(root, "src/lib/db/migrations.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`bundled ${out.length} migration(s)`);
