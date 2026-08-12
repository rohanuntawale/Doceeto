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

const doc = docBySlug("telemedicine-consent")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/telemedicine-consent" },
};

export default function TelemedicineConsentPage() {
  return (
    <LegalDocument
      slug="telemedicine-consent"
      lead={
        <>
          Remote consultations on {COMPANY.brand} run under the{" "}
          <em>Telemedicine Practice Guidelines, 2020</em>, issued by the Board of
          Governors in supersession of the Medical Council of India and appended
          to the Indian Medical Council (Professional Conduct, Etiquette and
          Ethics) Regulations, 2002. This page explains what you are consenting
          to, and what the doctor is bound by.
        </>
      }
      intro={
        <Callout tone="info" title="Consent, in one line">
          <P>
            By starting a consultation you consent to being assessed remotely by
            a Registered Medical Practitioner, to sharing your health
            information with them, and to being prescribed for within the limits
            the Guidelines impose. You can withdraw at any point, including
            mid-consultation.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "who-treats-you",
          title: "Who is treating you",
          content: (
            <>
              <P>
                Every doctor on {COMPANY.brand} is a{" "}
                <T>Registered Medical Practitioner (RMP)</T> enrolled on the
                State Medical Register or the National Medical Register under the
                National Medical Commission Act, 2019.
              </P>
              <UL>
                <LI>
                  You can see their <T>name, qualifications, specialty and
                  registration number</T> on their profile before you book, and
                  the number is printed on every prescription they issue.
                </LI>
                <LI>
                  The Guidelines oblige an RMP to display that registration
                  number on all communications — you are entitled to ask for it
                  and to verify it on the NMC register.
                </LI>
                <LI>
                  The doctor is an <T>independent practitioner</T> using{" "}
                  {COMPANY.brand} to reach you. Clinical responsibility is theirs.
                </LI>
                <LI>
                  <T>Nurses are a separate cadre</T> with a separate scope. See{" "}
                  <Xref href="/legal/telemedicine-consent#nurses">below</Xref>.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "modes",
          title: "How a consultation can happen",
          content: (
            <>
              <P>
                The Guidelines recognise three modes, and they are not
                equivalent. What a doctor may prescribe depends on which one was
                used.
              </P>
              <Table
                columns={["Mode", "Strength", "Limitation"]}
                rows={[
                  [
                    "Video",
                    "Closest to an in-person visit. The doctor can see you, your colour, your breathing, a rash or a wound.",
                    "Needs bandwidth at both ends.",
                  ],
                  [
                    "Audio",
                    "Works on a weak connection.",
                    "No visual cues at all. Narrows what can safely be prescribed.",
                  ],
                  [
                    "Text or chat",
                    "Good for follow-ups and simple clarifications.",
                    "Weakest signal. Suitable for the narrowest range of decisions.",
                  ],
                ]}
              />
              <P>
                A doctor may ask to switch modes — usually onto video — and may
                decline to proceed until you do. That is a clinical safety
                judgement, and the Guidelines require them to make it.
              </P>
            </>
          ),
        },
        {
          id: "consent",
          title: "Your consent",
          content: (
            <>
              <P>
                Under the Guidelines, consent is <T>implied</T> when you initiate
                the consultation yourself — which is what happens whenever you
                book on {COMPANY.brand}. <T>Explicit</T> consent is required, and
                recorded, when a health worker, caregiver or the doctor initiates
                it on your behalf.
              </P>
              <H3>What you are consenting to</H3>
              <UL>
                <LI>Assessment by an RMP without a physical examination.</LI>
                <LI>
                  Sharing your health profile, symptoms, history and any uploaded
                  reports or photographs with that doctor.
                </LI>
                <LI>
                  A prescription being issued electronically, within the limits{" "}
                  <Xref href="/legal/telemedicine-consent#prescribing">below</Xref>.
                </LI>
                <LI>
                  The consultation being recorded in your medical record and
                  retained as{" "}
                  <Xref href="/legal/privacy#retention">the law requires</Xref>.
                </LI>
                <LI>
                  Being referred for in-person care, tests or admission where the
                  doctor judges it necessary.
                </LI>
              </UL>
              <H3>Withdrawing consent</H3>
              <P>
                You may stop at any moment, including part-way through, without
                giving a reason. Refunds follow the{" "}
                <Xref href="/legal/sales#cancellation">Sales Policy</Xref>.
                Withdrawing does not delete a record of care already given —
                that record is a medical document, and the doctor is required to
                keep it.
              </P>
              <H3>Consenting for someone else</H3>
              <P>
                You may consult on behalf of a child, an elderly parent or a
                dependant where you have lawful authority to consent to their
                treatment. Say so at the start. The doctor may still ask to see
                or speak with the patient directly.
              </P>
            </>
          ),
        },
        {
          id: "identity",
          title: "Confirming who you are",
          content: (
            <>
              <P>
                The Guidelines require the doctor to be satisfied of your
                identity, and require you to be satisfied of theirs. Expect to be
                asked for your name and age at the start of the consultation, and
                to show a photo identity document where there is doubt.
              </P>
              <P>
                <T>Do not consult under someone else&rsquo;s name or account.</T>{" "}
                A prescription written against the wrong person&rsquo;s allergies,
                weight or medication list is a direct route to harm, and it makes
                the record medico-legally worthless.
              </P>
            </>
          ),
        },
        {
          id: "prescribing",
          title: "What can and cannot be prescribed",
          content: (
            <>
              <P>
                The Guidelines place medicines into defined lists, and a doctor
                consulting remotely may prescribe only from the list appropriate
                to the mode and to whether this is a first consultation or a
                follow-up.
              </P>
              <Table
                columns={["List", "What it covers", "When it may be prescribed"]}
                rows={[
                  [
                    "List O",
                    "Over-the-counter medicines that are safe without a prescription — paracetamol, oral rehydration salts, antacids, simple antiseptics, common vitamins.",
                    "Any mode: video, audio or text.",
                  ],
                  [
                    "List A",
                    "Relatively safe medicines with a low potential for abuse, where a visual assessment is enough to prescribe on a first consultation.",
                    "Video consultation, or a follow-up in any mode.",
                  ],
                  [
                    "List B",
                    "Add-on medicines to optimise treatment already started for a condition the patient is under care for.",
                    "Follow-up consultations only.",
                  ],
                  [
                    "Prohibited list",
                    "Schedule X drugs, and narcotic and psychotropic substances under the NDPS Act, 1985.",
                    "Never, by any mode of telemedicine, by anyone.",
                  ],
                ]}
              />
              <Callout tone="critical" title="Do not ask for what cannot be given">
                <P>
                  No doctor on {COMPANY.brand} may prescribe a Schedule X drug or
                  any narcotic or psychotropic substance over telemedicine, in
                  any circumstances, however genuine your need. Pressing a doctor
                  to do so, or approaching several doctors for the same
                  prescription, will end your account and may be reported. If you
                  need such medicine, you need an <strong>in-person</strong>{" "}
                  consultation.
                </P>
              </Callout>
              <H3>The prescription itself</H3>
              <UL>
                <LI>
                  It is issued electronically, carries the doctor&rsquo;s name,
                  qualifications and registration number, and is a{" "}
                  <T>valid prescription</T> at any pharmacy.
                </LI>
                <LI>
                  It is a <T>snapshot</T>: it keeps saying what it said on the
                  day, even if the doctor later edits their profile or leaves the
                  platform.
                </LI>
                <LI>
                  It can be shared with a chemist through an unlisted link.
                  Anyone holding that link can read it —{" "}
                  <Xref href="/legal/privacy#sharing">see the warning</Xref>.
                </LI>
                <LI>
                  <T>Doctors only.</T> Nurses on {COMPANY.brand} cannot issue
                  prescriptions, and the platform does not permit it.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "refusal",
          title: "When a doctor must refuse",
          content: (
            <>
              <P>
                The Guidelines give — and require — full professional discretion
                to decline. A doctor should refuse, or convert the consultation
                into a referral, where:
              </P>
              <UL>
                <LI>
                  a physical examination is essential to a safe decision;
                </LI>
                <LI>
                  the complaint is outside their specialty or competence;
                </LI>
                <LI>
                  the information available is too thin to prescribe on;
                </LI>
                <LI>
                  the mode of consultation is inadequate for the problem;
                </LI>
                <LI>
                  they suspect the request is a way of obtaining medicine for
                  misuse;
                </LI>
                <LI>the situation is an emergency needing in-person care.</LI>
              </UL>
              <Callout tone="warn" title="In an emergency, telemedicine is a bridge">
                <P>
                  Where a consultation turns out to be an emergency, the
                  Guidelines confine the doctor to{" "}
                  <strong>first aid, immediate life-saving advice, counselling and
                  referral</strong>, with the explicit goal of getting you
                  in-person care as fast as possible. Read the{" "}
                  <Xref href="/legal/emergency">Emergency Services Policy</Xref>{" "}
                  and call <strong>112</strong> or <strong>108</strong>.
                </P>
              </Callout>
              <P>
                A refusal on these grounds is the doctor doing their job. Refunds
                follow the <Xref href="/legal/sales">Sales Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "your-part",
          title: "Your side of it",
          content: (
            <>
              <P>
                A remote consultation is only as good as what you bring to it.
                You agree to:
              </P>
              <OL>
                <OLI>
                  give <T>complete and truthful</T> information about your
                  symptoms, history, allergies and current medication —
                  including anything ayurvedic, homoeopathic or herbal, and
                  anything bought over the counter;
                </OLI>
                <OLI>
                  say if you are <T>pregnant, breastfeeding, or trying to
                  conceive</T>, and give the patient&rsquo;s correct age and
                  weight, which change dosing entirely in children;
                </OLI>
                <OLI>
                  upload the reports and images the doctor asks for;
                </OLI>
                <OLI>
                  take the consultation somewhere private, quiet and adequately
                  lit;
                </OLI>
                <OLI>
                  follow the advice given, and <T>attend follow-up</T> or seek
                  in-person care when told to;
                </OLI>
                <OLI>
                  not record the consultation without the doctor&rsquo;s express
                  consent, and not publish any part of it.
                </OLI>
              </OL>
            </>
          ),
        },
        {
          id: "records",
          title: "Records and confidentiality",
          content: (
            <>
              <P>
                The doctor is required to keep a log of the consultation — the
                mode used, what was discussed, and what was prescribed. That
                record is retained as set out in{" "}
                <Xref href="/legal/privacy#retention">retention</Xref>. Your
                prescriptions and care history are available to you at any time in{" "}
                <T>Records</T>.
              </P>
              <P>
                Doctors are bound by professional confidentiality independently
                of anything we do. A breach of it is professional misconduct
                under the Ethics Regulations, and is separately reportable to
                their State Medical Council.
              </P>
              <P>
                Where a technology failure at our end causes a breach of
                confidentiality, the Guidelines place that responsibility on us,
                not on the doctor. We accept it — see{" "}
                <Xref href="/legal/security">Security</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "nurses",
          title: "Nurses: a different scope",
          content: (
            <>
              <P>
                Nurses on {COMPANY.brand} are registered with a State Nursing
                Council under the Indian Nursing Council Act, 1947. They deliver{" "}
                <T>hands-on nursing care at your home</T> — injections and
                infusions, wound care and dressings, catheter and stoma care,
                vitals monitoring, post-operative care, and elder care.
              </P>
              <Callout tone="warn" title="What a nurse will not do">
                <UL>
                  <LI>
                    <strong>Diagnose.</strong> Naming a condition is a
                    doctor&rsquo;s act.
                  </LI>
                  <LI>
                    <strong>Prescribe, or change your prescription.</strong> Not
                    the drug, not the dose, not the duration.
                  </LI>
                  <LI>
                    <strong>Administer a prescription-only medicine without a
                    valid prescription</strong> from a registered doctor.
                  </LI>
                  <LI>
                    <strong>Perform a procedure outside their scope</strong> or
                    beyond what their skills list on this platform declares.
                  </LI>
                </UL>
              </Callout>
              <P>
                A nurse who believes you need a doctor will tell you to get one,
                and should escalate to emergency services if you are unwell.
                Their scope and obligations are set out in the{" "}
                <Xref href="/legal/providers">Provider Terms</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "platform-duties",
          title: "Our obligations as the platform",
          content: (
            <>
              <P>
                The Guidelines place duties directly on technology platforms
                offering telemedicine. We:
              </P>
              <UL>
                <LI>
                  conduct due diligence so that <T>only Registered Medical
                  Practitioners</T> can consult through {COMPANY.brand}, and
                  verify registration at onboarding and periodically after;
                </LI>
                <LI>
                  make the doctor&rsquo;s name, qualification, registration
                  number and contact details visible to you;
                </LI>
                <LI>
                  do not manipulate, override or algorithmically direct a
                  doctor&rsquo;s clinical judgement, and never use software to
                  counsel patients or prescribe in place of an RMP;
                </LI>
                <LI>
                  operate a <Xref href="/legal/grievance">grievance
                  mechanism</Xref> with a named officer and published timelines;
                </LI>
                <LI>
                  report to the relevant State Medical Council any practitioner
                  found in non-compliance, and remove them from the platform.
                </LI>
              </UL>
              <P>
                Concerns about a doctor&rsquo;s conduct in a teleconsultation go
                to <MailLink address={CONTACTS.medical} />.
              </P>
            </>
          ),
        },
      ]}
    />
  );
}
