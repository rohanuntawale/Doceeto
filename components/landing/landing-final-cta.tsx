import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingFinalCta() {
  return (
    <section className="bg-[var(--surface)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="label">Ready for care?</p>
        <h2 className="mt-4 text-4xl font-serif tracking-tight text-[var(--text)] sm:text-5xl">
          Your care journey starts here.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
          Whether you need treatment or you are ready to support patients,
          everything begins from the same signup door.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              I need care
            </Button>
          </Link>

          <Link href="/signup?as=doctor" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              I&apos;m a doctor
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
