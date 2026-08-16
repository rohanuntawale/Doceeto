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
import { COMPANY, CONTACTS, OFFICERS } from "@/lib/legal/company";
import { docBySlug } from "@/lib/legal/documents";

const doc = docBySlug("data-deletion")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <LegalDocument
      slug="data-deletion"
      lead={
        <>
          How to delete your {COMPANY.brand} account and your health data, what
          disappears immediately, and the narrow set of medical and financial
          records the law obliges us to keep even after you have gone.
        </>
      }
      intro={
        <Callout tone="info" title="Two ways, and neither requires talking to us">
          <P>
            Delete your account from <strong>Account &rsaquo; Delete account</strong>{" "}
            in the app or on the web, no email, no form, no retention call. Or,
            if you have lost access to the account, write to{" "}
            <a
              href={`mailto:${CONTACTS.privacy}`}
              className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2"
            >
              {CONTACTS.privacy}
            </a>{" "}
            and we will verify you and do it.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "how",
          title: "Deleting your account",
          content: (
            <>
              <H3>In the app or on the web</H3>
              <OL>
                <OLI>Sign in and open <T>Account</T>.</OLI>
                <OLI>
                  Scroll to <T>Delete account</T>.
                </OLI>
                <OLI>
                  Read what will be deleted and what must be kept, the same list
                  as{" "}
                  <Xref href="/legal/data-deletion#what-goes">below</Xref>.
                </OLI>
                <OLI>Confirm. We re-authenticate you at this point.</OLI>
                <OLI>
                  You are signed out on every device immediately, and a
                  confirmation is emailed to you.
                </OLI>
              </OL>
              <H3>By email</H3>
              <P>
                Write to <MailLink address={CONTACTS.privacy} /> from your
                registered email address with the subject{" "}
                <T>&ldquo;Delete my account&rdquo;</T>. We verify your identity
                before acting, an unverified deletion request is an obvious way
                to attack someone else&rsquo;s medical record. We complete it
                within <T>{OFFICERS.dataProtection.respondWithin}</T> and confirm
                in writing.
              </P>
              <Callout tone="warn" title="Settle up first">
                <P>
                  Deletion is blocked while a consultation is in progress, an
                  order is out for delivery, a payment is pending, or a refund or
                  grievance is open. Finish or cancel those first, we will tell
                  you exactly which one is blocking it.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "what-goes",
          title: "What is deleted, and what is kept",
          content: (
            <>
              <P>
                We would rather show you this plainly than have you discover it
                afterwards. Most of your data goes. A defined set of medical and
                financial records does not, because keeping it is a legal
                obligation, not our preference.
              </P>
              <H3>Deleted</H3>
              <Table
                columns={["Data", "When"]}
                rows={[
                  ["Name, email address and password", "Immediately"],
                  ["Profile photograph", "Immediately"],
                  [
                    "Health profile, blood group, allergies, conditions, medication, surgeries, family history, lifestyle, emergency contact",
                    "Immediately",
                  ],
                  ["Vitals history", "Immediately"],
                  ["Symptom-checker history", "Immediately"],
                  ["Saved addresses and location history", "Immediately"],
                  ["Sessions on every device", "Immediately"],
                  ["Google sign-in link", "Immediately"],
                  [
                    "Reviews you wrote",
                    "Detached from you and anonymised, or removed on request",
                  ],
                  ["Ratings you received as a provider", "Anonymised"],
                  ["Backups containing the above", "Within 90 days, as backups rotate"],
                ]}
              />
              <H3>Retained, and why</H3>
              <Table
                columns={["Record", "Kept for", "Legal basis"]}
                rows={[
                  [
                    "Prescriptions issued to you",
                    "3 years from issue",
                    "Telemedicine Practice Guidelines, 2020; Drugs and Cosmetics Rules, 1945 (Schedule H1 records)",
                  ],
                  [
                    "Consultation and visit records",
                    "3 years",
                    "Medical-record obligations; defending a clinical complaint or claim",
                  ],
                  [
                    "Invoices, payments and tax records",
                    "8 financial years",
                    "Companies Act, 2013 s.128; income-tax record-keeping",
                  ],
                  [
                    "Emergency (SOS) records",
                    "3 years",
                    "Incident review; medico-legal defence",
                  ],
                  [
                    "Grievance correspondence",
                    "3 years from resolution",
                    "Consumer Protection (E-Commerce) Rules, 2020",
                  ],
                  [
                    "Provider earnings and payout ledger",
                    "8 financial years",
                    "Tax and TDS obligations",
                  ],
                  [
                    "Fraud and abuse records",
                    "As long as needed",
                    "Preventing a banned account from simply being recreated",
                  ],
                ]}
              />
              <Callout tone="info" title="What retention actually means here">
                <P>
                  A retained record is <strong>locked down to the purpose that
                  justifies it</strong>. It is not used to market to you, to
                  profile you, to train anything, or to rebuild your account. It
                  is separated from your identity as far as the record still
                  makes sense, a prescription has to keep naming its patient to
                  be a prescription at all.
                </P>
              </Callout>
              <P>
                Full schedule in{" "}
                <Xref href="/legal/privacy#retention">the Privacy Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "download-first",
          title: "Take your records with you first",
          content: (
            <>
              <P>
                Deletion is <T>irreversible</T>. Before you go, export your data
                you may want your prescriptions later, and after deletion we
                cannot hand you a copy of a record we have locked for retention.
              </P>
              <UL>
                <LI>
                  <T>Account &rsaquo; Download my data</T> exports your profile,
                  health record, vitals, prescriptions and care history in a
                  machine-readable format.
                </LI>
                <LI>
                  Individual prescriptions can be downloaded or printed from{" "}
                  <T>Records</T>.
                </LI>
                <LI>
                  Or request an export from{" "}
                  <MailLink address={CONTACTS.privacy} /> and we will send it
                  within {OFFICERS.dataProtection.respondWithin}.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "partial",
          title: "Deleting some things without deleting everything",
          content: (
            <>
              <P>
                You do not have to close the account to remove data you would
                rather we did not hold.
              </P>
              <Table
                columns={["To remove", "Where"]}
                rows={[
                  [
                    "Symptom-checker history",
                    "Account → Clear saved checks",
                  ],
                  [
                    "Any health-profile field",
                    "Account → Health profile, clear the field and save",
                  ],
                  ["A saved address", "Account → Addresses"],
                  ["Your profile photograph", "Account → tap the photo → Remove"],
                  [
                    "Location sharing",
                    "Turn off the permission in your browser or phone settings",
                  ],
                  [
                    "The Google sign-in link",
                    "Account → set a password first, then unlink",
                  ],
                  [
                    "A review you wrote",
                    "Open the review → Delete",
                  ],
                  [
                    "A shared prescription link",
                    "Records → open the prescription → Revoke link",
                  ],
                ]}
              />
              <P>
                You can also <T>withdraw consent</T> for a specific purpose, for
                example, stop using the AI symptom checker, without affecting
                anything else. See{" "}
                <Xref href="/legal/privacy#your-rights">your rights</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "providers",
          title: "If you are a doctor or a nurse",
          content: (
            <>
              <P>
                The same route applies, with two differences that follow from
                having treated patients.
              </P>
              <UL>
                <LI>
                  Give <T>seven days&rsquo; notice</T> and complete or reassign
                  bookings you have already accepted.
                </LI>
                <LI>
                  Your public profile, photograph and listing are removed.
                </LI>
                <LI>
                  <T>Prescriptions you issued keep your name, qualifications and
                  registration number.</T> They are clinical and legal documents
                  that must continue to say who wrote them, a prescription
                  stripped of its prescriber is worthless to the patient holding
                  it and to any court.
                </LI>
                <LI>
                  Your earnings ledger is retained for eight financial years for
                  tax. Outstanding payouts are settled before closure.
                </LI>
              </UL>
              <P>
                Details in the{" "}
                <Xref href="/legal/providers#removal">Provider Terms</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "aftermath",
          title: "After deletion",
          content: (
            <>
              <UL>
                <LI>
                  You are signed out everywhere and cannot sign back in.
                </LI>
                <LI>
                  <T>You cannot recover the account</T>, and we cannot restore
                  it. Registering again with the same email creates a genuinely
                  new, empty account.
                </LI>
                <LI>
                  Shared prescription links stop working, because the underlying
                  record is closed.
                </LI>
                <LI>
                  Deleting the app from your phone does <T>not</T> delete your
                  account. Delete the account first, then uninstall.
                </LI>
                <LI>
                  Copies inside backups are overwritten as backups rotate, within{" "}
                  <T>90 days</T>. They are not accessible to anyone in the
                  meantime.
                </LI>
                <LI>
                  Where we had already shared data with a treating clinician or a
                  pharmacy, <T>their</T> records are theirs, kept under their own
                  professional obligations. We tell them of your deletion where we
                  are able to.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "someone-else",
          title: "Deleting on behalf of someone else",
          content: (
            <>
              <UL>
                <LI>
                  <T>A child or dependant</T> whose account you hold: delete it as
                  the account holder.
                </LI>
                <LI>
                  <T>Someone who has died.</T> Write to{" "}
                  <MailLink address={CONTACTS.privacy} /> with the death
                  certificate and evidence of your relationship or legal
                  authority. If the person registered a nominee under the DPDP
                  Act, that nominee may exercise their rights.
                </LI>
                <LI>
                  <T>Someone who has lost capacity.</T> A legal guardian may act
                  on production of the guardianship order.
                </LI>
              </UL>
              <P>
                We verify carefully before acting on a third-party request.
                Medical records are exactly the kind of thing people try to reach
                by pretending to be family.
              </P>
            </>
          ),
        },
        {
          id: "store-links",
          title: "For app store reference",
          content: (
            <>
              <P>
                This page is the published account-deletion route required by
                Google Play&rsquo;s data-deletion policy and Apple&rsquo;s
                App Store Review Guideline 5.1.1(v). Both an in-app control and
                this web route exist, and neither requires contacting support.
              </P>
              <Table
                columns={["Requirement", "Where it is satisfied"]}
                rows={[
                  [
                    "In-app account deletion",
                    "Account → Delete account",
                  ],
                  [
                    "Web-accessible deletion request, reachable without signing in",
                    "This page",
                  ],
                  [
                    "What is deleted vs retained, with retention periods",
                    "Section on what is deleted and what is kept, above",
                  ],
                  [
                    "Data export before deletion",
                    "Account → Download my data",
                  ],
                  [
                    "Contact for deletion help",
                    CONTACTS.privacy,
                  ],
                ]}
              />
            </>
          ),
        },
      ]}
    />
  );
}
