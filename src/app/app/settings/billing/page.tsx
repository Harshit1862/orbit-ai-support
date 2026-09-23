"use client";

import { useState } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Badge, Button, Card, CardTitle, Notice } from "@/components/orbit/ui";
import {
  DATA_RETENTION_DAYS,
  PLAN_RANK,
  PLANS,
  formatDate,
  formatMoney,
  pricePerSeat,
  refundDaysLeft,
  seatsUsed,
  type BillingCycle,
  type Plan,
} from "@/lib/orbit/model";

export default function BillingPage() {
  const orbit = useOrbit();
  const { data, now } = orbit;
  const sub = data.subscription;
  const seats = seatsUsed(data, now);
  const [cycle, setCycle] = useState<BillingCycle>(sub.plan === "Free" ? "monthly" : sub.cycle);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const refundDays = refundDaysLeft(sub, now);

  // Billing buttons stay disabled while a request is in flight, so a double
  // click can't charge twice.
  const [busy, setBusy] = useState(false);

  async function run(pending: Promise<string | null>, success: string) {
    setBusy(true);
    const error = await pending;
    setBusy(false);
    setMessage(error ? { text: error, tone: "error" } : { text: success, tone: "success" });
  }

  function choose(plan: Plan) {
    const upgrade = PLAN_RANK[plan] > PLAN_RANK[sub.plan];
    const label = upgrade
      ? sub.plan === "Free"
        ? `Upgrade to ${plan} for ${formatMoney(pricePerSeat(plan, cycle) * seats * (cycle === "annual" ? 12 : 1))} (${seats} users, ${cycle})?`
        : `Upgrade to ${plan} now? You'll be charged the prorated difference for the rest of this billing period.`
      : `Downgrade to ${plan}? It takes effect at the end of your billing period (${formatDate(sub.renewsAt ?? now)}).`;
    if (!confirm(label)) return;
    run(
      orbit.changePlan(plan, cycle),
      upgrade ? `You're now on ${plan}. The upgrade applies immediately.` : `Scheduled: you'll move to ${plan} on ${formatDate(sub.renewsAt ?? now)}.`,
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Current plan</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {sub.plan}
              {sub.plan !== "Free" && <span className="ml-2 text-sm font-normal text-slate-400">billed {sub.cycle}</span>}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {sub.plan === "Free"
                ? "Free forever: up to 3 users and 5 projects."
                : sub.canceledAt
                  ? `Cancelled. You keep access until ${formatDate(sub.renewsAt ?? now)}; after that your data is kept for ${DATA_RETENTION_DAYS} days, then permanently deleted.`
                  : sub.pendingPlan
                    ? `Changes to ${sub.pendingPlan} on ${formatDate(sub.renewsAt ?? now)}.`
                    : `Renews ${formatDate(sub.renewsAt ?? now)} · ${seats} seats × ${formatMoney(pricePerSeat(sub.plan, sub.cycle))}/user/month`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sub.plan !== "Free" && sub.pendingPlan && (
              <Button variant="secondary" disabled={busy} onClick={() => run(orbit.changePlan(sub.plan, sub.cycle), "Scheduled change removed.")}>
                Keep {sub.plan}
              </Button>
            )}
            {sub.plan !== "Free" && !sub.canceledAt && (
              <Button
                disabled={busy}
                variant="danger"
                onClick={() =>
                  confirm(`Cancel your subscription? You keep access until ${formatDate(sub.renewsAt ?? now)}.`) &&
                  run(orbit.cancelSubscription(), `Subscription cancelled. You keep access until ${formatDate(sub.renewsAt ?? now)}.`)
                }
              >
                Cancel subscription
              </Button>
            )}
            {sub.canceledAt && (
              <Button disabled={busy} onClick={() => run(orbit.resumeSubscription(), "Welcome back! Your subscription will renew as normal.")}>
                Resume subscription
              </Button>
            )}
          </div>
        </div>
        <Notice message={message?.text ?? null} tone={message?.tone} />
      </Card>

      {/* Plans */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Plans</h2>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                disabled={sub.plan !== "Free"}
                title={sub.plan !== "Free" ? "Your billing cycle is set when you subscribe" : undefined}
                className={`rounded-lg px-3 py-1 capitalize transition disabled:cursor-not-allowed ${cycle === c ? "bg-white/10 text-white" : "text-slate-400"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const current = p.name === sub.plan;
            const price = pricePerSeat(p.name, cycle);
            return (
              <Card key={p.name} className={current ? "border-indigo-400/40 bg-indigo-500/[0.05]" : ""}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  {current && <Badge tone="indigo">Current</Badge>}
                  {sub.pendingPlan === p.name && <Badge tone="amber">Scheduled</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-400">{p.tagline}</p>
                <p className="mt-4 text-3xl font-semibold text-white">
                  ${price}
                  <span className="text-sm font-normal text-slate-400"> /user/month</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                {!current && (
                  <Button
                    className="mt-5 w-full"
                    variant={PLAN_RANK[p.name] > PLAN_RANK[sub.plan] ? "primary" : "secondary"}
                    onClick={() => choose(p.name)}
                    disabled={busy || sub.pendingPlan === p.name}
                  >
                    {PLAN_RANK[p.name] > PLAN_RANK[sub.plan] ? `Upgrade to ${p.name}` : `Downgrade to ${p.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Refund */}
      {sub.plan !== "Free" && (
        <Card>
          <CardTitle description="Full refund within 30 days of purchase, back to your original payment method in 5–7 business days.">Refunds</CardTitle>
          {refundDays > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-300">
                You can request a refund for {refundDays} more day{refundDays === 1 ? "" : "s"}.
              </p>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() =>
                  confirm("Request a full refund? Your workspace moves back to the Free plan now.") &&
                  run(orbit.requestRefund(), "Refund requested. It will reach your original payment method in 5–7 business days.")
                }
              >
                Request refund
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">The 30-day refund window for this purchase has closed.</p>
          )}
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardTitle>Invoices</CardTitle>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet. You&apos;re on the Free plan.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2.5 text-slate-400">{formatDate(inv.date)}</td>
                  <td className="py-2.5 text-slate-200">{inv.description}</td>
                  <td className="py-2.5 text-right text-slate-200">{formatMoney(inv.amount)}</td>
                  <td className="py-2.5 text-right">
                    <Badge tone={inv.status === "paid" ? "green" : "amber"}>{inv.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
