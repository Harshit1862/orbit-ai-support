"use client";

// The assistant inside the Orbit app. On top of the shared widget it:
//  1. sends the current page; the server looks up who is asking (plan, usage)
//     in the database, so answers are about *this* customer;
//  2. suggests questions that fit the current screen;
//  3. turns the conversation into a support ticket when the user asks for a
//     human, tagged by the AI triage so urgent tickets are handled first.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Icon } from "@/components/support/parts";
import SupportWidget from "@/components/support/SupportWidget";
import { MAX_INPUT_CHARS, classifyMessage } from "@/components/support/useSupportChat";

/** Suggested questions that fit the screen the user is looking at. */
function suggestionsFor(pathname: string, plan: string): string[] {
  if (pathname.startsWith("/app/settings/billing")) {
    return plan === "Free" ? ["What does Pro cost?", "Can I get a refund if I upgrade?"] : ["Can I get a refund?", "What happens if I cancel?"];
  }
  if (pathname.startsWith("/app/settings/members")) return ["Why can't I invite more people?", "How long do invitations last?"];
  if (pathname.startsWith("/app/settings/security")) return ["How do I set up 2FA?", "I lost my phone with 2FA"];
  if (pathname.startsWith("/app/settings/workspace")) return ["How can I export my data?", "What happens to my data if I cancel?"];
  if (pathname.startsWith("/app/settings/integrations")) return ["Which integrations do you support?", "Do you work with Jira?"];
  if (pathname.startsWith("/app/projects")) return ["Why can't I create more projects?", "How do I invite my team?"];
  return ["How many more projects can I create?", "How do I upgrade my plan?"];
}

export default function HelpWidget() {
  const pathname = usePathname();
  const orbit = useOrbit();
  return (
    <SupportWidget
      storageKey="orbit-app:help-chat"
      getPage={() => pathname}
      greeting={
        <>
          Hi {orbit.data.user.name.split(" ")[0]} 👋 Ask me anything about Orbit. I can see you&apos;re on the{" "}
          <span className="font-medium text-white">{orbit.data.subscription.plan}</span> plan, so answers are about your workspace.
        </>
      }
      suggestions={suggestionsFor(pathname, orbit.data.subscription.plan)}
      renderHandoff={(questions, close) => <TicketForm questions={questions} onDone={close} />}
    />
  );
}

/**
 * Human handoff: the conversation becomes a support ticket. The AI triage tags
 * it with a category and urgency, which is how a support team decides which
 * ticket to pick up first.
 */
function TicketForm({ questions, onDone }: { questions: string[]; onDone: () => void }) {
  const { addTicket, data } = useOrbit();
  // The latest question is what the user is stuck on now; earlier ones go in the details.
  const [subject, setSubject] = useState(questions.at(-1)?.slice(0, 80) ?? "");
  const [message, setMessage] = useState(questions.length > 1 ? `What I asked the assistant:\n- ${questions.join("\n- ")}` : "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Please add a short subject.");
      return;
    }
    setStatus("sending");
    const triage = await classifyMessage(`${subject}\n${message}`);
    const err = await addTicket({ subject: subject.trim(), message: message.trim(), category: triage?.category, urgency: triage?.urgency });
    if (err) {
      setError(err);
      setStatus("idle");
      return;
    }
    setTags(triage ? `${triage.category} · ${triage.urgency} urgency` : null);
    setStatus("sent");
  }

  const responseTime = data.subscription.plan === "Business" ? "within 4 hours (priority support)" : "Monday to Friday, 9:00–18:00 IST";

  if (status === "sent") {
    return (
      <div className="flex flex-1 animate-fade-up flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Icon className="h-6 w-6" d="M5 13l4 4L19 7" />
        </div>
        <p className="font-medium text-white">Ticket created</p>
        {tags && <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Tagged {tags}</p>}
        <p className="text-sm text-slate-400">Our team will reply to {data.user.email}, {responseTime}.</p>
        <div className="mt-2 flex gap-2">
          <Link href="/app/support" className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/[0.06]">
            View tickets
          </Link>
          <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-indigo-300 hover:bg-white/[0.06]">
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
      <p className="text-sm text-slate-400">A person from our team will get back to you by email. Your conversation is included so you don&apos;t have to repeat yourself.</p>
      <label className="text-xs font-medium text-slate-300">
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/60"
        />
      </label>
      <label className="flex flex-1 flex-col text-xs font-medium text-slate-300">
        Details
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          placeholder="What happened, and what did you expect?"
          className="mt-1 min-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
        />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "sending" ? "Creating ticket…" : "Send to support"}
        </button>
        <button type="button" onClick={onDone} className="rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.06]">
          Cancel
        </button>
      </div>
    </form>
  );
}
