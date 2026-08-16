import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  P,
  H3,
  UL,
  LI,
  OL,
  OLI,
  T,
  Xref,
  MailLink,
  Callout,
  Table,
} from "@/components/legal/prose";
import { COMPANY, CONTACTS } from "@/lib/legal/company";
import { docBySlug } from "@/lib/legal/documents";

const doc = docBySlug("security")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/security" },
};

export default function SecurityPage() {
  return (
    <LegalDocument
      slug="security"
      lead={
        <>
          How {COMPANY.brand} protects health data, what we do when something
          goes wrong, and the terms under which security researchers can test us
          without fear of being sued.
        </>
      }
      intro={
        <Callout tone="info" title="Found something? Tell us.">
          <P>
            Report vulnerabilities to{" "}
            <a
              href={`mailto:${CONTACTS.security}`}
              className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2"
            >
              {CONTACTS.security}
            </a>
            . We acknowledge within <strong>72 hours</strong>. Good-faith
            research under the rules below is authorised, and we will not pursue
            legal action over it.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "how-we-protect",
          title: "How data is protected",
          content: (
            <>
              <H3>In transit</H3>
              <UL>
                <LI>
                  All traffic is HTTPS over modern TLS. Plain HTTP is redirected
                  and never serves data.
                </LI>
                <LI>
                  Session cookies are marked <T>Secure</T>, so they are never
                  transmitted unencrypted.
                </LI>
              </UL>

              <H3>At rest</H3>
              <UL>
                <LI>
                  The database is encrypted at rest by our hosting provider,
                  including backups.
                </LI>
                <LI>
                  Passwords are stored only as <T>bcrypt</T> hashes with a
                  per-password salt. We cannot read your password and neither
                  can anyone who obtains the database.
                </LI>
                <LI>
                  Accounts created through Google carry no password at all, and
                  the sign-in route refuses a password attempt against them
                  so a Google-only account cannot be entered with a guessed empty
                  password.
                </LI>
              </UL>

              <H3>Sessions and access</H3>
              <UL>
                <LI>
                  A session is a <T>row in the database</T>. Your browser holds
                  only an opaque random identifier in an httpOnly, Secure,
                  SameSite cookie, no role, no user id, nothing signed that
                  could be forged or replayed after a privilege change.
                </LI>
                <LI>
                  Deleting that row ends the session <T>immediately</T>, on one
                  device or on all of them. There is no window in which a revoked
                  token still works.
                </LI>
                <LI>
                  One cookie per role, so a patient session and a provider
                  session on the same browser cannot be confused for each other,
                  and neither can act as the other.
                </LI>
                <LI>
                  <T>Authorisation is enforced server-side</T> on every API
                  route, and again in the page layer before anything renders.
                  Each role reads and writes only the records it is entitled to.
                </LI>
                <LI>
                  Production access is limited to the smallest necessary group,
                  over authenticated connections, and administrative actions
                  against records are written to an <T>audit log</T>.
                </LI>
              </UL>

              <H3>In the product</H3>
              <UL>
                <LI>
                  <T>Arrival codes.</T> A four-digit code visible only to the
                  patient confirms a home visit. It is never shown to a provider
                  or to our operations team, and it locks after five wrong
                  attempts.
                </LI>
                <LI>
                  <T>Prescription links.</T> Shared prescriptions sit behind a
                  long, unguessable token, uniquely indexed and revocable. Anyone
                  holding the link can read the document, that limitation is
                  disclosed to patients in the{" "}
                  <Xref href="/legal/privacy#sharing">Privacy Policy</Xref>.
                </LI>
                <LI>
                  <T>Rate limiting</T> on authentication and other sensitive
                  endpoints, to blunt credential stuffing and enumeration.
                </LI>
                <LI>
                  <T>Least data.</T> The AI symptom checker is sent clinical
                  context but never your name, email, phone number or account
                  identifier.
                </LI>
              </UL>
              <P>
                No system is perfectly secure, and we will not claim otherwise.
                What we commit to is defending it properly, and telling you
                promptly when we fail.
              </P>
            </>
          ),
        },
        {
          id: "breach",
          title: "If there is a breach",
          content: (
            <>
              <P>
                Section 8(6) of the <T>DPDP Act, 2023</T> requires notification
                of both the Data Protection Board of India and every affected
                person. Separately, <T>CERT-In</T> directions require certain
                incidents to be reported to CERT-In within{" "}
                <T>six hours</T> of becoming aware of them. We do both.
              </P>
              <OL>
                <OLI>
                  <T>Contain</T>, cut off the access path, and revoke affected
                  sessions and credentials.
                </OLI>
                <OLI>
                  <T>Assess</T>, establish what data was reached, whose, and
                  what the realistic consequence is.
                </OLI>
                <OLI>
                  <T>Report to CERT-In</T> within six hours where the incident
                  falls within their directions.
                </OLI>
                <OLI>
                  <T>Notify the Data Protection Board and affected people</T>{" "}
                  without undue delay, describing what happened, what data was
                  involved, what we have done, and what you should do.
                </OLI>
                <OLI>
                  <T>Remediate and publish</T>, fix the cause, and write up what
                  went wrong.
                </OLI>
              </OL>
              <Callout tone="ok" title="We will not wait for certainty">
                <P>
                  A notification that arrives late because we wanted a complete
                  picture is a notification that arrives after the damage. If we
                  know your data was involved, you will hear from us before we
                  have every answer, and we will say plainly what we do not yet
                  know.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "disclosure",
          title: "Reporting a vulnerability",
          content: (
            <>
              <P>
                Email <MailLink address={CONTACTS.security} />. Please include
                the affected endpoint or screen, reproduction steps, what an
                attacker could achieve, and any proof-of-concept.
              </P>
              <Table
                columns={["Stage", "Our commitment"]}
                rows={[
                  ["Acknowledgement", "Within 72 hours"],
                  ["Initial assessment and severity", "Within 7 days"],
                  ["Fix for a critical issue", "Target 14 days"],
                  ["Fix for a high or medium issue", "Target 30 to 90 days"],
                  [
                    "Public credit",
                    "With your permission, once the fix has shipped",
                  ],
                ]}
              />
              <P>
                We ask for <T>90 days</T> before public disclosure, or until a
                fix has shipped if sooner. Where an issue is being actively
                exploited we will move much faster and will say so.
              </P>
            </>
          ),
        },
        {
          id: "safe-harbour",
          title: "Safe harbour for good-faith research",
          content: (
            <>
              <Callout tone="ok" title="Authorised testing">
                <P>
                  Research conducted within the rules below is{" "}
                  <strong>authorised by us</strong>. We will not initiate or
                  support legal action against you for it, including under the
                  Information Technology Act, 2000, and we will make that
                  position clear if a third party comes after you over it.
                </P>
              </Callout>
              <H3>Stay within these rules</H3>
              <UL>
                <LI>
                  <T>Use your own test accounts.</T> Never access, modify or
                  retain another person&rsquo;s data. Health records belong to
                  real people, and reading one is a harm even in the course of
                  proving a point.
                </LI>
                <LI>
                  <T>Stop at proof.</T> The moment you have confirmed a
                  vulnerability, stop and report it. Do not pivot, escalate
                  further, or explore what else is reachable.
                </LI>
                <LI>
                  <T>Do not degrade the service.</T> No denial-of-service, no
                  load testing, no automated scanning heavy enough to affect
                  availability. Someone may be booking an ambulance.
                </LI>
                <LI>
                  <T>Do not touch production data.</T> No deleting, corrupting or
                  exfiltrating anything.
                </LI>
                <LI>
                  <T>No social engineering</T> of our staff, providers, patients
                  or suppliers. No phishing, no physical intrusion.
                </LI>
                <LI>
                  <T>Report promptly</T>, and keep the details confidential until
                  we agree on disclosure.
                </LI>
              </UL>
              <H3>Out of scope</H3>
              <UL>
                <LI>
                  Findings from automated scanners with no demonstrated
                  exploitability.
                </LI>
                <LI>
                  Missing security headers, cookie flags or TLS configuration
                  preferences with no working attack behind them.
                </LI>
                <LI>
                  Rate-limiting or brute-force reports without a demonstrated
                  impact.
                </LI>
                <LI>Self-XSS, clickjacking on pages with no sensitive action, or missing SPF/DMARC on non-mailing domains.</LI>
                <LI>
                  Vulnerabilities in third-party services we merely use, report
                  those to them.
                </LI>
                <LI>Attacks requiring physical access to an unlocked device.</LI>
                <LI>
                  Anything requiring a compromised account you did not lawfully
                  obtain.
                </LI>
              </UL>
              <P>
                We do not currently run a paid bounty. We do offer public credit
                and a genuinely fast, respectful response, and if you tell us
                about something serious, you will deal with an engineer, not a
                ticketing queue.
              </P>
            </>
          ),
        },
        {
          id: "your-part",
          title: "Keeping your own account safe",
          content: (
            <>
              <UL>
                <LI>
                  Use a long, unique password, or sign in with Google. Never
                  reuse a password you use elsewhere.
                </LI>
                <LI>
                  Sign out on shared devices, and use{" "}
                  <T>sign out of all devices</T> if you suspect anything.
                </LI>
                <LI>
                  <T>We will never ask for your password</T>, an OTP, or your
                  arrival code. Nobody from {COMPANY.brand} has any reason to,
                  and anyone who does is not from {COMPANY.brand}.
                </LI>
                <LI>
                  Do not forward a prescription link to anyone you would not hand
                  the paper prescription to.
                </LI>
                <LI>
                  Report anything suspicious to{" "}
                  <MailLink address={CONTACTS.security} />, and financial fraud
                  to the national cyber-crime helpline on <T>1930</T>.
                </LI>
              </UL>
            </>
          ),
        },
      ]}
    />
  );
}
