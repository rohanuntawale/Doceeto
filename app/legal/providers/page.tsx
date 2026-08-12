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

const doc = docBySlug("providers")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/providers" },
};

export default function ProviderTermsPage() {
  return (
    <LegalDocument
      slug="providers"
      lead={
        <>
          For the doctors and nurses who deliver care through {COMPANY.brand}.
          These terms are in addition to the{" "}
          <Xref href="/legal/terms">Terms of Use</Xref> and, where the two
          conflict on a matter of practice, these prevail.
        </>
      }
      intro={
        <Callout tone="info" title="The relationship in one paragraph">
          <P>
            You are an <strong>independent practitioner</strong>, not our
            employee. You keep your own registration, your own indemnity and your
            own clinical judgement. We provide the platform, find you patients,
            handle the money and take a commission. Neither of us can direct the
            other&rsquo;s professional decisions.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "eligibility",
          title: "Who can join",
          content: (
            <>
              <H3>Doctors</H3>
              <UL>
                <LI>
                  A current, unrestricted registration as a{" "}
                  <T>Registered Medical Practitioner</T> on a State Medical
                  Register or the National Medical Register under the National
                  Medical Commission Act, 2019.
                </LI>
                <LI>
                  Qualifications recognised under the Act, and evidence of any
                  postgraduate specialty you list.
                </LI>
                <LI>
                  <T>Professional indemnity insurance</T> at a level appropriate
                  to your practice, valid throughout your time on the platform.
                </LI>
                <LI>Government photo identity and PAN, and bank details for payouts.</LI>
              </UL>
              <H3>Nurses</H3>
              <UL>
                <LI>
                  Current registration with a <T>State Nursing Council</T> under
                  the Indian Nursing Council Act, 1947.
                </LI>
                <LI>
                  A recognised qualification — <T>ANM, GNM, B.Sc Nursing or M.Sc
                  Nursing</T> — with certificates.
                </LI>
                <LI>
                  Demonstrated competence in each service capability you list:
                  wound dressing and post-operative care, elderly and bedridden
                  care, vitals and sample collection, or injection and IV
                  assistance.
                </LI>
                <LI>Indemnity cover, identity, PAN and bank details as above.</LI>
              </UL>
              <P>
                You must tell us <T>within seven days</T> if your registration
                lapses, is suspended or is made conditional, if your indemnity
                lapses, or if you become the subject of a disciplinary or
                criminal proceeding. Failure to disclose is itself grounds for
                removal.
              </P>
            </>
          ),
        },
        {
          id: "verification",
          title: "Verification",
          content: (
            <>
              <P>
                Every provider passes through a verification workflow before
                taking patients, and a status is held against your account.
              </P>
              <Table
                columns={["Status", "What it means", "Can you take work?"]}
                rows={[
                  ["Not started", "You have not submitted documents yet.", "No"],
                  ["Submitted", "Documents received, queued for review.", "No"],
                  [
                    "Under review",
                    "We are checking your registration against the council register.",
                    "No",
                  ],
                  [
                    "Verified",
                    "Registration and credentials confirmed. Your profile carries the verified badge.",
                    "Yes",
                  ],
                  [
                    "Rejected",
                    "We could not confirm your credentials. You will be told why and may re-apply.",
                    "No",
                  ],
                  [
                    "Suspended",
                    "Verification withdrawn pending an investigation or a lapsed document.",
                    "No",
                  ],
                ]}
              />
              <UL>
                <LI>
                  We re-verify periodically and whenever a document expires.
                  Keep them current — an expired registration means your listing
                  stops.
                </LI>
                <LI>
                  <T>Verified is not an endorsement</T> of your clinical
                  judgement, and we tell patients so plainly in the{" "}
                  <Xref href="/legal/medical-disclaimer#provider-verification">Medical
                  Disclaimer</Xref>.
                </LI>
                <LI>
                  Submitting a forged or altered document ends your account
                  permanently and is reported to your council and to the police.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "independence",
          title: "You are independent, not employed",
          content: (
            <>
              <OL>
                <OLI>
                  Nothing here creates employment, partnership, agency or a joint
                  venture. You are not entitled to employee benefits, provident
                  fund, gratuity or leave from us.
                </OLI>
                <OLI>
                  You decide <T>when you work, which requests you accept, and
                  what you charge</T>. We set no minimum hours and no quota.
                </OLI>
                <OLI>
                  <T>Your clinical judgement is yours alone.</T> We never direct,
                  override, or algorithmically influence a diagnosis, a
                  prescription or a referral, and the Telemedicine Practice
                  Guidelines, 2020 forbid us from doing so.
                </OLI>
                <OLI>
                  You are responsible for your own income tax, GST where
                  applicable, and professional registration fees. We deduct TDS
                  where the law requires and give you the certificate.
                </OLI>
                <OLI>
                  You may work for hospitals, clinics or other platforms. We
                  impose no exclusivity.
                </OLI>
              </OL>
            </>
          ),
        },
        {
          id: "scope",
          title: "Scope of practice",
          content: (
            <>
              <H3>Doctors</H3>
              <UL>
                <LI>
                  Practise within your registration, your qualifications and your
                  competence. Refer on where a case is outside them.
                </LI>
                <LI>
                  Follow the <T>Telemedicine Practice Guidelines, 2020</T> in
                  full — mode-appropriate prescribing, the List O / A / B
                  framework, identity verification, and the prohibited list.{" "}
                  <T>
                    Never prescribe a Schedule X drug or any narcotic or
                    psychotropic substance over telemedicine.
                  </T>
                </LI>
                <LI>
                  Display your registration number in consultations and on every
                  prescription. The platform prints it for you.
                </LI>
                <LI>
                  Refuse or escalate where remote assessment is unsafe. We will
                  never hold a clinically-justified refusal against you, and your
                  rating is protected in such cases.
                </LI>
                <LI>
                  In an emergency, confine yourself to first aid, life-saving
                  advice, counselling and referral, and get the patient to
                  in-person care.
                </LI>
              </UL>
              <H3>Nurses</H3>
              <Callout tone="warn" title="Hard limits, enforced by the platform">
                <UL>
                  <LI>
                    <strong>You may not diagnose.</strong>
                  </LI>
                  <LI>
                    <strong>You may not prescribe</strong>, or alter a doctor&rsquo;s
                    prescription in drug, dose or duration. The platform does not
                    permit a nurse to issue a prescription at all.
                  </LI>
                  <LI>
                    <strong>
                      You may not administer a prescription-only medicine without
                      a valid prescription
                    </strong>{" "}
                    from a registered doctor. Sight it, and record that you did.
                  </LI>
                  <LI>
                    <strong>Stay inside your declared skills.</strong> Decline
                    anything beyond them and say why.
                  </LI>
                </UL>
              </Callout>
              <P>
                Escalate to a doctor or to emergency services whenever a patient
                deteriorates or presents beyond nursing scope. Recognising that
                line is the core of the role.
              </P>
            </>
          ),
        },
        {
          id: "conduct",
          title: "Conduct",
          content: (
            <>
              <UL>
                <LI>
                  <T>Confidentiality.</T> Patient information is accessible to
                  you only for the care you are delivering. Do not retain, copy,
                  photograph, discuss or publish it, including in anonymised case
                  posts on social media, which are far more identifying than
                  people assume.
                </LI>
                <LI>
                  <T>Consent.</T> Obtain it before examining, treating or
                  photographing. Record that you did.
                </LI>
                <LI>
                  <T>Records.</T> Keep a proper log of every encounter. It is your
                  professional obligation and your defence.
                </LI>
                <LI>
                  <T>Boundaries.</T> No personal relationship with a patient. No
                  contact outside the platform except for clinical follow-up. No
                  soliciting patients away from {COMPANY.brand} to avoid
                  commission — that is a material breach.
                </LI>
                <LI>
                  <T>No discrimination</T> on caste, religion, gender, sexual
                  orientation, disability, HIV status or ability to pay.
                </LI>
                <LI>
                  <T>No fee-splitting, kickbacks or commissions</T> for referrals
                  to laboratories, pharmacies or hospitals. This is professional
                  misconduct under the Ethics Regulations.
                </LI>
                <LI>
                  <T>No unlawful acts.</T> Prenatal sex determination is
                  prohibited by the PCPNDT Act, 1994; termination of pregnancy
                  outside the MTP Act, 1971 is an offence.
                </LI>
                <LI>
                  <T>Punctuality and communication.</T> Arrive when you said, or
                  tell the patient early. Confirm arrival with the four-digit code
                  the patient reads to you — never ask them to share it in
                  advance.
                </LI>
                <LI>
                  <T>Appearance and hygiene.</T> Identifiable, professional, with
                  proper infection control and safe sharps disposal on home
                  visits.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "listing",
          title: "Your listing and your data",
          content: (
            <>
              <P>
                Your name, photograph, qualifications, specialty or skills,
                experience, languages, council registration number, fees, ratings
                and reviews are <T>displayed publicly</T>. A patient choosing a
                clinician is entitled to see them, and you consent to that
                display for as long as you are listed.
              </P>
              <UL>
                <LI>
                  Everything you publish must be <T>true and current</T>.
                  Overstating a qualification is misconduct, not marketing.
                </LI>
                <LI>
                  <T>Your live location</T> is published to patients only while
                  you are marked online, and only at the granularity needed to
                  find and route to you. Go offline and it stops.
                </LI>
                <LI>
                  Patient ratings of you are published. Your ratings of patients
                  are not published, but are visible to us and inform future
                  matching.
                </LI>
                <LI>
                  On leaving, your public profile is removed. Prescriptions you
                  issued keep your name and registration number, because they are
                  clinical documents that must continue to say who wrote them.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "money",
          title: "Fees, commission and payouts",
          content: (
            <>
              <UL>
                <LI>
                  You set your consultation and home-visit fees and the price of
                  any package you list, within any band the platform publishes.
                </LI>
                <LI>
                  We charge a <T>commission</T> on the clinical fee. The current
                  rate is shown in your dashboard; any change is notified{" "}
                  <T>30 days</T> in advance and never applies retrospectively.
                </LI>
                <LI>
                  Every completed encounter posts a ledger line —{" "}
                  <T>gross, commission, net</T>. Nothing is deducted that is not
                  itemised.
                </LI>
                <LI>
                  <T>Cash you collect</T> is recorded as received by you, and the
                  commission on it is set off against your next payout.
                </LI>
                <LI>
                  Payouts go to your registered bank account on the published
                  cycle, after TDS, with a statement.
                </LI>
                <LI>
                  A payout may be <T>held</T> where a consultation is disputed, a
                  refund is pending, or an investigation is open. We tell you why
                  and how long.
                </LI>
                <LI>
                  Where a patient is refunded for care you did not deliver, the
                  corresponding amount is recovered from your ledger.
                </LI>
              </UL>
              <P>
                Patient-side rules are in the{" "}
                <Xref href="/legal/sales">Sales Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "cancellations",
          title: "Availability and cancellations",
          content: (
            <>
              <UL>
                <LI>
                  Only mark yourself <T>online</T> when you can genuinely take a
                  request. A patient in pain choosing you because you appear
                  available, and then waiting, is worse than not seeing you at
                  all.
                </LI>
                <LI>
                  Once you accept, you are committed. Cancel only for a genuine
                  reason, and as early as you can.
                </LI>
                <LI>
                  Repeated late cancellations, no-shows and long response times
                  reduce your visibility and can end your listing.
                </LI>
                <LI>
                  A <T>clinically-justified</T> refusal or escalation is never
                  counted against you. Tell us the reason and it is recorded as
                  such.
                </LI>
                <LI>
                  You may end an encounter where you are abused, threatened or
                  put at risk, and you will still be paid. Report it to{" "}
                  <MailLink address={CONTACTS.support} />; we act on it.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "liability",
          title: "Liability and indemnity",
          content: (
            <>
              <OL>
                <OLI>
                  You are <T>solely responsible</T> for your clinical acts and
                  omissions, and you must hold professional indemnity insurance
                  covering them, including telemedicine and home visits.
                </OLI>
                <OLI>
                  You indemnify {COMPANY.legalName} against any claim arising
                  from your clinical practice, your breach of these terms, your
                  breach of confidentiality, or any misrepresentation of your
                  credentials.
                </OLI>
                <OLI>
                  We indemnify you against claims arising from a failure of{" "}
                  <T>our</T> platform — a data breach caused by us, or a defect in
                  our software that causes harm. Where a technology failure at our
                  end breaches patient confidentiality, the Telemedicine Practice
                  Guidelines place that responsibility on us and we accept it.
                </OLI>
                <OLI>
                  Our aggregate liability to you in any twelve-month period is
                  limited to the commission we earned from your work in that
                  period.
                </OLI>
                <OLI>
                  Tell us of any claim, complaint or regulatory proceeding
                  connected with care delivered through {COMPANY.brand} as soon as
                  you become aware of it, and cooperate with the investigation.
                </OLI>
              </OL>
            </>
          ),
        },
        {
          id: "removal",
          title: "Suspension and removal",
          content: (
            <>
              <P>We suspend immediately, before investigating, where:</P>
              <UL>
                <LI>
                  your registration lapses, is suspended, or is made conditional;
                </LI>
                <LI>a credential turns out to be forged or overstated;</LI>
                <LI>
                  there is a credible allegation of clinical harm, abuse,
                  assault or sexual misconduct;
                </LI>
                <LI>
                  we find prescribing outside the Guidelines, particularly of
                  restricted drugs;
                </LI>
                <LI>patient data is misused.</LI>
              </UL>
              <P>We may remove you, with notice, for:</P>
              <UL>
                <LI>persistent poor ratings or substantiated complaints;</LI>
                <LI>repeated cancellations, no-shows or unavailability;</LI>
                <LI>
                  soliciting patients off-platform to avoid commission, or
                  fee-splitting;
                </LI>
                <LI>breach of any part of these terms.</LI>
              </UL>
              <P>
                <T>You will be told the reason</T> and may appeal to{" "}
                <MailLink address={CONTACTS.grievance} />. A person reviews it —
                where the matter is clinical, a clinician does. Earnings already
                due are paid, less any recovery. Where the conduct is reportable,
                we report it to your State Medical or Nursing Council, as the
                Telemedicine Practice Guidelines require of us.
              </P>
              <P>
                You may leave at any time with <T>seven days&rsquo; notice</T>,
                after completing bookings already accepted.
              </P>
            </>
          ),
        },
        {
          id: "provider-data",
          title: "Data protection duties",
          content: (
            <>
              <P>
                When you access patient data through {COMPANY.brand}, you handle
                it under both this agreement and the{" "}
                <Xref href="/legal/privacy">Privacy Policy</Xref>.
              </P>
              <UL>
                <LI>
                  Access only the records of patients you are treating. Access is
                  logged.
                </LI>
                <LI>
                  Do not export, copy or retain patient data beyond your own
                  professional record-keeping obligations.
                </LI>
                <LI>
                  Use a device with a screen lock and current software, and never
                  a shared or public computer for consultations.
                </LI>
                <LI>
                  Report any suspected data breach to{" "}
                  <MailLink address={CONTACTS.security} /> within{" "}
                  <T>24 hours</T> of becoming aware of it.
                </LI>
                <LI>
                  Do not use patient data for research, teaching or publication
                  without that patient&rsquo;s specific, documented consent and
                  proper ethical approval.
                </LI>
              </UL>
            </>
          ),
        },
      ]}
    />
  );
}
