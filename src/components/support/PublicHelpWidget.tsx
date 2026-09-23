"use client";

// The assistant on the public homepage, for visitors who haven't logged in.
// There's no account, so it sends no customer context, suggests pre-sales
// questions, and hands off to a human by email instead of an in-app ticket.
import { Icon } from "@/components/support/parts";
import SupportWidget from "@/components/support/SupportWidget";

const SUPPORT_EMAIL = "support@orbit.example";

export default function PublicHelpWidget() {
  return (
    <SupportWidget
      storageKey="orbit-public:help-chat"
      greeting="Hi 👋 I'm Orbit Assist. Ask me about plans, pricing, features or anything else before you sign up."
      suggestions={["Is there a free plan?", "How much does Pro cost?", "Which integrations do you support?", "Can I get a refund?"]}
      renderHandoff={(questions, close) => <EmailHandoff questions={questions} onDone={close} />}
    />
  );
}

function EmailHandoff({ questions, onDone }: { questions: string[]; onDone: () => void }) {
  const subject = questions.at(-1)?.slice(0, 80) ?? "Question about Orbit";
  const body = `Hi Orbit team,\n\nThe assistant couldn't answer this. What I asked:\n${questions.map((q) => `- ${q}`).join("\n")}\n`;
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="flex flex-1 animate-fade-up flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
        <Icon className="h-6 w-6" d="M4 6h16v12H4zM4 7l8 6 8-6" />
      </div>
      <p className="font-medium text-white">Email our team</p>
      <p className="text-sm text-slate-400">
        We reply Monday to Friday, 9:00–18:00 IST. Your questions are already filled in, so you don&apos;t have to repeat yourself.
      </p>
      <a href={href} className="mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white">
        Write to {SUPPORT_EMAIL}
      </a>
      <button onClick={onDone} className="text-sm text-slate-400 hover:text-white">
        Back to chat
      </button>
    </div>
  );
}
