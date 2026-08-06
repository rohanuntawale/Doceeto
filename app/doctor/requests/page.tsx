"use client";

import { useState } from "react";
import { Zap, CalendarDays, Briefcase, ClipboardList } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { RequestCard } from "@/components/zumi/request-card";
import { PatientBriefDialog } from "@/components/doctor/patient-brief-dialog";
import { PrescriptionComposer } from "@/components/prescription/prescription-composer";
import { StartCodeForDoctor } from "@/components/consult/start-code";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { isDemoMode } from "@/lib/config";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import {
  activeGigHireOf,
  clashesWithAccepted,
  intervalOf,
  isGig,
  isScheduled,
  ongoingConsultOf,
  visibleToProvider,
} from "@/lib/scheduling/slots";
import { awaitingStartCode } from "@/lib/scheduling/trip";
import { formatSlotRange } from "@/lib/scheduling/time";

export default function RequestsPage() {
  const requests = useConsultRequests();
  const actions = useActions();
  const me = useCurrentDoctor();
  const toast = useToast();
  // Which accepted consult's patient brief is open (live mode only — the
  // brief comes from the account store, which demo mode doesn't have).
  const [briefFor, setBriefFor] = useState<string | null>(null);
  /** Which accepted consult is being closed out with a prescription. */
  const [prescribingFor, setPrescribingFor] = useState<string | null>(null);

  /**
   * "Medical history" on a request the doctor has NOT accepted yet. Whether to
   * take a visit is itself a clinical decision — an allergy or a bleeding
   * disorder can be the reason to say no — so the history belongs before the
   * accept, not only after it. The server returns a clinical-only preview until
   * the visit is actually held.
   */
  const briefButton = (r: (typeof requests)[number]) =>
    !isDemoMode && r.patientId ? (
      <button
        onClick={() => setBriefFor(r.id)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-sm font-medium text-cream transition-colors hover:bg-white/5"
      >
        <ClipboardList className="h-4 w-4 text-salmon" />
        Medical history
      </button>
    ) : undefined;

  const doctorId = me?.id ?? "";
  const ongoing = doctorId ? ongoingConsultOf(requests, doctorId) : undefined;
  const liveGig = doctorId ? activeGigHireOf(requests, doctorId) : undefined;

  // The same visibility rule the server applies, re-run here so demo mode
  // (which has no server filter) hides exactly the same rows. Passing on a
  // broadcast is persisted as `passedBy`, which visibleToProvider honours — so
  // a dismissal survives a refresh instead of coming straight back.
  const inbox = requests.filter(
    (r) =>
      doctorId &&
      visibleToProvider(r, { doctorId, busy: Boolean(ongoing) }) &&
      r.status === "pending",
  );
  const gigHires = inbox.filter(isGig);
  const urgent = inbox.filter((r) => !isScheduled(r) && !isGig(r));
  const booked = inbox
    .filter(isScheduled)
    .sort((a, b) => (intervalOf(a)!.start - intervalOf(b)!.start));

  /** Pass on a request. The server decides whether that declines it outright
   *  or just records this doctor as having passed on a broadcast. */
  const pass = (id: string) => actions.declineRequest(id);

  const accepted = requests.filter((r) => r.status === "accepted" && r.doctorId === doctorId);

  async function accept(id: string, patientName: string) {
    if (!doctorId) return;
    try {
      await actions.acceptRequest(id, doctorId);
      toast.push({ tone: "success", title: "Consult accepted", desc: patientName });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't accept",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

  return (
    <>
      <PageHeader label="DOCEETO · FREELANCE DOCTOR" title="Requests" />

      {liveGig ? (
        <div className="mb-6 flex items-start gap-2 rounded-card border border-terracotta/40 bg-terracotta/[0.07] p-3.5 text-sm text-tan">
          <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-salmon" />
          <span>
            You&rsquo;re on a gig for{" "}
            <span className="font-medium">{liveGig.patientName}</span>, so nothing new
            is reaching you.{" "}
            <Link href="/doctor/gigs" className="underline hover:text-cream">
              Mark it complete
            </Link>{" "}
            to become available again — appointments you already confirmed still stand.
          </span>
        </div>
      ) : ongoing ? (
        <div className="mb-6 flex items-start gap-2 rounded-card border border-tan/30 bg-tan/10 p-3.5 text-sm text-tan">
          <Zap className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You&rsquo;re with <span className="font-medium">{ongoing.patientName}</span> right
            now, so urgent requests are going to other doctors. Complete this
            consult to start receiving them again — appointments still come
            through below.
          </span>
        </div>
      ) : null}

      {/* Gig hires first: a named patient chose a package and is waiting. */}
      <section className="mb-8">
        <div className="label mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" /> GIG REQUESTS · {gigHires.length}
        </div>
        {gigHires.length === 0 ? (
          <EmptyState
            title="No one waiting to hire you"
            desc="Patients who pick one of your gigs land here."
            action={
              <Link
                href="/doctor/gigs"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-white/5"
              >
                Manage your gigs
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gigHires.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                note="Chose your gig"
                canAccept={!liveGig}
                blockedReason="Finish your current gig before taking another."
                onAccept={() => accept(r.id, r.patientName)}
                onDecline={() => pass(r.id)}
                footer={briefButton(r)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="label mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> URGENT · NOW · {urgent.length}
        </div>
        {urgent.length === 0 ? (
          <EmptyState
            title={ongoing ? "Paused while you're on a consult" : "No urgent requests right now"}
            desc={
              ongoing
                ? "They'll reach you again the moment you mark this consult complete."
                : "Make sure you're online. Patients who need someone now will appear here."
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {urgent.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                note={r.doctorId === doctorId ? "Chose you" : "Open to nearby doctors"}
                onAccept={() => accept(r.id, r.patientName)}
                onDecline={() => pass(r.id)}
                footer={briefButton(r)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="label mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> APPOINTMENTS TO CONFIRM · {booked.length}
        </div>
        {booked.length === 0 ? (
          <EmptyState
            title="Nothing waiting on you"
            desc="Slots patients book on your calendar land here for a quick confirm."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {booked.map((r) => {
              // Confirming two appointments over the same slot is the one
              // thing the calendar must never allow.
              const clash = clashesWithAccepted(r, requests, doctorId);
              return (
                <RequestCard
                  key={r.id}
                  request={r}
                  note={r.doctorId === doctorId ? "Booked with you" : "Open booking"}
                  canAccept={!clash}
                  blockedReason={
                    clash ? "You've already confirmed another visit at this time." : undefined
                  }
                  onAccept={() => accept(r.id, r.patientName)}
                  onDecline={() => pass(r.id)}
                  footer={briefButton(r)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="label mb-3">ACCEPTED BY YOU · {accepted.length}</div>
        {accepted.length === 0 ? (
          <EmptyState
            title="Nothing in progress"
            desc="Accepted consults show up here until you complete them."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accepted.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                note={
                  isScheduled(r) && r.scheduledAt
                    ? formatSlotRange(r.scheduledAt, r.scheduledEnd)
                    : undefined
                }
                // Finishing a consult is writing its prescription — the
                // composer owns both, including the "no medicine needed" exit.
                onComplete={() => setPrescribingFor(r.id)}
                footer={
                  <div className="space-y-2.5">
                    {/* The consult can't be completed until the patient's
                        code is entered, so the keypad lives right here. */}
                    {!isDemoMode && awaitingStartCode(r) && (
                      <StartCodeForDoctor req={r} />
                    )}
                    {/* Accepting the consult is what unlocks the patient's
                        health profile — the server enforces the same rule. */}
                    {!isDemoMode && r.patientId && (
                      <button
                        onClick={() => setBriefFor(r.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-sm font-medium text-cream transition-colors hover:bg-white/5"
                      >
                        <ClipboardList className="h-4 w-4 text-salmon" />
                        View patient details
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      {briefFor && (
        <PatientBriefDialog
          requestId={briefFor}
          open
          onClose={() => setBriefFor(null)}
        />
      )}

      {prescribingFor && (
        <PrescriptionComposer
          request={requests.find((r) => r.id === prescribingFor)!}
          open
          onClose={() => setPrescribingFor(null)}
        />
      )}
    </>
  );
}
