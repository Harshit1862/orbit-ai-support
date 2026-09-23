"use client";

// The assistant, in three states:
//   closed  → only the launcher (a bot face in the corner) is visible
//   full    → a full-screen help centre, with the conversation history on the left
//   window  → a side window in the corner, next to the page
// Clicking the launcher opens it full screen; Minimise turns that into the side
// window, Expand goes back to full screen, and Close hides it. Conversations are
// kept either way (for the browser session). Used on the public pages and in
// the Orbit app; each passes in its own greeting, suggestions and handoff form.
//
// "Talk to a human" is offered only after the assistant has had a fair chance
// to help (see lib/handoff.ts): 7 replies for urgent conversations, 8 for
// medium and 10 for routine ones.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon, Logo, MessageBubble, TypingIndicator } from "@/components/support/parts";
import { MAX_INPUT_CHARS, useSupportChat } from "@/components/support/useSupportChat";
import { repliesUntilHandoff } from "@/lib/handoff";

const OPENED_KEY = "orbit-help:opened";
const TEASER_DELAY_MS = 2500;

type Mode = "closed" | "full" | "window";

const ICONS = {
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  minimise: "M5 12h14",
  expand: "M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7",
  history: "M4 6h16M4 12h16M4 18h10",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  send: "M5 12h14M13 6l6 6-6 6",
};

interface Props {
  /** sessionStorage key for this widget's conversations. */
  storageKey: string;
  /** The current app page, sent with each question (signed-in app only). */
  getPage?: () => string;
  greeting: ReactNode;
  suggestions: string[];
  /** The human-handoff form; `questions` are what the user asked, `close` returns to the chat. */
  renderHandoff: (questions: string[], close: () => void) => ReactNode;
}

