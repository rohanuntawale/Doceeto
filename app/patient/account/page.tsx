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

  return (
    <div className="profile-page patient-profile mx-auto max-w-4xl space-y-6">
      <section className="patient-profile-hero overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <AvatarUploader onPhoto={setPhoto}>
              <AvatarImage
                src={patient.avatarUrl}
                fallback={firstName.charAt(0).toUpperCase()}
                background="linear-gradient(135deg, #f3c96b, #c58b2e)"
                className="h-20 w-20 rounded-[1.65rem] border-4 border-white/20 text-2xl font-semibold text-[#173f33] shadow-[0_16px_32px_rgb(0_0_0/0.18)]"
              />
            </AvatarUploader>
            <div className="min-w-0 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Your care profile</p>
              <h1 className="mt-1 truncate font-serif text-4xl leading-none sm:text-5xl">{patient.name}</h1>
              <p className="mt-2 truncate text-sm text-white/75">{patient.address || "Add your home area for faster care"}</p>
              <p className="mt-2 text-xs text-white/65">{patient.avatarUrl ? t("account.tapPhoto") : t("account.addPhoto")}</p>
            </div>
          </div>
          <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:max-w-56">
            <div className="flex items-baseline justify-between gap-3 text-sm text-white/80"><span>Care profile</span><strong className="text-2xl text-white">{completion}%</strong></div>
            <progress aria-label="Health profile completeness" max={100} value={completion} className="mt-3 h-2 w-full accent-[#f3c96b]" />
            <p className="mt-2 text-xs leading-relaxed text-white/65">A fuller profile helps Mira ask better questions and clinicians prepare.</p>
          </div>
        </div>
      </section>

      {/* Health basics, what a doctor reads before treating them. */}
      <IdentityImport />
      <HealthProfileForm />


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
