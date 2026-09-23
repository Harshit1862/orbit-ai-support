"use client";

import Link from "next/link";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Avatar, Badge, ButtonLink, Card, CardTitle, PageHeader, ProgressBar } from "@/components/orbit/ui";
import { isoDate, projectLimit, seatLimit, seatsUsed } from "@/lib/orbit/model";

export default function DashboardPage() {
  const { data, now } = useOrbit();
  const today = isoDate(now);
  const myTasks = data.tasks
    .filter((t) => t.assigneeId === "u-me" && t.status !== "done")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const open = data.tasks.filter((t) => t.status !== "done").length;
  const overdue = data.tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
  const done = data.tasks.filter((t) => t.status === "done").length;
  const plan = data.subscription.plan;
  const pLimit = projectLimit(plan);
  const sLimit = seatLimit(plan);
  const seats = seatsUsed(data, now);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greeting}, ${data.user.name.split(" ")[0]}`} description={`Here's what's happening in ${data.workspace.name.replace(/\.$/, "")}.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open tasks" value={open} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? "text-amber-300" : undefined} />
        <Stat label="Completed" value={done} />
        <Stat label="Projects" value={data.projects.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle description="Tasks assigned to you, soonest first">My tasks</CardTitle>
          {myTasks.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing assigned to you. Nice.</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {myTasks.map((t) => {
                const project = data.projects.find((p) => p.id === t.projectId);
                const late = t.dueDate && t.dueDate < today;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project?.color }} />
                    <Link href={`/app/projects/${t.projectId}`} className="min-w-0 flex-1 truncate text-sm text-slate-200 hover:text-white">
                      {t.title}
                    </Link>
                    <span className="hidden text-xs text-slate-500 sm:inline">{project?.name}</span>
                    {t.dueDate && <Badge tone={late ? "red" : t.dueDate === today ? "amber" : "neutral"}>{t.dueDate === today ? "Today" : t.dueDate}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle description={`${plan} plan`}>Usage</CardTitle>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1.5 flex justify-between text-slate-300">
                <span>Projects</span>
                <span>
                  {data.projects.length} / {pLimit ?? "∞"}
                </span>
              </div>
              {pLimit !== null && <ProgressBar value={data.projects.length} max={pLimit} />}
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-slate-300">
                <span>Seats</span>
                <span>
                  {seats} / {sLimit ?? "∞"}
                </span>
              </div>
              {sLimit !== null && <ProgressBar value={seats} max={sLimit} />}
            </div>
            {plan === "Free" && (
              <ButtonLink href="/app/settings/billing" variant="secondary">
                See plans
              </ButtonLink>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Projects</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.projects.map((p) => {
            const tasks = data.tasks.filter((t) => t.projectId === p.id);
            const members = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))];
            return (
              <Link key={p.id} href={`/app/projects/${p.id}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <p className="truncate text-sm font-medium text-white">{p.name}</p>
                </div>
                <div className="mt-3">
                  <ProgressBar value={tasks.filter((t) => t.status === "done").length} max={tasks.length} />
                </div>
                <div className="mt-3 flex -space-x-1.5">
                  {members.map((m) => (
                    <Avatar key={m} name={data.members.find((x) => x.id === m)?.name ?? "?"} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${tone ?? "text-white"}`}>{value}</p>
    </Card>
  );
}
