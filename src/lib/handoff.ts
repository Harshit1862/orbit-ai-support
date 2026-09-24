// When "Talk to a human" is offered. For routine problems the assistant gets a
// fair chance to solve them first; a High-urgency problem (locked out, charged
// wrongly, losing data) is offered a person straight away.
import type { Message, Urgency } from "./types";

/** Assistant replies needed before the handoff is offered, by urgency. */
export const HANDOFF_AFTER_REPLIES: Record<Urgency, number> = { High: 0, Medium: 8, Low: 10 };

const RANK: Record<Urgency, number> = { Low: 0, Medium: 1, High: 2 };

/** The most urgent triage tag in the conversation (untagged messages count as Low). */
export function conversationUrgency(messages: Message[]): Urgency {
  let urgency: Urgency = "Low";
  for (const m of messages) {
    const u = m.triage?.urgency;
    if (u && RANK[u] > RANK[urgency]) urgency = u;
  }
  return urgency;
}

/** How many more assistant replies until "Talk to a human" appears (0 = available now). */
export function repliesUntilHandoff(messages: Message[]): number {
  const replies = messages.filter((m) => m.role === "assistant").length;
  return Math.max(0, HANDOFF_AFTER_REPLIES[conversationUrgency(messages)] - replies);
}
