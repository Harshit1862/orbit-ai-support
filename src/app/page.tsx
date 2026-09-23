import Link from "next/link";
import PublicHelpWidget from "@/components/support/PublicHelpWidget";
import { Logo } from "@/components/support/parts";
import { PLANS, pricePerSeat } from "@/lib/orbit/model";

const FEATURES = [
  { title: "Boards for every project", body: "Plan work in To do, In progress and Done columns. Drag tasks as they move." },
  { title: "Built for small teams", body: "Invite teammates, assign tasks and see who's working on what at a glance." },
  { title: "Connects to your tools", body: "Slack, Google Drive, GitHub and Zapier, set up in a click." },
  { title: "Help when you need it", body: "An AI assistant that knows your plan and answers instantly, and brings in a person when it can't solve the problem." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#05060f] text-slate-100">
      <div className="stars pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -left-32 -top-40 h-[34rem] w-[34rem] animate-drift rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-[30rem] h-[30rem] w-[30rem] animate-drift-slow rounded-full bg-violet-600/20 blur-[130px]" />

      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 md:px-8">
        <Logo />
        <span className="font-semibold tracking-tight">Orbit</span>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-4">
          <a href="#pricing" className="hidden px-2 text-slate-400 hover:text-white sm:inline">
            Pricing
          </a>
          <Link href="/login" className="px-2 text-slate-300 hover:text-white">
            Log in
          </Link>
          <Link href="/app" className="rounded-xl bg-white px-3.5 py-2 font-medium text-slate-900 transition hover:bg-slate-200">
            Open demo
          </Link>
        </nav>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-4xl px-4 pb-20 pt-16 text-center md:pt-24">
          <p className="mx-auto mb-5 inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Now with an AI help assistant built in
          </p>
          <h1 className="animate-fade-up bg-gradient-to-br from-white via-indigo-100 to-violet-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent [animation-delay:100ms] sm:text-6xl">
            Keep every project in orbit
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-fade-up text-lg text-slate-400 [animation-delay:200ms]">
            Orbit is the simple project-management app for small teams. Plan projects, track tasks and get help the moment you need it.
          </p>
          <div className="mt-9 flex animate-fade-up justify-center gap-3 [animation-delay:300ms]">
            <Link href="/app" className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50">
              Try the demo workspace →
            </Link>
            <Link href="/login" className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]">
              Log in
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur">
              <h2 className="font-medium text-white">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="mx-auto max-w-5xl scroll-mt-10 px-4 pb-24 md:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">Simple pricing</h2>
          <p className="mt-2 text-center text-slate-400">Full refund within 30 days, no questions asked.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-2xl border p-6 ${p.name === "Pro" ? "border-indigo-400/40 bg-indigo-500/[0.06]" : "border-white/[0.07] bg-white/[0.025]"}`}>
                <h3 className="font-semibold text-white">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{p.tagline}</p>
                <p className="mt-5 text-4xl font-semibold text-white">
                  ${pricePerSeat(p.name, "monthly")}
                  <span className="text-sm font-normal text-slate-400"> /user/month</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/[0.06] py-8 text-center text-sm text-slate-500">
        Orbit is a demo product · Questions? Ask the assistant in the corner, or email support@orbit.example
      </footer>

      <PublicHelpWidget />
    </div>
  );
}
