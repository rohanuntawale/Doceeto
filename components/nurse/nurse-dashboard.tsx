"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  BadgeCheck,
  Banknote,
  Check,
  CircleAlert,
  HeartPulse,
  Inbox,
  Languages as LanguagesIcon,
  MapPin,
  Pencil,
  ShieldCheck,
  Star,
  Stethoscope,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { OnlineToggle } from "@/components/doctor/online-toggle";
import { EditNurseProfileDialog } from "@/components/nurse/edit-nurse-profile-dialog";
import { RequestCard } from "@/components/zumi/request-card";
import { LiveMap } from "@/components/map/live-map";
import { DoctorConsultTracker } from "@/components/consult/consult-tracker";
import { AvatarImage } from "@/components/ui/avatar-image";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { useToast } from "@/components/ui/toast";
import { useMounted } from "@/lib/hooks/use-mounted";
import { doctorStatusOf } from "@/lib/labels";
import {
  useActions,
  useConsultRequests,
  useReviews,
  useTransactions,
} from "@/lib/hooks/data";
import { useCurrentProvider } from "@/lib/hooks/use-current-doctor";
import { useT } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { ongoingConsultOf, visibleToProvider } from "@/lib/scheduling/slots";
import { NURSE_SERVICES, skillsOf } from "@/lib/nurse";
import { cn } from "@/lib/utils/cn";

/** Requests shown on the dashboard before it defers to the full list. */
const INBOX_PREVIEW = 3;

/**
 * The nurse console. One component behind every /nurse route, mirroring the
 * doctor cockpit's workflow — presence, a live map, an inbox, trip tracking,
 * a wallet — minus the two things a nurse does not have: a gig shelf and a
 * bookable calendar. Availability here is presence, nothing more.
 *
 * Every figure is derived from persisted data through the same hooks the
 * cockpit uses, so nothing on this screen is placeholder content.
 */
export function NurseDashboard({ page = "home" }: { page?: string }) {
  if (page === "requests") return <Requests />;
  if (page === "active") return <ActiveVisits />;
  if (page === "history") return <History />;
  if (page === "earnings") return <Earnings />;
  if (page === "profile") return <Profile />;
  return <Home />;
}

/**
 * Everything the nurse screens read, resolved once. `pending` applies the same
 * predicate the server applies (visibleToProvider), so the list can never show
 * a row the API would refuse — including requests aimed at doctors.
 */
function useNurseData() {
  const me = useCurrentProvider();
  const requests = useConsultRequests();
  const txns = useTransactions();
  const id = me?.id ?? "";

  const ongoing = id ? ongoingConsultOf(requests, id) : undefined;
  const pending = requests.filter(
    (r) =>
      id &&
      r.status === "pending" &&
      visibleToProvider(r, { doctorId: id, busy: Boolean(ongoing), cadre: "nurse" }),
  );
  const accepted = requests.filter((r) => r.status === "accepted" && r.doctorId === id);
  const completed = requests.filter((r) => r.status === "completed" && r.doctorId === id);
  const earnings = txns.filter((t) => t.doctorId === id && t.kind === "earning");

  return { me, requests, pending, accepted, completed, earnings, txns, ongoing };
}

