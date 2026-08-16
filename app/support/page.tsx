import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileText,
  HeartPulse,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COMPANY, CONTACTS, correspondenceAddress } from "@/lib/legal/company";
import { LEGAL_DOCS, legalHref } from "@/lib/legal/documents";

export const metadata = {
  title: "Support · Doceeto",
  description:
    "Everything about Doceeto in one place: how it works, who we are, how providers are verified, how to reach us, and every policy we publish.",
};

/**
 * Support: one page that answers "what is this and who do I talk to".
 *
 * Deliberately a HUB rather than a contact form. Someone who clicks "Support"
 * is usually one of four people — a patient with a problem right now, a
 * provider with an account question, someone deciding whether to trust the
 * platform, or a regulator looking for a policy — and only one of those four
 * wants a text box. The form is here, at the bottom, after the answers.
 *
 * The emergency notice comes first for the same reason it does on the urgent
 * care page: whatever else this page is for, it must not be the thing standing
 * between someone and an ambulance.
 */

const HOW_IT_WORKS = [
  {
    icon: MessageSquare,
    title: "Say what's wrong",
    body: "Describe a symptom in plain words, or pick the care you already know you need. The symptom checker points you at the right specialty.",
  },
  {
    icon: Users,
    title: "It goes out to everyone free nearby",
    body: "You don't chase a doctor. The request reaches every verified provider in range at once, and the first to accept takes it, the rest see it disappear.",
  },
  {
    icon: HeartPulse,
    title: "They come to you, or you meet online",
    body: "A home visit, a clinic appointment or a video consult. You see the fee before you book, and you follow the trip on a map.",
  },
  {
    icon: ShieldCheck,
    title: "A 4-digit code confirms it happened",
    body: "At the door you read a code aloud that only you were given. The visit isn't marked complete, and nobody is paid, until you do.",
  },
];

const AUDIENCES = [
  {
    icon: HeartPulse,
    title: "I need care",
    body: "Browse doctors and nurses, check a symptom, or find someone free right now.",
    href: "/try/urgent",
    cta: "See who's free",
  },
  {
    icon: Stethoscope,
    title: "I'm a doctor or nurse",
    body: "Set your own fees and hours, take the requests you want, and get paid per completed visit.",
    href: "/signup?as=doctor",
    cta: "Join as a provider",
  },
  {
    icon: Building2,
    title: "Press, partnerships, investors",
    body: "Company background, the problem we're working on, and how to reach the team.",
    href: "/about",
    cta: "About Doceeto",
  },
];

