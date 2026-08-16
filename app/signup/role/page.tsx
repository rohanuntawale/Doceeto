import { Suspense } from "react";
import Link from "next/link";
import { HeartHandshake, Stethoscope, Syringe } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { RoleCta } from "@/components/ui/role-cta";

export const dynamic = "force-dynamic";

/**
 * "What are you here as?"
 *
 * Google proves who somebody is and says nothing about what they do, so a
 * first-time visitor who pressed a plain "Continue with Google" used to be
 * filed as a patient by default. This is the missing question.
 *
 * Each choice restarts the OAuth exchange with an explicit role. Google does
 * not re-prompt (they are already signed in there), so it reads as a single
 * step rather than a second sign-in, and the callback then knows to create a
 * patient outright or send a provider on to the credentials form.
 */
function Chooser({ next }: { next?: string }) {
  const start = (role: "patient" | "doctor" | "nurse") => {
    const p = new URLSearchParams({ role });
    if (next) p.set("next", next);
    return `/api/auth/google/start?${p.toString()}`;
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Wordmark compact={false} />
        </div>

        <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card sm:p-8">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--text)]">
            One quick thing
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Google told us who you are. It cannot tell us what you do here, and
            a patient account and a practitioner account are different things.
            Pick the one that fits.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <RoleCta
              href={start("patient")}
              icon={HeartHandshake}
              label="I need care"
              caption="Book a doctor or nurse, at home or online"
              primary
            />
            <RoleCta
              href={start("doctor")}
              icon={Stethoscope}
              label="I'm a doctor"
              caption="You will add your registration and fees next"
            />
            <RoleCta
              href={start("nurse")}
              icon={Syringe}
              label="I'm a nurse"
              caption="You will add your council number and services next"
            />
          </div>

          <p className="mt-6 text-xs leading-relaxed text-[var(--text-faint)]">
            Practitioners are verified before any patient can book them, so
            have your registration number to hand.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Wrong account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ChooseRolePage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Chooser next={searchParams.next} />
    </Suspense>
  );
}
