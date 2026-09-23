// The Postgres connection. Neon's serverless driver sends each query over
// HTTPS, which suits serverless functions: no connection pool to keep open
// between requests.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/** Tagged-template SQL: sql`SELECT ... WHERE id = ${id}` (values are always sent as parameters, never pasted into the query). */
export function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database (see README).");
  client ??= neon(url);
  return client;
}
