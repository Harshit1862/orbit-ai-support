// Daily clean-up (scheduled in vercel.json): deletes demo workspaces nobody
// has opened for 7 days and expired saved answers, so the free database
// doesn't fill up.
import { sql } from "@/lib/server/db";

export async function GET(request: Request) {
  // Vercel Cron sends this header; anyone else calling the URL is refused.
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deleted = await sql()`DELETE FROM workspaces WHERE last_seen_at < now() - interval '7 days' RETURNING id`;
  const expired = await sql()`DELETE FROM saved_answers WHERE expires_at < now() RETURNING kind`;
  console.info(`[cron] deleted ${deleted.length} inactive workspace(s), ${expired.length} expired saved answer(s)`);
  return Response.json({ deleted: deleted.length, expiredAnswers: expired.length });
}
