"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/support/parts";

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/60";

/** Demo sign-in: any credentials open the demo workspace. */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "forgot" | "sent">(params.get("forgot") ? "forgot" : "login");
  const [email, setEmail] = useState("harshit@acme.example");

  function login(e: FormEvent) {
    e.preventDefault();
    router.push("/app");
  }

  function reset(e: FormEvent) {
    e.preventDefault();
    setMode("sent");
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[#05060f] px-4 text-slate-100">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">Orbit</span>
        </Link>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
          {mode === "login" && (
            <form onSubmit={login} className="space-y-4">
              <h1 className="text-lg font-semibold text-white">Log in to your workspace</h1>
              <label className="block text-xs font-medium text-slate-300">
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                <span className="flex justify-between">
                  Password
                  <button type="button" onClick={() => setMode("forgot")} className="font-normal text-indigo-300 hover:underline">
                    Forgot password?
                  </button>
                </span>
                <input type="password" defaultValue="demo-password" className={inputClass} />
              </label>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20">
                Log in
              </button>
              <p className="text-center text-xs text-slate-500">Demo: any email and password work.</p>
            </form>
          )}
          {mode === "forgot" && (
            <form onSubmit={reset} className="space-y-4">
              <h1 className="text-lg font-semibold text-white">Reset your password</h1>
              <p className="text-sm text-slate-400">Enter your account email and we&apos;ll send you a reset link.</p>
              <label className="block text-xs font-medium text-slate-300">
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-medium text-white">
                Send reset link
              </button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-slate-400 hover:text-white">
                ← Back to log in
              </button>
            </form>
          )}
          {mode === "sent" && (
            <div className="space-y-3 text-center">
              <h1 className="text-lg font-semibold text-white">Check your email</h1>
              <p className="text-sm text-slate-400">
                If an account exists for <span className="text-slate-200">{email}</span>, a reset link is on its way. It&apos;s valid for 60 minutes. Check your spam folder if it
                doesn&apos;t arrive.
              </p>
              <p className="text-xs text-slate-500">Company uses SSO? Reset your password through your company&apos;s identity provider instead.</p>
              <button onClick={() => setMode("login")} className="text-sm text-indigo-300 hover:underline">
                Back to log in
              </button>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Trouble signing in?{" "}
          <Link href="/help" className="text-indigo-300 hover:underline">
            Ask our assistant
          </Link>
        </p>
      </div>
    </div>
  );
}
