"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Avatar, Badge, Button, Card, CardTitle, Input, Notice } from "@/components/orbit/ui";
import { INVITE_EXPIRY_DAYS, inviteDaysLeft, isInviteExpired, seatLimit, seatsUsed } from "@/lib/orbit/model";

export default function MembersPage() {
  const { data, now, inviteMember, resendInvite, acceptInvite, removeMember } = useOrbit();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const limit = seatLimit(data.subscription.plan);
  const seats = seatsUsed(data, now);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await inviteMember(email);
    setMessage(err ? { text: err, tone: "error" } : { text: `Invitation sent to ${email.trim()}. It expires in ${INVITE_EXPIRY_DAYS} days.`, tone: "success" });
    if (!err) setEmail("");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle description={`Invitations expire after ${INVITE_EXPIRY_DAYS} days. Each member, including pending invitations, uses one seat.`}>
          Invite people
        </CardTitle>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit">Send invite</Button>
        </form>
        <Notice message={message?.text ?? null} tone={message?.tone} />
        {message?.tone === "error" && limit !== null && seats >= limit && (
          <Link href="/app/settings/billing" className="mt-2 inline-block text-sm text-indigo-300 hover:underline">
            Compare plans →
          </Link>
        )}
      </Card>

      <Card>
        <CardTitle description={limit !== null ? `${seats} of ${limit} seats used on the Free plan` : `${seats} seats in use`}>Members</CardTitle>
        <ul className="divide-y divide-white/[0.05]">
          {data.members.map((m) => {
            const expired = isInviteExpired(m, now);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={m.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {m.name} {m.id === "u-me" && <span className="text-slate-500">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-400">{m.email}</p>
                </div>
                <Badge tone={m.role === "Admin" ? "indigo" : "neutral"}>{m.role}</Badge>
                {m.status === "invited" &&
                  (expired ? (
                    <Badge tone="red">Invite expired</Badge>
                  ) : (
                    <Badge tone="amber">
                      Invited · expires in {inviteDaysLeft(m, now)} day{inviteDaysLeft(m, now) === 1 ? "" : "s"}
                    </Badge>
                  ))}
                {m.status === "invited" && (
                  <>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={async () => {
                        const err = await resendInvite(m.id);
                        setMessage(err ? { text: err, tone: "error" } : { text: `Invitation re-sent to ${m.email}. It expires in ${INVITE_EXPIRY_DAYS} days.`, tone: "success" });
                      }}
                    >
                      Resend
                    </Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs" title="Demo: pretend they clicked the link in the email" onClick={() => acceptInvite(m.id)}>
                      Simulate accept
                    </Button>
                  </>
                )}
                {m.id !== "u-me" && (
                  <Button variant="ghost" className="px-2 py-1 text-xs text-red-300" onClick={() => confirm(`Remove ${m.name} from the workspace?`) && removeMember(m.id)}>
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
