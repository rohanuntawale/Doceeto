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

const doc = docBySlug("accessibility")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <LegalDocument
      slug="accessibility"
      lead={
        <>
          A healthcare app that a disabled person cannot use has failed at the
          only thing it exists to do. This is our commitment, an honest list of
          where we currently fall short, and how to tell us when something is
          unusable.
        </>
      }
      intro={
        <Callout tone="info" title="Tell us and we will fix it">
          <P>
            If any part of {COMPANY.brand} is unusable for you, write to{" "}
            <a
              href={`mailto:${CONTACTS.support}`}
              className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2"
            >
              {CONTACTS.support}
            </a>{" "}
            with &ldquo;Accessibility&rdquo; in the subject. We reply within{" "}
            <strong>five working days</strong>, and if we cannot fix it quickly
            we will help you complete what you were trying to do by another
            route.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "standard",
          title: "The standard we hold ourselves to",
          content: (
            <>
              <P>
                We target{" "}
                <T>
                  Web Content Accessibility Guidelines (WCAG) 2.2, Level AA
                </T>{" "}
                across the website and both mobile apps, and we design to the
                spirit of the{" "}
                <T>Rights of Persons with Disabilities Act, 2016</T>, which
                obliges service providers to make information and communication
                technology accessible.
              </P>
              <P>
                We describe conformance as <T>partial</T>. We have not completed
                an independent audit, and until we have, claiming full compliance
                would be a claim we cannot support.
              </P>
            </>
          ),
        },
        {
          id: "what-works",
          title: "What works today",
          content: (
            <>
              <UL>
                <LI>
                  <T>Keyboard.</T> Every interactive control can be reached and
                  operated by keyboard, with a visible focus indicator. No
                  keyboard traps.
                </LI>
                <LI>
                  <T>Screen readers.</T> Semantic headings, landmarks, labelled
                  form fields, and alternative text on meaningful images. Icons
                  used decoratively are hidden from assistive technology.
                </LI>
                <LI>
                  <T>Contrast.</T> Body text and interface controls meet the AA
                  contrast ratio against their background.
                </LI>
                <LI>
                  <T>Zoom and reflow.</T> The interface reflows to 400% zoom and
                  to a 320-pixel viewport without horizontal scrolling or loss of
                  content. Wide tables scroll inside their own container rather
                  than pushing the page sideways.
                </LI>
                <LI>
                  <T>Text sizing.</T> Respects your system font-size setting; no
                  fixed pixel text that ignores it.
                </LI>
                <LI>
                  <T>Reduced motion.</T> Animations are suppressed when your
                  system asks for reduced motion.
                </LI>
                <LI>
                  <T>Colour is never the only signal.</T> Status is carried by
                  text and icon as well as hue, so red-green colour blindness
                  never hides a state.
                </LI>
                <LI>
                  <T>Touch targets</T> meet the minimum size, with adequate
                  spacing.
                </LI>
                <LI>
                  <T>Language.</T> English, Hindi and Marathi, with the page
                  language declared so a screen reader pronounces it correctly.
                </LI>
                <LI>
                  <T>No time limits</T> on completing a booking or a form.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "known-gaps",
          title: "Where we currently fall short",
          content: (
            <>
              <P>
                Publishing this list is more useful to you than a badge would be.
              </P>
              <Table
                columns={["Gap", "Impact", "Workaround"]}
                rows={[
                  [
                    "Live maps",
                    "The map showing a provider approaching is inherently visual and is poorly conveyed by a screen reader.",
                    "Status and estimated time are given as text beside the map; the map is not needed to complete anything.",
                  ],
                  [
                    "Video consultations",
                    "No live captioning or sign-language interpretation.",
                    "Tell us when booking and we will help arrange an interpreter, or you can bring your own supporter.",
                  ],
                  [
                    "Uploaded documents",
                    "A prescription or report uploaded as a photograph is an image, and its contents cannot be read aloud.",
                    "Prescriptions issued on Doceeto are structured text and are fully readable.",
                  ],
                  [
                    "Charts",
                    "Vitals trend charts are visual.",
                    "The underlying figures are available as text; ask us for a tabular export.",
                  ],
                  [
                    "Independent audit",
                    "No third-party conformance audit yet.",
                    "Planned. We will publish the report and the remediation plan.",
                  ],
                ]}
              />
            </>
          ),
        },
        {
          id: "help",
          title: "If you need help using Doceeto",
          content: (
            <>
              <P>
                We will not let an accessibility barrier stop you getting care.
                Write to <MailLink address={CONTACTS.support} /> and we can:
              </P>
              <UL>
                <LI>take you through a booking over email;</LI>
                <LI>send your prescriptions or records in an accessible format;</LI>
                <LI>
                  note a permanent accessibility need on your account, so it is
                  passed to the clinician before every visit;
                </LI>
                <LI>
                  pass a specific requirement — a wheelchair-accessible entrance,
                  extra time, a female clinician, an interpreter — to the
                  provider in advance.
                </LI>
              </UL>
              <P>
                A carer or family member may act for you. Say so and we will not
                make you prove it repeatedly.
              </P>
            </>
          ),
        },
        {
          id: "feedback",
          title: "Reporting a problem",
          content: (
            <>
              <P>Please tell us:</P>
              <UL>
                <LI>the page or screen, and what you were trying to do;</LI>
                <LI>
                  your device, browser or app version, and any assistive
                  technology you use — screen reader, magnifier, switch, voice
                  control;
                </LI>
                <LI>what happened, and what you expected.</LI>
              </UL>
              <P>
                We acknowledge within <T>five working days</T>. Anything blocking
                access to care is treated as urgent, not queued as an
                enhancement. Unresolved, it can be escalated through{" "}
                <Xref href="/legal/grievance">Grievance Redressal</Xref>.
              </P>
              <H3>Building this in</H3>
              <P>
                Accessibility is checked as part of design and code review rather
                than retrofitted, and we test with a keyboard and a screen reader
                before shipping user-facing changes. This page is updated as gaps
                close and as new ones are found.
              </P>
            </>
          ),
        },
      ]}
    />
  );
}
