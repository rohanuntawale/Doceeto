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

const doc = docBySlug("medical-disclaimer")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/medical-disclaimer" },
};

export default function MedicalDisclaimerPage() {
  return (
    <LegalDocument
      slug="medical-disclaimer"
      lead={
        <>
          {COMPANY.brand} connects you to registered clinicians and helps you
          decide which one to see. It does not practise medicine itself. This
          page sets out, plainly, what the platform can and cannot be relied on
          for.
        </>
      }
      intro={
        <Callout tone="critical" title="If this is an emergency, stop reading">
          <P>
            Call <strong>112</strong> (national emergency) or{" "}
            <strong>108</strong> (ambulance) now, or go to the nearest emergency
            department. Do not wait for a {COMPANY.brand} response, and do not
            use the symptom checker to decide whether an emergency is real.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "no-relationship",
          title: "We are not your doctor",
          content: (
            <>
              <P>
                Using {COMPANY.brand} does not create a doctor&ndash;patient
                relationship between you and {COMPANY.legalName}. We are a
                technology platform. That relationship forms{" "}
                <T>only between you and the registered clinician</T> who accepts
                your request and assesses you.
              </P>
              <P>
                Nothing on this platform, the symptom checker, the health score,
                BMI and risk indicators, health tips, articles, specialty
                suggestions or search results, is a medical opinion about you.
                It is information and navigation, produced by software, and no
                registered medical practitioner has reviewed your case before it
                is shown to you.
              </P>
            </>
          ),
        },
        {
          id: "not-a-substitute",
          title: "Not a substitute for professional advice",
          content: (
            <>
              <P>Always seek the advice of a qualified clinician about anything concerning your health. In particular:</P>
              <UL>
                <LI>
                  <T>Never disregard professional medical advice</T>, or delay
                  seeking it, because of something you read on {COMPANY.brand}.
                </LI>
                <LI>
                  <T>Never start, stop or change a prescribed medicine</T> on the
                  strength of information here without speaking to the doctor who
                  prescribed it.
                </LI>
                <LI>
                  <T>Never use the platform to self-diagnose</T> a condition, or
                  to convince yourself that a symptom is nothing.
                </LI>
                <LI>
                  If your symptoms worsen, change character, or simply persist
                  when you expected them to settle,{" "}
                  <T>be seen in person</T> regardless of what any tool here said.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "symptom-checker",
          title: "What the symptom checker actually does",
          content: (
            <>
              <P>
                The checker asks a series of questions and narrows toward{" "}
                <T>which kind of clinician to see, and how soon</T>. It is a
                triage and navigation aid. It is built from a rule engine and,
                where configured, a large language model.
              </P>
              <Table
                columns={["It does", "It does not"]}
                rows={[
                  [
                    "Suggest a specialty to book",
                    "Diagnose you, or exclude a diagnosis",
                  ],
                  [
                    "Estimate how urgently you should be seen",
                    "Decide whether you are safe to stay at home",
                  ],
                  [
                    "List plain-language possibilities worth discussing",
                    "Rank them by real clinical probability for you",
                  ],
                  [
                    "Flag some emergency patterns and route you to SOS",
                    "Reliably detect every emergency",
                  ],
                  [
                    "Take your recorded history into account",
                    "Examine you, hear your chest, or see your test results",
                  ],
                ]}
              />
              <Callout tone="warn" title="It can be wrong in both directions">
                <P>
                  It can suggest something benign when the cause is serious, and
                  something alarming when the cause is trivial. Language models
                  can also produce fluent, confident answers that are simply
                  incorrect. <strong>A reassuring result is never clearance.</strong>{" "}
                  If you feel badly unwell, act on that and not on the screen.
                </P>
              </Callout>
              <P>
                The checker is not a registered medical device and has not been
                approved as one by the Central Drugs Standard Control
                Organisation or any other regulator. It is not validated for
                diagnostic use in children, in pregnancy, or in people with
                multiple complex conditions. See how your data is used by it in
                the <Xref href="/legal/privacy#ai">Privacy Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "red-flags",
          title: "Symptoms that mean go now, not book later",
          content: (
            <>
              <Callout tone="critical" title="Call 112 or 108, or go to an emergency department">
                <UL>
                  <LI>
                    Chest pain or pressure, especially with sweating, nausea, or
                    pain spreading to the arm, jaw or back
                  </LI>
                  <LI>Difficulty breathing, or fighting for breath</LI>
                  <LI>
                    Sudden weakness or numbness of the face, arm or leg;
                    drooping face; slurred speech; sudden confusion, {" "}
                    <strong>this is a stroke until proved otherwise, and every minute counts</strong>
                  </LI>
                  <LI>Unconsciousness, a fit, or a person who cannot be roused</LI>
                  <LI>Bleeding that will not stop</LI>
                  <LI>A serious burn, a major injury, or a suspected fracture with deformity</LI>
                  <LI>Sudden severe headache, described as the worst ever</LI>
                  <LI>Severe abdominal pain, or vomiting blood</LI>
                  <LI>A severe allergic reaction, swelling of the lips, tongue or throat, or a widespread rash with breathlessness</LI>
                  <LI>Poisoning, overdose, or a snake bite</LI>
                  <LI>In pregnancy: bleeding, severe abdominal pain, fits, or reduced movements of the baby</LI>
                  <LI>
                    In an infant: refusal to feed, floppiness, a high fever with
                    a rash that does not fade under pressure, or noisy or
                    difficult breathing
                  </LI>
                  <LI>Thoughts of harming yourself or someone else</LI>
                </UL>
              </Callout>
              <P>
                This list is not exhaustive. Trust your instinct, if something
                feels seriously wrong, treat it as an emergency.
              </P>
              <Callout tone="info" title="If you are struggling">
                <P>
                  <strong>Tele-MANAS</strong>, the Government of India&rsquo;s
                  mental-health helpline, is free and available at all hours on{" "}
                  <strong>14416</strong> or <strong>1-800-891-4416</strong>. You
                  do not have to be in crisis to call.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "remote-limits",
          title: "The limits of remote assessment",
          content: (
            <>
              <P>
                A clinician on a video call cannot palpate your abdomen, listen
                to your chest, take your blood pressure or look properly into an
                ear. They are working from what they can see and what you tell
                them. This makes some things genuinely unsafe to assess remotely.
              </P>
              <P>
                A good doctor will therefore sometimes <T>refuse to prescribe</T>{" "}
                and tell you to be seen in person. That is the system working
                correctly, not the doctor being unhelpful, and it is required of
                them by the Telemedicine Practice Guidelines, 2020. See{" "}
                <Xref href="/legal/telemedicine-consent">Telemedicine &amp;
                Informed Consent</Xref>.
              </P>
              <P>
                <T>Nurses on {COMPANY.brand} do not diagnose and do not
                prescribe.</T> They deliver defined nursing care at home
                injections, dressings, monitoring, elder and post-operative care
                on the instruction of a doctor or within their own established
                scope of practice.
              </P>
            </>
          ),
        },
        {
          id: "provider-verification",
          title: "What verification does and does not mean",
          content: (
            <>
              <P>
                A <T>verified</T> badge means we have checked the credentials and
                council registration a provider gave us, against the register,
                at the time of onboarding and periodically since.
              </P>
              <P>It does not mean:</P>
              <UL>
                <LI>that we endorse their clinical judgement;</LI>
                <LI>
                  that we supervise, direct or review the care they give, we do
                  not, and doing so would itself be practising medicine;
                </LI>
                <LI>
                  that they are the right clinician for your particular problem.
                </LI>
              </UL>
              <P>
                Every provider is an <T>independent practitioner</T>, responsible
                for their own registration, indemnity and conduct. Ratings and
                reviews are the opinions of other patients, not our assessment.
                If you doubt a clinician&rsquo;s registration, ask for their
                number and check it on the{" "}
                <T>National Medical Commission</T> or state council register
                and please tell us at <MailLink address={CONTACTS.medical} />.
              </P>
            </>
          ),
        },
        {
          id: "content",
          title: "Health content, scores and indicators",
          content: (
            <>
              <P>
                Health tips, articles, news items, BMI figures, the health score
                and diabetes-risk indicators are <T>general information</T>,
                calculated from public formulas and the data you entered
                yourself.
              </P>
              <UL>
                <LI>
                  <T>BMI</T> is a crude population measure. It misreads muscular
                  people, older people, pregnant women and children, and the
                  thresholds that matter for South Asian populations differ from
                  the standard ones.
                </LI>
                <LI>
                  The <T>Indian Diabetes Risk Score</T> is a screening
                  instrument. A high score is a reason to get a blood test, not a
                  diagnosis of diabetes; a low score does not rule it out.
                </LI>
                <LI>
                  The <T>health score</T> is a motivational summary of what you
                  told us. It is not a clinical assessment and no clinician
                  computed it.
                </LI>
                <LI>
                  These figures are only as good as the data you entered. Wrong
                  height, stale weight, or an unrecorded condition makes them
                  wrong.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "medicine",
          title: "Medicine information",
          content: (
            <>
              <P>
                Drug names, dosages, timings and descriptions shown in the
                catalogue or on a prescription are reproduced for your
                convenience. They do not replace the manufacturer&rsquo;s
                package insert, the dispensing pharmacist&rsquo;s counselling, or
                your doctor&rsquo;s instructions.
              </P>
              <P>
                Read the leaflet. Check the expiry. Tell your doctor about{" "}
                <T>every</T> medicine you take, including anything ayurvedic,
                homoeopathic, herbal or over the counter, interactions are real
                and are a common cause of avoidable harm.
              </P>
              <P>
                Suspected an adverse reaction? Tell the prescribing doctor, and
                report it to the{" "}
                <T>Pharmacovigilance Programme of India</T> on 1800-180-3024. You
                can also tell us at <MailLink address={CONTACTS.medical} /> and we
                will pass it on.
              </P>
            </>
          ),
        },
        {
          id: "outcomes",
          title: "Outcomes vary",
          content: (
            <P>
              Any outcome described on {COMPANY.brand}, in a testimonial, a case
              study, or a statistic, is not a promise of what will happen to
              you. Medicine deals in probabilities. Two people with the same
              diagnosis and the same treatment can have entirely different
              results, and no clinician can guarantee one.
            </P>
          ),
        },
        {
          id: "harm",
          title: "If something went wrong",
          content: (
            <>
              <P>
                We want to know. Report clinical concerns to{" "}
                <MailLink address={CONTACTS.medical} />, the clinical governance
                address, read by a person, not a queue.
              </P>
              <H3>Your options, which we will not stand in the way of</H3>
              <UL>
                <LI>
                  Complain to us formally through{" "}
                  <Xref href="/legal/grievance">Grievance Redressal</Xref>. We
                  will give you the encounter record and the provider&rsquo;s
                  registration details.
                </LI>
                <LI>
                  Complain about a doctor&rsquo;s professional conduct to the{" "}
                  <T>State Medical Council</T> they are registered with, or to
                  the <T>National Medical Commission</T>.
                </LI>
                <LI>
                  Complain about a nurse to the relevant{" "}
                  <T>State Nursing Council</T> or the{" "}
                  <T>Indian Nursing Council</T>.
                </LI>
                <LI>
                  Approach a <T>Consumer Disputes Redressal Commission</T> under
                  the Consumer Protection Act, 2019.
                </LI>
              </UL>
              <P>
                How liability is allocated between us and an independent provider
                is set out in the{" "}
                <Xref href="/legal/terms#liability">Terms of Use</Xref>.
              </P>
            </>
          ),
        },
      ]}
    />
  );
}
