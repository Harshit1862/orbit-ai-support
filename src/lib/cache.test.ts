import { afterEach, describe, expect, it, vi } from "vitest";
import { TtlCache, normalizeQuestion } from "./cache";

afterEach(() => vi.useRealTimers());

describe("normalizeQuestion", () => {
  it("treats case, punctuation and extra spaces as the same question", () => {
    expect(normalizeQuestion("  How do I reset my PASSWORD?? ")).toBe(normalizeQuestion("how do i reset my password"));
  });
});

describe("TtlCache", () => {
  it("returns stored values until they expire after an hour", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>();
    cache.set("q", "answer");
    expect(cache.get("q")).toBe("answer");
    vi.advanceTimersByTime(60 * 60_000 + 1);
    expect(cache.get("q")).toBeUndefined();
  });
});
