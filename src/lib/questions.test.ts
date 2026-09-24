import { describe, expect, it } from "vitest";
import { normalizeQuestion } from "./questions";

describe("normalizeQuestion", () => {
  it("treats case, punctuation and extra spaces as the same question", () => {
    expect(normalizeQuestion("  How do I reset my PASSWORD?? ")).toBe(normalizeQuestion("how do i reset my password"));
  });
});
