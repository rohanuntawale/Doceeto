import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  P,
  H3,
  UL,
  LI,
  T,
  Xref,
  Ext,
  MailLink,
  Callout,
  Table,
  KeyValues,
  Address,
} from "@/components/legal/prose";
import {
  COMPANY,
  CONTACTS,
  OFFICERS,
  correspondenceAddress,
} from "@/lib/legal/company";
import { docBySlug } from "@/lib/legal/documents";

const doc = docBySlug("privacy")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      slug="privacy"
      lead={
        <>
          Health data is the most sensitive category of personal data there is.
          This policy sets out exactly what {COMPANY.brand} collects, why, who
          else ever sees it, how long we hold it, and what you can compel us to
          do with it. It is written to be read, not to be survived.
        </>
      }
      intro={
        <Callout tone="info" title="The short version">
          <P>
            We collect what is needed to get care to you, who you are, where you
            are, and what is wrong. Your health profile is shared with the
            specific doctor or nurse treating you, and with an AI provider when
            you use the symptom checker. We do not sell your data, we do not run
            advertising on it, and you can delete your account and health record
            from inside the app at any time.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "who-we-are",
          title: "Who we are",
          content: (
            <>
              <P>
                {COMPANY.legalName} (&ldquo;{COMPANY.shortName}&rdquo;,
                &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the {COMPANY.brand}{" "}
                platform: the website at {COMPANY.web.domain}, the{" "}
                {COMPANY.brand} mobile applications, and the connected consoles
                used by doctors, nurses and our operations team.
              </P>
              <P>
                Under the <T>Digital Personal Data Protection Act, 2023</T> (the{" "}
                <T>DPDP Act</T>) we are the <T>Data Fiduciary</T> for the
                personal data described here, meaning we decide why and how it
                is processed, and we are accountable for it. You are the{" "}
                <T>Data Principal</T>. Where the{" "}
                <T>
                  Information Technology (Reasonable Security Practices and
                  Procedures and Sensitive Personal Data or Information) Rules,
                  2011
                </T>{" "}
                apply, your health data is{" "}
                <T>Sensitive Personal Data or Information</T> and we treat it to
                that standard.
              </P>
              <KeyValues
                items={[
                  { label: "Entity", value: COMPANY.legalName },
                  { label: "CIN", value: COMPANY.cin },
                  { label: "GSTIN", value: COMPANY.gstin },
                  {
                    label: "Address",
                    value: <Address lines={correspondenceAddress()} />,
                  },
                  {
                    label: "Data queries",
                    value: <MailLink address={CONTACTS.privacy} />,
                  },
                ]}
              />
              <P>
                Some parts of the product still carry our internal codename,{" "}
                <T>{COMPANY.internalCodename}</T>, you will see it in cookie
                names such as{" "}
                <code className="rounded bg-espresso-700 px-1.5 py-0.5 font-mono text-[13px] text-cream">
                  iyashi_sid_patient
                </code>
                . Those are ours. See the{" "}
                <Xref href="/legal/cookies">Cookie Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "scope",
          title: "What this policy covers",
          content: (
            <>
              <P>
                This policy covers everyone who uses {COMPANY.brand}: patients,
                the doctors and nurses who deliver care through the platform,
                and visitors who never create an account.
              </P>
              <P>
                It does <T>not</T> cover what an individual doctor, nurse,
                hospital, laboratory or pharmacy does with your information
                inside their own practice and records. Once a clinician has
                treated you, they hold their own medical records under their own
                professional obligations, and those records are theirs to keep
                for the period their council requires. Nor does it cover
                third-party sites we link to.
              </P>
            </>
          ),
        },
        {
          id: "what-we-collect",
          title: "The data we collect",
          content: (
            <>
              <P>
                Grouped by why it exists. Nothing in the &ldquo;health&rdquo; or
                &ldquo;location&rdquo; groups is required to browse the site it
                is collected when you ask for care.
              </P>
              <Table
                columns={["Category", "What it includes", "When we get it"]}
                rows={[
                  [
                    "Account",
                    "Name, email address, hashed password, role (patient / doctor / nurse / ops), account creation date. If you sign in with Google: your Google account identifier, email, name and profile photo.",
                    "At sign-up, and whenever you edit your profile.",
                  ],
                  [
                    "Health profile",
                    "Date of birth, gender, height, weight, waist measurement, blood group, allergies, ongoing conditions, current medication, past surgeries and hospitalisations, family history, diagnosed diabetes and hypertension, physical-activity level, and an emergency contact's name and phone number.",
                    "Only when you fill it in. Every field is optional and can be cleared.",
                  ],
                  [
                    "Vitals history",
                    "A dated log of measurements, so weight can be charted over time rather than only shown as today's number.",
                    "Appended automatically when you save a changed measurement.",
                  ],
                  [
                    "Symptom checker",
                    "The symptoms you describe, the answers you select, the result the checker reached, and a capped history of past sessions.",
                    "Each time you run a check while signed in.",
                  ],
                  [
                    "Location",
                    "Approximate device location (latitude and longitude), the short area label shown in your header, and, for home visits and deliveries, the full street address you enter.",
                    "When you grant your browser or phone permission, or type an address.",
                  ],
                  [
                    "Care requests",
                    "The consultation or visit type, the symptoms you attach, the provider involved, fee and payment method, timestamps for acceptance, arrival and completion, and any cancellation reason.",
                    "When you book, and as the request progresses.",
                  ],
                  [
                    "Emergency (SOS)",
                    "The emergency category, your location and address at the time, and any notes added by you or by our operations team.",
                    "Only when you raise an SOS.",
                  ],
                  [
                    "Prescriptions",
                    "Your name, age, gender and allergies as recorded on the document, the diagnosis, the medicines prescribed with dose and schedule, advice, follow-up interval, and the prescribing doctor's name, qualifications and council registration number.",
                    "When a doctor issues a prescription after a consultation.",
                  ],
                  [
                    "Medicine orders",
                    "The items ordered, the total, the delivery address, the fulfilling store, and the prescription the order was filled against.",
                    "When you place an order.",
                  ],
                  [
                    "Ratings",
                    "The rating and comment you leave for a provider, and the rating a provider leaves for you, which is visible to us and to providers considering a request, not published publicly.",
                    "After a completed consultation.",
                  ],
                  [
                    "Payments",
                    "The amount, method (online or cash), and the transaction reference returned by our payment partner. Full card numbers, UPI PINs and net-banking credentials never reach our servers.",
                    "At checkout.",
                  ],
                  [
                    "Technical",
                    "IP address, browser and device type, pages requested, timestamps, error reports, and the session identifier in your cookie.",
                    "Automatically, on every request.",
                  ],
                ]}
              />
              <H3>Provider data</H3>
              <P>
                Doctors and nurses additionally give us professional
                information: specialty or nursing skill set, qualifications and
                education, years of experience, council registration number,
                clinic address, languages, consultation and home-visit fees,
                availability, a profile photograph, and their live location
                while they are marked online. Their earnings ledger, the gross
                fee, our commission and the net amount for each completed visit
                is also held. Much of this is <T>deliberately public</T>: a
                patient choosing a clinician is entitled to see their
                credentials. See the{" "}
                <Xref href="/legal/providers">Provider Terms</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "why",
          title: "Why we use it, and on what basis",
          content: (
            <>
              <P>
                The DPDP Act lets us process personal data with your{" "}
                <T>consent</T>, or for certain <T>legitimate uses</T> defined in
                the Act. We rely on consent for everything clinical. Where we
                rely on something else, it is named below.
              </P>
              <Table
                columns={["Purpose", "Data used", "Basis"]}
                rows={[
                  [
                    "Create and secure your account",
                    "Account, technical",
                    "Performance of the service you asked for; consent at sign-up",
                  ],
                  [
                    "Match you with a doctor or nurse and get them to you",
                    "Location, care requests, account",
                    "Consent",
                  ],
                  [
                    "Give the treating clinician the context they need to treat you safely",
                    "Health profile, symptom checker, prescriptions",
                    "Consent",
                  ],
                  [
                    "Run the AI symptom checker",
                    "Symptoms, health profile",
                    "Consent, withdrawable, see below",
                  ],
                  [
                    "Dispatch emergency help",
                    "Location, SOS, health profile, emergency contact",
                    "Consent; and, where you are incapable of giving it, to respond to a medical emergency threatening your life or health (a legitimate use under the DPDP Act)",
                  ],
                  [
                    "Dispense and deliver medicine",
                    "Prescriptions, orders, address",
                    "Consent; compliance with the Drugs and Cosmetics Act, 1940",
                  ],
                  [
                    "Take payment, invoice, and pay providers",
                    "Payments, care requests, provider ledger",
                    "Performance of contract; tax and accounting law",
                  ],
                  [
                    "Keep the platform safe, fraud, abuse, impersonation, misuse of prescriptions",
                    "Technical, account, audit logs",
                    "Legitimate use: preventing fraud and securing the service",
                  ],
                  [
                    "Answer your complaint",
                    "Whatever the complaint concerns",
                    "Legal obligation under the Consumer Protection (E-Commerce) Rules, 2020",
                  ],
                  [
                    "Improve the product with aggregate statistics",
                    "De-identified and aggregated data only",
                    "Legitimate use; the output cannot be traced back to you",
                  ],
                ]}
              />
              <Callout tone="ok" title="What we do not do with it">
                <UL>
                  <LI>
                    We do not <T>sell</T> your personal data, and we do not
                    share it with data brokers.
                  </LI>
                  <LI>
                    We do not use your health data for <T>advertising</T>,
                    profiling for advertising, or building audience segments.
                  </LI>
                  <LI>
                    We do not disclose your health data to your{" "}
                    <T>employer, insurer or bank</T> unless you specifically
                    instruct us to.
                  </LI>
                  <LI>
                    We do not use your conversations or health record to{" "}
                    <T>train AI models</T>, and our AI provider is contractually
                    directed not to either.
                  </LI>
                </UL>
              </Callout>
            </>
          ),
        },
        {
          id: "ai",
          title: "The AI symptom checker",
          content: (
            <>
              <P>
                This deserves its own section, because it is the one place where
                your health information leaves our infrastructure for a reason
                that is not a human clinician treating you.
              </P>
              <P>
                When you use the symptom checker while signed in, we send the
                symptoms you describe, your answers, and{" "}
                <T>relevant fields from your health profile</T>, age band, BMI,
                diagnosed diabetes or hypertension, current medication,
                allergies, family history and lifestyle, to{" "}
                <Ext href="https://openrouter.ai/privacy">OpenRouter</Ext>,
                which routes the request to a large language model. That is what
                makes the checker personalised: a hypertensive 55-year-old
                reporting chest pain is triaged as exactly that person rather
                than as a generic patient.
              </P>
              <UL>
                <LI>
                  Your profile is attached <T>on our server</T>, from your
                  session. It is never assembled in your browser and cannot be
                  altered by anyone impersonating you.
                </LI>
                <LI>
                  We do not send your name, email address, phone number, precise
                  location or account identifier to the model.
                </LI>
                <LI>
                  The request is processed <T>outside India</T>, see{" "}
                  <Xref href="/legal/privacy#transfers">transfers</Xref>.
                </LI>
                <LI>
                  If you would rather not use it, simply do not run a check.
                  Every part of {COMPANY.brand}, booking a doctor, a home visit,
                  medicine, SOS, works without it. Clearing your saved checks in
                  Account removes the stored history.
                </LI>
                <LI>
                  If no AI provider is configured, or the call fails, the
                  checker falls back to an <T>offline rule engine</T> that runs
                  entirely on our own servers and sends nothing anywhere.
                </LI>
              </UL>
              <Callout tone="warn" title="It is triage, not diagnosis">
                <P>
                  The checker suggests which kind of clinician to see and how
                  urgently. It does not diagnose, and it can be wrong in both
                  directions. Read the{" "}
                  <Xref href="/legal/medical-disclaimer">
                    Medical Disclaimer
                  </Xref>{" "}
                  before you rely on it.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Who else sees your data",
          content: (
            <>
              <H3>The people treating you</H3>
              <P>
                When you raise a request, the provider who accepts it sees your
                name, the symptoms you attached, your location and address, and
                for the duration of the episode of care, your health profile.
                Providers who <T>declined or were not assigned</T> the request
                do not retain access. A broadcast request shows waiting
                providers only enough to decide whether to accept: the type of
                care, the approximate area, and the fee.
              </P>
              <P>
                Our operations team can see requests and emergencies in order to
                dispatch, unblock and investigate them. Their actions against
                your records are written to an audit log.
              </P>

              <H3>Service providers who process data for us</H3>
              <P>
                Each is bound by contract to process data only on our
                instructions, to protect it, and to delete it when we say so.
              </P>
              <Table
                columns={["Who", "What they handle", "Where"]}
                rows={[
                  [
                    "Cloud hosting and database",
                    "The application and the primary database, effectively all stored data.",
                    "Region-configurable; see transfers below",
                  ],
                  [
                    "Google (Sign in with Google)",
                    "Authenticates you and returns your Google identifier, email, name and photo. Optional, email and password work equally well.",
                    "Global",
                  ],
                  [
                    "OpenRouter and the model it routes to",
                    "Symptom-checker text and the health-profile fields listed above. No name, email or precise location.",
                    "Outside India",
                  ],
                  [
                    "Payment gateway",
                    "Processes the payment. Card and UPI credentials go to them directly and never touch our servers; we receive only a status and a reference.",
                    "India",
                  ],
                  [
                    "Map tiles",
                    "Your browser requests map imagery, which discloses your IP address and the map area to the tile provider.",
                    "Global",
                  ],
                  [
                    "Pharmacy and delivery partners",
                    "The prescription being filled, the items, and the delivery name, address and contact number.",
                    "India",
                  ],
                  [
                    "Email delivery",
                    "Your email address and the content of transactional messages such as prescriptions and receipts.",
                    "Global",
                  ],
                ]}
              />

              <H3>Anyone holding a prescription link</H3>
              <Callout
                tone="warn"
                title="Shared prescription links are unlisted, not private"
              >
                <P>
                  A prescription can be opened at a{" "}
                  <code className="rounded bg-espresso-700 px-1.5 py-0.5 font-mono text-[13px] text-cream">
                    /rx/…
                  </code>{" "}
                  link containing a long, unguessable token, so that you can
                  hand it to a chemist without either of you signing in. That
                  link <T>is</T> the credential: anyone you forward it to can
                  read the prescription, including your name, age and the
                  medicines prescribed. Treat it like the paper original and
                  send it only to people you would hand the paper to.
                </P>
              </Callout>

              <H3>When the law requires it</H3>
              <P>
                We disclose data to a court, regulator, police authority or
                government agency where we are legally obliged to, or where it
                is necessary to protect someone&rsquo;s life. We satisfy
                ourselves that the demand is lawful and properly issued, we
                disclose no more than is demanded, and we tell you unless we are
                prohibited from doing so.
              </P>
              <P>
                If {COMPANY.legalName} is acquired or merges, your data may
                transfer to the acquirer, who will remain bound by this policy
                until you are given notice of and a chance to object to any
                change.
              </P>
            </>
          ),
        },
        {
          id: "transfers",
          title: "Data that leaves India",
          content: (
            <>
              <P>
                We store the primary database in a region we select and keep
                Indian users&rsquo; records there wherever the provider offers
                it. Two flows nonetheless cross borders:
              </P>
              <UL>
                <LI>
                  <T>AI symptom checking</T>, which is processed by an inference
                  provider outside India, as described above.
                </LI>
                <LI>
                  <T>Google sign-in, email delivery and map tiles</T>, which are
                  global services.
                </LI>
              </UL>
              <P>
                Section 16 of the DPDP Act permits transfer to any country the
                Central Government has not restricted. Where a transfer happens,
                it is covered by contractual protections requiring
                confidentiality, security and deletion on instruction. If the
                Government restricts a country we use, we will move or stop that
                processing.
              </P>
            </>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          content: (
            <>
              <P>
                Under section 8(7) of the DPDP Act we must erase personal data
                once the purpose is served, unless a law requires us to keep it.
                Medical records are the main exception, and a genuine one:
                deleting a prescription would erase a record of what a
                registered doctor prescribed you.
              </P>
              <Table
                columns={["Record", "Kept for", "Why"]}
                rows={[
                  [
                    "Account and profile",
                    "While your account exists, then erased on deletion",
                    "It is yours",
                  ],
                  [
                    "Health profile and vitals",
                    "While your account exists; erased on deletion",
                    "It is yours",
                  ],
                  [
                    "Symptom-checker history",
                    "A capped, rolling history; clearable at any time from Account",
                    "So a check survives a refresh or a change of phone",
                  ],
                  [
                    "Prescriptions",
                    "Three years from issue, retained even after account deletion",
                    "Telemedicine Practice Guidelines, 2020; Drugs and Cosmetics Rules, 1945 (Schedule H1 records are kept for three years)",
                  ],
                  [
                    "Consultation and visit records",
                    "Three years from the consultation",
                    "Medical-record and limitation requirements; defending a clinical complaint",
                  ],
                  [
                    "Invoices, payments and the provider earnings ledger",
                    "Eight financial years",
                    "Section 128 of the Companies Act, 2013 and income-tax record-keeping",
                  ],
                  [
                    "Emergency (SOS) records",
                    "Three years",
                    "Incident review and medico-legal defence",
                  ],
                  [
                    "Grievance correspondence",
                    "Three years from resolution",
                    "Consumer Protection (E-Commerce) Rules, 2020",
                  ],
                  [
                    "Sessions",
                    "Until expiry or sign-out, whichever is first",
                    "Deleting the row ends the session immediately",
                  ],
                  [
                    "Security and audit logs",
                    "Up to 180 days",
                    "IT Rules, 2021; investigating abuse",
                  ],
                ]}
              />
              <P>
                Retained clinical records are locked down to what the retention
                purpose needs and are not used to market to you, profile you, or
                rebuild a deleted account. See{" "}
                <Xref href="/legal/data-deletion">
                  Account &amp; Data Deletion
                </Xref>{" "}
                for exactly what goes and what stays.
              </P>
            </>
          ),
        },
        {
          id: "security",
          title: "How we protect it",
          content: (
            <>
              <UL>
                <LI>
                  <T>In transit</T>, everything travels over HTTPS with modern
                  TLS. The application refuses plain HTTP.
                </LI>
                <LI>
                  <T>Passwords</T> are stored only as bcrypt hashes with a
                  per-password salt. We cannot read your password, and neither
                  can anyone who steals the database.
                </LI>
                <LI>
                  <T>Sessions</T> are rows in our database. Your browser holds
                  nothing but an opaque random identifier in an httpOnly,
                  Secure, SameSite cookie, no role, no user id, nothing signed
                  that could be tampered with. Deleting the row ends the session
                  instantly, on every device if you ask.
                </LI>
                <LI>
                  <T>Authorisation</T> is enforced on the server for every API
                  call, and again in the page layer before a page renders. Each
                  role reads and writes only the records it is entitled to; a
                  doctor cannot open a patient record they were never assigned.
                </LI>
                <LI>
                  <T>At rest</T>, the database is encrypted by our hosting
                  provider, and access to production is restricted to the
                  smallest possible group, over authenticated connections.
                </LI>
                <LI>
                  <T>Arrival codes.</T> A home visit is confirmed by a
                  four-digit code shown only to you, which the provider must
                  enter. It is never shown to providers or to our operations
                  team, and it locks after five wrong attempts.
                </LI>
                <LI>
                  <T>Audit logging</T> records administrative actions taken
                  against records, so misuse can be traced.
                </LI>
              </UL>
              <P>
                No system is perfectly secure, and we will not pretend
                otherwise. If you find a weakness, please tell us, see{" "}
                <Xref href="/legal/security">
                  Security &amp; Vulnerability Disclosure
                </Xref>
                , which includes safe-harbour terms for good-faith researchers.
              </P>
              <H3>If there is a breach</H3>
              <P>
                Section 8(6) of the DPDP Act requires us to notify both the Data
                Protection Board of India and every affected person. We will do
                so <T>without undue delay</T>, describing what happened, what
                data was involved, what we have done, and what you should do. We
                will not wait until we have every answer before telling you.
              </P>
            </>
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          content: (
            <>
              <P>
                The DPDP Act gives you the following rights. Exercise any of
                them by writing to <MailLink address={CONTACTS.privacy} />, or
                from <T>Account</T> in the app where a self-service control
                exists. We respond within{" "}
                {OFFICERS.dataProtection.respondWithin}.
              </P>
              <UL>
                <LI>
                  <T>Access.</T> A summary of the personal data we hold about
                  you, what we are doing with it, and the identities of everyone
                  we have shared it with.
                </LI>
                <LI>
                  <T>Correction and completion.</T> Fix anything inaccurate,
                  fill in anything incomplete, update anything stale. Most of
                  this you can do yourself in Account. A clinical record already
                  issued, a prescription, say, cannot be silently rewritten, but
                  we will annotate it with your correction.
                </LI>
                <LI>
                  <T>Erasure.</T> Delete your data and your account. See{" "}
                  <Xref href="/legal/data-deletion">
                    Account &amp; Data Deletion
                  </Xref>
                  .
                </LI>
                <LI>
                  <T>Withdraw consent.</T> As easily as you gave it. Withdrawal
                  is forward-looking: it does not undo processing already
                  lawfully carried out, and withdrawing consent for something
                  essential, location for a home visit, say, means we can no
                  longer provide that part of the service.
                </LI>
                <LI>
                  <T>Grievance redressal.</T> Complain to us first and get a
                  reasoned answer. See{" "}
                  <Xref href="/legal/grievance">Grievance Redressal</Xref>.
                </LI>
                <LI>
                  <T>Nominate.</T> Name someone to exercise these rights on your
                  behalf if you die or become incapacitated. Write to us to
                  register a nominee.
                </LI>
                <LI>
                  <T>Portability.</T> Beyond what the Act strictly requires, we
                  will export your health profile, vitals, prescriptions and
                  care history in a machine-readable format on request.
                </LI>
              </UL>
              <Callout tone="info" title="Your duties under the Act">
                <P>
                  Section 15 of the DPDP Act also places duties on you: do not
                  impersonate someone else when giving personal data, do not
                  suppress material information where it is legally required,
                  and do not file a false or frivolous grievance. In a
                  healthcare setting the first two matter more than usual,{" "}
                  <T>
                    a doctor prescribing on the strength of an allergy list you
                    filled in wrongly can do you real harm
                  </T>
                  .
                </P>
              </Callout>
              <P>
                If our answer does not satisfy you, you may complain to the{" "}
                <T>Data Protection Board of India</T>.
              </P>
            </>
          ),
        },
        {
          id: "children",
          title: "Children and people who cannot consent for themselves",
          content: (
            <>
              <P>
                Under the DPDP Act, a <T>child</T> is anyone under 18.{" "}
                {COMPANY.brand} is not intended for independent use by children,
                and we do not knowingly create an account for one.
              </P>
              <UL>
                <LI>
                  A parent or legal guardian must hold the account and book care
                  on a child&rsquo;s behalf. Paediatric consultations are
                  entirely normal, the <T>account holder</T> must simply be the
                  adult.
                </LI>
                <LI>
                  Where we process a child&rsquo;s data, we obtain{" "}
                  <T>verifiable consent</T> from the parent or guardian first.
                </LI>
                <LI>
                  We never track, behaviourally monitor, or direct advertising
                  at a child. Section 9(3) of the Act forbids it, and we do not
                  do it to adults either.
                </LI>
                <LI>
                  The same protections apply to a person with a disability who
                  has a lawful guardian.
                </LI>
                <LI>
                  If you believe a child has created an account without parental
                  consent, write to <MailLink address={CONTACTS.privacy} /> and
                  we will remove it.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and on-device storage",
          content: (
            <>
              <P>
                We set a small number of cookies, and none of them are for
                advertising. There is no third-party tracker, no advertising
                pixel and no cross-site profiling on {COMPANY.brand}. Your
                theme, chosen language and some draft state live in your
                browser&rsquo;s local storage and never reach us.
              </P>
              <P>
                Every cookie and storage key is itemised in the{" "}
                <Xref href="/legal/cookies">Cookie Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "app-stores",
          title: "The mobile apps",
          content: (
            <>
              <P>
                The {COMPANY.brand} apps for iOS and Android collect the same
                data as the website, and additionally request these device
                permissions. Each is optional, each is asked for at the moment
                it is first needed rather than at launch, and refusing one
                disables only the feature that depends on it.
              </P>
              <Table
                columns={["Permission", "Used for", "If you refuse"]}
                rows={[
                  [
                    "Location (while in use)",
                    "Finding clinicians near you, routing a home visit, and pinpointing an SOS.",
                    "Enter an address manually instead.",
                  ],
                  [
                    "Location (background)",
                    "Providers only, while marked online, so a patient can watch them approach. Never collected from patients in the background.",
                    "Providers cannot take home visits.",
                  ],
                  [
                    "Camera",
                    "Video consultations, and photographing a rash, wound or paper prescription.",
                    "Audio-only consultation; upload from your gallery.",
                  ],
                  [
                    "Microphone",
                    "Audio and video consultations.",
                    "You cannot take a voice or video consultation.",
                  ],
                  [
                    "Photos and files",
                    "Attaching reports and a profile photograph.",
                    "No attachments.",
                  ],
                  [
                    "Notifications",
                    "Telling you a doctor accepted, arrived, or that an order is out for delivery.",
                    "Check the app for status instead.",
                  ],
                  ["Contacts", "Not requested.", ", "],
                ]}
              />
              <P>
                We do not read your health platform data (Apple Health or Health
                Connect) unless you explicitly link it, and we never use data
                obtained from those platforms for advertising or share it with
                data brokers, as both platforms&rsquo; terms require.
              </P>
              <P>
                You can delete your account from inside the app, without
                contacting us and without reinstalling anything:{" "}
                <Xref href="/legal/data-deletion">
                  Account &amp; Data Deletion
                </Xref>
                .
              </P>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          content: (
            <>
              <P>
                When we change this policy we bump the version and effective
                date at the top of the page. For any change that materially
                affects your rights or widens what we do with your data, we will
                notify you by email and in the app <T>before</T> it takes
                effect, and where the law requires consent we will ask again
                rather than assume it.
              </P>
              <P>
                Superseded versions are kept and can be requested from{" "}
                <MailLink address={CONTACTS.privacy} />.
              </P>
            </>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          content: (
            <>
              <H3>Data Protection Officer</H3>
              <P>
                For anything about your personal data, access, correction,
                erasure, consent, or a question about this policy.
              </P>
              <KeyValues
                items={[
                  { label: "Name", value: OFFICERS.dataProtection.name },
                  { label: "Role", value: OFFICERS.dataProtection.role },
                  {
                    label: "Email",
                    value: <MailLink address={OFFICERS.dataProtection.email} />,
                  },
                  { label: "Phone", value: OFFICERS.dataProtection.phone },
                  {
                    label: "Post",
                    value: <Address lines={correspondenceAddress()} />,
                  },
                  {
                    label: "Response time",
                    value: OFFICERS.dataProtection.respondWithin,
                  },
                ]}
              />
              <H3>Grievance Officer</H3>
              <P>
                For a formal complaint under the Consumer Protection
                (E-Commerce) Rules, 2020 and the Information Technology
                (Intermediary Guidelines and Digital Media Ethics Code) Rules,
                2021. Full escalation path in{" "}
                <Xref href="/legal/grievance">Grievance Redressal</Xref>.
              </P>
              <KeyValues
                items={[
                  { label: "Name", value: OFFICERS.grievance.name },
                  { label: "Role", value: OFFICERS.grievance.role },
                  {
                    label: "Email",
                    value: <MailLink address={OFFICERS.grievance.email} />,
                  },
                  { label: "Phone", value: OFFICERS.grievance.phone },
                  {
                    label: "Acknowledgement",
                    value: `Within ${OFFICERS.grievance.acknowledgeWithin}`,
                  },
                  {
                    label: "Resolution",
                    value: `Within ${OFFICERS.grievance.resolveWithin}`,
                  },
                ]}
              />
            </>
          ),
        },
      ]}
    />
  );
}