const FAQS = [
  {
    q: "Is Doceeto an emergency service?",
    a: "No. For chest pain, trouble breathing, heavy bleeding, a seizure or a suspected stroke, call 112. Doceeto is for care that needs a doctor soon, not care that needs an ambulance now.",
  },
  {
    q: "How do you check that a doctor is real?",
    a: "Every provider is reviewed by our team before they can be found by patients, registration number, qualifications and identity. Nurses are checked before they can ever be sent to a home. An unverified provider is not discoverable at all.",
  },
  {
    q: "What does it cost?",
    a: "The provider sets their own fee and you see it before you book. There is no charge to create an account, and no booking fee on top of the consultation.",
  },
  {
    q: "Can I get a prescription?",
    a: "A doctor can issue one after a consultation, and it arrives as a document you can share with any pharmacy. Nurses cannot prescribe, that stays with doctors.",
  },
  {
    q: "Where does Doceeto work?",
    a: "Nagpur first, and growing outward from there. If nobody is online in your area yet, an account means you're told when that changes.",
  },
  {
    q: "How do I delete my account and data?",
    a: "From your account settings, or by writing to the address below. What we keep afterwards, and for how long, is set out in the Privacy Policy and the Data Deletion policy.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" />
            <span className="label">Support</span>
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-tight text-[var(--text)] md:text-5xl">
            How Doceeto works, and who to ask.
          </h1>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            {COMPANY.legalName} runs a marketplace that sends verified doctors and nurses to
            patients. Everything we publish about how that works is on this page.
          </p>
        </div>

        {/* Before anything else. */}
        <Card className="mt-8 flex flex-col gap-3 border-status-critical/40 bg-status-critical/5 p-5 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-status-critical" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text)]">
              In an emergency, call 112, don&apos;t wait for us
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Doceeto is not an emergency service and cannot dispatch an ambulance.{" "}
              <Link href="/legal/emergency" className="underline underline-offset-2">
                Read what we can and cannot do
              </Link>
            </p>
          </div>
          <a href="tel:112" className="shrink-0">
            <Button variant="danger" size="sm">
              <Phone className="h-3.5 w-3.5" />
              Call 112
            </Button>
          </a>
        </Card>

        {/* ── Who are you ── */}
        <Section title="Start here" label="01">
          <div className="grid gap-3 sm:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, body, href, cta }) => (
              <Card key={title} className="flex flex-col p-5">
                <Icon className="h-5 w-5 text-terracotta" />
                <h3 className="mt-3 font-serif text-lg text-[var(--text)]">{title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-[var(--text-muted)]">{body}</p>
                <Link href={href} className="mt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    {cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </Section>

        {/* ── The mechanism ── */}
        <Section title="How a visit actually happens" label="02">
          {/* Numbered because it IS a sequence, each step only makes sense
              after the one before it. */}
          <ol className="grid gap-px overflow-hidden rounded-card border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="bg-[var(--surface)] p-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold tabular-nums text-[var(--text-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="h-4 w-4 text-terracotta" />
                </div>
                <h3 className="mt-2.5 font-serif text-lg text-[var(--text)]">{title}</h3>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── FAQ ── */}
        <Section title="Common questions" label="03">
          <div className="divide-y divide-[var(--border)] rounded-card border border-[var(--border)]">
            {FAQS.map(({ q, a }) => (
              // <details> rather than a JS accordion: it opens without
              // hydration, it's keyboard-navigable for free, and the browser's
              // find-in-page can reach the answers inside it.
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[var(--text)] marker:hidden">
                  {q}
                  <span className="shrink-0 text-[var(--text-faint)] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-muted)]">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* ── Contact ── */}
        <Section title="Reach a person" label="04">
          <div className="grid gap-3 sm:grid-cols-2">
            <ContactCard
              icon={MessageSquare}
              title="Something's wrong with my account or a visit"
              detail={CONTACTS.support}
              href={`mailto:${CONTACTS.support}`}
            />
            <ContactCard
              icon={HeartPulse}
              title="A complaint about the care itself"
              detail={CONTACTS.medical}
              href={`mailto:${CONTACTS.medical}`}
            />
            <ContactCard
              icon={ShieldCheck}
              title="My data, or a privacy question"
              detail={CONTACTS.privacy}
              href={`mailto:${CONTACTS.privacy}`}
            />
            <ContactCard
              icon={FileText}
              title="A formal grievance"
              detail={CONTACTS.grievance}
              href="/legal/grievance"
            />
          </div>

          <Card className="mt-3 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Rather write it out?
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  The contact form reaches the same inbox, and you don&apos;t need an account.
                </p>
              </div>
              <Link href="/contact" className="shrink-0">
                <Button size="sm">
                  <Mail className="h-3.5 w-3.5" />
                  Open the form
                </Button>
              </Link>
            </div>
            {correspondenceAddress().length > 0 && (
              <address className="mt-4 border-t border-[var(--border)] pt-4 text-xs not-italic leading-relaxed text-[var(--text-muted)]">
                {correspondenceAddress().map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            )}
          </Card>
        </Section>

        {/* ── Policies ── */}
        <Section title="Everything we publish" label="05">
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Every policy, in full. Nothing here is summarised away, {" "}
            <Link href="/legal" className="underline underline-offset-2">
              the legal hub
            </Link>{" "}
            groups them by who needs to read which.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {LEGAL_DOCS.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={legalHref(doc.slug)}
                  className="flex items-start gap-2.5 rounded-card border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--surface)]"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-faint)]" />
                  <span className="min-w-0">
                    <span className="block text-sm text-[var(--text)]">{doc.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {doc.audience}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <SiteFooter />
    </main>
  );
}

function Section({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs font-semibold tabular-nums text-[var(--text-faint)]">{label}</span>
        <h2 className="font-serif text-2xl text-[var(--text)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ContactCard({
  icon: Icon,
  title,
  detail,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-card border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface)]"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
      <span className="min-w-0">
        <span className="block text-sm text-[var(--text)]">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{detail}</span>
      </span>
    </Link>
  );
}
