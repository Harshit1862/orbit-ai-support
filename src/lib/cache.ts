// Small in-memory cache for model answers, so repeated questions (such as the
// example-question buttons) cost no tokens. Like the rate limiter, it lives in
// one server instance's memory; a production version would use a shared store.

const TTL_MS = 60 * 60_000;
const MAX_ENTRIES = 500;

export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    // Maps keep insertion order, so the first key is the oldest one.
    if (this.entries.size >= MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: Date.now() + TTL_MS });
  }
}

/** "How do I reset my password?" and "how do i reset my password" share a key. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
