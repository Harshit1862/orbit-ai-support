"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type DragEvent, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Avatar, Button, PageHeader } from "@/components/orbit/ui";
import { isoDate, type Task, type TaskStatus } from "@/lib/orbit/model";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "todo", label: "To do", dot: "bg-slate-400" },
  { status: "doing", label: "In progress", dot: "bg-indigo-400" },
  { status: "done", label: "Done", dot: "bg-emerald-400" },
];

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, updateTask, deleteProject } = useOrbit();
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const project = data.projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-300">This project doesn&apos;t exist (or was deleted).</p>
        <Link href="/app/projects" className="mt-3 inline-block text-sm text-indigo-300 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const tasks = data.tasks.filter((t) => t.projectId === project.id);

  function onDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) updateTask(taskId, { status });
  }

  return (
    <>
      <Link href="/app/projects" className="mb-3 inline-block text-sm text-slate-400 hover:text-white">
        ← Projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.description}
        action={
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete "${project.name}" and its ${tasks.length} tasks?`)) {
                deleteProject(project.id);
                router.push("/app/projects");
              }
            }}
          >
            Delete project
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <section
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, col.status)}
              className={`flex min-h-64 flex-col rounded-2xl border p-3 transition ${
                dragOver === col.status ? "border-indigo-400/50 bg-indigo-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-medium text-slate-300">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {col.label}
                <span className="text-slate-500">{colTasks.length}</span>
              </h2>
              <div className="flex flex-1 flex-col gap-2">
                {colTasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
              <AddTask projectId={project.id} status={col.status} />
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">Tip: drag cards between columns.</p>
    </>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { data, now, updateTask, deleteTask } = useOrbit();
  const [editing, setEditing] = useState(false);
  const assignee = data.members.find((m) => m.id === task.assigneeId);
  const today = isoDate(now);
  const late = task.status !== "done" && task.dueDate && task.dueDate < today;
  const index = COLUMNS.findIndex((c) => c.status === task.status);

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className="group animate-fade-up cursor-grab rounded-xl border border-white/[0.07] bg-[#0d0f1e] p-3 shadow-sm transition hover:border-white/15 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm ${task.status === "done" ? "text-slate-500 line-through" : "text-slate-100"}`}>{task.title}</p>
        <button
          onClick={() => setEditing((e) => !e)}
          aria-label="Edit task"
          className="rounded px-1 text-slate-500 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100"
        >
          ⋯
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {assignee ? <Avatar name={assignee.name} /> : <span className="text-slate-600">Unassigned</span>}
        {task.dueDate && <span className={late ? "text-red-300" : "text-slate-500"}>{task.dueDate === today ? "Due today" : `Due ${task.dueDate}`}</span>}
        {/* Keyboard- and touch-friendly alternative to dragging */}
        <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
          {index > 0 && (
            <button onClick={() => updateTask(task.id, { status: COLUMNS[index - 1].status })} aria-label="Move left" className="rounded px-1 text-slate-400 hover:bg-white/10">
              ←
            </button>
          )}
          {index < COLUMNS.length - 1 && (
            <button onClick={() => updateTask(task.id, { status: COLUMNS[index + 1].status })} aria-label="Move right" className="rounded px-1 text-slate-400 hover:bg-white/10">
              →
            </button>
          )}
        </span>
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 border-t border-white/[0.06] pt-3 text-xs">
          <label className="flex items-center justify-between gap-2 text-slate-400">
            Assignee
            <select
              value={task.assigneeId ?? ""}
              onChange={(e) => updateTask(task.id, { assigneeId: e.target.value || null })}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-slate-200"
            >
              <option value="">Unassigned</option>
              {data.members
                .filter((m) => m.status === "active")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-slate-400">
            Due date
            <input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-slate-200 [color-scheme:dark]"
            />
          </label>
          <button onClick={() => deleteTask(task.id)} className="justify-self-start text-red-300 hover:underline">
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}

function AddTask({ projectId, status }: { projectId: string; status: TaskStatus }) {
  const { addTask } = useOrbit();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(await addTask(projectId, title, status))) setTitle("");
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300">
        + Add task
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Task title, then Enter"
        maxLength={120}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/60"
      />
    </form>
  );
}
