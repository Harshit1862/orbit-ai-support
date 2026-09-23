// Chunking: how the knowledge base is split into pieces that get one embedding
// each. FAQs are short and self-contained, so each FAQ is one chunk. Long
// help-centre articles would be split into overlapping ~300-token sections.
import { createHash } from "node:crypto";
import { FAQS, type Faq } from "@/lib/faqs";

export interface Chunk {
  id: string;
  text: string;
}

/** The text that gets embedded for an FAQ: its question and its answer. */
export function faqChunk(faq: Faq): Chunk {
  return { id: faq.id, text: `${faq.question}\n${faq.answer}` };
}

export function faqChunks(): Chunk[] {
  return FAQS.map(faqChunk);
}

/** Fingerprint of the chunk texts, to detect an index built from older FAQs. */
export function chunksHash(chunks: Chunk[]): string {
  return createHash("sha256")
    .update(JSON.stringify(chunks))
    .digest("hex")
    .slice(0, 16);
}
