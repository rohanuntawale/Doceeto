"use client";

import { useState } from "react";
import { Video, Home, Building2, Navigation, Star, FileText, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { consultStatus, consultType } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  useConsultRequests,
  useDoctors,
  usePrescriptions,
  useReviews,
  useActions,
} from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest, Doctor, Prescription } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

const IN_PROGRESS = ["pending", "accepted", "enroute", "arrived"];

/** The patient's booked doctors: live visits, and past visits with the
 *  prescription and a chance to rate the doctor. */
export function PatientBookings({ patientId }: { patientId: string }) {
  const mounted = useMounted();
  const doctors = useDoctors();
  const prescriptions = usePrescriptions();
  const reviews = useReviews();
  const mine = useConsultRequests().filter((r) => r.patientId === patientId);

  const current = mine.filter((r) => IN_PROGRESS.includes(r.status));
  const previous = mine.filter((r) => r.status === "completed");

  if (mine.length === 0) return null;

  const doctorOf = (id: string | null) => doctors.find((d) => d.id === id);
  const rxOf = (reqId: string) => prescriptions.find((p) => p.requestId === reqId);
  const ratedReqs = new Set(reviews.map((v) => v.requestId).filter(Boolean));

  return (
    <div className="space-y-5">
      {current.length > 0 && (
        <section>
          <div className="label mb-2.5">Your care · live</div>
          <div className="space-y-2.5">
            {current.map((r) => (
              <BookingRow key={r.id} req={r} doctor={doctorOf(r.doctorId)} mounted={mounted} />
            ))}
          </div>
        </section>
      )}

      {previous.length > 0 && (
        <section>
          <div className="label mb-2.5">Past visits</div>
          <div className="space-y-2.5">
            {previous.map((r) => (
              <BookingRow
                key={r.id}
                req={r}
                doctor={doctorOf(r.doctorId)}
                mounted={mounted}
                prescription={rxOf(r.id)}
                rated={ratedReqs.has(r.id)}
                past
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingRow({
  req,
  doctor,
  mounted,
  prescription,
  rated,
  past = false,
}: {
  req: ConsultRequest;
  doctor?: Doctor;
  mounted: boolean;
  prescription?: Prescription;
  rated?: boolean;
  past?: boolean;
}) {
  const [showRx, setShowRx] = useState(false);
  const [rating, setRating] = useState(0);
  const { addReview } = useActions();
  const toast = useToast();
  const st = consultStatus[req.status];
  const name = doctor?.fullName ?? "Iyashi doctor";
  const inPerson = req.type !== "video";

  const liveNote =
    req.status === "pending"
      ? "Finding a doctor near you…"
      : req.status === "accepted"
        ? inPerson && req.etaMins != null
          ? `${name} accepted · arriving in ~${req.etaMins} min`
          : `${name} accepted`
        : req.status === "enroute"
          ? `${name} is on the way${req.etaMins != null ? ` · ~${req.etaMins} min` : ""}`
          : req.status === "arrived"
            ? `${name} has arrived`
            : null;

  function submitRating(stars: number) {
    if (!doctor) return;
    setRating(stars);
    addReview({
      doctorId: doctor.id,
      requestId: req.id,
      patientName: req.patientName,
      rating: stars,
      comment: "",
    });
    toast.push({ tone: "success", title: "Thanks for rating", desc: name });
  }

  return (
    <div
      className={cn(
        "rounded-card border border-[var(--border)] bg-espresso-800 p-3.5 shadow-card",
        past && "opacity-95",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-medium text-cream"
          style={{ background: doctor?.avatarColor ?? "#6B615A" }}
        >
          {initials(name.replace("Dr. ", ""))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cream">{name}</p>
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {typeIcon[req.type]}
            {consultType[req.type].label}
            {doctor?.specialty ? ` · ${doctor.specialty}` : ""}
          </p>
          {liveNote && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-tan">
              {(req.status === "enroute" || req.status === "accepted") && inPerson && (
                <Navigation className="h-3 w-3" />
              )}
              {liveNote}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          <span className="font-mono text-[10px] text-[var(--text-faint)]">
            {formatINR(req.fee)} · {mounted ? timeAgo(req.createdAt) : ""}
          </span>
        </div>
      </div>

      {/* Completed visit: prescription + rating */}
      {past && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {prescription && (
            <button
              onClick={() => setShowRx((v) => !v)}
              className="flex w-full items-center gap-2 text-xs font-medium text-salmon"
            >
              <FileText className="h-3.5 w-3.5" /> Prescription
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", showRx && "rotate-90")}
              />
            </button>
          )}
          {showRx && prescription && <RxView rx={prescription} />}

          {!rated && rating === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Rate this visit:</span>
              <StarPicker onPick={submitRating} />
            </div>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">
              {rating > 0 ? "Rated. Thank you!" : "You rated this visit."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StarPicker({ onPick }: { onPick: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onPick(n)}
          aria-label={`${n} stars`}
        >
          <Star
            className={cn(
              "h-4 w-4",
              n <= hover ? "fill-tan text-tan" : "text-[var(--text-faint)]",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function RxView({ rx }: { rx: Prescription }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-espresso p-3 text-xs">
      <p className="text-cream">
        <span className="text-[var(--text-muted)]">Diagnosis:</span> {rx.diagnosis}
      </p>
      {rx.items.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {rx.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2 font-mono text-[var(--text-muted)]">
              <span className="text-cream">{it.name}</span>
              <span>
                {it.dosage} · {it.duration}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rx.advice && <p className="mt-1.5 text-[var(--text-muted)]">{rx.advice}</p>}
      <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
        {rx.doctorName}
        {rx.doctorRegNo ? ` · Reg ${rx.doctorRegNo}` : ""}
      </p>
    </div>
  );
}
