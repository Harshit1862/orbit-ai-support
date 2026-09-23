import { describe, expect, it } from "vitest";
import { cosineSimilarity, search } from "./vectorStore";

const records = [
  { id: "a", vector: [1, 0, 0] },
  { id: "b", vector: [0.8, 0.6, 0] },
  { id: "c", vector: [0, 0, 1] },
];

describe("cosineSimilarity", () => {
  it("is 1 for identical unit vectors and 0 for unrelated ones", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });
});

describe("search", () => {
  it("returns the closest records first", () => {
    expect(search(records, [1, 0, 0], { topK: 2, minScore: 0 }).map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("drops records below the similarity threshold", () => {
    expect(search(records, [1, 0, 0], { topK: 3, minScore: 0.9 }).map((h) => h.id)).toEqual(["a"]);
  });

  it("returns nothing when no record is similar enough", () => {
    expect(search(records, [0, 1, 0], { topK: 3, minScore: 0.7 })).toEqual([]);
  });
});
