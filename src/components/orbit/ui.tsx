// Small UI kit for the Orbit app screens.
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-semibold text-white">{children}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40",
  secondary: "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
  danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  ghost: "text-slate-400 hover:bg-white/[0.06] hover:text-white",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: Variant }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 ${props.className ?? ""}`}
    />
  );
}

const BADGE_TONES = {
  neutral: "border-white/10 bg-white/5 text-slate-300",
  indigo: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200",
  green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/20 bg-amber-500/10 text-amber-300",
  red: "border-red-400/20 bg-red-500/10 text-red-300",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>;
}

/** An error or success message from the last action. */
export function Notice({ message, tone = "error" }: { message: string | null; tone?: "error" | "success" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-3 animate-fade-up rounded-xl border px-3 py-2 text-sm ${
        tone === "error" ? "border-red-500/20 bg-red-500/[0.08] text-red-300" : "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
      }`}
    >
      {message}
    </p>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/60 to-fuchsia-500/60 font-semibold text-white ring-2 ring-[#0b0d1a] ${
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs"
      }`}
    >
      {initials}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-amber-400" : "bg-gradient-to-r from-indigo-400 to-violet-400"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