export default function SupportWidget({ storageKey, getPage, greeting, suggestions, renderHandoff }: Props) {
  const chat = useSupportChat({ storageKey, getPage });
  const { conversations, active, pendingId, isPending, isSlow, cooldown, isCoolingDown, canRetry } = chat;

  const [mode, setMode] = useState<Mode>("closed");
  const [view, setView] = useState<"chat" | "handoff">("chat");
  const [input, setInput] = useState("");
  // On small screens the history list is a drawer, opened from the header.
  const [historyOpen, setHistoryOpen] = useState(false);
  // The launcher shakes and shows a teaser until the visitor has opened it once.
  const [hasOpened, setHasOpened] = useState(true);
  const [showTeaser, setShowTeaser] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let opened = true;
    try {
      opened = sessionStorage.getItem(OPENED_KEY) === "1";
    } catch {
      // Storage unavailable: skip the attention-grabbing animation.
    }
    if (opened) return;
    const timer = setTimeout(() => {
      setHasOpened(false);
      setShowTeaser(true);
    }, TEASER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mode !== "closed") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mode, active.id, active.messages.length, pendingId, active.error]);

  useEffect(() => {
    if (mode !== "closed" && view === "chat") inputRef.current?.focus();
  }, [mode, view, active.id]);

  // Escape steps down one level: full screen → side window → closed.
  useEffect(() => {
    if (mode === "closed") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMode((m) => (m === "full" ? "window" : "closed"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // The page behind a full-screen chat shouldn't scroll.
  useEffect(() => {
    if (mode !== "full") return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mode]);

  function openFull() {
    setMode("full");
    setShowTeaser(false);
    setHasOpened(true);
    try {
      sessionStorage.setItem(OPENED_KEY, "1");
    } catch {
      // Not remembered; the launcher may shake again on the next page load.
    }
  }

  function newConversation() {
    chat.startNewConversation();
    setInput("");
    setView("chat");
    setHistoryOpen(false);
  }

  function selectConversation(id: string) {
    chat.setActiveId(id);
    setView("chat");
    setHistoryOpen(false);
  }

  function send(text: string) {
    if (chat.send(text)) setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  // Following a link in an answer ("Open Billing →") shows the page: the full
  // screen becomes the side window, and on a phone (where the side window
  // covers the page too) the chat closes.
  function onNavigate() {
    const phone = window.matchMedia("(max-width: 640px)").matches;
    setMode(phone ? "closed" : "window");
  }

  const waitingHere = pendingId === active.id;
  const canHandoff = repliesUntilHandoff(active.messages) === 0;

  const messages =
    view === "handoff" ? (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {renderHandoff(
          active.messages.filter((m) => m.role === "user").map((m) => m.content),
          () => setView("chat"),
        )}
      </div>
    ) : (
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto space-y-5 px-4 ${mode === "full" ? "max-w-3xl py-6" : "py-5"}`}>
          {active.messages.length === 0 && (
            <div className="animate-fade-up">
              <p className="text-sm text-slate-300">{greeting}</p>
              <div className={`mt-4 grid gap-2 ${mode === "full" ? "sm:grid-cols-2" : ""}`}>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={isPending || isCoolingDown}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.08] hover:text-white disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {active.messages.map((m) => (
            <MessageBubble key={m.id} message={m} onNavigate={onNavigate} />
          ))}

          {waitingHere && <TypingIndicator slow={isSlow} />}

          {active.error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">
              <span className="flex-1">{active.error}</span>
              {canRetry && (
                <button onClick={chat.retry} className="rounded-lg bg-red-500/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500">
                  Retry
                </button>
              )}
            </div>
          )}

          {canHandoff && !waitingHere && (
            <div className="flex animate-fade-up items-center gap-2 border-t border-white/[0.06] pt-4 text-xs text-slate-400">
              <span>Still stuck?</span>
              <button onClick={() => setView("handoff")} className="font-medium text-indigo-300 hover:underline">
                Talk to a human
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    );

  const composer = view === "chat" && (
    <form onSubmit={handleSubmit} className={mode === "full" ? "mx-auto w-full max-w-3xl px-4 pb-4 pt-2" : "border-t border-white/[0.07] p-3"}>
      <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5 focus-within:border-indigo-400/50">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (chat.notice) chat.clearNotice();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_INPUT_CHARS}
          placeholder="Ask a question…"
          aria-label="Your question"
          className="field-sizing-content max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={isPending || isCoolingDown || !input.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white transition disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
        >
          {isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-300" /> : <Icon className="h-4 w-4" d={ICONS.send} />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-slate-500">
        {isCoolingDown ? <span className="text-amber-300">You can send again in {cooldown}s</span> : (chat.notice ?? "AI answers can be wrong.")}
      </p>
    </form>
  );

  const title = (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-white">Orbit Assist</p>
      <p className="truncate text-xs text-slate-400">{view === "chat" ? "AI answers from our help centre" : "Contact our support team"}</p>
    </div>
  );

  const history = (
    <>
      <div className="p-3">
        <button
          onClick={newConversation}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40"
        >
          <Icon className="h-4 w-4" d={ICONS.plus} />
          New conversation
        </button>
      </div>
      <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">This session</p>
      <nav aria-label="Conversation history" className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            aria-current={c.id === active.id ? "true" : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              c.id === active.id ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-60" d={ICONS.chat} />
            <span className="truncate">{c.title}</span>
            {pendingId === c.id && <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-indigo-400" />}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {mode === "full" && (
        <div role="dialog" aria-modal="true" aria-label="Orbit Assist" className="fixed inset-0 z-50 flex animate-fade-up bg-[#070812]/98 backdrop-blur-xl">
          {/* Conversation history: a sidebar on larger screens, a drawer on phones */}
          <aside className="hidden w-72 shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.02] md:flex">{history}</aside>
          {historyOpen && (
            <div className="fixed inset-0 z-10 md:hidden">
              <button aria-label="Hide history" className="absolute inset-0 bg-black/60" onClick={() => setHistoryOpen(false)} />
              <aside className="relative flex h-full w-72 flex-col border-r border-white/[0.06] bg-[#0b0d1a]">{history}</aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-white/[0.07] bg-gradient-to-r from-indigo-500/10 to-violet-500/10">
              <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
                <span className="md:hidden">
                  <HeaderButton label="Conversation history" icon={ICONS.history} onClick={() => setHistoryOpen(true)} />
                </span>
                <Logo />
                {title}
                <HeaderButton label="Minimise to a side window" icon={ICONS.minimise} onClick={() => setMode("window")} />
                <HeaderButton label="Close" icon={ICONS.close} onClick={() => setMode("closed")} />
              </div>
            </div>
            {messages}
            {composer}
          </div>
        </div>
      )}

      {mode === "window" && (
        <div
          role="dialog"
          aria-label="Orbit Assist"
          className="fixed inset-0 z-50 flex origin-bottom-right animate-msg-in flex-col overflow-hidden border-white/10 bg-[#0b0d1a]/95 shadow-2xl shadow-black/60 backdrop-blur-xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-3 py-3">
            <Logo />
            {title}
            <HeaderButton label="New conversation" icon={ICONS.plus} onClick={newConversation} />
            <HeaderButton label="Expand to full screen" icon={ICONS.expand} onClick={() => setMode("full")} />
            <HeaderButton label="Close" icon={ICONS.close} onClick={() => setMode("closed")} />
          </div>
          {messages}
          {composer}
        </div>
      )}

      {/* Teaser bubble, shown once per session until the launcher is opened */}
      {showTeaser && mode === "closed" && (
        <div className="fixed bottom-[6.5rem] right-6 z-50 flex max-w-[15rem] origin-bottom-right animate-pop items-start gap-2 rounded-2xl rounded-br-md border border-white/10 bg-[#0f1122]/95 py-2.5 pl-3.5 pr-2 text-sm text-slate-200 shadow-xl shadow-black/40 backdrop-blur-xl">
          <button onClick={openFull} className="text-left">
            👋 Need help? Ask me anything
          </button>
          <button onClick={() => setShowTeaser(false)} aria-label="Dismiss" className="rounded p-0.5 text-slate-500 hover:text-slate-200">
            <Icon className="h-3.5 w-3.5" d={ICONS.close} />
          </button>
        </div>
      )}

      {/* Launcher: a friendly bot face that wiggles until it has been opened */}
      {mode === "closed" && (
        <button
          onClick={openFull}
          aria-label="Open Orbit Assist"
          className={`fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/40 ring-4 ring-violet-500/20 transition hover:scale-110 hover:shadow-violet-500/60 active:scale-95 ${
            hasOpened ? "" : "animate-wiggle"
          }`}
        >
          <BotFace />
          {/* A conversation still waiting for its reply */}
          {isPending && <span className="absolute right-0.5 top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-[#0b0d1a] bg-emerald-400" />}
        </button>
      )}
    </>
  );
}

function HeaderButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
      <Icon className="h-4 w-4" d={icon} />
    </button>
  );
}

function BotFace() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
      <rect x="5" y="8" width="22" height="17" rx="8" fill="white" fillOpacity="0.95" />
      <circle cx="12" cy="16" r="2.2" fill="#4c1d95" />
      <circle cx="20" cy="16" r="2.2" fill="#4c1d95" />
      <path d="M12.5 20.5c1.9 1.6 5.1 1.6 7 0" stroke="#4c1d95" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M16 8V5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="4" r="1.6" fill="white" />
    </svg>
  );
}
