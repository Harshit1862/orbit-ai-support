import { describe, expect, it } from "vitest";
import { ChatRequestSchema, TriageSchema } from "./schemas";

describe("ChatRequestSchema", () => {
  const user = (content: string) => ({ role: "user" as const, content });

  it("accepts a normal conversation", () => {
    expect(ChatRequestSchema.safeParse({ messages: [user("Can I get a refund?")] }).success).toBe(true);
  });

  it("rejects empty and over-long messages", () => {
    expect(ChatRequestSchema.safeParse({ messages: [user("   ")] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [user("a".repeat(2001))] }).success).toBe(false);
  });

  it("requires the last message to come from the user", () => {
    const messages = [user("hi"), { role: "assistant", content: "Hello!" }];
    expect(ChatRequestSchema.safeParse({ messages }).success).toBe(false);
  });

  it("accepts only an in-app page from the browser, not customer details", () => {
    expect(ChatRequestSchema.safeParse({ messages: [user("hi")], page: "/app/projects" }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ messages: [user("hi")], page: "https://evil.example" }).success).toBe(false);
    // Unknown keys (like a faked plan) are stripped, never trusted.
    const parsed = ChatRequestSchema.parse({ messages: [user("hi")], context: { plan: "Business" } });
    expect(parsed).not.toHaveProperty("context");
  });
});

describe("TriageSchema", () => {
  it("normalises the model's capitalisation", () => {
    expect(TriageSchema.parse({ category: "billing", urgency: "HIGH" })).toEqual({ category: "Billing", urgency: "High" });
  });

  it("rejects unknown labels", () => {
    expect(TriageSchema.safeParse({ category: "Sales", urgency: "High" }).success).toBe(false);
  });
});
