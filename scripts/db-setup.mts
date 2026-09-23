// Creates the database tables from db/schema.sql. Safe to run more than once.
//
//   npm run db:setup
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set (see README: Database).");
const sql = neon(url);

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
// Drop comment lines, then run each statement.
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);

const [{ count }] = await sql`SELECT count(*)::int AS count FROM workspaces`;
console.log(`Database ready: table "workspaces" exists and holds ${count} workspace(s).`);
