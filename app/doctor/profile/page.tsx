"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Star,
  MapPin,
  Stethoscope,
  Pencil,
  Award,
  GraduationCap,
  ShieldCheck,
  Briefcase,
  Languages as LanguagesIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { OnlineToggle } from "@/components/doctor/online-toggle";
import { EditProfileDialog } from "@/components/doctor/edit-profile-dialog";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { useActions, useReviews } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { doctorStatusOf } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import {
  doctorQualification,
  doctorEducation,
  doctorAbout,
} from "@/lib/utils/doctor";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function ProfilePage() {
  const me = useCurrentDoctor();
  const reviews = useReviews(me?.id);
  const mounted = useMounted();
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const { updateDoctor } = useActions();

  /** Persist a new profile photo: the avatar endpoint for live accounts (it
   *  writes both the account and the public doctor row), the in-browser store
   *  in demo mode. */
  async function setPhoto(dataUrl: string) {
    if (!me) return;
    if (isDemoMode) {
      updateDoctor(me.id, { avatarUrl: dataUrl });
      return;
    }
    const res = await apiFetch("/api/auth/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't save the photo.");
    }
    // Show the new photo now rather than on the next 5s poll.
    qc.invalidateQueries();
  }

  if (!me) return null;

  const mine = reviews; // scoped to this doctor via useReviews(me.id)
  const st = doctorStatusOf(me.status);

  return (
    <>
      <PageHeader
        label="DOCEETO · PROFILE"
        title="Your profile"
        action={
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit profile
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <AvatarUploader onPhoto={setPhoto}>
              <span
                className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl font-serif text-2xl text-cream"
                style={{ background: me.avatarColor }}
              >
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={me.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(me.fullName.replace("Dr. ", ""))
                )}
              </span>
            </AvatarUploader>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-serif text-2xl text-cream">
                  {me.fullName}
                </h2>
                {me.verified && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-status-ok" />
                )}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Stethoscope className="h-3.5 w-3.5" /> {me.specialty}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
                <span className="flex items-center gap-1 text-sm text-tan">
                  <Star className="h-4 w-4 fill-tan" /> {me.rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <FeeTile
              label="Video / clinic consult"
              value={formatINR(me.consultFee)}
            />
            <FeeTile label="Home visit" value={formatINR(me.homeVisitFee)} />
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <MapPin className="h-3.5 w-3.5" /> Serving Nagpur ·{" "}
            {me.lat.toFixed(3)}, {me.lng.toFixed(3)}
          </p>

          {/* About + credentials — exactly what patients see. Use “Edit
              profile” to change any of it. */}
          <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <div className="label">What patients see</div>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-salmon transition-colors hover:text-cream"
              >
                Edit
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              {doctorAbout(me)}
            </p>
            <CredLine
              icon={<MapPin className="h-4 w-4 text-salmon" />}
              label="Clinic address"
              value={me.clinicAddress || "Not added yet"}
            />
            <CredLine
              icon={<Award className="h-4 w-4 text-salmon" />}
              label="Qualifications"
              value={doctorQualification(me)}
            />
            <CredLine
              icon={<GraduationCap className="h-4 w-4 text-salmon" />}
              label="Academic background"
              value={doctorEducation(me)}
            />
            <CredLine
              icon={<Briefcase className="h-4 w-4 text-salmon" />}
              label="Experience"
              value={`${me.experienceYears} yr${me.experienceYears === 1 ? "" : "s"}`}
            />
            <CredLine
              icon={<LanguagesIcon className="h-4 w-4 text-salmon" />}
              label="Languages"
              value={me.languages.join(", ") || "—"}
            />
            <CredLine
              icon={<ShieldCheck className="h-4 w-4 text-salmon" />}
              label="Medical reg. no."
              value={me.registrationNo || "Not added yet"}
            />
          </div>

          {!me.avatarUrl && (
            <p className="mt-4 rounded-xl border border-tan/30 bg-tan/10 px-3.5 py-2.5 text-xs leading-relaxed text-tan">
              Add a profile photo (tap the avatar above) — it&apos;s required
              before you can go online or publish a gig, so patients can see
              who&apos;s treating them.
            </p>
          )}

          <div className="mt-5">
            <OnlineToggle doctor={me} />
          </div>
        </Card>

        {/* Anchor target for the dashboard's Rating tile. */}
        <Card id="reviews" className="scroll-mt-24">
          <CardHeader
            label="DOCEETO · REVIEWS"
            title={`Patient reviews (${mine.length})`}
          />
          {mine.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No reviews yet" />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {mine.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-cream">
                      {r.patientName}
                    </span>
                    <span className="flex items-center gap-0.5 text-tan">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-tan" />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    “{r.comment}”
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                    {mounted ? timeAgo(r.createdAt) : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <EditProfileDialog
        doctor={me}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </>
  );
}

function FeeTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-espresso p-3">
      <div className="metric text-xl text-cream">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function CredLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-terracotta/10">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-faint)]">{label}</div>
        <div className="text-sm text-cream">{value}</div>
      </div>
    </div>
  );
}
