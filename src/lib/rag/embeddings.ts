// Turns text into embeddings: 384 numbers that capture its meaning, so that
// "Can I get my money back?" lands close to "What is your refund policy?"
// even though they share no words.
//
// The model (all-MiniLM-L6-v2, 23 MB, 8-bit quantised) runs inside this Node
// process via transformers.js: no embedding API, no key, no per-call cost.
// Groq, the chat provider, has no embedding models.
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  // Imported on first use, not at the top of the file: if the native runtime
  // can't load, only this call fails (and the chat route falls back to the
  // full knowledge base) instead of the whole route failing to load.
  const { env, pipeline } = await import("@huggingface/transformers");
  // Serverless functions can only write to /tmp, where the model is downloaded
  // once per cold start.
  if (process.env.VERCEL) env.cacheDir = "/tmp/transformers-cache";
  return pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  // Load once and share: concurrent first requests wait on the same promise.
  extractor ??= loadExtractor().catch((err) => {
    extractor = null; // let the next request try again
    throw err;
  });
  return extractor;
}

/** Embeds texts into unit-length vectors, so cosine similarity is a plain dot product. */
export async function embed(texts: string[]): Promise<number[][]> {
  const extract = await getExtractor();
  const output = await extract(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}
