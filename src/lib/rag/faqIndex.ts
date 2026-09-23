// The FAQ index: every chunk's embedding, computed ahead of time by
// `npm run build:index` and stored in faq-index.json. At request time only the
// user's question needs embedding.
import index from "./faq-index.json";
import type { VectorRecord } from "./vectorStore";

export interface FaqIndex {
  model: string;
  /** chunksHash() of the FAQs the index was built from. */
  hash: string;
  records: VectorRecord[];
}

export const FAQ_INDEX: FaqIndex = index;
