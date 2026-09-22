// Types shared by the frontend and the API routes.

export type Role = "user" | "assistant";

export const CATEGORIES = ["Billing", "Technical", "Account", "Other"] as const;
export const URGENCIES = ["Low", "Medium", "High"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];

export interface Triage {
  category: Category;
  urgency: Urgency;
}

export interface Source {
  id: string;
  question: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Knowledge-base entries the assistant based its answer on. */
  sources?: Source[];
  /** Issue classification for user messages: undefined = loading, null = unavailable. */
  triage?: Triage | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  /** Set when the last request for this conversation failed. */
  error?: string;
}

/** POST /api/chat response. */
export interface ChatResponse {
  reply: string;
  sources: Source[];
}

/** Error body returned by every API route. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
