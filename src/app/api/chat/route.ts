import { FAQ_BY_ID } from "@/lib/faqs";
import { CHAT_MODEL, completeJson, errorResponse, llmErrorResponse } from "@/lib/llm";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { ChatReplySchema, ChatRequestSchema, MAX_HISTORY_MESSAGES } from "@/lib/schemas";
import type { ChatResponse, Source } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isRateLimited(`chat:${clientKey(request)}`, 15)) {
    return errorResponse(429, "rate_limited", "You're sending messages too quickly. Please wait a moment and try again.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Please enter a message (up to 2000 characters).");
  }

  // Conversation context: the client sends the full session history and we
  // forward the most recent part of it on every request.
  const messages = parsed.data.messages.slice(-MAX_HISTORY_MESSAGES);

  try {
    const reply = await completeJson({
      model: CHAT_MODEL,
      system: CHAT_SYSTEM_PROMPT,
      messages,
      schema: ChatReplySchema,
      maxTokens: 1500,
      temperature: 0.3,
    });

    // Only keep ids that really exist, so the UI never shows an invented source.
    const sources: Source[] = [...new Set(reply.faq_ids)].flatMap((id) => {
      const faq = FAQ_BY_ID.get(id);
      return faq ? [{ id: faq.id, question: faq.question }] : [];
    });

    return Response.json({ reply: reply.answer, sources } satisfies ChatResponse);
  } catch (err) {
    return llmErrorResponse(err);
  }
}
