"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon, Logo, MessageBubble, TypingIndicator } from "@/components/support/parts";
import { MAX_INPUT_CHARS, useSupportChat } from "@/components/support/useSupportChat";

const SIDEBAR_KEY = "orbit-support:sidebar-collapsed";

const EXAMPLE_QUESTIONS = [
  "I forgot my password. How can I reset it?",
  "Can I get a refund?",
  "How do I invite my team?",
  "Do you have a mobile app?",
];

/** The full-page help centre at /help. */
export default function HelpCenter() {
  const chat = useSupportChat({ storageKey: "orbit-support:v1" });
  const { conversations, active, pendingId, isPending, isSlow, cooldown, isCoolingDown, canRetry } = chat;
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length, pendingId, active.error]);

  // The sidebar's collapsed state is a per-browser preference, so it lives in
  // localStorage (unlike the conversations, which end with the session).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage after mount
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // Storage unavailable: default to expanded.
    }
  }, []);

  // Ctrl/Cmd+B toggles the sidebar, as in most editors.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggleSidebar() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, prev ? "0" : "1");
      } catch {
        // Not remembered across visits; still works for this page.
      }
      return !prev;
    });
  }

  function send(text: string) {
    if (chat.send(text)) setInput("");
    else if (!text.trim()) inputRef.current?.focus();
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
    chat.startNewConversation();
    setInput("");
    inputRef.current?.focus();
  }

  const inputError = chat.notice;
  const waitingHere = pendingId === active.id;

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[#05060f] text-slate-100">
      <Backdrop />

      {/* Sidebar: conversation history for this session. Collapses to a slim rail. */}
      <aside
        className={`relative z-10 hidden shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:flex ${
          collapsed ? "w-[4.5rem]" : "w-72"
        }`}
      >
        <div className={`flex items-center py-6 transition-all duration-300 ${collapsed ? "flex-col gap-4 px-0" : "gap-3 px-5"}`}>
          <Logo />
          <div className={`min-w-0 flex-1 whitespace-nowrap transition-opacity duration-200 ${collapsed ? "hidden" : "opacity-100"}`}>
            <p className="font-semibold leading-tight tracking-tight">Orbit Support</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              AI assistant · online
            </p>
          </div>
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand chat list" : "Collapse chat list"}
            aria-expanded={!collapsed}
            title={`${collapsed ? "Expand" : "Collapse"} chat list (Ctrl+B)`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M9 4v16" />
              <path d={collapsed ? "M13 10l2 2-2 2" : "M15 10l-2 2 2 2"} className="transition-all duration-300" />
            </svg>
          </button>
        </div>
        <div className={collapsed ? "flex justify-center" : "px-4"}>
          <button
            onClick={startNewConversation}
            title="New conversation"
            aria-label="New conversation"
            className={`group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:shadow-indigo-500/40 active:scale-[0.96] ${
              collapsed ? "h-10 w-10 rounded-xl" : "w-full rounded-xl px-3 py-2.5"
            }`}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center justify-center gap-2 whitespace-nowrap">
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:rotate-90" d="M12 5v14M5 12h14" />
              {!collapsed && "New conversation"}
            </span>
          </button>
        </div>
        <p
          className={`mt-7 whitespace-nowrap px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 transition-opacity duration-200 ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          This session
        </p>
        <nav className={`mt-2 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pb-4 ${collapsed ? "px-3.5" : "px-3"}`}>
          {conversations.map((c) => {
            const isActive = c.id === active.id;
            return (
              <button
                key={c.id}
                onClick={() => chat.setActiveId(c.id)}
                title={collapsed ? c.title : undefined}
                aria-label={collapsed ? c.title : undefined}
                className={`group relative flex w-full animate-fade-up items-center gap-2 rounded-lg py-2 text-left text-sm transition-all duration-200 ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${isActive ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"} ${
                  !isActive && !collapsed ? "hover:translate-x-0.5" : ""
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-violet-400 transition-all duration-300 ${
                    isActive ? "opacity-100" : "scale-y-0 opacity-0"
                  }`}
                />
                <Icon className="h-4 w-4 shrink-0 opacity-60" d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                {!collapsed && <span className="truncate">{c.title}</span>}
                {pendingId === c.id && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-indigo-400 ${collapsed ? "absolute right-1.5 top-1.5" : "ml-auto"}`}
                  />
                )}
              </button>
            );
          })}
        </nav>
        <p
          className={`whitespace-nowrap border-t border-white/[0.06] px-5 py-4 text-[11px] leading-relaxed text-slate-500 transition-opacity duration-200 ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          Answers are AI-generated from the
          <br />
          Orbit help centre.
        </p>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold tracking-tight">Orbit Support</span>
          </div>
          <button
            onClick={startNewConversation}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white active:scale-95"
          >
            New chat
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {active.messages.length === 0 && <EmptyState key={active.id} onPick={send} disabled={isPending || isCoolingDown} />}

            {active.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {waitingHere && <TypingIndicator slow={isSlow} />}

            {active.error && (
              <div
                role="alert"
                className="flex animate-shake flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300 backdrop-blur"
              >
                <Icon className="h-4 w-4 shrink-0" d="M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <span className="flex-1">{active.error}</span>
                {canRetry && (
                  <button
                    onClick={chat.retry}
                    className="rounded-lg bg-red-500/90 px-3 py-1.5 font-medium text-white transition hover:bg-red-500 active:scale-95"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Reply was cancelled (e.g. user switched away mid-request) and no error recorded */}
            {!active.error && canRetry && !waitingHere && (
              <div className="flex animate-fade-up items-center gap-3 text-sm text-slate-400">
                <span>No reply was received for this message.</span>
                <button onClick={chat.retry} className="font-medium text-indigo-300 hover:underline">
                  Ask again
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
          <div className="mx-auto max-w-3xl">
            {/* Gradient ring lights up while the composer has focus */}
            <div className="group rounded-2xl bg-gradient-to-r from-white/10 via-white/5 to-white/10 p-px shadow-2xl shadow-black/40 transition-all duration-300 focus-within:from-indigo-500/70 focus-within:via-violet-500/70 focus-within:to-fuchsia-500/60 focus-within:shadow-indigo-500/10">
              <div className="flex items-end gap-2 rounded-2xl bg-[#0b0d1a]/95 p-2 backdrop-blur-xl">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) chat.clearNotice();
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={MAX_INPUT_CHARS}
                  placeholder="Ask anything about Orbit…"
                  aria-label="Your message"
                  className="field-sizing-content max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={isPending || isCoolingDown || !input.trim()}
                  aria-label={isPending ? "Waiting for reply" : isCoolingDown ? `Wait ${cooldown}s` : "Send"}
                  className="group/send flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:scale-105 hover:shadow-indigo-500/50 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-300" />
                  ) : (
                    <Icon
                      className="h-5 w-5 transition-transform duration-200 group-hover/send:-translate-y-0.5 group-hover/send:translate-x-0.5"
                      d="M5 12h14M13 6l6 6-6 6"
                    />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-2 flex justify-between px-1 text-[11px] text-slate-500">
              <span className={inputError ? "animate-shake text-red-400" : ""}>
                {isCoolingDown ? (
                  <span className="text-amber-300">You can send again in {cooldown}s</span>
                ) : inputError ?? (
                  <>
                    <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
                  </>
                )}
              </span>
              {input.length > MAX_INPUT_CHARS * 0.8 && (
                <span className={input.length >= MAX_INPUT_CHARS ? "text-red-400" : ""}>
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

/** Slowly drifting aurora glows over a faint star field. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="stars absolute inset-0 opacity-60" />
      <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] animate-drift rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="absolute -bottom-48 right-[-10rem] h-[38rem] w-[38rem] animate-drift-slow rounded-full bg-violet-600/20 blur-[130px]" />
      <div className="absolute left-1/2 top-1/3 h-72 w-72 animate-drift rounded-full bg-fuchsia-500/10 blur-[110px] [animation-delay:-8s]" />
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-white/10 bg-white/5 px-1 py-px font-sans text-[10px] text-slate-400">{children}</kbd>;
}

const SUGGESTION_ICONS = [
  "M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.7 5.7L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.6a1 1 0 0 1 .3-.7l6-6A6 6 0 1 1 21 9z",
  "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z",
  "M17 20h5v-2a3 3 0 0 0-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.8M7 20H2v-2a3 3 0 0 1 5.4-1.8M7 20v-2c0-.7.1-1.3.4-1.8m0 0a5 5 0 0 1 9.2 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  "M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z",
];

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="animate-fade-up">
        <Logo size="lg" />
      </div>
      <h1 className="mt-8 animate-fade-up bg-gradient-to-br from-white via-indigo-100 to-violet-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent [animation-delay:100ms] sm:text-4xl">
        How can we help?
      </h1>
      <p className="mt-3 animate-fade-up text-sm text-slate-400 [animation-delay:200ms]">Ask about your account, billing, or using Orbit.</p>
      <div className="mt-10 grid w-full max-w-xl gap-3 sm:grid-cols-2">
        {EXAMPLE_QUESTIONS.map((q, i) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            style={{ animationDelay: `${300 + i * 80}ms` }}
            className="group flex animate-fade-up items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 text-left text-sm text-slate-300 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-indigo-500/[0.08] hover:text-white hover:shadow-lg hover:shadow-indigo-500/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300 transition-colors group-hover:bg-indigo-500/20">
              <Icon className="h-4 w-4" d={SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]} />
            </span>
            <span className="flex-1">{q}</span>
            <Icon
              className="h-4 w-4 -translate-x-1 text-indigo-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
              d="M5 12h14M13 6l6 6-6 6"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

