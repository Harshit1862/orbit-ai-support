// Shows what's stored in the database: one line per workspace, then the full
// JSON of the most recently used one.
//
//   npm run db:inspect
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set (see README: Database).");
const sql = neon(url);

const rows = await sql`
  SELECT id, left(session_hash, 12) AS session, version, created_at, last_seen_at,
         data->'workspace'->>'name' AS workspace,
         data->'subscription'->>'plan' AS plan,
         jsonb_array_length(data->'projects') AS projects,
         jsonb_array_length(data->'tasks') AS tasks,
         jsonb_array_length(data->'members') AS members,
         jsonb_array_length(data->'invoices') AS invoices,
         jsonb_array_length(data->'tickets') AS tickets,
         pg_column_size(data) AS bytes
  FROM workspaces
  ORDER BY last_seen_at DESC`;

console.log(`\n${rows.length} workspace(s) in table "workspaces":\n`);
console.table(
  rows.map((r) => ({
    session: r.session + "…",
    workspace: r.workspace,
    plan: r.plan,
    projects: r.projects,
    tasks: r.tasks,
    members: r.members,
    invoices: r.invoices,
    tickets: r.tickets,
    version: r.version,
    size: `${(r.bytes / 1024).toFixed(1)} KB`,
    last_seen: new Date(r.last_seen_at).toLocaleString(),
  })),
);

if (rows[0]) {
  const [latest] = await sql`SELECT data FROM workspaces WHERE id = ${rows[0].id}`;
  console.log("\nMost recently used workspace, as stored in the `data` column:\n");
  console.log(JSON.stringify(latest.data, null, 2));
}