function Home() {
  const { t } = useT();
  const { me, pending, accepted, completed, earnings, ongoing } = useNurseData();
  const reviews = useReviews(me?.id);
  const online = me?.status === "online";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isToday = (iso?: string | null) =>
    Boolean(iso) && new Date(iso!).getTime() >= startOfToday.getTime();

  // Net, not gross — this is what actually lands in the wallet, so the tile
  // agrees with the balance on the payments screen.
  const earningsToday = earnings
    .filter((x) => isToday(x.createdAt))
    .reduce((a, x) => a + x.net, 0);

  const greetKey =
    new Date().getHours() < 12
      ? "greeting.morning"
      : new Date().getHours() < 17
        ? "greeting.afternoon"
        : "greeting.evening";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <header className="lg:col-span-12">
        <p className="label">{t("nurse.space")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream lg:text-4xl">
          {t(greetKey)},{" "}
          <span className="text-[rgb(var(--c-terracotta))]">{me?.fullName ?? ", "}</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">{t("nurse.subtitle")}</p>
      </header>

      {/* Presence, the nurse equivalent of the doctor's shift card. Going
          offline takes her off the patient map entirely.

          GlassCard carries no padding of its own and clips with
          overflow-hidden, so the p-5 is load-bearing, not decoration; h-full on
          the inner flex keeps this level with the card beside it. */}
      <GlassCard className="p-5 lg:col-span-5">
        <div className="flex h-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="label">{t("nurse.shift")}</p>
            <p className="mt-1 truncate text-lg font-semibold text-cream">
              {online ? t("nurse.online") : t("nurse.offline")}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {online ? t("nurse.youAreOnline") : t("nurse.goOnline")}
            </p>
          </div>
          <OnlineToggle doctor={me} variant="inline" />
        </div>
      </GlassCard>

      {/* Scope reminder. A nurse works inside a defined boundary and the
          console says so where she'll actually read it. */}
      <GlassCard className="p-5 lg:col-span-7">
        <div className="flex h-full gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-ok" />
          <div className="min-w-0">
            <p className="font-semibold text-cream">{t("nurse.scopeTitle")}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("nurse.scopeDesc")}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
        <StatCard
          dense
          icon={<Banknote className="h-4 w-4" />}
          value={formatINR(earningsToday)}
          label={t("nurse.earningsToday")}
          sub={t("nurse.earningsTodaySub")}
          href="/nurse/earnings"
        />
        <StatCard
          dense
          icon={<Activity className="h-4 w-4" />}
          value={accepted.length}
          label={t("nurse.activeVisits")}
          sub={t("nurse.activeVisitsSub")}
          href="/nurse/active"
        />
        <StatCard
          dense
          icon={<CircleAlert className="h-4 w-4" />}
          value={pending.length}
          label={t("nurse.openRequests")}
          sub={t("nurse.openRequestsSub")}
          href="/nurse/requests"
        />
        <StatCard
          dense
          icon={<Star className="h-4 w-4" />}
          value={me?.rating ? me.rating.toFixed(1) : t("nurse.ratingNew")}
          label={t("nurse.rating")}
          sub={
            reviews.length
              ? t("nurse.ratingFrom", { n: String(reviews.length) })
              : t("nurse.noReviews")
          }
        />
      </div>

      {/* The live visit, with its trip rail and the patient's start code. The
          same tracker the cockpit uses, a nurse's visit advances through
          exactly the same stages. */}
      {me && (
        <div className="lg:col-span-12">
          <DoctorConsultTracker doctor={me} />
        </div>
      )}

      {/* Patients around her. `self` needs real coordinates, which is why the
          layout mounts the location publisher, without it there is a map but
          no "you", and the whole card reads as broken. */}
      <Card className="overflow-hidden lg:col-span-7">
        <CardHeader label={t("nurse.aroundYou")} title={t("nurse.patientsNearYou")} />
        <div className="p-4">
          <LiveMap
            self={me ? { lat: me.lat, lng: me.lng, label: t("nurse.console") } : null}
            center={me ? { lat: me.lat, lng: me.lng } : undefined}
            // Mirrors the inbox: a request hidden from the list must not
            // still be a pin on the map.
            requests={[...pending, ...accepted]}
            height={320}
          />
        </div>
      </Card>

      <Card className="flex flex-col lg:col-span-5">
        <CardHeader
          label={t("nurse.incoming")}
          title={t("nurse.requestsCount", { n: String(pending.length) })}
          action={
            <Link
              href="/nurse/requests"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {t("nurse.viewAll")}
            </Link>
          }
        />
        <div className="space-y-3 p-4">
          {pending.length ? (
            pending
              .slice(0, INBOX_PREVIEW)
              .map((r) => <NurseRequest key={r.id} request={r} busy={Boolean(ongoing)} />)
          ) : (
            <EmptyState title={t("nurse.noOpenTitle")} desc={t("nurse.noOpenDesc")} />
          )}
        </div>
      </Card>

      <Card className="lg:col-span-12">
        <CardHeader label={t("nurse.workQueue")} title={t("nurse.completedVisits")} />
        <div className="p-4">
          <p className="text-3xl font-semibold text-cream">{completed.length}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t("nurse.completedVisitsSub")}
          </p>
        </div>
      </Card>
    </div>
  );
}

