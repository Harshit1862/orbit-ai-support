// UI pieces shared by the full-page help centre and the in-app help widget.
import Link from "next/link";
import type { Message, Triage } from "@/lib/types";

export function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** A planet with a moon on an orbit ring. */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${lg ? "h-24 w-24" : "h-9 w-9"}`} aria-hidden>
      {lg && <div className="absolute inset-0 animate-glow rounded-full bg-indigo-500/30 blur-2xl" />}
      <div className={`rounded-full bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40 ${lg ? "h-10 w-10" : "h-4 w-4"}`} />
      <div className="absolute inset-0 animate-orbit rounded-full border border-indigo-300/30">
        <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-indigo-200 shadow-[0_0_8px_2px_rgba(165,180,252,0.7)] ${lg ? "-top-1 h-2 w-2" : "-top-[3px] h-1.5 w-1.5"}`} />
      </div>
      {lg && (
        <div className="absolute -inset-5 animate-orbit-reverse rounded-full border border-dashed border-violet-300/15">
          <div className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-fuchsia-300 shadow-[0_0_8px_2px_rgba(240,171,252,0.6)]" />
        </div>
      )}
    </div>
  );
}

function AiAvatar() {
  return (
    <div
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-indigo-500/30 to-violet-500/30 shadow-lg shadow-indigo-500/10"
      aria-hidden
    >
      <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-300 to-fuchsia-300" />
    </div>
  );
}

export function MessageBubble({ message, onNavigate }: { message: Message; onNavigate?: () => void }) {
  // One button per destination, even if several FAQs point to the same screen.
  const links = [...new Map((message.sources ?? []).flatMap((s) => (s.link ? [[s.link.href, s.link] as const] : []))).values()];
  if (message.role === "user") {
    return (
      <div className="flex origin-bottom-right animate-msg-in flex-col items-end gap-1.5">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/20">
          {message.content}
        </div>
        <TriageBadge triage={message.triage} />
      </div>
    );
  }
  return (
    <div className="flex origin-bottom-left animate-msg-in gap-3">
      <AiAvatar />
      <div className="min-w-0 max-w-[85%]">
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-200 backdrop-blur">
          {message.content}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Icon className="h-3.5 w-3.5" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5a2.5 2.5 0 0 1 0-5" />
            Based on:
            {message.sources.map((s, i) => (
              <span
                key={s.id}
                style={{ animationDelay: `${200 + i * 80}ms` }}
                className="animate-pop rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-slate-300"
              >
                {s.question}
              </span>
            ))}
          </div>
        )}
        {/* Deep links to the screen where the answer is actually carried out */}
        {links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className="inline-flex animate-pop items-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const URGENCY_STYLES: Record<string, string> = {
  High: "border-red-400/20 bg-red-500/10 text-red-300",
  Medium: "border-amber-400/20 bg-amber-500/10 text-amber-300",
  Low: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
};

const URGENCY_DOTS: Record<string, string> = {
  High: "bg-red-400 animate-pulse",
  Medium: "bg-amber-400",
  Low: "bg-emerald-400",
};

function TriageBadge({ triage }: { triage?: Triage | null }) {
  if (triage === null) return null;
  if (triage === undefined) {
    return (
      <span className="animate-shimmer bg-gradient-to-r from-slate-600 via-slate-300 to-slate-600 bg-[length:200%_100%] bg-clip-text text-xs text-transparent">
        Classifying…
      </span>
    );
  }
  return (
    <div className="flex gap-1.5 text-xs" title="AI classification of this request">
      <span className="animate-pop rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-slate-300">{triage.category}</span>
      <span
        className={`flex animate-pop items-center gap-1.5 rounded-full border px-2.5 py-0.5 [animation-delay:80ms] ${URGENCY_STYLES[triage.urgency] ?? ""}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${URGENCY_DOTS[triage.urgency] ?? ""}`} />
        {triage.urgency} urgency
      </span>
    </div>
  );
}

export function TypingIndicator({ slow }: { slow: boolean }) {
  return (
    <div className="flex animate-msg-in items-center gap-3" aria-live="polite">
      <AiAvatar />
      <div className="flex gap-1.5 rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.04] px-4 py-3.5 backdrop-blur">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            className="h-2 w-2 animate-wave rounded-full bg-gradient-to-br from-indigo-300 to-violet-400"
          />
        ))}
      </div>
      {slow && (
        <span className="animate-shimmer bg-gradient-to-r from-slate-500 via-slate-200 to-slate-500 bg-[length:200%_100%] bg-clip-text text-xs text-transparent">
          This is taking longer than usual…
        </span>
      )}
    </div>
  );
}
