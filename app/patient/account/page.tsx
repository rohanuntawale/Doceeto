"use client";

import {
  RotateCcw,
  LogOut,
  ChevronRight,
  Languages,
} from "lucide-react";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { HealthProfileForm } from "@/components/patient/health-profile-form";
import { useT, type LangCode } from "@/lib/i18n";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { resetTestData } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

export default function PatientAccount() {
  const { patient, update } = useCurrentPatient();
  const { t, lang, setLang, languages } = useT();
  const toast = useToast();

  /** Persist a new profile photo: the server for live accounts, the browser
   *  store in demo mode. Either way the shared identity updates in place. */
  async function setPhoto(dataUrl: string) {
    if (!isDemoMode) {
      const res = await apiFetch("/api/auth/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save the photo.");
      }
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-cream">
        {t("account.title")}
      </h1>

      {/* Profile card — the avatar doubles as the photo upload control. */}
      <div className="flex items-center gap-4 rounded-3xl fh-card p-5 shadow-soft">
        <AvatarUploader onPhoto={setPhoto}>
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-terracotta to-salmon text-xl font-semibold text-on-accent">
            {patient.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              firstName.charAt(0).toUpperCase()
            )}
          </span>
        </AvatarUploader>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-cream">{patient.name}</p>
          <p className="truncate text-sm text-[var(--text-muted)]">{patient.address}</p>
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">
            {patient.avatarUrl ? t("account.tapPhoto") : t("account.addPhoto")}
          </p>
        </div>
      </div>

      {/* Health basics — what a doctor reads before treating them. */}
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
        {isDemoMode && (
          <Row
            icon={<RotateCcw className="h-4 w-4" />}
            label={t("account.clearData")}
            onClick={() => {
              resetTestData();
              toast.push({ tone: "info", title: "Test data cleared" });
            }}
          />
        )}
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
        "flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-[var(--c-espresso-700)]",
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
