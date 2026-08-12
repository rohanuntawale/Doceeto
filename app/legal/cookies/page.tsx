import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  P,
  H3,
  UL,
  LI,
  T,
  Xref,
  MailLink,
  Callout,
  Table,
} from "@/components/legal/prose";
import { COMPANY, CONTACTS } from "@/lib/legal/company";
import { docBySlug } from "@/lib/legal/documents";

const doc = docBySlug("cookies")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/cookies" },
};

/** Monospace inline code — cookie and storage keys are literals users can
 *  actually go and look for in their browser, so they are set in mono. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded bg-espresso-700 px-1.5 py-0.5 font-mono text-[12.5px] text-cream">
      {children}
    </code>
  );
}

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      slug="cookies"
      lead={
        <>
          Every cookie {COMPANY.brand} sets, itemised. There are seven, they are
          all strictly necessary, and none of them are for advertising or
          tracking you across the web.
        </>
      }
      intro={
        <Callout tone="ok" title="No trackers, no ad pixels, no consent banner">
          <P>
            We run no advertising network, no third-party analytics tag, no
            social pixel and no cross-site profiling. Because every cookie we set
            is strictly necessary to deliver a service you asked for, none of
            them require prior consent — and that is why you are not greeted by
            a banner asking for it.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "what",
          title: "What a cookie is here",
          content: (
            <>
              <P>
                A cookie is a small text file a site stores in your browser and
                reads back on later requests. We use them for exactly one thing:{" "}
                <T>remembering that you are signed in</T>, so you are not asked
                for your password on every page.
              </P>
              <P>
                We also use your browser&rsquo;s <T>local storage</T>, which
                works similarly but never travels to our servers. Those keys are
                listed further down.
              </P>
              <P>
                Some cookie names begin with <Key>iyashi_</Key> — our internal
                codename. They are ours; see{" "}
                <Xref href="/legal/privacy#who-we-are">who we are</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "cookies-we-set",
          title: "The cookies we set",
          content: (
            <>
              <Table
                columns={["Name", "Purpose", "Lifetime", "Type"]}
                rows={[
                  [
                    <Key key="p">iyashi_sid_patient</Key>,
                    "Your patient session. Holds nothing but an opaque random identifier — no name, no role, no user id, nothing signed. The matching row in our database is what actually says who you are.",
                    "Until sign-out or expiry",
                    "Strictly necessary",
                  ],
                  [
                    <Key key="d">iyashi_sid_doctor</Key>,
                    "The same, for a doctor signed into the cockpit.",
                    "Until sign-out or expiry",
                    "Strictly necessary",
                  ],
                  [
                    <Key key="n">iyashi_sid_nurse</Key>,
                    "The same, for a nurse.",
                    "Until sign-out or expiry",
                    "Strictly necessary",
                  ],
                  [
                    <Key key="o">iyashi_sid_ops</Key>,
                    "The same, for our operations team.",
                    "Until sign-out or expiry",
                    "Strictly necessary",
                  ],
                  [
                    <Key key="oa">iyashi_oauth</Key>,
                    "Holds an in-flight Sign in with Google attempt — the state value to echo back and the PKCE verifier, which together stop someone hijacking the sign-in.",
                    "Minutes; deleted the moment sign-in completes",
                    "Strictly necessary",
                  ],
                  [
                    <Key key="ps">iyashi_pending_signup</Key>,
                    "Points at a verified Google identity that has not become an account yet — a doctor part-way through filling in their practice profile.",
                    "Until the sign-up finishes or expires",
                    "Strictly necessary",
                  ],
                ]}
              />
              <H3>How they are protected</H3>
              <UL>
                <LI>
                  <T>httpOnly</T> — JavaScript cannot read them, so a
                  cross-site scripting flaw cannot steal your session.
                </LI>
                <LI>
                  <T>Secure</T> — sent only over HTTPS.
                </LI>
                <LI>
                  <T>SameSite</T> — not sent on cross-site requests, which blocks
                  cross-site request forgery.
                </LI>
                <LI>
                  <T>Opaque</T> — the value is a random identifier and carries no
                  information about you. Tampering with it grants nothing.
                </LI>
                <LI>
                  <T>Revocable</T> — deleting the session row ends the session
                  instantly. Signing out with &ldquo;all devices&rdquo; ends every
                  one.
                </LI>
              </UL>
              <P>
                One cookie <T>per role</T> is deliberate: it lets a patient and a
                doctor be signed in on the same browser without either replacing
                the other. Each surface reads only its own.
              </P>
              <H3>Retired cookies</H3>
              <P>
                Earlier versions used <Key>iyashi_session</Key>,{" "}
                <Key>iyashi_session_patient</Key>,{" "}
                <Key>iyashi_session_doctor</Key>,{" "}
                <Key>iyashi_session_nurse</Key> and{" "}
                <Key>iyashi_session_ops</Key>, which carried a signed token. They
                are cleared on sight and never honoured — a self-describing token
                must not be trusted now that the database is the authority on who
                you are.
              </P>
            </>
          ),
        },
        {
          id: "local-storage",
          title: "Local storage on your device",
          content: (
            <>
              <P>
                These stay in your browser. They are <T>never transmitted to
                us</T> and are cleared by clearing site data.
              </P>
              <Table
                columns={["Key", "Holds"]}
                rows={[
                  [
                    <Key key="lang">iyashi:lang:v1</Key>,
                    "Your chosen language — English, Hindi or Marathi.",
                  ],
                  [
                    <Key key="mh">iyashi:medhistory:v1</Key>,
                    "A local copy of your recent symptom-checker sessions, so a check survives a page refresh.",
                  ],
                  [
                    <Key key="mho">iyashi:medhistory:owner</Key>,
                    "Which account the cached history belongs to, so it is discarded if a different person signs in on this device.",
                  ],
                  [
                    <Key key="bmi">doceeto:bmi-tip</Key>,
                    "Which BMI tip you last saw, so the same one is not repeated.",
                  ],
                  [
                    <Key key="guide">iyashi:guide-dismissed:v1</Key>,
                    "That you dismissed the onboarding guide.",
                  ],
                  [
                    <Key key="did">iyashi:doctor-id:v1</Key>,
                    "Demo mode only: which demo doctor this tab is acting as.",
                  ],
                  [
                    <Key key="pat">iyashi:patient:v2</Key>,
                    "Demo mode only: the demo patient identity.",
                  ],
                  [
                    <Key key="ops">iyashi:ops-auth:v1</Key>,
                    "Demo mode only: that the ops console was unlocked in this browser.",
                  ],
                  [
                    <Key key="ds">iyashi:demo-state:v3</Key>,
                    "Demo mode only: the entire local dataset. Demo mode runs with no backend, so this stands in for the database.",
                  ],
                  [
                    <Key key="seed">iyashi:demo-seeded:v1</Key>,
                    "Demo mode only: that the demo catalogue has been seeded.",
                  ],
                ]}
                caption="Demo-mode keys appear only when the app runs without a backend — for local evaluation. They are absent in production."
              />
              <Callout tone="warn" title="On a shared or public device">
                <P>
                  Sign out when you finish, and clear site data. The cached
                  symptom-checker history and any demo state sit in that
                  browser&rsquo;s storage until they are cleared.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "third-party",
          title: "Third parties",
          content: (
            <>
              <P>
                We embed no advertising or analytics scripts. Two third parties
                are nonetheless contacted by your browser:
              </P>
              <UL>
                <LI>
                  <T>Google</T>, if and only if you press &ldquo;Sign in with
                  Google&rdquo;. Google sets its own cookies on its own domain
                  under its own privacy policy. Use email and password instead
                  and Google is never contacted.
                </LI>
                <LI>
                  <T>Map tile providers.</T> Loading a map fetches imagery from
                  them, which discloses your IP address and the area you are
                  viewing. They set no cookie in our context.
                </LI>
              </UL>
              <P>
                Both are listed in{" "}
                <Xref href="/legal/privacy#sharing">who else sees your
                data</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "control",
          title: "Controlling cookies",
          content: (
            <>
              <P>
                Every browser lets you view, block and delete cookies — usually
                under Settings &rsaquo; Privacy. On {COMPANY.brand} the effect is
                simple and total:
              </P>
              <Callout tone="warn" title="Blocking our cookies signs you out">
                <P>
                  Because our only cookies are the ones that carry your session,
                  blocking or deleting them signs you out. You can still browse
                  the public site, but you cannot stay signed in, book care, or
                  reach your records. There is nothing to opt out of{" "}
                  <em>selectively</em> — there is no advertising or analytics
                  cookie here to refuse.
                </P>
              </Callout>
              <P>
                To end a session properly, use <T>Sign out</T> in the app. That
                deletes the session row on our side, which the cookie alone
                cannot do — clearing the cookie in your browser leaves the server
                session alive until it expires.
              </P>
              <P>
                We honour <T>Global Privacy Control</T> and{" "}
                <T>Do Not Track</T> signals by default, in that we already do
                none of the things they ask us to stop.
              </P>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          content: (
            <P>
              If we ever add a cookie that is not strictly necessary — analytics,
              say — we will update this page, ask for your consent first, and
              give you a way to refuse without losing access to care. Questions
              to <MailLink address={CONTACTS.privacy} />.
            </P>
          ),
        },
      ]}
    />
  );
}
