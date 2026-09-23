import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimitWaitSeconds } from "./rateLimit";

afterEach(() => vi.useRealTimers());

describe("rateLimitWaitSeconds", () => {
  it("allows requests up to the limit, then says how long to wait", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimitWaitSeconds(key, 3)).toBe(0);

    vi.advanceTimersByTime(20_000);
    // The oldest request frees its slot 60s after it was made: 40s from now.
    expect(rateLimitWaitSeconds(key, 3)).toBe(40);
  });

  it("allows requests again once the window has passed", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimitWaitSeconds(key, 3);
    vi.advanceTimersByTime(60_001);
    expect(rateLimitWaitSeconds(key, 3)).toBe(0);
  });

  it("counts each client separately", () => {
    rateLimitWaitSeconds("client-a", 1);
    expect(rateLimitWaitSeconds("client-a", 1)).toBeGreaterThan(0);
    expect(rateLimitWaitSeconds("client-b", 1)).toBe(0);
  });
});
