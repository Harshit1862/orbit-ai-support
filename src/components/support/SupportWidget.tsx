"use client";

// The assistant: an animated launcher in the corner that opens the chat full
// screen. "Minimise" hides it and keeps the conversation; "Close" ends the
// conversation. Used on the public pages and inside the Orbit app; each passes
// in its own greeting, suggested questions and human-handoff form.
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
  const { active, pendingId, isPending, isSlow, cooldown, isCoolingDown, canRetry } = chat;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "handoff">("chat");
  const [input, setInput] = useState("");
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
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, active.messages.length, pendingId, active.error]);

  useEffect(() => {
    if (open && view === "chat") inputRef.current?.focus();
  }, [open, view]);

  // While the chat is open: Escape minimises it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function openChat() {
    setOpen(true);
    setShowTeaser(false);
    setHasOpened(true);
    try {
      sessionStorage.setItem(OPENED_KEY, "1");
    } catch {
      // Not remembered; the launcher may shake again on the next page load.
    }
  }

  /** Hides the chat; the conversation is kept for when it's opened again. */
  function minimise() {
    setOpen(false);
  }

  /** Hides the chat and ends the conversation; the next one starts fresh. */
  function close() {
    chat.startNewConversation();
    setInput("");
    setView("chat");
    setOpen(false);
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

  // Following a link in an answer ("Open Billing →") minimises the chat, so the page shows.
  function onNavigate() {
    minimise();
  }

  const waitingHere = pendingId === active.id;
  const canHandoff = repliesUntilHandoff(active.messages) === 0;

  return (
    <>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Orbit Assist" className="fixed inset-0 z-50 flex animate-fade-up flex-col bg-[#070812]/98 backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-white/[0.07] bg-gradient-to-r from-indigo-500/10 to-violet-500/10">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
              <Logo />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Orbit Assist</p>
                <p className="text-xs text-slate-400">{view === "chat" ? "AI answers from our help centre" : "Contact our support team"}</p>
              </div>
              {view === "chat" && (
                <HeaderButton
                  label="New conversation"
                  icon="M12 5v14M5 12h14"
                  onClick={() => {
                    chat.startNewConversation();
                    setInput("");
                  }}
                />
              )}
              <HeaderButton label="Minimise (keeps the conversation)" icon="M5 12h14" onClick={minimise} />
              <HeaderButton label="Close (ends the conversation)" icon="M6 6l12 12M18 6 6 18" onClick={close} />
            </div>
          </div>

          {view === "handoff" ? (
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
              {renderHandoff(
                active.messages.filter((m) => m.role === "user").map((m) => m.content),
                () => setView("chat"),
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
                  {active.messages.length === 0 && (
                    <div className="animate-fade-up">
                      <p className="text-sm text-slate-300">{greeting}</p>
                      <div className="mt-4 flex flex-col gap-2">
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

              <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
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
                    {isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-300" />
                    ) : (
                      <Icon className="h-4 w-4" d="M5 12h14M13 6l6 6-6 6" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-slate-500">
                  {isCoolingDown ? <span className="text-amber-300">You can send again in {cooldown}s</span> : (chat.notice ?? "AI answers can be wrong.")}
                </p>
              </form>
            </>
          )}
        </div>
      )}

      {/* Teaser bubble, shown once per session until the launcher is opened */}
      {showTeaser && !open && (
        <div className="fixed bottom-[6.5rem] right-6 z-50 flex max-w-[15rem] origin-bottom-right animate-pop items-start gap-2 rounded-2xl rounded-br-md border border-white/10 bg-[#0f1122]/95 py-2.5 pl-3.5 pr-2 text-sm text-slate-200 shadow-xl shadow-black/40 backdrop-blur-xl">
          <button onClick={openChat} className="text-left">
            👋 Need help? Ask me anything
          </button>
          <button onClick={() => setShowTeaser(false)} aria-label="Dismiss" className="rounded p-0.5 text-slate-500 hover:text-slate-200">
            <Icon className="h-3.5 w-3.5" d="M6 6l12 12M18 6 6 18" />
          </button>
        </div>
      )}

      {/* Launcher: a friendly bot face that wiggles until it has been opened */}
      {!open && (
        <button
          onClick={openChat}
          aria-label="Open Orbit Assist"
          className={`fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/40 ring-4 ring-violet-500/20 transition hover:scale-110 hover:shadow-violet-500/60 active:scale-95 ${
            hasOpened ? "" : "animate-wiggle"
          }`}
        >
          <BotFace />
          {/* A minimised conversation that's still waiting for a reply */}
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
