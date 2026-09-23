// Runtime validation for request bodies and model output.
import { z } from "zod";
import { CATEGORIES, MAX_MESSAGE_CHARS, URGENCIES } from "./types";

/**
 * Only the most recent messages are sent to the model, to bound prompt size.
 * Every message sent is paid for again on each turn, and follow-ups rarely
 * refer back more than a couple of exchanges.
 */
export const MAX_HISTORY_MESSAGES = 6;

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

export const ChatRequestSchema = z.object({
  /**
   * The app page the question was asked from; sent only by the in-app widget.
   * It's the only customer detail the browser provides: plan, usage and so on
   * are read from the database on the server, so they can't be faked.
   */
  page: z.string().startsWith("/app").max(100).optional(),
  messages: z
    .array(chatMessage)
    .min(1)
    .max(200)
    .refine((msgs) => msgs[msgs.length - 1].role === "user", {
      message: "The last message must be from the user",
    }),
});

export const TriageRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

// What we require the model to return.
export const ChatReplySchema = z.object({
  answer: z.string().trim().min(1),
  faq_ids: z.array(z.string()).default([]),
});

/** Accepts "billing" / "BILLING" etc. and normalises to "Billing". */
function caseInsensitiveEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((s) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase())
    .pipe(z.enum(values));
}

export const TriageSchema = z.object({
  category: caseInsensitiveEnum(CATEGORIES),
  urgency: caseInsensitiveEnum(URGENCIES),
});
