"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  HeartHandshake,
  Loader2,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { CareNetwork } from "@/components/auth/care-network";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { useWarmBackend } from "@/lib/hooks/use-warm-backend";
import { SIGNUP_HANDOFF_KEY, surfaceFromPath } from "@/lib/auth/constants";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

type Mode = "signin" | "signup";
type Role = "patient" | "doctor" | "nurse";

// Mirrors the server's rules (app/api/auth/register/route.ts) so nobody is
// carried to the profile step only to bounce back on a weak password.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordProblem = (pw: string) =>
  pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)
    ? "Password must be 8+ characters and include a letter and a number."
    : null;

/**
 * The front door — one card switching between sign-in and sign-up, sized to
 * fit one screen without scrolling in either mode. Sign-up asks which cadre
 * first: patients are created here, practitioners carry their basics on to
 * the profile form, which is what creates their account.
 */
export function AuthSwitch({
  googleEnabled = false,
  defaultMode = "signin",
}: {
  googleEnabled?: boolean;
  defaultMode?: Mode;
}) {
  return (
    <Suspense
      fallback={<div className="h-screen bg-[rgb(var(--c-forest-paper))]" />}
    >
      <AuthShell googleEnabled={googleEnabled} defaultMode={defaultMode} />
    </Suspense>
  );
}

function AuthShell({
  googleEnabled,
  defaultMode,
}: {
  googleEnabled: boolean;
  defaultMode: Mode;
}) {
  return (
    <main className="relative grid h-screen place-items-center overflow-hidden bg-[rgb(var(--c-forest-paper))] px-3 py-3 text-[var(--text)] sm:px-5 sm:py-4">
      {/* The landing hero's footage, same file and same full-opacity treatment
          as components/landing/landing-hero.tsx. Must be z-0, not -z-10: main
          has z-index:auto, so a negative child escapes to the root stacking
          context and paints behind main's own background. */}
      <video
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src="/hero-background.mp4" type="video/mp4" />
      </video>

      {/* The frame carries no fill of its own — the glass lives on the form
          column, so the right column stays a clear window onto the footage. */}
      <div className="relative z-10 grid h-full w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/35 shadow-card lg:grid-cols-[1fr_1fr]">
        <AuthPanel googleEnabled={googleEnabled} defaultMode={defaultMode} />
        <FilmPanel />
      </div>
    </main>
  );
}

