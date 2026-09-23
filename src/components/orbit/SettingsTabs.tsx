"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings/workspace", label: "Workspace" },
  { href: "/app/settings/members", label: "Members" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/security", label: "Security" },
  { href: "/app/settings/integrations", label: "Integrations" },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 mt-5 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
              active ? "border-indigo-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
