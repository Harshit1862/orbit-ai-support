"use client";

import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Badge, Button, Card, PageHeader } from "@/components/orbit/ui";
import { formatDate } from "@/lib/orbit/model";

const URGENCY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const URGENCY_TONE = { High: "red", Medium: "amber", Low: "green" } as const;

export default function SupportPage() {
  const { data, setTicketStatus } = useOrbit();
  // Open tickets first, then the most urgent: the order a support team works in.
  const tickets = [...data.tickets].sort(
    (a, b) =>
      Number(a.status === "resolved") - Number(b.status === "resolved") ||
      (URGENCY_ORDER[a.urgency ?? ""] ?? 3) - (URGENCY_ORDER[b.urgency ?? ""] ?? 3) ||
      b.createdAt - a.createdAt,
  );
  const business = data.subscription.plan === "Business";

  return (
    <>
      <PageHeader
        title="Support tickets"
        description={
          business
            ? "Priority support: our team replies within 4 hours."
            : "Our team replies by email, Monday to Friday, 9:00–18:00 IST. Business plan customers get priority support with a 4-hour response time."
        }
      />

      <Card className="mb-6 border-indigo-400/20 bg-indigo-500/[0.04]">
        <p className="text-sm text-slate-300">
          <span className="font-medium text-white">How tickets are created:</span> open the assistant (the bot in the bottom corner), ask your question, and
          choose <span className="font-medium text-white">Talk to a human</span> if it can&apos;t solve your problem. That option appears once the assistant has had a
          fair try: after 7 replies for urgent issues, 8 for medium and 10 for routine questions. The AI tags every ticket with a category and urgency, so the
          team handles &quot;I was charged twice&quot; before &quot;how do I change my avatar&quot;. That&apos;s why this list is sorted by urgency, not by date.
        </p>
      </Card>

      {tickets.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-slate-300">No tickets yet.</p>
          <p className="mt-1 text-sm text-slate-500">Most questions are answered instantly by the assistant, so you may never need one.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className={t.status === "resolved" ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-white">{t.subject}</h2>
                    <span className="text-xs text-slate-500">
                      #{t.id} · {formatDate(t.createdAt)}
                    </span>
                  </div>
                  {t.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{t.message}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.category && <Badge>{t.category}</Badge>}
                  {t.urgency && <Badge tone={URGENCY_TONE[t.urgency as keyof typeof URGENCY_TONE] ?? "neutral"}>{t.urgency} urgency</Badge>}
                  <Badge tone={t.status === "open" ? "indigo" : "green"}>{t.status}</Badge>
                </div>
              </div>
              <div className="mt-3">
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setTicketStatus(t.id, t.status === "open" ? "resolved" : "open")}>
                  {t.status === "open" ? "Mark resolved" : "Reopen"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