// ── Left: the form ───────────────────────────────────────────
function AuthPanel({
  googleEnabled,
  defaultMode,
}: {
  googleEnabled: boolean;
  defaultMode: Mode;
}) {
  // Wake the database while they're still typing — submit lands warm.
  useWarmBackend();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const wantedSurface = surfaceFromPath(next);

  const [mode, setMode] = useState<Mode>(defaultMode);
  // Null until they say so; the submit stays inert rather than defaulting to
  // patient, which is the silent guess this chooser exists to stop.
  const [role, setRole] = useState<Role | null>(
    wantedSurface === "doctor"
      ? "doctor"
      : wantedSurface === "nurse"
        ? "nurse"
        : null,
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // The OAuth callback reports failures by bouncing back here with ?error=
  const [error, setError] = useState<string | null>(params.get("error"));
  // Their address belongs to a Google account: the wrong door, not a mistake,
  // so the red box becomes a Google button carrying the address they gave.
  const [googleOnly, setGoogleOnly] = useState(false);

  // Empty means we genuinely do not know, which makes the callback ASK rather
  // than filing a first-time visitor as a patient.
  const googleRole: Role | "" =
    mode === "signup"
      ? (role ?? "")
      : wantedSurface === "doctor"
        ? "doctor"
        : wantedSurface === "nurse"
          ? "nurse"
          : "";

  function switchMode(to: Mode) {
    setMode(to);
    setError(null);
    setGoogleOnly(false);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGoogleOnly(false);
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
      setGoogleOnly(data.code === "GOOGLE_ONLY");
      return;
    }
    const home =
      data.role === "ops"
        ? "/ops"
        : data.role === "patient"
          ? "/patient"
          : data.role === "nurse"
            ? "/nurse"
            : "/doctor";
    router.push(next.startsWith(home) ? next : home);
    router.refresh();
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      setError("Pick whether you're here as a patient, a doctor or a nurse.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      setError(pwProblem);
      return;
    }
    // Practitioners do not finish here — no account exists until the profile
    // step — so their basics ride along rather than being asked for twice.
    if (role === "doctor" || role === "nurse") {
      setError(null);
      try {
        sessionStorage.setItem(
          SIGNUP_HANDOFF_KEY,
          JSON.stringify({
            role,
            name: name.trim(),
            email: email.trim(),
            password,
          }),
        );
      } catch {
        // Private mode or storage full; the profile form asks for the basics
        // itself, and a re-typed password beats a dead button.
      }
      router.push(`/signup?as=${role}`);
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "patient", name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create the account.");
      return;
    }
    router.push("/patient");
    router.refresh();
  }

  const providerPicked = role === "doctor" || role === "nurse";

  return (
    /* min-h-0 lets the column shrink; overflow-y-auto is a safety net for very
       short windows, not the expected experience. */
    /* 85% surface over the footage: the paper texture still moves behind the
       form, without the type losing its ground. */
    <section className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-[rgb(var(--surface-rgb)/0.85)] px-6 py-8 backdrop-blur-2xl short:py-6 sm:px-10">
      <div className="w-full max-w-[22rem]">
        <div className="flex justify-center">
          <Link href="/" aria-label="Doceeto home">
            <Wordmark compact />
          </Link>
        </div>

        <h1 className="mt-5 text-center font-serif text-[32px] font-bold leading-[1.1] tracking-tight text-[var(--text)] short:mt-4 short:text-[27px]">
          {mode === "signin" ? (
            <>
              Welcome
              <br />
              back
            </>
          ) : (
            <>
              Start your
              <br />
              care journey
            </>
          )}
        </h1>

        {/* Google sits above the form as a bare mark, the way the reference
            stacks its providers — one chip, since it is our only provider. */}
        {googleEnabled && (
          <>
            <div className="mt-5 flex justify-center short:mt-4">
              <GoogleButton
                iconOnly
                role={googleRole}
                next={next || undefined}
                label={`Continue with Google${providerPicked ? ` as ${role}` : ""}`}
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-soft hover:bg-[var(--bg)]"
              />
            </div>
            <AuthDivider className="my-4 short:my-3">or</AuthDivider>
          </>
        )}

        <form
          onSubmit={mode === "signin" ? onSignIn : onSignUp}
          className="space-y-2.5"
        >
          {/* Asked first: the three cadres do not share an onboarding, so
              nothing below can be filled in sensibly until it is answered. */}
          {mode === "signup" && (
            <div className="grid grid-cols-3 gap-1.5 pb-0.5">
              <RoleChip
                icon={HeartHandshake}
                label="Patient"
                active={role === "patient"}
                onClick={() => setRole("patient")}
              />
              <RoleChip
                icon={Stethoscope}
                label="Doctor"
                active={role === "doctor"}
                onClick={() => setRole("doctor")}
              />
              <RoleChip
                icon={Syringe}
                label="Nurse"
                active={role === "nurse"}
                onClick={() => setRole("nurse")}
              />
            </div>
          )}

          {mode === "signup" && (
            <Field label="Full name">
              <input
                type="text"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className={inputCls}
              />
            </Field>
          )}

          <Field label="Email">
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputCls}
            />
          </Field>

          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={cn(inputCls, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          {/* A routing problem, not a failure: accent treatment and a button
              rather than a red box, with the address as login_hint. */}
          {error && googleOnly ? (
            <div className="space-y-2.5 rounded-2xl border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.07)] p-3">
              <p className="text-[11px] font-medium text-[var(--text)]">
                {error}
              </p>
              <GoogleButton
                role={googleRole}
                next={next || undefined}
                email={email}
                label="Continue with Google"
                className="h-10 rounded-full border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)]"
              />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-status-critical/30 bg-status-critical/10 p-2.5 text-[11px] font-medium text-status-critical">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || (mode === "signup" && !role)}
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-[15px] font-semibold text-on-accent shadow-soft transition-colors hover:bg-terracotta-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60 disabled:pointer-events-none disabled:opacity-50 short:h-11"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "signin" ? "Signing in…" : "Creating…"}
              </>
            ) : (
              <>
                {mode === "signin"
                  ? "Log in"
                  : providerPicked
                    ? "Continue"
                    : "Start"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-[var(--text-muted)] short:mt-3">
          {mode === "signin" ? "New to Doceeto? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="font-bold text-[var(--text)] underline-offset-4 hover:underline"
          >
            {mode === "signin" ? (
              <Link
                href="/signup"
                className="font-bold text-[var(--text)] underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
            ) : (
              <Link
                href="/login"
                className="font-bold text-[var(--text)] underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            )}
          </button>
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 text-[10.5px] text-[var(--text-faint)] shorter:hidden">
          <Link
            href="/about"
            className="transition-colors hover:text-[var(--text)]"
          >
            About
          </Link>
          <span>·</span>
          <Link
            href="/contact"
            className="transition-colors hover:text-[var(--text)]"
          >
            Contact
          </Link>
          <span>·</span>
          <Link
            href="/terms"
            className="transition-colors hover:text-[var(--text)]"
          >
            Terms
          </Link>
          <span>·</span>
          <Link
            href="/privacy"
            className="transition-colors hover:text-[var(--text)]"
          >
            Privacy
          </Link>
        </div>
      </div>
    </section>
  );
}

/** One of the three cadres. Icon beside label keeps the row one line tall. */
function RoleChip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-row items-center justify-center gap-1.5 rounded-full border px-2 py-2 transition-all duration-200",
        active
          ? "border-[rgb(var(--accent-rgb)/0.55)] bg-[rgb(var(--accent-rgb)/0.09)] text-[var(--text)]"
          : "border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.6)] text-[var(--text-muted)] hover:border-[rgb(var(--accent-rgb)/0.35)] hover:text-[var(--text)]",
      )}
    >
      <Icon
        className={cn("h-4 w-4", active && "text-[var(--accent)]")}
        strokeWidth={1.75}
      />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

/** Placeholder-only fields, so the label is there for screen readers alone. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-12 w-full rounded-2xl border border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.75)] px-4 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[rgb(var(--accent-rgb)/0.4)] short:h-11";

/**
 * Right: a clear window onto the page's footage with the interactive Care
 * Network. The gold dot from the Doceeto logo is the draggable care signal.
 */
function FilmPanel() {
  const bounds = useRef<HTMLDivElement>(null);
  return (
    <section className="relative hidden overflow-hidden lg:block">
      {/* Hairline separator between form and panel */}
      <div className="absolute inset-y-0 left-0 w-px bg-white/25" />

      {/* Full panel bounds — used as drag constraint for the gold dot */}
      <div ref={bounds} className="absolute inset-0">
        <CareNetwork boundsRef={bounds} />
      </div>

      {/* Tagline — clean typography, no pill or border */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center">
        <p className="font-serif text-[13px] italic text-paper/55">
          Care that reaches you.
        </p>
      </div>
    </section>
  );
}

export default AuthSwitch;
