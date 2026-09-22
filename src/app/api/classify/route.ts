// Extra AI feature: classify each question by category and urgency, so a
// support team could route and prioritise tickets automatically.
import { completeJson, errorResponse, llmErrorResponse, TRIAGE_MODEL } from "@/lib/llm";
import { TRIAGE_SYSTEM_PROMPT } from "@/lib/prompts";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { TriageRequestSchema, TriageSchema } from "@/lib/schemas";
import type { Triage } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (isRateLimited(`classify:${clientKey(request)}`, 15)) {
    return errorResponse(429, "rate_limited", "Too many requests. Please wait a moment.");
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

  try {
    const triage: Triage = await completeJson({
      model: TRIAGE_MODEL,
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: parsed.data.message }],
      schema: TriageSchema,
      maxTokens: 400,
      temperature: 0,
    });
    return Response.json(triage);
  } catch (err) {
    return llmErrorResponse(err);
  }
}
