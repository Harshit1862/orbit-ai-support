// Retrieval: find the FAQs relevant to what the user is asking, so only those
// go into the prompt (the "R" in RAG).
import { FAQ_BY_ID, type Faq } from "@/lib/faqs";
import { embed } from "./embeddings";
import { FAQ_INDEX } from "./faqIndex";
import { search } from "./vectorStore";

/**
 * Tuned with `npm run eval:retrieval`. The threshold is deliberately low:
 * missing the right FAQ makes the assistant wrongly say "I don't know", while
 * an extra, unrelated FAQ only costs a few tokens, because the model is told
 * to answer only when the knowledge base covers the question. At 0.2 every
 * in-scope eval question retrieves its FAQ (100% recall@3).
 */
export const RETRIEVAL = {
  /** At most this many FAQs go into the prompt. */
  topK: 3,
  /** Below this cosine similarity an FAQ counts as unrelated. */
  minScore: 0.2,
};

export interface RetrievedFaq {
  faq: Faq;
  score: number;
}

/**
 * The FAQs most relevant to the latest question, best first.
 *
 * A follow-up like "and the bigger one?" means nothing on its own, so the
 * search also runs on the previous question joined with the latest one, and
 * each FAQ keeps its best score from either search.
 */
export async function retrieveFaqs(userQuestions: string[], options = RETRIEVAL): Promise<RetrievedFaq[]> {
  const latest = userQuestions.at(-1);
  if (!latest) return [];
  const previous = userQuestions.at(-2);
  const queries = previous ? [latest, `${previous}\n${latest}`] : [latest];

  const best = new Map<string, number>();
  for (const vector of await embed(queries)) {
    for (const hit of search(FAQ_INDEX.records, vector, options)) {
      best.set(hit.id, Math.max(best.get(hit.id) ?? -1, hit.score));
    }
  }

  return [...best]
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.topK)
    .flatMap(([id, score]) => {
      const faq = FAQ_BY_ID.get(id);
      return faq ? [{ faq, score }] : [];
    });
}
