"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartPulse, Stethoscope, ArrowLeft, ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { isDemoMode } from "@/lib/config";
import { demoStore } from "@/lib/demo/store";
import { setCurrentDoctorId } from "@/lib/hooks/use-current-doctor";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { doctorKind } from "@/lib/labels";
import type { DoctorKind } from "@/lib/types/domain";

type Role = "patient" | "doctor" | null;

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const params = useSearchParams();
  const initial = (params.get("as") as Role) ?? null;
  const [role, setRole] = useState<Role>(
    initial === "patient" || initial === "doctor" ? initial : null,
  );

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Wordmark className="mb-8 justify-center" />

        {role === null && <Chooser onPick={setRole} />}
        {role === "patient" && <PatientForm onBack={() => setRole(null)} />}
        {role === "doctor" && <DoctorForm onBack={() => setRole(null)} />}

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-salmon hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Chooser({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 shadow-card">
      <div className="label mb-1 text-center">CREATE ACCOUNT</div>
      <h1 className="mb-5 text-center font-serif text-2xl text-cream">
        How will you use Iyashi?
      </h1>
      <div className="space-y-3">
        <RoleCard
          onClick={() => onPick("patient")}
          kanji="患"
          title="I need care"
          sub="Get a doctor at home, at a clinic, or on video"
          icon={<HeartPulse className="h-4 w-4" />}
        />
        <RoleCard
          onClick={() => onPick("doctor")}
          kanji="医"
          title="I'm a doctor"
          sub="See patients near you and earn on your own time"
          icon={<Stethoscope className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

function RoleCard({
  onClick,
  kanji,
  title,
  sub,
  icon,
}: {
  onClick: () => void;
  kanji: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-card border border-[var(--border)] bg-espresso px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-terracotta/50"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-terracotta/12 font-jp text-lg text-salmon ring-1 ring-inset ring-terracotta/20 group-hover:bg-terracotta group-hover:text-cream">
        {kanji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-cream">
          {icon} {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--text-faint)]">
          {sub}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
    </button>
  );
}

// ── Patient registration ─────────────────────────────────────
function PatientForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { patient, update } = useCurrentPatient();
  const [form, setForm] = useState({
    name: "",
    address: patient.address,
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isDemoMode) {
      update({
        name: form.name.trim() || "Patient",
        address: form.address.trim() || patient.address,
      });
      toast.push({ tone: "success", title: "Welcome to Iyashi", desc: "Your profile is ready." });
      router.push("/patient");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "patient",
        name: form.name,
        address: form.address,
        email: form.email,
        password: form.password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Could not create the account.");
    toast.push({ tone: "success", title: "Welcome to Iyashi", desc: "Your account is ready." });
    router.push("/patient");
  }

  return (
    <FormShell title="Register as a patient" kanji="患" onBack={onBack} onSubmit={submit}>
      <Field label="Full name">
        <input
          className={inputCls}
          value={form.name}
          required
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Aarav Patel"
        />
      </Field>
      <Field label="Address / area">
        <input
          className={inputCls}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Baner, Pune"
        />
      </Field>
      {!isDemoMode && (
        <>
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputCls}
              value={form.password}
              required
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
            />
          </Field>
        </>
      )}
      {error && <p className="text-sm text-terracotta-300">{error}</p>}
      <Button type="submit" className="mt-2 w-full" disabled={loading}>
        {loading ? "Setting up…" : "Continue to the app"}
      </Button>
    </FormShell>
  );
}

// ── Doctor registration ──────────────────────────────────────
const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Pediatrician",
  "Orthopedic",
  "Dermatologist",
  "Gynecologist",
  "ENT",
  "Psychiatrist",
];

function DoctorForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: "",
    specialty: "General Physician",
    kind: "practising" as DoctorKind,
    gender: "female" as "female" | "male",
    experienceYears: 3,
    regNo: "",
    email: "",
    password: "",
    consultFee: 400,
    homeVisitFee: 900,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isDemoMode) {
      const doc = demoStore.registerDoctor({
        fullName: form.fullName,
        specialty: form.specialty,
        kind: form.kind,
        gender: form.gender,
        experienceYears: Number(form.experienceYears) || 0,
        regNo: form.regNo.trim() || null,
        consultFee: Number(form.consultFee) || 0,
        homeVisitFee: Number(form.homeVisitFee) || 0,
      });
      setCurrentDoctorId(doc.id);
      toast.push({
        tone: "success",
        title: "Application received",
        desc: "Our team will verify your registration before you can go online.",
      });
      router.push("/doctor");
      return;
    }

    // Live: create the doctor account on the Neo4j backend.
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "doctor",
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        specialty: form.specialty,
        kind: form.kind,
        gender: form.gender,
        experienceYears: form.experienceYears,
        regNo: form.regNo,
        consultFee: form.consultFee,
        homeVisitFee: form.homeVisitFee,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Could not create the account.");
    toast.push({ tone: "success", title: "You're on the network", desc: form.fullName });
    router.push("/doctor");
  }

  return (
    <FormShell title="Join as a doctor" kanji="医" onBack={onBack} onSubmit={submit}>
      <Field label="Full name">
        <input
          className={inputCls}
          value={form.fullName}
          required
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="Dr. Ananya Rao"
        />
      </Field>
      <Field label="Specialty">
        <select
          className={inputCls}
          value={form.specialty}
          onChange={(e) => setForm({ ...form, specialty: e.target.value })}
        >
          {SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="You are">
          <select
            className={inputCls}
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as "female" | "male" })
            }
          >
            <option value="female">Female doctor</option>
            <option value="male">Male doctor</option>
          </select>
        </Field>
        <Field label="Years of experience">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.experienceYears}
            onChange={(e) =>
              setForm({ ...form, experienceYears: Number(e.target.value) })
            }
          />
        </Field>
      </div>

      <Field label="Medical registration number (NMC / state council)">
        <input
          className={inputCls}
          value={form.regNo}
          onChange={(e) => setForm({ ...form, regNo: e.target.value })}
          placeholder="e.g. MH-2018-05529"
        />
      </Field>

      <div>
        <span className="label">Where you are right now</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["resident", "practising"] as DoctorKind[]).map((k) => {
            const active = form.kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, kind: k })}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-terracotta bg-terracotta/10"
                    : "border-[var(--border)] bg-espresso hover:border-terracotta/40"
                }`}
              >
                <span className="block text-sm font-medium text-cream">
                  {doctorKind[k].label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-faint)]">
                  {doctorKind[k].blurb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Consult fee (₹)">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.consultFee}
            onChange={(e) => setForm({ ...form, consultFee: Number(e.target.value) })}
          />
        </Field>
        <Field label="Home visit fee (₹)">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.homeVisitFee}
            onChange={(e) => setForm({ ...form, homeVisitFee: Number(e.target.value) })}
          />
        </Field>
      </div>

      {!isDemoMode && (
        <>
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputCls}
              value={form.password}
              required
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
            />
          </Field>
        </>
      )}

      {error && <p className="text-sm text-terracotta-300">{error}</p>}
      <Button type="submit" className="mt-2 w-full" disabled={loading}>
        {loading ? "Creating…" : isDemoMode ? "Join and go online" : "Create account"}
      </Button>
    </FormShell>
  );
}

// ── Shared bits ──────────────────────────────────────────────
function FormShell({
  title,
  kanji,
  onBack,
  onSubmit,
  children,
}: {
  title: string;
  kanji: string;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border border-[var(--border)] bg-espresso-800 p-6 shadow-card"
    >
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-cream"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-jp text-sm text-salmon">{kanji}</span>
        <span className="label">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
