"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import HelpWidget from "@/components/orbit/HelpWidget";
import { OrbitProvider, useOrbit } from "@/components/orbit/OrbitProvider";
import { Avatar, Badge } from "@/components/orbit/ui";
import { Icon, Logo } from "@/components/support/parts";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/app/projects", label: "Projects", icon: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { href: "/app/support", label: "Support tickets", icon: "M4 4h16v12H7l-3 3zM8 9h8M8 12h5" },
  { href: "/app/settings/workspace", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

export default function AppShell({ initial, children }: { initial: ComponentProps<typeof OrbitProvider>["initial"]; children: ReactNode }) {
  return (
    <OrbitProvider initial={initial}>
      <Shell>{children}</Shell>
    </OrbitProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useOrbit();
  const [menuOpen, setMenuOpen] = useState(false);
  const plan = data.subscription.plan;
  const openTickets = data.tickets.filter((t) => t.status === "open").length;

  function isActive(href: string) {
    if (href === "/app") return pathname === "/app";
    if (href.startsWith("/app/settings")) return pathname.startsWith("/app/settings");
    return pathname.startsWith(href);
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMenuOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            isActive(item.href) ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" d={item.icon} />
          {item.label}
          {item.href === "/app/support" && openTickets > 0 && <span className="ml-auto text-xs text-slate-500">{openTickets}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-[#070812] text-slate-100">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.015] px-3 py-5 md:flex">
        <Link href="/app" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-semibold tracking-tight">Orbit</span>
        </Link>
        <WorkspaceSwitcher />
        {nav}
        <div className="mt-auto space-y-3">
          {plan === "Free" && (
            <Link
              href="/app/settings/billing"
              className="block rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-3 text-xs text-slate-300 transition hover:border-indigo-400/40"
            >
              <p className="font-medium text-white">Upgrade to Pro</p>
              <p className="mt-0.5 text-slate-400">Unlimited projects and members.</p>
            </Link>
          )}
          <Link href="/help" className="block px-3 text-xs text-slate-500 hover:text-slate-300">
            Help centre ↗
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-[#070812]/80 px-4 py-3 backdrop-blur-xl md:px-8">
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] md:hidden">
            <Icon className="h-5 w-5" d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <span className="text-sm text-slate-400 md:hidden">{data.workspace.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/app/settings/billing">
              <Badge tone={plan === "Free" ? "neutral" : "indigo"}>{plan} plan</Badge>
            </Link>
            <Avatar name={data.user.name} size="md" />
          </div>
        </header>
        {menuOpen && <div className="border-b border-white/[0.06] px-3 py-3 md:hidden">{nav}</div>}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28 md:px-8">{children}</main>
      </div>

      <HelpWidget />
    </div>
  );
}

function WorkspaceSwitcher() {
  const { data } = useOrbit();
  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 text-xs font-bold text-white">
        {data.workspace.name[0]}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{data.workspace.name}</p>
        <p className="text-[11px] text-slate-500">{data.members.filter((m) => m.status === "active").length} members</p>
      </div>
    </div>
  );
}
