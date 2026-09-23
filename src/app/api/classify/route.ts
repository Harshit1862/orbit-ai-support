// Extra AI feature: classify each question by category and urgency, so a
// support team could route and prioritise tickets automatically.
import { normalizeQuestion, TtlCache } from "@/lib/cache";
import { completeJson, errorResponse, llmErrorResponse, TRIAGE_MODEL, rateLimitedResponse } from "@/lib/llm";
import { TRIAGE_SYSTEM_PROMPT } from "@/lib/prompts";
import { quickReply } from "@/lib/quickReplies";
import { clientKey, rateLimitWaitSeconds } from "@/lib/rateLimit";
import { TriageRequestSchema, TriageSchema } from "@/lib/schemas";
import type { Triage } from "@/lib/types";

export const maxDuration = 30;

// Triage looks at one message only, so identical messages always get the same tags.
const triageCache = new TtlCache<Triage>();

export async function POST(request: Request) {
  const waitSeconds = rateLimitWaitSeconds(`classify:${clientKey(request)}`, 15);
  if (waitSeconds > 0) {
    return rateLimitedResponse(waitSeconds, "Too many requests. Please wait a moment.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
  }
  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "A non-empty message is required.");
  }

  const quick = quickReply(parsed.data.message);
  if (quick) return Response.json(quick.triage);

  const cacheKey = normalizeQuestion(parsed.data.message);
  const cached = triageCache.get(cacheKey);
  if (cached) return Response.json(cached);

  try {
    const triage: Triage = await completeJson({
      models: [TRIAGE_MODEL],
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: parsed.data.message }],
      schema: TriageSchema,
      maxTokens: 200,
      temperature: 0,
    });
    triageCache.set(cacheKey, triage);
    return Response.json(triage);
  } catch (err) {
    return llmErrorResponse(err);
  }
}
