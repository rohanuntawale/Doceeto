"use client";

import {
  LogOut,
  ChevronRight,
  Languages,
} from "lucide-react";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { HealthProfileForm } from "@/components/patient/health-profile-form";
import { useT, type LangCode } from "@/lib/i18n";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { AvatarImage } from "@/components/ui/avatar-image";
import { IdentityImport } from "@/components/patient/identity-import";
import { healthProfileCompletion } from "@/lib/health/profile";
import { AccountSecuritySupport } from "@/components/account/account-security-support";

export default function PatientAccount() {
  const { patient, update } = useCurrentPatient();
  const { t, lang, setLang, languages } = useT();

  /** Persist a new profile photo: the server for live accounts, the browser
   *  store in demo mode. Either way the shared identity updates in place. */
  async function setPhoto(dataUrl: string) {
    const res = await apiFetch("/api/auth/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't save the photo.");
    }
    update({ avatarUrl: dataUrl });
  }

  async function signOut() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  const firstName = patient.name.split(" ")[0] || "Guest";
  const completion = healthProfileCompletion(patient.healthProfile);
  const health = patient.healthProfile ?? {};

  return (
    <div className="profile-page patient-profile mx-auto max-w-4xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white/80 p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">My profile</p>
          <div className="mt-5 flex min-w-0 flex-col items-center text-center">
            <AvatarUploader onPhoto={setPhoto}>
              <AvatarImage
                src={patient.avatarUrl}
                fallback={firstName.charAt(0).toUpperCase()}
                background="linear-gradient(135deg, #f3c96b, #c58b2e)"
                className="h-24 w-24 rounded-[1.8rem] border-4 border-white text-3xl font-semibold text-[#173f33] shadow-[0_16px_32px_rgb(21_61_50/0.18)]"
              />
            </AvatarUploader>
            <h1 className="mt-4 truncate text-3xl leading-none text-cream">{patient.name}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{patient.address || "Add your home area for faster care"}</p>
            <p className="mt-3 text-xs text-[var(--text-faint)]">{patient.avatarUrl ? t("account.tapPhoto") : t("account.addPhoto")}</p>
          </div>
          <dl className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            <ProfileRow label="Care profile" value={`${completion}% complete`} />
            <ProfileRow label="Home area" value={patient.address || "Not added"} />
            <ProfileRow label="Emergency contact" value={health.emergencyContactName || "Not added"} />
          </dl>
          <button type="button" onClick={() => document.getElementById("health-record")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98]">Update care record</button>
        </section>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white/70 shadow-soft">
            <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">Care at a glance</p>
                <h2 className="mt-1 text-lg font-semibold text-cream">Your patient summary</h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">The essentials a clinician needs first</p>
            </div>
            <dl className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <SummaryFact label="Blood group" value={health.bloodGroup || "Not added"} />
              <SummaryFact label="Allergies" value={health.allergies || "None recorded"} />
              <SummaryFact label="Current conditions" value={health.conditions || "None recorded"} />
              <SummaryFact label="Emergency contact" value={health.emergencyContactName ? `${health.emergencyContactName}${health.emergencyContactPhone ? ` · ${health.emergencyContactPhone}` : ""}` : "Not added"} />
            </dl>
          </section>
          <AccountSecuritySupport />
        </div>
      </div>

      {/* Health basics, what a doctor reads before treating them. */}
      <IdentityImport />
      <div id="health-record"><HealthProfileForm /></div>


      {/* Language */}
      <Section icon={<Languages className="h-4 w-4" />} title={t("account.language")}>
        <div className="grid grid-cols-3 gap-2">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as LangCode)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors",
                l.code === lang
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {l.native}
            </button>
          ))}
        </div>
      </Section>

      {/* Actions */}
      <div className="overflow-hidden rounded-3xl fh-card shadow-soft">
        <Row
          icon={<LogOut className="h-4 w-4" />}
          label={t("account.signOut")}
          tone="danger"
          onClick={signOut}
          last
        />
      </div>
    </div>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-cream" title={value}>{value}</dd>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-3 text-left"><dt className="text-xs text-[var(--text-faint)]">{label}</dt><dd className="max-w-[58%] truncate text-sm font-medium text-cream" title={value}>{value}</dd></div>;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl fh-card p-5 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-cream">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  icon,
  label,
  onClick,
  tone,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-espresso-700",
        !last && "border-b border-[var(--border)]",
        tone === "danger" ? "text-status-critical" : "text-cream",
      )}
    >
      <span className={tone === "danger" ? "text-status-critical" : "text-primary"}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-[var(--text-faint)]" />
    </button>
  );
}
