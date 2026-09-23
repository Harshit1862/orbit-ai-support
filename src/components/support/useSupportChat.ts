"use client";

// The chat logic shared by the full-page help centre and the in-app help
// widget: conversations, sending, retries, timeouts, rate-limit cooldowns and
// sessionStorage persistence. The two UIs only differ in how they render it.
import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE_CHARS, type ApiErrorBody, type ChatResponse, type Conversation, type Message, type Triage } from "@/lib/types";

export const MAX_INPUT_CHARS = MAX_MESSAGE_CHARS;
const CHAT_TIMEOUT_MS = 30_000;
const TRIAGE_TIMEOUT_MS = 15_000;
const SLOW_NOTICE_MS = 8_000;
// Minimum gap between two sends, so fast failures can't be fired off in a loop.
const MIN_SEND_GAP_MS = 2_000;

function createConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", messages: [] };
}

/** An error whose message is safe to show to the user. */
class RequestError extends Error {
  /** Seconds the server asked us to wait (from a 429's Retry-After header). */
  retryAfter?: number;
}

async function postJson(url: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new RequestError("The server sent back an unreadable response. Please try again.");
  }
  if (!res.ok) {
    const message = (data as Partial<ApiErrorBody> | null)?.error?.message;
    const error = new RequestError(typeof message === "string" ? message : `Request failed (${res.status}). Please try again.`);
    const retryAfter = Number(res.headers.get("Retry-After"));
    if (res.status === 429 && retryAfter > 0) error.retryAfter = retryAfter;
    throw error;
  }
  return data;
}

function isChatResponse(data: unknown): data is ChatResponse {
  const d = data as ChatResponse;
  return typeof d?.reply === "string" && d.reply.trim().length > 0 && Array.isArray(d.sources);
}

function isTriage(data: unknown): data is Triage {
  const d = data as Triage;
  return typeof d?.category === "string" && typeof d?.urgency === "string";
}

/** Classifies one message; resolves to null if triage is unavailable. */
export async function classifyMessage(message: string): Promise<Triage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRIAGE_TIMEOUT_MS);
  try {
    const data = await postJson("/api/classify", { message }, controller.signal);
    return isTriage(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface Options {
  /** sessionStorage key, so each chat surface keeps its own history. */
  storageKey: string;
  /** The app page the user is on, read at send time (in-app widget only). */
  getPage?: () => string;
}

export function useSupportChat({ storageKey, getPage }: Options) {
  const [conversations, setConversations] = useState<Conversation[]>(() => [createConversation()]);
  const [activeId, setActiveId] = useState(() => conversations[0].id);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const [restored, setRestored] = useState(false);
  // Seconds left before the server will accept another message (after a 429).
  const [cooldown, setCooldown] = useState(0);

  // A ref (not state) guards against double-sends: two quick clicks both run
  // before React re-renders, so a state flag alone would let both through.
  const inFlight = useRef(false);
  const lastSentAt = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const isPending = pendingId !== null;
  const isCoolingDown = cooldown > 0;

  // Count the rate-limit cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Keep the session's conversations across page refreshes (sessionStorage is
  // cleared when the tab closes, matching "during the current session").
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved?.conversations) && saved.conversations.length > 0) {
        // A classification still loading when the page was refreshed will never arrive.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage after mount
        setConversations(
          (saved.conversations as Conversation[]).map((c) => ({
            ...c,
            messages: c.messages.map((m) => (m.role === "user" && m.triage === undefined ? { ...m, triage: null } : m)),
          })),
        );
        setActiveId(saved.activeId);
      }
    } catch {
      // Corrupt or unavailable storage: start fresh.
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ conversations, activeId }));
    } catch {
      // Storage full or blocked: the app still works, it just won't survive a refresh.
    }
  }, [conversations, activeId, restored, storageKey]);

  function updateConversation(id: string, update: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? update(c) : c)));
  }

  function updateMessage(convId: string, msgId: string, patch: Partial<Message>) {
    updateConversation(convId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
    }));
  }

  async function requestReply(convId: string, history: Message[]) {
    inFlight.current = true;
    setPendingId(convId);
    setIsSlow(false);
    updateConversation(convId, (c) => ({ ...c, error: undefined }));

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const slowTimer = setTimeout(() => setIsSlow(true), SLOW_NOTICE_MS);
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);

    try {
      const data = await postJson(
        "/api/chat",
        { messages: history.map(({ role, content }) => ({ role, content })), page: getPage?.() },
        controller.signal,
      );
      if (!isChatResponse(data)) {
        throw new RequestError("The assistant sent back an unexpected response. Please try again.");
      }
      const reply: Message = { id: crypto.randomUUID(), role: "assistant", content: data.reply, sources: data.sources };
      updateConversation(convId, (c) => ({ ...c, messages: [...c.messages, reply] }));
    } catch (err) {
      // Aborted because the user started a new conversation: not an error.
      if (controller.signal.aborted && !timedOut) return;
      if (err instanceof RequestError && err.retryAfter) setCooldown(err.retryAfter);
      const message = timedOut
        ? "The assistant is taking too long to respond. Please try again."
        : err instanceof RequestError
          ? err.message
          : "Couldn't reach the server. Check your connection and try again.";
      updateConversation(convId, (c) => ({ ...c, error: message }));
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlight.current = false;
        setPendingId(null);
        setIsSlow(false);
      }
    }
  }

  async function classify(convId: string, message: Message) {
    updateMessage(convId, message.id, { triage: await classifyMessage(message.content) });
  }

  /** Returns true if a request may be sent now, recording the send time. */
  function claimSendSlot(): boolean {
    if (inFlight.current || cooldown > 0) return false;
    if (Date.now() - lastSentAt.current < MIN_SEND_GAP_MS) {
      setNotice("Please wait a moment before sending another message.");
      return false;
    }
    lastSentAt.current = Date.now();
    return true;
  }

  function retry() {
    if (claimSendSlot()) void requestReply(active.id, active.messages);
  }

  /** Sends a message. Returns true if it was sent, so the caller can clear its input. */
  function send(text: string): boolean {
    const content = text.trim();
    if (!content) {
      setNotice("Please type a question first.");
      return false;
    }
    if (content.length > MAX_INPUT_CHARS) {
      setNotice(`Please keep your message under ${MAX_INPUT_CHARS} characters.`);
      return false;
    }
    if (!claimSendSlot()) return false;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const history = [...active.messages, userMessage];
    updateConversation(active.id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "…" : "") : c.title,
      messages: history,
    }));
    setNotice(null);

    void classify(active.id, userMessage);
    void requestReply(active.id, history);
    return true;
  }

  /** Cancels any in-flight reply and switches to an empty conversation. */
  function startNewConversation() {
    // Cancel any in-flight reply; it belongs to the conversation being left.
    abortRef.current?.abort();
    abortRef.current = null;
    inFlight.current = false;
    setPendingId(null);
    setIsSlow(false);
    setNotice(null);

    // Reuse the current conversation if it is still empty.
    if (active.messages.length === 0) return;
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  }

  const lastMessage = active.messages[active.messages.length - 1];

  return {
    conversations,
    active,
    setActiveId,
    pendingId,
    isPending,
    isSlow,
    cooldown,
    isCoolingDown,
    notice,
    clearNotice: () => setNotice(null),
    send,
    retry,
    startNewConversation,
    /** The last message has no reply (failed or cancelled) and may be asked again. */
    canRetry: !isPending && !isCoolingDown && lastMessage?.role === "user",
  };
}
