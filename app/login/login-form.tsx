"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/config";
import { surfaceFromPath } from "@/lib/auth/constants";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { useWarmBackend } from "@/lib/hooks/use-warm-backend";

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginInner googleEnabled={googleEnabled} />
    </Suspense>
  );
}

function LoginInner({ googleEnabled }: { googleEnabled: boolean }) {
  // Wake the database while they're still typing — sign-in lands warm.
  useWarmBackend();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/doctor";
  const wantedSurface = surfaceFromPath(params.get("next") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The OAuth callback reports failures by bouncing back here with ?error=,
  // since it is a full-page redirect and has no other way to speak.
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);
  /** Google needs to know which app is being entered; default to the patient. */
  const googleRole = wantedSurface === "doctor" ? "doctor" : "patient";

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
    // Land in the signed-in role's own space. `next` (where the guard sent them
    // from) is honored only when it belongs to that space — otherwise a doctor
    // sent to /patient/... would ping-pong between the guard and this page.
    const home =
      data.role === "ops" ? "/ops" : data.role === "patient" ? "/patient" : data.role === "nurse" ? "/nurse" : "/doctor";
    const dest = next.startsWith(home) ? next : home;
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
              This is demo mode, so login is skipped. Sign in as a doctor, nurse, or
              patient. Set <span className="font-mono">NEXT_PUBLIC_BACKEND=neo4j</span>{" "}
              with Neo4j credentials to turn on real accounts.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => router.push("/doctor")}>
                Sign in as Doctor
              </Button>
              <Button className="flex-1 bg-[#2d7d66] hover:bg-[#236b58]" onClick={() => router.push("/nurse")}>
                Sign in as Nurse
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

            {/* Google first: for most people it is one tap against a form. */}
            {googleEnabled && (
              <>
                <GoogleButton
                  role={googleRole}
                  next={params.get("next") ?? undefined}
                  label={`Continue with Google${googleRole === "doctor" ? " as a doctor" : ""}`}
                />
                <AuthDivider>or use your password</AuthDivider>
              </>
            )}

            {/* Which surface asked for a sign-in. Landing here from /doctor used
                to silently show the patient dashboard instead; saying it plainly
                also makes clear that the other role stays signed in. */}
            {wantedSurface && (
              <p className="mb-4 rounded-lg border border-[var(--border)] bg-espresso px-3 py-2 text-xs text-[var(--text-muted)]">
                {wantedSurface === "doctor"
                  ? "The doctor cockpit needs a doctor account. Signing in here won't sign you out of the patient app."
                  : wantedSurface === "nurse"
                    ? "The nurse workspace needs a nurse account. Signing in here won't sign you out of the patient app."
                  : "The patient app needs a patient account. Signing in here won't sign you out of the doctor cockpit."}
              </p>
            )}
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

        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-[var(--text-faint)]">
          <Link href="/about" className="transition-colors hover:text-cream">
            About
          </Link>
          <span aria-hidden>·</span>
          <Link href="/contact" className="transition-colors hover:text-cream">
            Contact
          </Link>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--text-faint)]">
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
