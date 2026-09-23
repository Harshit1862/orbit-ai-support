// Minimal in-memory sliding-window rate limiter, keyed by client IP.
// Note: on serverless hosting each instance has its own memory, so this is a
// best-effort guard against rapid-fire requests, not a strict global limit.
// A production version would use a shared store such as Redis.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/**
 * Records a request for `key` and returns how many seconds the client must wait
 * before the next one is allowed, or 0 if this request is allowed.
 */
export function rateLimitWaitSeconds(key: string, maxPerWindow: number): number {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.set(key, recent);
  if (recent.length >= maxPerWindow) {
    // A slot frees up when the oldest request in the window expires.
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
  }
  recent.push(now);
  return 0;
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
