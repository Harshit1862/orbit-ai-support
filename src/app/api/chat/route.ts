import { FAQS } from "@/lib/faqs";
import { CHAT_FALLBACK_MODELS, CHAT_MODEL, completeJson, errorResponse, llmErrorResponse, rateLimitedResponse } from "@/lib/llm";
import { chatContextFor, workspaceNow } from "@/lib/orbit/model";
import { chatSystemPrompt, customerContextPrompt } from "@/lib/prompts";
import { quickReply } from "@/lib/quickReplies";
import { retrieveFaqs } from "@/lib/rag/retrieve";
import { clientKey, rateLimitWaitSeconds } from "@/lib/rateLimit";
import { ChatReplySchema, ChatRequestSchema, MAX_HISTORY_MESSAGES } from "@/lib/schemas";
import { SavedAnswers } from "@/lib/server/savedAnswers";
import { currentWorkspace } from "@/lib/server/workspaces";
import type { ChatResponse, Source } from "@/lib/types";

export const maxDuration = 60;

// Answers to opening questions, which don't depend on earlier messages.
const savedAnswers = new SavedAnswers<ChatResponse>("chat");

export async function POST(request: Request) {
  const waitSeconds = rateLimitWaitSeconds(`chat:${clientKey(request)}`, 15);
  if (waitSeconds > 0) {
    return rateLimitedResponse(waitSeconds, "You're sending messages too quickly. Please wait a moment and try again.");
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
  const question = messages[messages.length - 1].content;

  const quick = quickReply(question);
  if (quick) return Response.json({ reply: quick.reply, sources: [] } satisfies ChatResponse);

  // Only a conversation's first question can reuse a saved answer: later
  // answers depend on the earlier messages ("and the bigger one?"). Answers
  // personalised with customer context aren't saved either.
  const { page } = parsed.data;
  const reusable = parsed.data.messages.length === 1 && !page;
  const saved = reusable ? await savedAnswers.get(question) : undefined;
  if (saved) return Response.json(saved);

  // Retrieval: only the FAQs related to the question go into the prompt.
  const faqs = await findRelevantFaqs(messages.filter((m) => m.role === "user").map((m) => m.content));
  const context = page ? await customerContext(page) : null;
  const system = chatSystemPrompt(faqs) + (context ? customerContextPrompt(context) : "");

  try {
    const reply = await completeJson({
      models: [CHAT_MODEL, ...CHAT_FALLBACK_MODELS],
      system,
      // Earlier replies are shown to the model in the same JSON shape it must
      // produce, so it doesn't copy their plain-text style and break JSON mode.
      messages: messages.map((m) => (m.role === "assistant" ? { ...m, content: JSON.stringify({ answer: m.content }) } : m)),
      schema: ChatReplySchema,
      fromPlainText: (text) => ({ answer: text, faq_ids: [] }),
      // Replies are 2-4 sentences (~100 tokens). Some providers reserve the full
      // allowance against the per-minute limit up front, so keep it tight.
      maxTokens: 400,
      temperature: 0.3,
    });

    // Only keep ids of FAQs the model was actually given, so the UI never
    // shows an invented source.
    const sources: Source[] = [...new Set(reply.faq_ids)].flatMap((id) => {
      const faq = faqs.find((f) => f.id === id);
      return faq ? [{ id: faq.id, question: faq.question, link: faq.link }] : [];
    });

    const response: ChatResponse = { reply: reply.answer, sources };
    if (reusable) await savedAnswers.save(question, response);
    return Response.json(response);
  } catch (err) {
    return llmErrorResponse(err);
  }
}

/**
 * Who is asking, read from their workspace in the database (never from the
 * request body, which the user controls). Without it the assistant still
 * answers, just not personally.
 */
async function customerContext(page: string) {
  try {
    const workspace = await currentWorkspace();
    return workspace ? chatContextFor(workspace.data, workspaceNow(workspace.data), page) : null;
  } catch (err) {
    console.error("[chat] couldn't load the customer's workspace", err);
    return null;
  }
}

/**
 * The FAQs to ground this answer in. If the embedding model can't load (for
 * example, its download fails on a cold start), fall back to the whole
 * knowledge base: a bigger prompt is better than no answer.
 */
async function findRelevantFaqs(userQuestions: string[]) {
  try {
    const hits = await retrieveFaqs(userQuestions);
    console.info(`[rag] retrieved ${hits.map((h) => `${h.faq.id} ${h.score.toFixed(2)}`).join(", ") || "nothing"}`);
    return hits.map((h) => h.faq);
  } catch (err) {
    console.error("[rag] retrieval failed, using the full knowledge base", err);
    return FAQS;
  }
}
