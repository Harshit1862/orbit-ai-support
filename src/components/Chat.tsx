"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatResponse, Conversation, Message, Triage } from "@/lib/types";

const MAX_INPUT_CHARS = 2000;
const CHAT_TIMEOUT_MS = 30_000;
const TRIAGE_TIMEOUT_MS = 15_000;
const SLOW_NOTICE_MS = 8_000;
const STORAGE_KEY = "nimbus-support:v1";

const EXAMPLE_QUESTIONS = [
  "I forgot my password. How can I reset it?",
  "Can I get a refund?",
  "How do I invite my team?",
  "Do you have a mobile app?",
];

function createConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", messages: [] };
}

/** An error whose message is safe to show to the user. */
class RequestError extends Error {}

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
    const message = (data as { error?: { message?: unknown } })?.error?.message;
    throw new RequestError(typeof message === "string" ? message : `Request failed (${res.status}). Please try again.`);
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

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => [createConversation()]);
  const [activeId, setActiveId] = useState(() => conversations[0].id);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const [restored, setRestored] = useState(false);

  // A ref (not state) guards against double-sends: two quick clicks both run
  // before React re-renders, so a state flag alone would let both through.
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const isPending = pendingId !== null;

  // Keep the session's conversations across page refreshes (sessionStorage is
  // cleared when the tab closes, matching "during the current session").
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
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
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, activeId }));
    } catch {
      // Storage full or blocked: the app still works, it just won't survive a refresh.
    }
  }, [conversations, activeId, restored]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length, pendingId, active.error]);

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
        { messages: history.map(({ role, content }) => ({ role, content })) },
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRIAGE_TIMEOUT_MS);
    try {
      const data = await postJson("/api/classify", { message: message.content }, controller.signal);
      updateMessage(convId, message.id, { triage: isTriage(data) ? data : null });
    } catch {
      // Classification is a nice-to-have; never block the chat on it.
      updateMessage(convId, message.id, { triage: null });
    } finally {
      clearTimeout(timer);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content) {
      setInputError("Please type a question first.");
      inputRef.current?.focus();
      return;
    }
    if (content.length > MAX_INPUT_CHARS) {
      setInputError(`Please keep your message under ${MAX_INPUT_CHARS} characters.`);
      return;
    }
    if (inFlight.current) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const history = [...active.messages, userMessage];
    updateConversation(active.id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "…" : "") : c.title,
      messages: history,
    }));
    setInput("");
    setInputError(null);

    void classify(active.id, userMessage);
    void requestReply(active.id, history);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  function startNewConversation() {
    // Cancel any in-flight reply; it belongs to the conversation being left.
    abortRef.current?.abort();
    abortRef.current = null;
    inFlight.current = false;
    setPendingId(null);
    setIsSlow(false);

    // Reuse the current conversation if it is still empty.
    if (active.messages.length === 0) {
      inputRef.current?.focus();
      return;
    }
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");
    setInputError(null);
    inputRef.current?.focus();
  }

  const lastMessage = active.messages[active.messages.length - 1];
  const waitingHere = pendingId === active.id;
  const canRetry = !isPending && lastMessage?.role === "user";

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-900">
      {/* Sidebar: conversation history for this session */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo />
          <div>
            <p className="font-semibold leading-tight">Nimbus Support</p>
            <p className="text-xs text-slate-500">AI assistant</p>
          </div>
        </div>
        <div className="px-4">
          <button
            onClick={startNewConversation}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New conversation
          </button>
        </div>
        <p className="mt-6 px-5 text-xs font-medium uppercase tracking-wide text-slate-400">This session</p>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full truncate rounded-md px-3 py-2 text-left text-sm ${
                c.id === active.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {c.title}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold">Nimbus Support</span>
          </div>
          <button onClick={startNewConversation} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
            New chat
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {active.messages.length === 0 && <EmptyState onPick={send} disabled={isPending} />}

            {active.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {waitingHere && <TypingIndicator slow={isSlow} />}

            {active.error && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="flex-1">{active.error}</span>
                {canRetry && (
                  <button
                    onClick={() => requestReply(active.id, active.messages)}
                    className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Reply was cancelled (e.g. user switched away mid-request) and no error recorded */}
            {!active.error && canRetry && !waitingHere && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>No reply was received for this message.</span>
                <button onClick={() => requestReply(active.id, active.messages)} className="font-medium text-indigo-600 hover:underline">
                  Ask again
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (inputError) setInputError(null);
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={MAX_INPUT_CHARS}
                placeholder="Describe your question or problem…"
                aria-label="Your message"
                className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={isPending || !input.trim()}
                className="h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPending ? "Waiting…" : "Send"}
              </button>
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-slate-400">
              <span className={inputError ? "text-red-600" : ""}>
                {inputError ?? "Enter to send · Shift+Enter for a new line"}
              </span>
              {input.length > MAX_INPUT_CHARS * 0.8 && (
                <span>
                  {input.length}/{MAX_INPUT_CHARS}
                </span>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white" aria-hidden>
      N
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-semibold">How can we help?</h1>
      <p className="mt-2 text-sm text-slate-500">Ask about your account, billing, or using Nimbus.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
        <TriageBadge triage={message.triage} />
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700" aria-hidden>
        AI
      </div>
      <div className="min-w-0 max-w-[85%]">
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
        {message.sources && message.sources.length > 0 && (
          <p className="mt-1.5 text-xs text-slate-500">
            Based on: {message.sources.map((s) => s.question).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

const URGENCY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-800",
  Low: "bg-emerald-100 text-emerald-700",
};

function TriageBadge({ triage }: { triage?: Triage | null }) {
  if (triage === null) return null;
  if (triage === undefined) return <span className="text-xs text-slate-400">Classifying…</span>;
  return (
    <div className="flex gap-1.5 text-xs" title="AI classification of this request">
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">{triage.category}</span>
      <span className={`rounded-full px-2 py-0.5 ${URGENCY_STYLES[triage.urgency] ?? ""}`}>{triage.urgency} urgency</span>
    </div>
  );
}

function TypingIndicator({ slow }: { slow: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">AI</div>
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
      </div>
      {slow && <span className="text-xs text-slate-500">This is taking longer than usual…</span>}
    </div>
  );
}
