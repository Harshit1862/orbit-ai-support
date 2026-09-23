"use client";

import { useState, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Button, Card, CardTitle, Input, Notice } from "@/components/orbit/ui";
import { formatDate, isoDate, type OrbitData } from "@/lib/orbit/model";

/** Builds the export file in the browser and hands it to the user as a download. */
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | undefined): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(data: OrbitData): string {
  const rows = [["project", "task", "status", "assignee", "due_date"]];
  for (const t of data.tasks) {
    rows.push([
      data.projects.find((p) => p.id === t.projectId)?.name ?? "",
      t.title,
      t.status,
      data.members.find((m) => m.id === t.assigneeId)?.name ?? "",
      t.dueDate ?? "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export default function WorkspacePage() {
  const { data, now, renameWorkspace, skipDays, resetDemo } = useOrbit();
  const [name, setName] = useState(data.workspace.name);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await renameWorkspace(name);
    setMessage(err ? { text: err, tone: "error" } : { text: "Workspace name saved.", tone: "success" });
  }

  function exportData(format: "csv" | "json") {
    const stamp = isoDate(now);
    if (format === "csv") download(`orbit-export-${stamp}.csv`, toCsv(data), "text/csv");
    else {
      const { projects, tasks, members, workspace } = data;
      download(`orbit-export-${stamp}.json`, JSON.stringify({ workspace, projects, tasks, members }, null, 2), "application/json");
    }
    setMessage({ text: `Your ${format.toUpperCase()} export has downloaded.`, tone: "success" });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Workspace name</CardTitle>
        <form onSubmit={submit} className="flex max-w-md gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle description="Download all projects and tasks. Small exports download immediately; large exports are emailed to you within 24 hours.">
          Export data
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportData("csv")}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => exportData("json")}>
            Export JSON
          </Button>
        </div>
        <Notice message={message?.text ?? null} tone={message?.tone} />
      </Card>

      {/* Not part of a real product: lets you see time-based rules without waiting days */}
      <Card className="border-dashed border-amber-400/20">
        <CardTitle
          description={
            <>
              Demo only. Today in the app is <span className="text-slate-200">{formatDate(now)}</span>. Skip ahead to watch invitations expire, the refund window close and
              renewals or scheduled downgrades happen.
            </>
          }
        >
          Demo controls
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => skipDays(3)}>
            Skip 3 days
          </Button>
          <Button variant="secondary" onClick={() => skipDays(15)}>
            Skip 15 days
          </Button>
          <Button variant="secondary" onClick={() => skipDays(31)}>
            Skip 31 days
          </Button>
          <Button variant="danger" onClick={() => confirm("Reset all demo data?") && resetDemo()}>
            Reset demo data
          </Button>
        </div>
      </Card>
    </div>
  );
}
