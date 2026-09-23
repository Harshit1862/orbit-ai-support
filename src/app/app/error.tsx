"use client";

// Shown if the workspace can't be loaded, for example when the database is unreachable.
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#070812] px-4 text-center text-slate-100">
      <p className="text-lg font-semibold text-white">Couldn&apos;t load your workspace</p>
      <p className="max-w-sm text-sm text-slate-400">Something went wrong reaching our servers. Your data is safe; please try again in a moment.</p>
      <div className="flex gap-2">
        <button onClick={() => retry()} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white">
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">
          Home
        </Link>
      </div>
    </div>
  );
}
