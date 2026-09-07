"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";

export function IdentityImport() {
  const { patient, update } = useCurrentPatient();
  const [available, setAvailable] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { apiFetch("/api/verify/aadhaar").then(response => response.json()).then(data => setAvailable(data.available === true)).catch(() => setAvailable(false)); }, []);
  async function upload(file?: File) {
    if (!file || !consent || busy) return;
    if (file.size > 300000 || !file.name.toLowerCase().endsWith(".xml")) { setMessage("Choose the extracted XML file, under 300 KB."); return; }
    setBusy(true);
    try {
      const response = await apiFetch("/api/verify/aadhaar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent, xml: await file.text() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      update({ healthProfile: data.healthProfile });
      setMessage("Document authenticated. Date of birth and gender are imported into your health profile.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to import. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="flex items-center gap-2 font-semibold text-[var(--text)]"><ShieldCheck size={20} /> Your identity, your choice</h2>
    <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">Optionally import your date of birth and gender from a signed Aadhaar offline XML. We retain the name and document-check date, but not your XML, Aadhaar number, photo, or share code.</p>
    {patient.healthProfile?.aadhaarDocument ? <p className="mt-3 text-sm font-medium">Document authenticated for {patient.healthProfile.aadhaarDocument.name}. This checks the document signature, not ownership of the identity.</p> : available ? <>
      <p className="mt-3 text-sm"><a href="https://myaadhaar.uidai.gov.in/offline-ekyc" target="_blank" rel="noreferrer" className="underline">Get your offline XML from UIDAI</a>, then extract the ZIP on your device using your share code.</p>
      <label className="my-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" />I consent to Doceeto authenticating this document and importing these details.</label>
      <input aria-label="Upload signed Aadhaar XML" type="file" accept=".xml,text/xml,application/xml" disabled={!consent || busy} onChange={event => void upload(event.target.files?.[0])} className="w-full text-sm" />
    </> : <p className="mt-3 text-sm text-[var(--text-muted)]">Document import is not available yet. You can fill in your details below and continue to care.</p>}
    <p role="status" className="mt-3 text-sm">{busy ? "Checking the document signature…" : message}</p>
  </section>;
}
