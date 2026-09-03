"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";


export default function OpsSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Could not sign in.");
    if (data.role !== "ops") return setError("This account is not an ops account.");
    router.push("/ops");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs text-[var(--text-faint)] transition-colors hover:text-cream"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <Wordmark className="mb-6 justify-center" />

        <form
          onSubmit={submit}
          className="rounded-card border border-terracotta/25 bg-espresso-800 p-6 shadow-card"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-terracotta/12 text-salmon ring-1 ring-inset ring-terracotta/20">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <div className="label">ADMIN</div>
              <h1 className="font-serif text-lg text-cream">Ops console sign in</h1>
            </div>
          </div>

          <div className="space-y-3">
              <label className="block">
                <span className="label">Email</span>
                <input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none focus:border-terracotta/60"
                  placeholder="ops@doceeto.health"
                />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none focus:border-terracotta/60"
                  placeholder="••••••••"
                />
              </label>
            </div>

          {error && <p className="mt-3 text-sm text-terracotta-300">{error}</p>}

          <Button type="submit" className="mt-5 w-full" disabled={loading}>
            {loading ? "Signing in…" : "Enter console"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--text-faint)]">
          Restricted to Doceeto operations & admin staff.
        </p>
      </div>
    </main>
  );
}
