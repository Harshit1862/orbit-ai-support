// Minimal in-memory sliding-window rate limiter, keyed by client IP.
// Note: on serverless hosting each instance has its own memory, so this is a
// best-effort guard against rapid-fire requests, not a strict global limit.
// A production version would use a shared store such as Redis.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxPerWindow: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= maxPerWindow) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
