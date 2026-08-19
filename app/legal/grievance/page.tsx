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

const doc = docBySlug("grievance")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/grievance" },
};

export default function GrievancePage() {
  return (
    <LegalDocument
      slug="grievance"
      lead={
        <>
          How to complain to {COMPANY.brand}, who is obliged to answer, and by
          when. If we cannot put it right, this page also tells you exactly how
          to go over our heads, because you are entitled to know that.
        </>
      }
      intro={
        <Callout tone="info" title="Start here">
          <P>
            Most problems are solved fastest by{" "}
            <a
              href={`mailto:${CONTACTS.support}`}
              className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2"
            >
              {CONTACTS.support}
            </a>{" "}
            or in-app support. Escalate to the Grievance Officer if that does not
            resolve it, or go straight there if the matter is serious.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "officer",
          title: "The Grievance Officer",
          content: (
            <>
              <P>
                Appointed under Rule 4(1)(d) of the{" "}
                <T>Consumer Protection (E-Commerce) Rules, 2020</T> and Rule 3(2)
                of the{" "}
                <T>
                  Information Technology (Intermediary Guidelines and Digital
                  Media Ethics Code) Rules, 2021
                </T>
                .
              </P>
              <KeyValues
                items={[
                  { label: "Name", value: OFFICERS.grievance.name },
                  { label: "Designation", value: OFFICERS.grievance.role },
                  { label: "Company", value: COMPANY.legalName },
                  {
                    label: "Email",
                    value: <MailLink address={OFFICERS.grievance.email} />,
                  },
                  { label: "Phone", value: OFFICERS.grievance.phone },
                  {
                    label: "Post",
                    value: <Address lines={correspondenceAddress()} />,
                  },
                  {
                    label: "Hours",
                    value: "Monday to Saturday, 10:00 to 18:00 IST",
                  },
                ]}
              />
              <Callout tone="critical" title="Not for emergencies">
                <P>
                  This is a complaints channel, not a clinical one. If you are
                  unwell right now, call <strong>112</strong> or{" "}
                  <strong>108</strong>. See the{" "}
                  <Xref href="/legal/emergency">Emergency Services Policy</Xref>.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "timelines",
          title: "What we are held to",
          content: (
            <>
              <Table
                columns={["Stage", "Timeline", "Required by"]}
                rows={[
                  [
                    "Acknowledgement, with a ticket number",
                    "48 hours",
                    "IT Rules, 2021 and E-Commerce Rules, 2020",
                  ],
                  [
                    "Resolution of an ordinary grievance",
                    "One month from receipt",
                    "IT Rules, 2021; E-Commerce Rules, 2020",
                  ],
                  [
                    "Removal of unlawful content on a valid complaint",
                    "36 hours of a court order or government notification",
                    "IT Rules, 2021",
                  ],
                  [
                    "Removal of content that exposes a private area, or depicts nudity or impersonation",
                    "24 hours",
                    "IT Rules, 2021, Rule 3(2)(b)",
                  ],
                  [
                    "Response to a data-protection request",
                    "30 days",
                    "DPDP Act, 2023",
                  ],
                  [
                    "Billing or refund dispute",
                    "7 working days",
                    "Our own commitment",
                  ],
                  [
                    "Clinical safety concern",
                    "Triaged within 24 hours, investigated within 15 days",
                    "Our own commitment",
                  ],
                ]}
              />
              <P>
                If we need longer, usually because a clinical review or a
                third-party pharmacy is involved, we tell you why and give a
                date, before the deadline passes rather than after.
              </P>
            </>
          ),
        },
        {
          id: "how-to",
          title: "Raising a grievance",
          content: (
            <>
              <P>
                Write to <MailLink address={CONTACTS.grievance} />. Include as
                much of this as you have:
              </P>
              <OL>
                <OLI>Your name and the email address on the account.</OLI>
                <OLI>
                  The <T>booking, order or prescription reference</T>, and the
                  date.
                </OLI>
                <OLI>
                  The name of the doctor, nurse or pharmacy involved, if any.
                </OLI>
                <OLI>What happened, in plain sequence.</OLI>
                <OLI>What you want done about it.</OLI>
                <OLI>
                  Anything supporting it, screenshots, the invoice, photographs
                  of a delivered item, chat transcripts.
                </OLI>
              </OL>
              <P>
                A complaint may be made in <T>English, Hindi or Marathi</T>. You
                may complain on behalf of someone you care for; say so and say
                what your relationship is.
              </P>
              <P>
                You may also write by post to the address above. Post is slower;
                the same timelines run from the day it arrives.
              </P>
            </>
          ),
        },
        {
          id: "what-happens",
          title: "What happens next",
          content: (
            <>
              <OL>
                <OLI>
                  <T>Acknowledgement</T> within 48 hours, with a ticket number to
                  quote.
                </OLI>
                <OLI>
                  <T>Triage.</T> Anything raising a clinical-safety or
                  patient-harm concern goes to clinical governance the same day.
                </OLI>
                <OLI>
                  <T>Investigation.</T> We read the encounter record, the audit
                  log and the payment trail, and put your account to the provider
                  or pharmacy so they can answer it.
                </OLI>
                <OLI>
                  <T>Decision</T>, in writing, with the reasons and the evidence
                  we relied on. Not a template.
                </OLI>
                <OLI>
                  <T>Remedy</T> where it is due: a refund, a redelivery, a
                  correction to your record, action against a provider, or a fix
                  to the product.
                </OLI>
                <OLI>
                  <T>Appeal.</T> Unhappy with the decision? Say so within 30 days
                  and someone not involved the first time reviews it.
                </OLI>
              </OL>
              <P>
                Complaining is never held against you. Raising a grievance will
                not affect your access to care, and we do not permit a provider
                to refuse you because you complained about them.
              </P>
            </>
          ),
        },
        {
          id: "clinical",
          title: "Complaints about clinical care",
          content: (
            <>
              <P>
                Complaints about a doctor&rsquo;s or nurse&rsquo;s{" "}
                <T>clinical conduct</T> go to{" "}
                <MailLink address={CONTACTS.medical} /> and are handled by
                clinical governance, not by customer support.
              </P>
              <P>What we can do:</P>
              <UL>
                <LI>
                  investigate, obtain the provider&rsquo;s account, and have the
                  case reviewed by a clinician;
                </LI>
                <LI>
                  suspend or remove the provider from {COMPANY.brand};
                </LI>
                <LI>
                  refund you, and arrange a further consultation with someone
                  else at no cost;
                </LI>
                <LI>
                  <T>report the provider to their State Medical or Nursing
                  Council</T>, which the Telemedicine Practice Guidelines require
                  of us where we find non-compliance;
                </LI>
                <LI>
                  give you the complete encounter record and the
                  provider&rsquo;s registration details so you can pursue it
                  yourself.
                </LI>
              </UL>
              <P>What we cannot do:</P>
              <UL>
                <LI>
                  overrule a clinical decision, or order a clinician to prescribe
                  something, that would be us practising medicine;
                </LI>
                <LI>
                  strike a practitioner off a register. Only their council can;
                </LI>
                <LI>award compensation for clinical negligence. Only a court or consumer commission can.</LI>
              </UL>
            </>
          ),
        },
        {
          id: "escalate",
          title: "Going over our heads",
          content: (
            <>
              <P>
                These routes are open to you whether or not you have complained
                to us, and nothing in our terms takes them away.
              </P>

              <H3>Consumer complaints</H3>
              <UL>
                <LI>
                  <T>National Consumer Helpline</T>, dial{" "}
                  <T>1915</T>, or file at{" "}
                  <Ext href="https://consumerhelpline.gov.in">
                    consumerhelpline.gov.in
                  </Ext>
                  . Free, and effective for refunds and service failures.
                </LI>
                <LI>
                  <T>District, State or National Consumer Disputes Redressal
                  Commission</T> under the Consumer Protection Act, 2019. File
                  online at{" "}
                  <Ext href="https://edaakhil.nic.in">edaakhil.nic.in</Ext>. You
                  may file where you live.
                </LI>
              </UL>

              <H3>A doctor&rsquo;s or nurse&rsquo;s professional conduct</H3>
              <UL>
                <LI>
                  The <T>State Medical Council</T> the doctor is registered with
                  the first port of call for professional misconduct.
                </LI>
                <LI>
                  The <T>National Medical Commission</T>, {" "}
                  <Ext href="https://www.nmc.org.in">nmc.org.in</Ext>.
                </LI>
                <LI>
                  For nurses, the relevant <T>State Nursing Council</T> or the{" "}
                  <T>Indian Nursing Council</T>.
                </LI>
              </UL>

              <H3>Data protection</H3>
              <UL>
                <LI>
                  The <T>Data Protection Board of India</T>, under the DPDP Act,
                  2023, after you have first complained to our{" "}
                  {OFFICERS.dataProtection.role}, which the Act requires you to do.
                </LI>
              </UL>

              <H3>Medicine, and adverse reactions</H3>
              <UL>
                <LI>
                  The <T>State Drugs Controller</T>, or the{" "}
                  <T>Central Drugs Standard Control Organisation</T>, {" "}
                  <Ext href="https://cdsco.gov.in">cdsco.gov.in</Ext>.
                </LI>
                <LI>
                  The <T>Pharmacovigilance Programme of India</T>, {" "}
                  <T>1800-180-3024</T>, to report a suspected adverse drug
                  reaction.
                </LI>
              </UL>

              <H3>Content and intermediary matters</H3>
              <UL>
                <LI>
                  The <T>Grievance Appellate Committee</T> constituted under the
                  IT Rules, 2021, if you are dissatisfied with our decision on a
                  content complaint, {" "}
                  <Ext href="https://gac.gov.in">gac.gov.in</Ext>. Appeal within
                  30 days of our decision.
                </LI>
                <LI>
                  <T>Cyber Crime Reporting Portal</T>, {" "}
                  <Ext href="https://cybercrime.gov.in">cybercrime.gov.in</Ext>,
                  or the helpline <T>1930</T> for financial fraud.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "publishing",
          title: "What we publish",
          content: (
            <P>
              In line with the IT Rules, 2021 we intend to publish periodic
              compliance reporting: the number of grievances received and
              actioned, and the action taken. It will be linked from this page.
              We would rather be measured on it than not.
            </P>
          ),
        },
      ]}
    />
  );
}
