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

const doc = docBySlug("terms")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      slug="terms"
      lead={
        <>
          These terms are the contract between you and {COMPANY.legalName}. They
          govern your use of the {COMPANY.brand} website, apps and services. By
          creating an account or booking care you accept them, so it is worth
          the ten minutes.
        </>
      }
      intro={
        <Callout tone="critical" title="Read this first">
          <P>
<<<<<<< HEAD
            {COMPANY.brand} is a <strong>technology platform that connects you
            with independent, registered clinicians</strong>. We are not a
            hospital, a clinic, a diagnostic centre or an ambulance service, and
            we do not practise medicine. The doctor or nurse who treats you is
            responsible for their clinical judgement, not us.{" "}
            <strong>In a life-threatening emergency, call 112 or 108 first.</strong>
=======
            {COMPANY.brand} is a{" "}
            <strong>
              technology platform that connects you with independent, registered
              clinicians
            </strong>
            . We are not a hospital, a clinic, a diagnostic centre or an
            ambulance service, and we do not practise medicine. The doctor or
            nurse who treats you is responsible for their clinical judgement not
            us.{" "}
            <strong>
              In a life-threatening emergency, call 112 or 108 first.
            </strong>
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
          </P>
        </Callout>
      }
      sections={[
        {
          id: "acceptance",
          title: "Accepting these terms",
          content: (
            <>
              <P>
                By accessing {COMPANY.web.domain}, installing a {COMPANY.brand}{" "}
                app, creating an account or using any part of the service, you
                agree to these Terms of Use and to the documents they
                incorporate: the{" "}
                <Xref href="/legal/privacy">Privacy Policy</Xref>, the{" "}
                <Xref href="/legal/medical-disclaimer">Medical Disclaimer</Xref>
                , the <Xref href="/legal/sales">Sales Policy</Xref>, the{" "}
                <Xref href="/legal/emergency">Emergency Services Policy</Xref>{" "}
<<<<<<< HEAD
                and, if you deliver care, the{" "}
=======
                and if you deliver care the{" "}
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                <Xref href="/legal/providers">Provider Terms</Xref>. Together
                they form one agreement.
              </P>
              <P>
                If you do not accept them, do not use {COMPANY.brand}. This is
                an electronic record under the Information Technology Act, 2000
                and needs no physical signature.
              </P>
            </>
          ),
        },
        {
          id: "eligibility",
          title: "Who may use Doceeto",
          content: (
            <>
              <UL>
                <LI>
                  You must be <T>18 or older</T> and legally capable of entering
                  a contract under the Indian Contract Act, 1872.
                </LI>
                <LI>
                  You may book care <T>for a child or a dependant</T> in your
                  care, as long as you are the account holder and you have the
                  authority to consent to their treatment. You are responsible
                  for the accuracy of what you tell us about them.
                </LI>
                <LI>
                  The service is offered <T>for use in India</T>. Availability
                  varies by city and by the hour; nothing here promises that a
                  clinician is available where and when you want one.
                </LI>
                <LI>
                  If we have previously suspended or removed your account, you
                  may not create another without our written agreement.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "what-we-are",
          title: "What Doceeto is, and what it is not",
          content: (
            <>
              <P>
                {COMPANY.brand} is a marketplace and coordination layer. We
                verify and list independent providers, help you find the right
                one, carry the booking, handle payment, and give both sides the
                tools to run the encounter. The{" "}
                <T>
                  clinical relationship is directly between you and the
                  provider.
                </T>
              </P>
              <H3>We are responsible for</H3>
              <UL>
                <LI>
                  Running the platform and keeping it reasonably available.
                </LI>
                <LI>
                  Checking a provider&rsquo;s stated registration and
                  credentials before marking them verified, and removing them
                  when that ceases to be true.
                </LI>
                <LI>Handling your data as the Privacy Policy sets out.</LI>
                <LI>
                  Processing payments, refunds and cancellations under the Sales
                  Policy.
                </LI>
                <LI>Investigating complaints, and acting on what we find.</LI>
              </UL>
              <H3>We are not responsible for</H3>
              <UL>
                <LI>
                  <T>
                    The medical advice, diagnosis, prescription or treatment
                  </T>{" "}
                  a provider gives. That is their professional judgement, made
                  under their own registration and their own indemnity.
                </LI>
                <LI>
                  A provider&rsquo;s punctuality, manner or the outcome of your
                  treatment.
                </LI>
                <LI>
                  The quality of medicine manufactured by a third party, beyond
                  sourcing it from licensed pharmacies.
                </LI>
                <LI>
                  Care you obtain outside {COMPANY.brand} on the strength of
                  something you read here.
                </LI>
              </UL>
              <P>
                To the extent we transmit or host information provided by
                others, we act as an <T>intermediary</T> under section 2(1)(w)
                of the Information Technology Act, 2000 and claim the safe
                harbour of section 79.
              </P>
            </>
          ),
        },
        {
          id: "account",
          title: "Your account",
          content: (
            <>
              <OL>
                <OLI>
                  Register with a real email address and your real name. A
                  clinician is about to make decisions about your body on the
                  strength of what you tell us.
                </OLI>
                <OLI>
                  Keep your password secret. You are responsible for everything
                  done through your account until you tell us it is compromised.
                  Write to <MailLink address={CONTACTS.support} /> the moment
                  you suspect it is.
                </OLI>
                <OLI>
<<<<<<< HEAD
                  One account per person. Do not share it, a shared account
=======
                  One account per person. Do not share it a shared account
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                  merges two people&rsquo;s medical histories into one record,
                  which is genuinely dangerous.
                </OLI>
                <OLI>
                  Keep your health profile current, particularly{" "}
                  <T>allergies and current medication</T>.
                </OLI>
                <OLI>
                  Signing in as a patient and as a provider in the same browser
                  is supported and deliberate; the two sessions are separate and
                  neither can act as the other.
                </OLI>
              </OL>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "How you may not use Doceeto",
          content: (
            <>
              <P>You must not:</P>
              <UL>
                <LI>
                  Impersonate anyone, or claim medical or nursing qualifications
                  you do not hold.
                </LI>
                <LI>
                  Use the platform to obtain{" "}
                  <T>narcotic, psychotropic or habit-forming</T> medicine, or to
                  accumulate prescriptions from several doctors for the same
                  complaint.
                </LI>
                <LI>
                  Seek anything unlawful in India, including{" "}
                  <T>prenatal sex determination</T> (prohibited by the PCPNDT
                  Act, 1994) or termination of a pregnancy outside the Medical
                  Termination of Pregnancy Act, 1971.
                </LI>
                <LI>
                  Record a consultation without the provider&rsquo;s express
                  consent, or publish any part of one.
                </LI>
                <LI>
                  Raise a false emergency. SOS diverts real capacity away from
                  someone who needs it.
                </LI>
                <LI>
                  Abuse, threaten, harass or discriminate against a provider or
                  our staff. Providers may end an encounter on this ground and
                  still be paid.
                </LI>
                <LI>
                  Contact a provider outside the platform in order to avoid our
                  fees, having found them here.
                </LI>
                <LI>
                  Scrape, reverse-engineer, probe, overload or circumvent the
                  access controls of the service, or use it to build a competing
                  product.
                </LI>
                <LI>
                  Post a review that is false, defamatory, or written about a
                  consultation that never happened.
                </LI>
                <LI>
                  Upload malware, or anything unlawful, obscene, or infringing
                  someone&rsquo;s rights.
                </LI>
              </UL>
              <P>
                We may remove content and suspend accounts that break these
<<<<<<< HEAD
                rules, see <Xref href="/legal/terms#termination">suspension and
                termination</Xref>.
=======
                rules see{" "}
                <Xref href="/legal/terms#termination">
                  suspension and termination
                </Xref>
                .
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
              </P>
            </>
          ),
        },
        {
          id: "care",
          title: "Booking and receiving care",
          content: (
            <>
              <UL>
                <LI>
                  Requesting care is an <T>offer</T>. It becomes a booking when
                  a provider accepts. Nothing obliges any provider to accept.
                </LI>
                <LI>
                  A provider may <T>decline or end</T> an encounter where the
                  complaint is outside their competence, where remote assessment
                  is unsafe, where they suspect misuse, or where they are being
                  abused. Their professional duty overrides the booking.
                </LI>
                <LI>
                  <T>Nurses do not diagnose and do not prescribe.</T> They
<<<<<<< HEAD
                  deliver defined nursing services at home, injections, wound
=======
                  deliver defined nursing services at home injections, wound
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                  care, monitoring, elder and post-operative care. Anything
                  requiring a diagnosis needs a doctor.
                </LI>
                <LI>
                  For a home visit, you must be at the address you gave and must
                  provide safe, lawful access. The visit is confirmed by a{" "}
                  <T>four-digit code shown only to you</T>, which you read out
                  to the provider on arrival.
                </LI>
                <LI>
                  Remote consultations are governed by the{" "}
                  <Xref href="/legal/telemedicine-consent">
                    Telemedicine &amp; Informed Consent
                  </Xref>{" "}
                  page, which reflects the Telemedicine Practice Guidelines,
                  2020.
                </LI>
                <LI>
                  You and the provider may rate each other after a completed
                  encounter. Provider ratings of patients are not published, but
                  they are visible to us and inform whether future requests are
                  accepted.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "ai-and-emergency",
          title: "The symptom checker and the SOS button",
          content: (
            <>
              <Callout tone="critical" title="SOS is not an emergency number">
                <P>
                  The SOS button alerts our operations team and nearby
                  responders on a best-effort basis over the public internet. It
                  depends on your battery, your signal, your location permission
                  and someone being available. It{" "}
                  <strong>
                    does not connect you to the government emergency services
                  </strong>
                  . For anything life-threatening call <strong>112</strong> or{" "}
                  <strong>108</strong> first, then raise SOS. Full limits in the{" "}
                  <Xref href="/legal/emergency">Emergency Services Policy</Xref>
                  .
                </P>
              </Callout>
              <P>
                The AI symptom checker suggests which kind of clinician to see
                and how urgently. It is <T>triage, not diagnosis</T>, it has no
                registration to practise medicine, and it can be wrong. Never
                use it to rule out a serious condition. Read the{" "}
                <Xref href="/legal/medical-disclaimer">Medical Disclaimer</Xref>
                , and note the data disclosure in the{" "}
                <Xref href="/legal/privacy#ai">Privacy Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "medicine",
          title: "Medicine",
          content: (
            <>
              <P>
                We do not manufacture or sell medicine. Orders are fulfilled by{" "}
                <T>licensed pharmacies</T>, and prescription-only medicine is
                dispensed only against a valid prescription that a registered
                pharmacist has verified. Some drug schedules we will not deliver
<<<<<<< HEAD
                at all. The full rules, including what we refuse and why an
                order may be cancelled after you have paid, are in the{" "}
                <Xref href="/legal/pharmacy">Medicine &amp; Pharmacy
                Policy</Xref>.
=======
                at all. The full rules including what we refuse and why an order
                may be cancelled after you have paid are in the{" "}
                <Xref href="/legal/pharmacy">
                  Medicine &amp; Pharmacy Policy
                </Xref>
                .
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
              </P>
            </>
          ),
        },
        {
          id: "fees",
          title: "Fees, payment and refunds",
          content: (
            <>
              <P>
                Prices are shown before you confirm and are in Indian Rupees,
                inclusive of applicable taxes unless stated. Providers set their
                own consultation and home-visit fees; we add a platform fee
                where one applies, disclosed at checkout.
              </P>
              <P>
                Cancellation windows, no-show rules, refund timelines and the
                treatment of cash payments are all in the{" "}
                <Xref href="/legal/sales">Sales Policy</Xref>, which forms part
                of these terms.
              </P>
            </>
          ),
        },
        {
          id: "content",
          title: "Content and intellectual property",
          content: (
            <>
              <H3>Ours</H3>
              <P>
                The {COMPANY.brand} name, logo, wordmark, interface, copy,
                design system and software are owned by {COMPANY.legalName} and
                protected by Indian and international law. We grant you a
                personal, non-exclusive, non-transferable, revocable licence to
                use the app for its intended purpose. Nothing else is granted.
              </P>
              <H3>Yours</H3>
              <P>
                Your health data, reports and photographs remain yours. You give
<<<<<<< HEAD
                us the licence needed to run the service, storing them,
=======
                us the licence needed to run the service storing them,
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                displaying them to the clinician treating you, and processing
                them as the Privacy Policy describes. Nothing more.
              </P>
              <H3>Reviews</H3>
              <P>
                A review you publish may be displayed alongside the
                provider&rsquo;s profile with your first name, indefinitely and
                worldwide. Write only what is true and what you experienced. We
                remove reviews that are defamatory, that identify third parties,
                or that relate to a consultation we can find no record of.
              </P>
              <H3>Complaints about infringement</H3>
              <P>
                If something on {COMPANY.brand} infringes your rights, write to{" "}
                <MailLink address={CONTACTS.grievance} /> identifying the
                material, your right, and your contact details. We act within
                the timelines in{" "}
                <Xref href="/legal/grievance">Grievance Redressal</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "availability",
          title: "Availability and changes to the service",
          content: (
            <>
              <P>
                We aim to keep {COMPANY.brand} available continuously but do not
                guarantee it. Maintenance, upgrades, failures at our hosting or
                payment partners, network outages and events beyond our control
                all interrupt service. We will give notice of planned downtime
                where we reasonably can.
              </P>
              <P>
                We may add, change, suspend or withdraw features. If a change
                materially reduces what you have already paid for, you may
                cancel and receive a proportionate refund.
              </P>
              <P>
                We may amend these terms. Material amendments are notified by
                email and in-app at least <T>fifteen days</T> before they take
                effect, and continuing to use the service afterwards is
                acceptance. If you object, stop using {COMPANY.brand} and close
                your account.
              </P>
            </>
          ),
        },
        {
          id: "termination",
          title: "Suspension and termination",
          content: (
            <>
              <P>
                <T>You</T> may stop at any time and delete your account from
                Account &rsaquo; Delete account. See{" "}
                <Xref href="/legal/data-deletion">
                  Account &amp; Data Deletion
                </Xref>
                .
              </P>
              <P>
                <T>We</T> may suspend or terminate your account, with notice
                where practicable and immediately where it is not, if you break
                these terms, if we reasonably suspect fraud or misuse of
                prescriptions, if you endanger or abuse a provider, if you
                repeatedly raise false emergencies, or if the law requires it.
              </P>
              <P>
                On termination: your licence to use the service ends; sums
                already due remain payable; refunds owed are paid; and your data
                is handled as described in{" "}
<<<<<<< HEAD
                <Xref href="/legal/privacy#retention">retention</Xref>, clinical
                records are kept for the statutory period even after deletion.
=======
                <Xref href="/legal/privacy#retention">retention</Xref>
                clinical records are kept for the statutory period even after
                deletion.
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
              </P>
              <P>
                If you believe a suspension was wrong, appeal to{" "}
                <MailLink address={CONTACTS.grievance} />. A human reviews it.
              </P>
            </>
          ),
        },
        {
          id: "disclaimers",
          title: "Disclaimers",
          content: (
            <>
              <P>
                To the fullest extent Indian law allows, the platform is
                provided <T>&ldquo;as is&rdquo;</T> and{" "}
                <T>&ldquo;as available&rdquo;</T>. We disclaim all implied
                warranties of merchantability, fitness for a particular purpose
                and non-infringement.
              </P>
              <P>We specifically do not warrant that:</P>
              <UL>
                <LI>
                  a provider will be available, will accept your request, or
                  will arrive within any estimated time;
                </LI>
                <LI>
                  any consultation, treatment or medicine will produce a
                  particular clinical outcome;
                </LI>
                <LI>
                  the symptom checker&rsquo;s suggestion is correct, complete or
                  safe to rely on;
                </LI>
                <LI>
                  the service will be uninterrupted, timely or error-free.
                </LI>
              </UL>
              <P>
                Nothing here excludes liability that cannot lawfully be excluded
                including liability for death or personal injury caused by our
                own negligence, for fraud, or under the Consumer Protection Act,
                2019.
              </P>
            </>
          ),
        },
        {
          id: "liability",
          title: "Limitation of liability",
          content: (
            <>
              <P>Subject to the paragraph immediately above:</P>
              <OL>
                <OLI>
                  We are <T>not liable for the clinical acts or omissions</T> of
                  any provider, pharmacy, laboratory or ambulance operator. They
                  are independent professionals and businesses, responsible for
                  their own conduct and carrying their own indemnity.
                </OLI>
                <OLI>
                  We are not liable for indirect, incidental, special,
                  consequential or punitive loss, nor for loss of profit,
                  revenue, data, goodwill or anticipated savings, however
                  arising.
                </OLI>
                <OLI>
                  Our total aggregate liability arising out of or in connection
                  with the service in any twelve-month period is limited to the
                  greater of <T>the amounts you paid us in that period</T> and{" "}
                  <T>₹10,000</T>.
                </OLI>
                <OLI>
                  Any claim must be brought within <T>one year</T> of the event
                  giving rise to it.
                </OLI>
              </OL>
              <Callout tone="info">
                <P>
                  If you are harmed by a provider&rsquo;s negligence, your claim
                  lies against that provider and their indemnity insurer. We
                  will give you the provider&rsquo;s registration details, the
                  record of the encounter and any documents you need to pursue
<<<<<<< HEAD
                  it, that is a commitment, not a courtesy.
=======
                  it that is a commitment, not a courtesy.
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "indemnity",
          title: "Indemnity",
          content: (
            <P>
              You agree to indemnify {COMPANY.legalName}, its directors,
              employees and agents against any claim, loss, liability or
              reasonable cost arising from your breach of these terms, your
              misuse of the platform, information you gave that was false or
              incomplete, or your infringement of anyone&rsquo;s rights. We will
              tell you promptly of any such claim and will not settle it without
              consulting you.
            </P>
          ),
        },
        {
          id: "disputes",
          title: "Governing law and disputes",
          content: (
            <>
              <P>This agreement is governed by {COMPANY.jurisdiction.law}.</P>
              <OL>
                <OLI>
                  <T>Talk to us first.</T> Almost everything is resolved through{" "}
                  <Xref href="/legal/grievance">Grievance Redressal</Xref>.
                  Please exhaust it before anything formal.
                </OLI>
                <OLI>
                  <T>Arbitration.</T> A dispute not resolved within sixty days
                  of the grievance being raised is referred to a sole arbitrator
                  appointed by mutual agreement, under the Arbitration and
                  Conciliation Act, 1996. The seat is{" "}
                  {COMPANY.jurisdiction.arbitrationSeat} and the language is
                  English. Each side bears its own costs unless the arbitrator
                  orders otherwise.
                </OLI>
                <OLI>
                  <T>Courts.</T> Subject to the above,{" "}
                  {COMPANY.jurisdiction.courts} have exclusive jurisdiction.
                </OLI>
              </OL>
              <P>
                None of this prevents you from approaching a{" "}
                <T>Consumer Disputes Redressal Commission</T> under the Consumer
                Protection Act, 2019, or the relevant{" "}
                <T>State Medical Council</T> about a doctor&rsquo;s conduct.
                Those rights stand whatever this clause says.
              </P>
            </>
          ),
        },
        {
          id: "general",
          title: "General",
          content: (
            <>
              <UL>
                <LI>
                  <T>Entire agreement.</T> These terms and the documents they
                  incorporate are the whole agreement between us on this
                  subject.
                </LI>
                <LI>
                  <T>Severability.</T> If a clause is unenforceable, it is
                  narrowed to the minimum extent needed and the rest stands.
                </LI>
                <LI>
                  <T>No waiver.</T> Not enforcing something once does not waive
                  it.
                </LI>
                <LI>
                  <T>Assignment.</T> You may not assign your rights. We may
                  assign ours to a successor on notice to you.
                </LI>
                <LI>
<<<<<<< HEAD
                  <T>Force majeure.</T> Neither side is liable for failure caused
                  by events beyond reasonable control, natural disaster,
=======
                  <T>Force majeure.</T> Neither side is liable for failure
                  caused by events beyond reasonable control natural disaster,
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                  epidemic, war, strike, or failure of public infrastructure or
                  telecommunications.
                </LI>
                <LI>
                  <T>Notices.</T> We write to your registered email address or
                  notify you in-app. You write to the addresses below.
                </LI>
                <LI>
                  <T>Language.</T> Translations are provided for convenience;
                  the English version governs.
                </LI>
                <LI>
                  <T>Relationship.</T> Nothing here creates a partnership, joint
                  venture, agency or employment between us.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          content: (
            <>
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
                    label: "General",
                    value: <MailLink address={CONTACTS.general} />,
                  },
                  {
                    label: "Support",
                    value: <MailLink address={CONTACTS.support} />,
                  },
                  {
                    label: "Legal notices",
                    value: <MailLink address={CONTACTS.legal} />,
                  },
                  {
                    label: OFFICERS.grievance.role,
                    value: (
                      <>
                        {OFFICERS.grievance.name
<<<<<<< HEAD
                          ? `${OFFICERS.grievance.name}, `
=======
                          ? `${OFFICERS.grievance.name} `
>>>>>>> 94b3b6a (Removed '—' from legals and policies)
                          : null}
                        <MailLink address={OFFICERS.grievance.email} />
                      </>
                    ),
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