function Requests() {
  const { t } = useT();
  const { pending, ongoing } = useNurseData();
  return (
    <Page
      eyebrow={t("nurse.workQueue")}
      title={t("nurse.requestInbox")}
      intro={t("nurse.requestInboxIntro")}
    >
      {pending.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((r) => (
            <NurseRequest key={r.id} request={r} busy={Boolean(ongoing)} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="p-4">
            <EmptyState title={t("nurse.noOpenTitle")} desc={t("nurse.noOpenDesc")} />
          </div>
        </Card>
      )}
    </Page>
  );
}

function ActiveVisits() {
  const { t } = useT();
  const { me, accepted } = useNurseData();
  return (
    <Page
      eyebrow={t("nurse.inProgress")}
      title={t("nurse.activeTitle")}
      intro={t("nurse.activeIntro")}
    >
      {me && accepted.length > 0 ? (
        <DoctorConsultTracker doctor={me} />
      ) : (
        <Card>
          <div className="p-4">
            <EmptyState title={t("nurse.noActiveTitle")} desc={t("nurse.noActiveDesc")} />
          </div>
        </Card>
      )}
    </Page>
  );
}

function History() {
  const { t } = useT();
  const { completed } = useNurseData();
  return (
    <Page eyebrow={t("nurse.workQueue")} title={t("nurse.completedVisits")}>
      <Card>
        {completed.length ? (
          <div className="divide-y divide-[var(--border)]">
            {completed.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-cream">{r.patientName}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{r.address}</p>
                </div>
                <span className="shrink-0 font-semibold text-[rgb(var(--c-terracotta))]">
                  {formatINR(r.fee)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title={t("nurse.noActiveTitle")} desc={t("nurse.noActiveDesc")} />
          </div>
        )}
      </Card>
    </Page>
  );
}

function Earnings() {
  const { t } = useT();
  const { me, earnings, completed, txns } = useNurseData();
  const actions = useActions();
  const toast = useToast();
  // Net across the whole ledger — earnings add, payouts subtract — so this is
  // the withdrawable balance, not lifetime income.
  const balance = txns.reduce((a, x) => a + x.net, 0);

  return (
    <Page eyebrow={t("nurse.wallet")} title={t("nurse.earnings")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          dense
          icon={<Banknote className="h-4 w-4" />}
          value={formatINR(balance)}
          label={t("nurse.netBalance")}
          sub={t("nurse.netBalanceSub")}
        />
        <StatCard
          dense
          icon={<Inbox className="h-4 w-4" />}
          value={earnings.length}
          label={t("nurse.entries")}
          sub={t("nurse.entriesSub")}
        />
        <StatCard
          dense
          icon={<Stethoscope className="h-4 w-4" />}
          value={completed.length}
          label={t("nurse.completedVisits")}
          sub={t("nurse.completedVisitsSub")}
        />
      </div>

      <Card>
        <CardHeader
          label={t("nurse.wallet")}
          title={t("nurse.ledger")}
          action={
            balance > 0 ? (
              <button
                onClick={async () => {
                  if (!me) return;
                  try {
                    await actions.requestPayout(me.id);
                    toast.push({ tone: "success", title: t("nurse.withdraw") });
                  } catch (e) {
                    toast.push({
                      tone: "error",
                      title: t("nurse.acceptFailed"),
                      desc: e instanceof Error ? e.message : t("nurse.tryAgain"),
                    });
                  }
                }}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:border-white/25"
              >
                {t("nurse.withdraw")}
              </button>
            ) : undefined
          }
        />
        {txns.length ? (
          <div className="divide-y divide-[var(--border)]">
            {txns.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="truncate text-[var(--text-muted)]">
                  {x.patientName ?? t("nurse.wallet")}
                </span>
                <b className={cn(x.net < 0 ? "text-[var(--text-muted)]" : "text-cream")}>
                  {formatINR(x.net)}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title={t("nurse.noEarningsTitle")} desc={t("nurse.noEarningsDesc")} />
          </div>
        )}
      </Card>
    </Page>
  );
}

function Profile() {
  const { t } = useT();
  const { me } = useNurseData();
  const reviews = useReviews(me?.id);
  const { updateDoctor } = useActions();
  const qc = useQueryClient();
  const mounted = useMounted();
  const [editing, setEditing] = useState(false);

  /** Persist a new profile photo. Same path the cockpit uses: the avatar
   *  endpoint writes both the account and the public provider row. */
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

  const mine = new Set(skillsOf(me));
  const st = doctorStatusOf(me.status);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">{t("nurse.patientFacing")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream">
            {t("nurse.profileTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {t("nurse.servicesIntro")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> {t("nurse.editProfile")}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            {/* A photo is required before going online, the same rule the
                cockpit enforces, so it belongs on the same screen. */}
            <AvatarUploader onPhoto={setPhoto}>
              <AvatarImage
                src={me.avatarUrl}
                background={me.avatarColor}
                className="h-16 w-16 rounded-xl font-serif text-2xl text-cream"
                fallback={initials(me.fullName)}
              />
            </AvatarUploader>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-serif text-2xl text-cream">{me.fullName}</h2>
                {me.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-status-ok" />}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <HeartPulse className="h-3.5 w-3.5" /> {me.specialty}
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
            <FeeTile label={t("nurse.feeLabel")} value={formatINR(me.homeVisitFee)} />
            <FeeTile
              label={t("nurse.experienceYrs")}
              value={`${me.experienceYears} yr${me.experienceYears === 1 ? "" : "s"}`}
            />
          </div>

          <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <div className="label">{t("nurse.whatPatientsSee")}</div>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-salmon transition-colors hover:text-cream"
              >
                {t("nurse.edit")}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              {me.about?.trim() || t("nurse.noAbout")}
            </p>
            <CredLine
              icon={<Award className="h-4 w-4 text-salmon" />}
              label={t("nurse.qualification")}
              value={me.qualifications || t("nurse.notAdded")}
            />
            <CredLine
              icon={<ShieldCheck className="h-4 w-4 text-salmon" />}
              label={t("nurse.councilNo")}
              value={me.registrationNo || t("nurse.notAdded")}
            />
            <CredLine
              icon={<LanguagesIcon className="h-4 w-4 text-salmon" />}
              label={t("nurse.languages")}
              value={me.languages.join(", ") || ", "}
            />
            <CredLine
              icon={<MapPin className="h-4 w-4 text-salmon" />}
              label={t("nurse.servingArea")}
              value={`${me.lat.toFixed(3)}, ${me.lng.toFixed(3)}`}
            />
          </div>

          {!me.avatarUrl && (
            <p className="mt-4 rounded-xl border border-tan/30 bg-tan/10 px-3.5 py-2.5 text-xs leading-relaxed text-tan">
              {t("nurse.photoRequired")}
            </p>
          )}

          <div className="mt-5">
            <OnlineToggle doctor={me} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              label={t("nurse.patientFacing")}
              title={t("nurse.services")}
              action={
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-salmon transition-colors hover:text-cream"
                >
                  {t("nurse.edit")}
                </button>
              }
            />
            <div className="p-4">
              <div className="grid gap-2">
                {NURSE_SERVICES.map((s) => {
                  const on = mine.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 text-sm",
                        on
                          ? "border-[rgb(var(--c-terracotta))]/40 bg-white/[0.04] text-cream"
                          : "border-[var(--border)] text-[var(--text-faint)]",
                      )}
                    >
                      <span>{s.label}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-status-ok" />}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-[var(--text-faint)]">
                {t("nurse.cannotPrescribe")}
              </p>
            </div>
          </Card>

          <Card id="reviews" className="scroll-mt-24">
            <CardHeader
              label={t("nurse.reviewsEyebrow")}
              title={t("nurse.reviewsTitle", { n: String(reviews.length) })}
            />
            {reviews.length === 0 ? (
              <div className="p-4">
                <EmptyState title={t("nurse.noReviews")} />
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {reviews.map((r) => (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-cream">{r.patientName}</span>
                      <span className="flex items-center gap-0.5 text-tan">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-tan" />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">“{r.comment}”</p>
                    <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                      {mounted ? timeAgo(r.createdAt) : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EditNurseProfileDialog nurse={me} open={editing} onClose={() => setEditing(false)} />
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
        <div className="break-words text-sm text-cream">{value}</div>
      </div>
    </div>
  );
}

/**
 * One request in the nurse's queue. Wraps the shared RequestCard so a nurse's
 * inbox looks and behaves exactly like a doctor's — the accept/decline
 * semantics, the offline rule and the busy rule are all the platform's, not
 * this screen's.
 */
function NurseRequest({ request, busy }: { request: ConsultRequestRow; busy: boolean }) {
  const { t } = useT();
  const { me } = useNurseData();
  const actions = useActions();
  const toast = useToast();
  const [working, setWorking] = useState(false);

  const offline = !me || me.status === "offline";
  const canAccept = !offline && !busy && !working;

  return (
    <RequestCard
      request={request}
      canAccept={canAccept}
      blockedReason={offline ? t("nurse.offlineBlocked") : undefined}
      onAccept={async () => {
        if (!me) return;
        setWorking(true);
        try {
          await actions.acceptRequest(request.id, me.id);
          toast.push({
            tone: "success",
            title: t("nurse.acceptedToast"),
            desc: request.patientName,
          });
        } catch (e) {
          toast.push({
            tone: "error",
            title: t("nurse.acceptFailed"),
            desc: e instanceof Error ? e.message : t("nurse.tryAgain"),
          });
        } finally {
          setWorking(false);
        }
      }}
      onDecline={() => me && actions.declineRequest(request.id, me.id)}
    />
  );
}

type ConsultRequestRow = Parameters<typeof RequestCard>[0]["request"];

function Page({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="label">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream">{title}</h1>
        {intro && <p className="mt-1.5 text-sm text-[var(--text-muted)]">{intro}</p>}
      </div>
      {children}
    </div>
  );
}
