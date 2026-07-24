"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/config";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/doctor";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
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
    if (!res.ok) {
      setError(data.error ?? "Could not sign in.");
      return;
    }
    const dest =
      data.role === "ops" ? "/ops" : data.role === "patient" ? "/patient" : next;
    router.push(dest);
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
        <Wordmark className="mb-8 justify-center" />

        {isDemoMode ? (
          <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 text-center shadow-card">
            <div className="label mb-2">DEMO MODE</div>
            <p className="text-sm text-[var(--text-muted)]">
              This is demo mode, so login is skipped. Sign in as a doctor or a
              patient. Set <span className="font-mono">NEXT_PUBLIC_BACKEND=neo4j</span>{" "}
              with Neo4j credentials to turn on real accounts.
            </p>
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" onClick={() => router.push("/doctor")}>
                Sign in as Doctor
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/patient")}
              >
                Sign in as Patient
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 shadow-card"
          >
            <div className="label mb-4">SIGN IN</div>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@doceeto.health"
            />
            <div className="h-3" />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
            {error && (
              <p className="mt-3 text-sm text-terracotta-300">{error}</p>
            )}
            <Button
              type="submit"
              className="mt-5 w-full"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
              New here?{" "}
              <Link href="/" className="text-salmon hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Doceeto Health · Healing, on demand
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
      />
    </label>
  );
}
