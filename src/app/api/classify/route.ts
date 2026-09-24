// Extra AI feature: classify each question by category and urgency, so a
// support team could route and prioritise tickets automatically.
import { completeJson, errorResponse, llmErrorResponse, TRIAGE_MODEL, rateLimitedResponse } from "@/lib/llm";
import { TRIAGE_SYSTEM_PROMPT } from "@/lib/prompts";
import { quickReply } from "@/lib/quickReplies";
import { clientKey, rateLimitWaitSeconds } from "@/lib/rateLimit";
import { TriageRequestSchema, TriageSchema } from "@/lib/schemas";
import { SavedAnswers } from "@/lib/server/savedAnswers";
import type { Triage } from "@/lib/types";

export const maxDuration = 30;

// Triage looks at one message only, so identical messages always get the same tags.
const savedTriage = new SavedAnswers<Triage>("triage");

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

  const saved = await savedTriage.get(parsed.data.message);
  if (saved) return Response.json(saved);

  try {
    const triage: Triage = await completeJson({
      models: [TRIAGE_MODEL],
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: parsed.data.message }],
      schema: TriageSchema,
      maxTokens: 200,
      temperature: 0,
    });
    await savedTriage.save(parsed.data.message, triage);
    return Response.json(triage);
  } catch (err) {
    return llmErrorResponse(err);
  }
}
