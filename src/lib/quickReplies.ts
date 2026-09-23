// Messages that don't need a model at all. Answering them locally saves a full
// request (about 1,000 tokens) each time.
import type { Triage } from "./types";
import { normalizeQuestion } from "./cache";

const GREETINGS = new Set(["hi", "hello", "hey", "hii", "yo", "good morning", "good afternoon", "good evening"]);
const THANKS = new Set(["thanks", "thank you", "thx", "ty", "ok thanks", "ok thank you", "great thanks"]);

const LOW_OTHER: Triage = { category: "Other", urgency: "Low" };

/** A canned reply for greetings, thanks and too-short messages, or null if the model is needed. */
export function quickReply(message: string): { reply: string; triage: Triage } | null {
  const text = normalizeQuestion(message);
  if (GREETINGS.has(text)) {
    return { reply: "Hi! I'm Orbit Assist. What can I help you with today?", triage: LOW_OTHER };
  }
  if (THANKS.has(text)) {
    return { reply: "You're welcome! Let me know if there's anything else I can help with.", triage: LOW_OTHER };
  }
  // A single character (e.g. "w" or "?") carries no question to answer. Two
  // letters can ("no" in reply to a clarifying question), so those go to the model.
  if (text.replace(/\s/g, "").length <= 1) {
    return { reply: "Could you tell me a bit more about what you need help with?", triage: LOW_OTHER };
  }
  return null;
}
