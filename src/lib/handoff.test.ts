import { describe, expect, it } from "vitest";
import { conversationUrgency, repliesUntilHandoff } from "./handoff";
import type { Message, Urgency } from "./types";

const user = (urgency?: Urgency): Message => ({
  id: crypto.randomUUID(),
  role: "user",
  content: "question",
  triage: urgency ? { category: "Billing", urgency } : undefined,
});
const bot = (): Message => ({ id: crypto.randomUUID(), role: "assistant", content: "answer" });

/** A conversation of `n` question/answer pairs, all with the given urgency. */
const conversation = (n: number, urgency?: Urgency) => Array.from({ length: n }, () => [user(urgency), bot()]).flat();

describe("conversationUrgency", () => {
  it("is the most urgent tag seen, defaulting to Low", () => {
    expect(conversationUrgency([user()])).toBe("Low");
    expect(conversationUrgency([user("Low"), user("High"), user("Medium")])).toBe("High");
  });
});

describe("repliesUntilHandoff", () => {
  it("offers a human at once for High urgency, after 8 replies for Medium and 10 for Low", () => {
    expect(repliesUntilHandoff([user("High")])).toBe(0);
    expect(repliesUntilHandoff(conversation(1, "High"))).toBe(0);
    expect(repliesUntilHandoff(conversation(7, "Medium"))).toBe(1);
    expect(repliesUntilHandoff(conversation(8, "Medium"))).toBe(0);
    expect(repliesUntilHandoff(conversation(9, "Low"))).toBe(1);
    expect(repliesUntilHandoff(conversation(10, "Low"))).toBe(0);
  });

  it("brings the handoff forward as soon as an urgent message arrives", () => {
    const messages = [...conversation(7, "Low"), user("High")];
    expect(repliesUntilHandoff(messages)).toBe(0);
  });
});
