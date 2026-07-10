import Link from "next/link";
import { ArrowRight, Stethoscope, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteMenu } from "@/components/site/site-menu";
import { isDemoMode } from "@/lib/config";

const ENTRIES = [
  {
    href: "/patient",
    kanji: "患",
    title: "Patient app",
    sub: "SOS · find a doctor · medicine",
    icon: <HeartPulse className="h-4 w-4" />,
  },
  {
    href: "/doctor",
    kanji: "助",
    title: "Doctor cockpit",
    sub: "Go online · take requests · earn",
    icon: <Stethoscope className="h-4 w-4" />,
  },
];

const PILLARS = [
  { kanji: "助", name: "Tasuke", role: "the button" },
  { kanji: "医", name: "Zumi", role: "the doctor" },
  { kanji: "検", name: "Kenshin", role: "the network" },
  { kanji: "薬", name: "AuraMed", role: "the medicine" },
];

export default function Landing() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.12fr_0.88fr]">
      {/* ── Left: the pitch ─────────────────────────────── */}
      <section className="relative flex flex-col justify-between overflow-hidden px-7 py-9 sm:px-10 md:px-16 md:py-12">
        {/* ambient terracotta glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(193,90,56,0.35), transparent 65%)",
          }}
        />

        {/* top bar */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-terracotta font-jp text-lg text-cream shadow-[0_0_22px_rgba(193,90,56,0.5)]">
              癒
            </span>
            <div className="leading-none">
              <div className="font-serif text-base tracking-tight text-cream">
                Iyashi <span className="text-[var(--text-faint)]">Health</span>
              </div>
              <div className="mt-0.5 font-jp text-[10px] tracking-[0.2em] text-[var(--text-faint)]">
                癒し · HEALING
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {isDemoMode ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-terracotta/12 px-3 py-1.5 text-[11px] font-medium text-salmon ring-1 ring-terracotta/25 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
                LIVE DEMO
              </span>
            ) : (
              <span className="label hidden sm:inline">EST · 2026</span>
            )}
            <SiteMenu />
          </div>
        </div>

        {/* hero */}
        <div className="relative max-w-xl">
          <div className="animate-rise flex items-center gap-3" style={{ animationDelay: "40ms" }}>
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">One front door to care</span>
          </div>

          <h1
            className="animate-rise mt-5 font-serif text-[4.25rem] leading-[0.9] tracking-tight text-cream sm:text-[5.5rem] md:text-[6.5rem]"
            style={{ animationDelay: "90ms" }}
          >
            Iyashi
          </h1>
          <div
            className="animate-rise mt-4 h-1 w-20 rounded-full bg-terracotta"
            style={{ animationDelay: "140ms" }}
          />

          <p
            className="animate-rise mt-8 font-serif text-3xl text-cream md:text-4xl"
            style={{ animationDelay: "190ms" }}
          >
            Healing, <span className="text-salmon">on demand.</span>
          </p>
          <p
            className="animate-rise mt-4 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]"
            style={{ animationDelay: "240ms" }}
          >
            One platform for the moments that matter — emergencies, doctors, and
            medicine, brought to the instant they’re needed.
          </p>

          {/* primary CTAs */}
          <div
            className="animate-rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "280ms" }}
          >
            <Link href="/register">
              <Button size="lg">
                Register <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
            <span className="text-xs text-[var(--text-faint)]">
              as a patient or a doctor
            </span>
          </div>

          {/* quick entry cards */}
          <div
            className="animate-rise mt-8"
            style={{ animationDelay: "340ms" }}
          >
            <div className="label mb-3">Or explore a surface</div>
            <div className="flex flex-col gap-2.5">
              {ENTRIES.map((e) => (
                <EntryLink key={e.href} {...e} />
              ))}
            </div>
          </div>

          {isDemoMode && (
            <p
              className="animate-rise mt-4 text-xs text-[var(--text-faint)]"
              style={{ animationDelay: "400ms" }}
            >
              Tip: open the <span className="text-salmon">Patient app</span> and{" "}
              <span className="text-salmon">Doctor cockpit</span> in two tabs — a
              request you raise shows up live for the doctor.
            </p>
          )}
        </div>

        {/* footer: pillars + contact */}
        <div className="relative mt-10 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {PILLARS.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="font-jp text-sm text-terracotta">{p.kanji}</span>
                <span className="text-sm text-cream">{p.name}</span>
                <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
                  {p.role}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-5 text-xs text-[var(--text-muted)]">
            <Link href="/about" className="transition-colors hover:text-cream">
              About us
            </Link>
            <Link href="/contact" className="transition-colors hover:text-cream">
              Contact
            </Link>
            <span className="text-[var(--text-faint)]">© 2026 Iyashi Health</span>
          </div>
        </div>
      </section>

      {/* ── Right: terracotta plate ─────────────────────── */}
      <section className="relative hidden items-center justify-center overflow-hidden bg-terracotta lg:flex">
        {/* depth layers of the kanji */}
        <span className="absolute font-jp text-[34rem] leading-none text-black/[0.07] select-none">
          癒
        </span>
        <span className="animate-float font-jp text-[24rem] leading-none text-black/15 select-none">
          癒
        </span>

        {/* light sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* vignette + hairline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 70% 20%, transparent 40%, rgba(0,0,0,0.28))",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-px bg-black/20" />

        {/* vertical module romaji */}
        <div className="absolute right-7 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-mono text-xs tracking-[0.35em] text-cream/75">
          TASUKE / ZUMI / KENSHIN / AURAMED
        </div>

        {/* caption block */}
        <div className="absolute bottom-9 left-9">
          <div className="font-jp text-lg text-cream/80">癒し</div>
          <div className="mt-1 font-serif text-2xl text-cream">Healing, delivered.</div>
          <div className="mt-1 text-xs text-cream/60">
            One button · one doctor · one network.
          </div>
        </div>
      </section>
    </main>
  );
}

function EntryLink({
  href,
  title,
  sub,
  kanji,
  icon,
}: {
  href: string;
  title: string;
  sub: string;
  kanji: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 overflow-hidden rounded-card border border-[var(--border)] bg-espresso-800/80 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-terracotta/50 hover:bg-espresso-800"
    >
      {/* accent hairline that lights up on hover */}
      <span className="absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-terracotta to-transparent transition-transform duration-300 group-hover:scale-x-100" />
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-terracotta/12 font-jp text-lg text-salmon ring-1 ring-inset ring-terracotta/20 transition-colors group-hover:bg-terracotta group-hover:text-cream">
        {kanji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-cream">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--text-faint)]">
          {sub}
        </span>
      </span>
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-faint)] transition-colors group-hover:text-terracotta">
        <span className="hidden sm:inline">Enter</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
