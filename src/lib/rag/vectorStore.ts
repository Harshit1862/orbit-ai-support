// A minimal in-memory vector store: the "vector database" of this app.
//
// With 10 FAQs, a brute-force scan (compare the question with every stored
// vector) takes microseconds, so a hosted vector database (Pinecone, Qdrant,
// pgvector) would add a service without adding anything. Those become worth it
// at hundreds of thousands of chunks, where they use approximate-nearest-
// neighbour indexes instead of scanning everything.

export interface VectorRecord {
  id: string;
  vector: number[];
}

export interface SearchHit {
  id: string;
  score: number;
}

/** Cosine similarity of two unit-length vectors (1 = same meaning, ~0 = unrelated). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * The `topK` records most similar to `query`, best first, keeping only those
 * scoring at least `minScore`. The threshold is what lets "Do you have a
 * mobile app?" retrieve nothing instead of the least-bad FAQ.
 */
export function search(records: VectorRecord[], query: number[], { topK, minScore }: { topK: number; minScore: number }): SearchHit[] {
  return records
    .map((r) => ({ id: r.id, score: cosineSimilarity(r.vector, query) }))
    .filter((hit) => hit.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
