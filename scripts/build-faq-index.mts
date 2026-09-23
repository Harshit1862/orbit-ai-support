// Ingestion: embeds every FAQ chunk and writes the vectors to
// src/lib/rag/faq-index.json. Run after editing src/lib/faqs.ts:
//
//   npm run build:index
import { writeFileSync } from "node:fs";
import { chunksHash, faqChunks } from "@/lib/rag/chunks";
import { EMBEDDING_MODEL, embed } from "@/lib/rag/embeddings";
import type { FaqIndex } from "@/lib/rag/faqIndex";

const chunks = faqChunks();
const vectors = await embed(chunks.map((c) => c.text));

const index: FaqIndex = {
  model: EMBEDDING_MODEL,
  hash: chunksHash(chunks),
  // 5 decimals keeps the file small without changing any ranking.
  records: chunks.map((c, i) => ({ id: c.id, vector: vectors[i].map((x) => Math.round(x * 1e5) / 1e5) })),
};

const path = new URL("../src/lib/rag/faq-index.json", import.meta.url);
writeFileSync(path, JSON.stringify(index) + "\n");
console.log(`Indexed ${chunks.length} FAQ chunks (${vectors[0].length} dimensions) with ${EMBEDDING_MODEL}.`);
