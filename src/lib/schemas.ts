// Runtime validation for request bodies and model output.
import { z } from "zod";
import { CATEGORIES, URGENCIES } from "./types";

export const MAX_MESSAGE_CHARS = 2000;
/** Only the most recent messages are sent to the model, to bound prompt size. */
export const MAX_HISTORY_MESSAGES = 20;

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

export const ChatRequestSchema = z.object({
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
