"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Badge, Button, Card, CardTitle, Input, Notice } from "@/components/orbit/ui";

export default function SecurityPage() {
  const { data, enableTwoFactor, disableTwoFactor } = useOrbit();
  const [settingUp, setSettingUp] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { twoFactor, backupCodes } = data.security;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await enableTwoFactor(code);
    setError(err);
    if (!err) {
      setSettingUp(false);
      setCode("");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle description="Protect your account with a code from an authenticator app when you sign in.">Two-factor authentication (2FA)</CardTitle>
          <Badge tone={twoFactor ? "green" : "neutral"}>{twoFactor ? "Enabled" : "Off"}</Badge>
        </div>

        {!twoFactor && !settingUp && <Button onClick={() => setSettingUp(true)}>Enable 2FA</Button>}

        {settingUp && (
          <form onSubmit={submit} className="grid animate-fade-up gap-5 sm:grid-cols-[auto_1fr]">
            <FakeQrCode />
            <div className="space-y-3 text-sm text-slate-300">
              <p>1. Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy…).</p>
              <p>2. Enter the 6-digit code it shows. <span className="text-slate-500">(Demo: any 6 digits work.)</span></p>
              <Input inputMode="numeric" autoFocus placeholder="123456" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-40 tracking-[0.3em]" />
              <div className="flex gap-2">
                <Button type="submit">Verify and enable</Button>
                <Button type="button" variant="ghost" onClick={() => setSettingUp(false)}>
                  Cancel
                </Button>
              </div>
              <Notice message={error} />
            </div>
          </form>
        )}

        {twoFactor && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white">Backup codes</p>
              <p className="mt-0.5 text-sm text-slate-400">
                Save these somewhere safe. If you lose your phone, sign in with one of them. Each code works once. Without backup codes you&apos;ll need to{" "}
                <Link href="/app/support" className="text-indigo-300 hover:underline">
                  contact support
                </Link>{" "}
                to verify your identity.
              </p>
              <div className="mt-3 grid max-w-md grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 font-mono text-sm text-slate-200">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <Button variant="danger" onClick={() => confirm("Turn off 2FA? Your account will be less secure.") && disableTwoFactor()}>
              Turn off 2FA
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle description={`Signed in as ${data.user.email}`}>Password</CardTitle>
        <p className="text-sm text-slate-400">
          To change your password, use{" "}
          <Link href="/login?forgot=1" className="text-indigo-300 hover:underline">
            Forgot password
          </Link>{" "}
          on the login page. The reset link is valid for 60 minutes. If your company uses SSO, reset it through your identity provider instead.
        </p>
      </Card>
    </div>
  );
}

/** A decorative QR-style pattern (the demo has no real authenticator secret). */
function FakeQrCode() {
  const size = 21;
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.5);
  }
  const finder = (x: number, y: number) =>
    [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const finderOn = (x: number, y: number) => {
    const lx = x % (size - 7) === x ? x : x - (size - 7);
    const ly = y % (size - 7) === y ? y : y - (size - 7);
    const d = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
    return d !== 2;
  };
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className="h-40 w-40 rounded-xl bg-white p-1" aria-label="QR code for your authenticator app">
      {cells.map((on, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        const fill = finder(x, y) ? finderOn(x, y) : on;
        return fill ? <rect key={i} x={x} y={y} width={1.02} height={1.02} fill="#0b0d1a" /> : null;
      })}
    </svg>
  );
}
