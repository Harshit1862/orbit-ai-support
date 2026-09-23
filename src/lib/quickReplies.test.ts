import { describe, expect, it } from "vitest";
import { quickReply } from "./quickReplies";

describe("quickReply", () => {
  it("answers greetings, thanks and single characters without the model", () => {
    for (const message of ["hi", "Hello!", "thanks", "Thank you.", "w", "?"]) {
      expect(quickReply(message), message).not.toBeNull();
    }
  });

  it("tags them as low-urgency", () => {
    expect(quickReply("hi")?.triage).toEqual({ category: "Other", urgency: "Low" });
  });

  it("sends real questions, and short answers like 'no', to the model", () => {
    for (const message of ["Can I get a refund?", "no", "hi, how do I cancel?"]) {
      expect(quickReply(message), message).toBeNull();
    }
  });
});
