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

const doc = docBySlug("pharmacy")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/pharmacy" },
};

export default function PharmacyPolicyPage() {
  return (
    <LegalDocument
      slug="pharmacy"
      lead={
        <>
          {COMPANY.brand} does not manufacture, stock or sell medicine. We
          connect your order to licensed pharmacies who dispense it. This page
          sets out what we will and will not deliver, and why an order can be
          refused after you have paid for it.
        </>
      }
      intro={
        <Callout tone="info" title="Who is actually selling you the medicine">
          <P>
            The seller of record is the <strong>licensed pharmacy</strong> that
            fills your order, holding a retail sale licence in Form 20 and Form
            21 under the Drugs and Cosmetics Rules, 1945. Every prescription-only
            item is dispensed under the supervision of a{" "}
            <strong>registered pharmacist</strong>, a legal requirement, not a
            courtesy step.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "prescriptions",
          title: "Prescription medicine",
          content: (
            <>
              <P>
                Anything that is prescription-only requires a valid prescription
                before it is dispensed. There is no way around this and no
                account level that unlocks it.
              </P>
              <UL>
                <LI>
                  A prescription issued by a doctor on {COMPANY.brand} is
                  attached to the order automatically. You can also upload one
                  from any Registered Medical Practitioner.
                </LI>
                <LI>
                  An uploaded prescription must be legible and complete: the
                  patient&rsquo;s name, the date, the medicines with dose and
                  duration, and the prescriber&rsquo;s name, signature and{" "}
                  <T>registration number</T>. A photograph of a cropped or blurred
                  slip will be rejected.
                </LI>
                <LI>
                  The pharmacist <T>verifies</T> it before dispensing, and may
                  telephone the prescriber. They may refuse, a pharmacist&rsquo;s
                  professional judgement is theirs, and it is a safeguard for you.
                </LI>
                <LI>
                  Quantity is capped at what the prescription supports. We will
                  not dispense six months of a drug written for two weeks.
                </LI>
                <LI>
                  <T>Repeats are not automatic.</T> Where a prescription has
                  expired, or the condition needs review, you need a fresh one.
                </LI>
                <LI>
                  Prescriptions and dispensing records are retained as required
                  three years for Schedule H1, see{" "}
                  <Xref href="/legal/privacy#retention">retention</Xref>.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "schedules",
          title: "What we will and will not dispense",
          content: (
            <>
              <Table
                columns={["Category", "Examples", "Status"]}
                rows={[
                  [
                    "Over the counter",
                    "Paracetamol, ORS, antacids, antiseptics, common vitamins",
                    "Available without a prescription",
                  ],
                  [
                    "Schedule H",
                    "Most antibiotics and prescription-only medicines",
                    "Valid prescription required; pharmacist-verified",
                  ],
                  [
                    "Schedule H1",
                    "Third-generation antibiotics, anti-TB drugs, some anxiolytics",
                    "Prescription required; recorded in a separate register kept for three years",
                  ],
                  [
                    "Schedule X",
                    "Barbiturates and other drugs of dependence",
                    "Never dispensed. Requires a physical prescription in duplicate, retained by a pharmacy in person",
                  ],
                  [
                    "Narcotics and psychotropics (NDPS Act, 1985)",
                    "Opioid analgesics and similar",
                    "Never dispensed through this platform",
                  ],
                  [
                    "Habit-forming and abuse-prone drugs",
                    "As determined by the pharmacist or by us",
                    "Refused, or referred back to the prescriber",
                  ],
                  [
                    "Cold chain",
                    "Insulin, some vaccines and biologics",
                    "Only where the fulfilling pharmacy can maintain the cold chain to your door",
                  ],
                  [
                    "Medical termination of pregnancy kits",
                    ", ",
                    "Not dispensed. These require supervision under the MTP Act, 1971",
                  ],
                ]}
              />
              <Callout tone="critical" title="Do not try to obtain restricted drugs here">
                <P>
                  Attempting to obtain a Schedule X, narcotic or psychotropic
                  drug, including by uploading a forged or altered prescription,
                  or by collecting prescriptions from several doctors for the
                  same complaint, will end your account immediately. Forging a
                  prescription is an offence under the Bharatiya Nyaya Sanhita and
                  under the Drugs and Cosmetics Act, 1940, and we report it.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "substitution",
          title: "Substitution and availability",
          content: (
            <>
              <UL>
                <LI>
                  A generic equivalent is offered only with{" "}
                  <T>your explicit consent</T>, and for prescription medicine
                  only where the prescriber permitted substitution or confirms it.
                </LI>
                <LI>
                  We never substitute silently. If the exact item is unavailable
                  and you do not want an alternative, that item is refunded in
                  full.
                </LI>
                <LI>
                  A partial order is dispatched with the available items and the
                  rest refunded, unless you tell us to hold the whole order.
                </LI>
                <LI>
                  Brand images are illustrative. Packaging changes; what arrives
                  is what the invoice names.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "delivery",
          title: "Delivery",
          content: (
            <>
              <UL>
                <LI>
                  Delivery windows are estimates and depend on stock, distance,
                  weather and traffic. Cold-chain items may take longer because
                  they wait for the right transport.
                </LI>
                <LI>
                  Someone <T>18 or older</T> must receive the order. Schedule H
                  and H1 items are handed only to the patient or a named
                  representative, and identity may be checked.
                </LI>
                <LI>
                  <T>Check the parcel at the door</T>: the correct medicine, the
                  correct strength, an intact seal, and an expiry date far enough
                  ahead to finish the course. Refuse anything wrong, that is
                  much simpler than a return.
                </LI>
                <LI>
                  We do not deliver to a location the delivery partner judges
                  unsafe, and we do not leave medicine unattended.
                </LI>
                <LI>
                  After two failed delivery attempts the order is returned and
                  refunded less delivery costs.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "returns",
          title: "Returns and refunds",
          content: (
            <>
              <Callout tone="warn" title="Medicine is not ordinary retail">
                <P>
                  A drug that has left the pharmacy&rsquo;s custody cannot be
                  verified as correctly stored, and therefore cannot safely be
                  resold to anyone else. So{" "}
                  <strong>we do not accept change-of-mind returns on medicine</strong>.
                  This is a patient-safety rule under the Drugs and Cosmetics
                  Rules, 1945, not a commercial one.
                </P>
              </Callout>
              <P>We refund in full, without requiring a return, where:</P>
              <UL>
                <LI>the wrong item or the wrong strength was delivered;</LI>
                <LI>the item is damaged, leaking, or the seal is broken;</LI>
                <LI>
                  the item is expired, or expires before you could finish the
                  prescribed course;
                </LI>
                <LI>
                  the cold chain was not maintained for an item that requires it;
                </LI>
                <LI>the order never arrived.</LI>
              </UL>
              <P>
                Report within <T>48 hours</T> with a photograph of the item and
                the batch panel. Timelines and mechanics are in the{" "}
                <Xref href="/legal/sales#medicine-orders">Sales Policy</Xref>.
              </P>
              <P>
                Please do not throw unused or expired medicine into household
                waste or a drain. Return it to a pharmacy that operates a
                take-back scheme.
              </P>
            </>
          ),
        },
        {
          id: "safety",
          title: "Using medicine safely",
          content: (
            <>
              <UL>
                <LI>
                  Read the package insert. It is written for you, and it lists
                  the interactions and side effects a consultation may not have
                  covered.
                </LI>
                <LI>
                  <T>Finish the course</T> of an antibiotic even once you feel
                  better. Stopping early is how resistant infection is bred, and
                  India carries a great deal of it already.
                </LI>
                <LI>
                  Never take a medicine prescribed for someone else, and never
                  give yours to anyone.
                </LI>
                <LI>
                  Store as the label says. Most Indian homes exceed 30°C in
                  summer, which spoils medicine that the label assumes is kept
                  cooler.
                </LI>
                <LI>Keep everything out of reach of children.</LI>
                <LI>
                  Tell your doctor about <T>every</T> substance you take,
                  including ayurvedic, homoeopathic and herbal preparations.
                </LI>
              </UL>
              <H3>Adverse reactions</H3>
              <P>
                Stop and contact the prescribing doctor. In a severe reaction
                swelling of the face, lips or tongue, difficulty breathing, or a
                spreading rash, <T>call 112 immediately</T>. Report the reaction
                to the Pharmacovigilance Programme of India on 1800-180-3024, and
                tell us at <MailLink address={CONTACTS.medical} /> so we can
                inform the pharmacy and the prescriber.
              </P>
            </>
          ),
        },
        {
          id: "counterfeit",
          title: "Counterfeit and quality concerns",
          content: (
            <>
              <P>
                We source only from licensed pharmacies and require batch
                traceability. If you suspect a product is counterfeit,
                substandard or tampered with:
              </P>
              <UL>
                <LI>stop taking it;</LI>
                <LI>
                  keep the packaging, the strip and the invoice, the batch
                  number is what makes an investigation possible;
                </LI>
                <LI>
                  tell us at <MailLink address={CONTACTS.medical} /> the same day.
                </LI>
              </UL>
              <P>
                We refund you in full, quarantine the batch with the pharmacy, and
                report to the State Drugs Controller where the evidence warrants
                it. You may also report directly to the Central Drugs Standard
                Control Organisation.
              </P>
            </>
          ),
        },
        {
          id: "not-permitted",
          title: "What this service is not for",
          content: (
            <>
              <UL>
                <LI>
                  <T>Bulk or commercial purchase.</T> Orders are for personal or
                  household use. Wholesale requires a different licence.
                </LI>
                <LI>
                  <T>Export or interstate resale.</T> We deliver within India for
                  personal use only.
                </LI>
                <LI>
                  <T>Stockpiling.</T> Repeated large orders of the same medicine
                  are flagged and may be refused.
                </LI>
                <LI>
                  <T>Ordering for someone else without their knowledge</T>, other
                  than for a dependant in your care.
                </LI>
              </UL>
            </>
          ),
        },
      ]}
    />
  );
}
