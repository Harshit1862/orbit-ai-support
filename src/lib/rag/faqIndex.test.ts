import { describe, expect, it } from "vitest";
import { FAQS } from "@/lib/faqs";
import { chunksHash, faqChunks } from "./chunks";
import { EMBEDDING_MODEL } from "./embeddings";
import { FAQ_INDEX } from "./faqIndex";

describe("FAQ index", () => {
  it("was built from the current FAQs (run `npm run build:index` after editing faqs.ts)", () => {
    expect(FAQ_INDEX.hash).toBe(chunksHash(faqChunks()));
  });

  it("has one vector per FAQ, from the model used for questions", () => {
    expect(FAQ_INDEX.model).toBe(EMBEDDING_MODEL);
    expect(FAQ_INDEX.records.map((r) => r.id)).toEqual(FAQS.map((f) => f.id));
    expect(new Set(FAQ_INDEX.records.map((r) => r.vector.length))).toEqual(new Set([384]));
  });
});
