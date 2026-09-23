// Types shared by the frontend and the API routes.

export type Role = "user" | "assistant";

/** Longest message a user can send; enforced in the UI and on the server. */
export const MAX_MESSAGE_CHARS = 2000;

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
  /** Where in the Orbit app this is done, e.g. { href: "/app/settings/billing", label: "Open Billing" }. */
  link?: { href: string; label: string };
}

/**
 * Facts about the signed-in customer that the in-app help widget sends along,
 * so answers can be specific ("you're on the Free plan, which allows 5 projects").
 */
export interface ChatContext {
  page: string;
  plan: string;
  billingCycle: string;
  subscription: string;
  seatsUsed: number;
  seatLimit: number | null;
  projects: number;
  projectLimit: number | null;
  twoFactorEnabled: boolean;
  refundEligible: boolean;
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
