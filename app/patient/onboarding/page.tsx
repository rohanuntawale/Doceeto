"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IdentityImport } from "@/components/patient/identity-import";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { apiFetch } from "@/lib/api/client";

export default function PatientOnboarding() {
  const { patient, update } = useCurrentPatient();
  const router = useRouter();
  const [dob, setDob] = useState("");
  const [allergies, setAllergies] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function finish() {
    if (busy || !patient.ready) return;
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth/health-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...patient.healthProfile, ...(dob ? { dob } : {}), ...(allergies.trim() ? { allergies: allergies.trim() } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save your details.");
      update({ healthProfile: body.healthProfile });
      router.replace("/patient"); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="profile-page mx-auto max-w-2xl space-y-6">
    <p className="label">Welcome to Doceeto</p><h1 className="font-serif text-4xl">A little about you.</h1>
    <p className="text-[var(--text-muted)]">These optional details help your clinician and Mira. You can add the rest to your profile later.</p>
    <IdentityImport />
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <label className="block text-sm">Date of birth<input type="date" value={dob || patient.healthProfile?.dob || ""} max={new Date().toISOString().slice(0, 10)} onChange={event => setDob(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--border)] p-3" /></label>
      <label className="block text-sm">Medication or food allergies<input value={allergies} onChange={event => setAllergies(event.target.value)} placeholder="e.g. penicillin, or no known allergies" maxLength={500} className="mt-2 block w-full rounded-xl border border-[var(--border)] p-3" /></label>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button onClick={finish} disabled={busy || !patient.ready} className="w-full rounded-xl bg-[#153d32] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Continue to care"}</button>
  </div>;
}
