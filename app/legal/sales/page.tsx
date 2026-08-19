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

const doc = docBySlug("sales")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/sales" },
};

export default function SalesPolicyPage() {
  return (
    <LegalDocument
      slug="sales"
      lead={
        <>
          What things cost on {COMPANY.brand}, how you pay, and, the part
          people actually need, when you get your money back. This policy forms
          part of the <Xref href="/legal/terms">Terms of Use</Xref>.
        </>
      }
      intro={
        <Callout tone="ok" title="The principle we apply">
          <P>
            You should not pay for care you did not receive. If a provider does
            not turn up, cancels on you, or the consultation fails for a reason
            that is not yours, you get a <strong>full refund</strong>, you
            should not have to argue for it.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "prices",
          title: "Prices and who sets them",
          content: (
            <>
              <UL>
                <LI>
                  All prices are in <T>Indian Rupees (₹)</T> and are shown
                  before you confirm anything. Nothing is charged that you have
                  not seen first.
                </LI>
                <LI>
                  <T>Doctors and nurses set their own fees</T> for consultations,
                  home visits and the packages they list. Two clinicians of the
                  same specialty may legitimately charge very different amounts.
                </LI>
                <LI>
                  <T>{COMPANY.brand} adds a platform fee</T> where one applies.
                  It is itemised at checkout, never folded silently into the
                  clinician&rsquo;s fee.
                </LI>
                <LI>
                  A home visit may carry a <T>travel or distance component</T>{" "}
                  and a <T>late-night surcharge</T>. Both are shown before you
                  confirm.
                </LI>
                <LI>
                  Medicine is priced by the fulfilling pharmacy, at or below the
                  printed maximum retail price. Delivery charges, and the order
                  value above which they are waived, are shown in the basket.
                </LI>
                <LI>
                  We may change prices at any time, but never for a booking you
                  have already confirmed.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "taxes",
          title: "Taxes and invoices",
          content: (
            <>
              <P>
                Healthcare services provided by a clinical establishment or an
                authorised medical practitioner are <T>exempt from GST</T> under
                Notification 12/2017-Central Tax (Rate). Our{" "}
                <T>platform fee, delivery charges and other non-clinical
                services are taxable</T> and carry GST at the applicable rate.
              </P>
              <UL>
                <LI>
                  The price you see is <T>inclusive of taxes</T> unless the
                  checkout says otherwise.
                </LI>
                <LI>
                  A tax invoice is issued to your registered email and is
                  available in <T>Account &rsaquo; Payments</T>.
                </LI>
                <LI>
                  Need a GSTIN on the invoice, for reimbursement or an employer
                  claim? Add it in Account <T>before</T> you pay. We cannot
                  retrospectively add a GSTIN to an issued invoice.
                </LI>
                <LI>
                  A clinician registered for GST invoices their own fee
                  separately where they are required to.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "payment",
          title: "How you pay",
          content: (
            <>
              <Table
                columns={["Method", "Available for", "Notes"]}
                rows={[
                  [
                    "UPI",
                    "Everything",
                    "Collected at confirmation through our payment partner.",
                  ],
                  [
                    "Cards (credit / debit)",
                    "Everything",
                    "Card details go to the gateway, never to us. RBI tokenisation applies.",
                  ],
                  [
                    "Net banking and wallets",
                    "Everything",
                    "As offered by the gateway at checkout.",
                  ],
                  [
                    "Cash",
                    "Home visits and delivery, where the provider or pharmacy accepts it",
                    "Paid directly to the person in front of you. Ask for the amount to be marked collected in the app.",
                  ],
                ]}
              />
              <UL>
                <LI>
                  Payment is taken when the booking is <T>confirmed by the
                  provider</T>, not when you request. If nobody accepts, nothing
                  is charged; an authorisation hold, if placed, is released.
                </LI>
                <LI>
                  We never see or store your full card number, UPI PIN or
                  net-banking credentials. Only a status and a reference reach
                  us.
                </LI>
                <LI>
                  A failed payment where money left your account is normally
                  auto-reversed by your bank within{" "}
                  <T>5&ndash;7 working days</T>. If it is not, write to{" "}
                  <MailLink address={CONTACTS.support} /> with the reference and
                  we will chase the gateway.
                </LI>
              </UL>
              <Callout tone="warn" title="Cash payments">
                <P>
                  Cash is settled directly between you and the provider or
                  delivery agent. {COMPANY.brand} records it so the consultation
                  can be closed and the ledger balanced, but{" "}
                  <strong>we are not holding your money</strong>. A refund on a
                  cash payment has to come from the person who took it, and we
                  can only mediate. Paying online is materially better protected.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "cancellation",
          title: "Cancelling a consultation or visit",
          content: (
            <>
              <H3>If you cancel</H3>
              <Table
                columns={["When you cancel", "Video consultation", "Home visit"]}
                rows={[
                  [
                    "Before a provider accepts",
                    "Full refund",
                    "Full refund",
                  ],
                  [
                    "More than 30 minutes before the appointment",
                    "Full refund",
                    "Full refund",
                  ],
                  [
                    "Within 30 minutes of the appointment",
                    "Full refund less the platform fee",
                    "Up to 50% retained if the provider has set out",
                  ],
                  [
                    "After the provider has arrived, or after the consultation has begun",
                    "No refund",
                    "No refund",
                  ],
                  [
                    "You are not there for a home visit (no-show)",
                    ", ",
                    "No refund; the provider is paid in full for the trip",
                  ],
                ]}
                caption="An emergency or an unavoidable hospital admission is treated on its facts, tell us and we will look at it properly."
              />

              <H3>If the provider cancels or does not turn up</H3>
              <UL>
                <LI>
                  <T>Full refund, always</T>, plus the option to be rematched
                  immediately with another available clinician.
                </LI>
                <LI>
                  If a home-visit provider is more than <T>30 minutes</T> past
                  the estimate, you may cancel free of charge.
                </LI>
                <LI>
                  Repeated cancellations count against a provider and can end
                  their listing. See the{" "}
                  <Xref href="/legal/providers">Provider Terms</Xref>.
                </LI>
              </UL>

              <H3>If the technology fails</H3>
              <P>
                A video consultation that cannot proceed because of a fault at
                our end is rescheduled at no cost, or refunded in full. Where
                the call drops but the clinician has already assessed you and
                issued advice or a prescription, the consultation counts as
                delivered, the guidance you were given is the thing you paid
                for.
              </P>
            </>
          ),
        },
        {
          id: "medicine-orders",
          title: "Medicine orders",
          content: (
            <>
              <P>
                Medicine is a special case, because a returned drug cannot
                safely be resold. These rules follow the Drugs and Cosmetics
                Rules, 1945 rather than ordinary retail practice.
              </P>
              <Table
                columns={["Situation", "What happens"]}
                rows={[
                  [
                    "Cancel before the pharmacy packs the order",
                    "Full refund.",
                  ],
                  [
                    "Cancel after packing, before dispatch",
                    "Refund less any restocking cost the pharmacy has actually incurred.",
                  ],
                  [
                    "Refuse at the door",
                    "Refund less delivery. Repeated refusals may restrict cash on delivery.",
                  ],
                  [
                    "Wrong, damaged, expired, or short-dated item delivered",
                    "Full refund or free replacement. Report within 48 hours with a photograph, we do not make you send it back first.",
                  ],
                  [
                    "Correct item, you changed your mind",
                    "No return. Medicine that has left the pharmacy's custody cannot be restocked.",
                  ],
                  [
                    "Prescription rejected by the pharmacist",
                    "Full refund of the affected items.",
                  ],
                  [
                    "Item unavailable",
                    "We offer a substitute only with your consent and, for prescription medicine, the prescriber's. Otherwise, full refund of that item.",
                  ],
                ]}
              />
              <P>
                Full detail, including which schedules we will not dispense at
                all, is in the{" "}
                <Xref href="/legal/pharmacy">Medicine &amp; Pharmacy
                Policy</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "refund-timing",
          title: "How refunds reach you",
          content: (
            <>
              <Table
                columns={["Paid by", "Refunded to", "Typical time"]}
                rows={[
                  ["UPI", "The same UPI ID", "1 to 3 working days"],
                  ["Card", "The same card", "5 to 7 working days"],
                  ["Net banking", "The same bank account", "5 to 7 working days"],
                  ["Wallet", "The same wallet", "1 to 3 working days"],
                  [
                    "Cash",
                    "Bank transfer to details you provide, once recovered from the provider",
                    "Up to 10 working days",
                  ],
                ]}
                caption="We initiate refunds within 24 hours of approval. The time above is your bank's, not ours, we will give you the reference number so you can chase them."
              />
              <UL>
                <LI>
                  Refunds go back to the <T>original payment method</T>. We
                  cannot redirect one to a different account, which is an
                  anti-fraud rule, not an inconvenience we chose.
                </LI>
                <LI>
                  Where a refund is genuinely due and the original method has
                  closed, we arrange a bank transfer after verifying your
                  identity.
                </LI>
                <LI>
                  We do not charge a processing fee on a refund we owe you.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "disputes",
          title: "If a charge looks wrong",
          content: (
            <>
              <P>
                Write to <MailLink address={CONTACTS.support} /> with the booking
                or order reference. We aim to resolve billing disputes within{" "}
                <T>seven working days</T>. Unresolved, it escalates through{" "}
                <Xref href="/legal/grievance">Grievance Redressal</Xref>.
              </P>
              <Callout tone="warn" title="Before you raise a chargeback">
                <P>
                  Please come to us first. A chargeback typically freezes the
                  disputed amount for 60&ndash;90 days while the banks argue,
                  which is far slower than us simply refunding you. Where a
                  chargeback is raised for a service that was genuinely
                  delivered, we will contest it with the encounter record and may
                  suspend the account.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "provider-payouts",
          title: "Provider earnings and payouts",
          content: (
            <>
              <P>For doctors and nurses earning through {COMPANY.brand}:</P>
              <UL>
                <LI>
                  Each completed encounter posts a ledger entry showing the{" "}
                  <T>gross fee</T>, the <T>{COMPANY.brand} commission</T>, and
                  your <T>net</T>. Nothing is deducted that is not itemised.
                </LI>
                <LI>
                  Commission is charged on the clinical fee. The current rate is
                  shown in your dashboard and in your provider agreement, and any
                  change is notified <T>30 days</T> in advance.
                </LI>
                <LI>
                  Cash you collect directly is recorded as received by you, and
                  the commission on it is set off against your next payout.
                </LI>
                <LI>
                  Payouts are made to your registered bank account on the
                  published cycle, after TDS where applicable, with a statement.
                </LI>
                <LI>
                  A payout may be held where a consultation is disputed, a refund
                  is pending, or an investigation is open. You will be told why.
                </LI>
              </UL>
              <P>
                Full terms in the{" "}
                <Xref href="/legal/providers">Provider Terms</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "fraud",
          title: "Abuse of this policy",
          content: (
            <P>
              We look at patterns. Repeatedly booking and cancelling after a
              provider sets out, claiming non-delivery of orders that were
              delivered, or extracting refunds for care that was given, will lead
              to refunds being reviewed manually, cash on delivery being
              withdrawn, and ultimately to the account being closed under the{" "}
              <Xref href="/legal/terms#termination">Terms of Use</Xref>. We would
              rather refund a hundred honest people quickly than make everyone
              prove themselves, that only works if the policy is not gamed.
            </P>
          ),
        },
      ]}
    />
  );
}
