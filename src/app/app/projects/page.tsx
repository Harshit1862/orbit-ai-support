"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Button, ButtonLink, Card, Input, Notice, PageHeader, ProgressBar } from "@/components/orbit/ui";
import { projectLimit } from "@/lib/orbit/model";

export default function ProjectsPage() {
  const { data, createProject } = useOrbit();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const limit = projectLimit(data.subscription.plan);
  const atLimit = limit !== null && data.projects.length >= limit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await createProject(name, description);
    setSaving(false);
    setError(err);
    if (!err) {
      setName("");
      setDescription("");
      setShowForm(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description={limit !== null ? `${data.projects.length} of ${limit} projects on the Free plan` : `${data.projects.length} projects`}
        action={
          <Button
            onClick={async () => {
              // At the limit, clicking still explains why instead of silently doing nothing.
              if (atLimit) setError(await createProject("", ""));
              else setShowForm((s) => !s);
            }}
          >
            + New project
          </Button>
        }
      />

      {error && atLimit && (
        <Card className="mb-6 border-amber-400/20 bg-amber-500/[0.05]">
          <p className="text-sm text-amber-200">{error}</p>
          <div className="mt-3 flex gap-2">
            <ButtonLink href="/app/settings/billing">Upgrade to Pro</ButtonLink>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6 animate-fade-up">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <Input autoFocus placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <Input placeholder="What is it about? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </form>
          {!atLimit && <Notice message={error} />}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.projects.map((p) => {
          const tasks = data.tasks.filter((t) => t.projectId === p.id);
          const done = tasks.filter((t) => t.status === "done").length;
          return (
            <Link key={p.id} href={`/app/projects/${p.id}`} className="group">
              <Card className="h-full transition group-hover:border-white/15 group-hover:bg-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <h2 className="truncate font-medium text-white">{p.name}</h2>
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-400">{p.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {done}/{tasks.length} tasks done
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={done} max={tasks.length} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
