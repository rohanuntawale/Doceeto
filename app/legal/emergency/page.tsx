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

const doc = docBySlug("emergency")!;

export const metadata: Metadata = {
  title: `${doc.title} · ${COMPANY.brand}`,
  description: doc.summary,
  alternates: { canonical: "/legal/emergency" },
};

export default function EmergencyPolicyPage() {
  return (
    <LegalDocument
      slug="emergency"
      lead={
        <>
          The SOS button can bring help toward you faster. It cannot replace the
          emergency services, and treating it as though it can is the single
          most dangerous mistake anyone could make with this app. This page is
          deliberately blunt about where the line sits.
        </>
      }
      intro={
        <Callout tone="critical" title="Call 112 or 108 first. Then raise SOS.">
          <P>
            <strong>112</strong> is the national emergency number.{" "}
            <strong>108</strong> reaches an ambulance in most states. Both work
            without balance, without data, and from a locked phone. They are
            staffed by the state, around the clock, with legal duties{" "}
            {COMPANY.brand} does not have.
          </P>
        </Callout>
      }
      sections={[
        {
          id: "what-sos-is",
          title: "What SOS actually does",
          content: (
            <>
              <P>When you raise an SOS, {COMPANY.brand}:</P>
              <OL>
                <OLI>
                  records the emergency category, your location and your address
                  at that moment;
                </OLI>
                <OLI>
                  raises it live on our operations console, where our team can
                  see and act on it;
                </OLI>
                <OLI>
                  alerts nearby doctors and responders who are marked online, so
                  one of them can accept;
                </OLI>
                <OLI>
                  makes your health profile, blood group, allergies, conditions,
                  medication, available to whoever accepts;
                </OLI>
                <OLI>
                  shows you the status as it changes, and tracks the responder to
                  you.
                </OLI>
              </OL>
              <P>
                That is a genuine benefit: a responder arriving already knowing
                you are diabetic and allergic to penicillin is better than one
                who does not. But it is a <T>coordination layer over the public
                internet</T>, not an emergency service.
              </P>
            </>
          ),
        },
        {
          id: "what-it-is-not",
          title: "What SOS is not",
          content: (
            <>
              <Table
                columns={["SOS does not…", "Because"]}
                rows={[
                  [
                    "Connect you to 112, 108 or any government emergency service",
                    "We have no integration with state emergency response. Raising SOS does not dial anyone.",
                  ],
                  [
                    "Guarantee that anyone responds",
                    "Response depends on a verified provider being online, nearby, available and willing to accept.",
                  ],
                  [
                    "Guarantee an ambulance",
                    "We are not an ambulance operator and do not own vehicles. Any ambulance is a third party, dispatched on a best-effort basis.",
                  ],
                  [
                    "Guarantee a response time",
                    "Estimates are estimates. Traffic, weather, distance and availability all move them.",
                  ],
                  [
                    "Work without internet, signal, battery or location permission",
                    "Every one of those is a hard dependency. 112 needs only a phone signal.",
                  ],
                  [
                    "Work when you cannot use your phone",
                    "SOS must be raised deliberately. It does not detect a crash, a fall or a collapse.",
                  ],
                  [
                    "Provide medical care by itself",
                    "It is an alert. Care arrives only when a person does.",
                  ],
                  [
                    "Operate everywhere",
                    "Coverage is limited to cities where we have an active provider network.",
                  ],
                ]}
              />
            </>
          ),
        },
        {
          id: "before-you-need-it",
          title: "Make it work better, before you need it",
          content: (
            <>
              <UL>
                <LI>
                  <T>Fill in your health profile</T>, blood group, allergies,
                  conditions and current medication. This is what a responder
                  reads on the way, and it is the highest-value thing you can do
                  in this app.
                </LI>
                <LI>
                  <T>Add an emergency contact.</T> We can point a responder at
                  someone who can speak for you if you cannot.
                </LI>
                <LI>
                  <T>Keep location permission on</T>, and keep your saved address
                  accurate down to the house number, floor and landmark. A
                  responder standing in the right lane at the wrong gate is
                  wasted time.
                </LI>
                <LI>
                  <T>Save 112 and 108</T> in your phone, and teach the people you
                  live with to use them.
                </LI>
              </UL>
            </>
          ),
        },
        {
          id: "using-it",
          title: "Using SOS in the moment",
          content: (
            <>
              <OL>
                <OLI>
                  <T>Call 112 or 108 first</T> if there is any chance life is at
                  risk.
                </OLI>
                <OLI>Raise the SOS and pick the closest category.</OLI>
                <OLI>
                  Confirm your location. Correct it if the map is wrong, a
                  building can throw GPS out by a street.
                </OLI>
                <OLI>
                  Stay reachable. Keep the phone with you, unlocked if you
                  safely can, and answer calls from unknown numbers.
                </OLI>
                <OLI>
                  <T>Do not cancel</T> because help is slow. Cancelling stands
                  down whoever was coming.
                </OLI>
                <OLI>
                  If your situation worsens, call 112 again and say so. Do not
                  wait on the app.
                </OLI>
              </OL>
              <H3>While you wait</H3>
              <P>
                If you are trained, act, control severe bleeding with firm
                direct pressure, put an unconscious but breathing person in the
                recovery position, and start CPR on someone who is not breathing
                normally. If you are not trained, the 112 or 108 call taker will
                talk you through it. Do not move someone with a suspected spinal
                injury unless they are in immediate danger.
              </P>
            </>
          ),
        },
        {
          id: "false-alarms",
          title: "False and accidental alarms",
          content: (
            <>
              <P>
                <T>Cancel a mistaken SOS immediately</T> in the app, and tell the
                responder if one has already called. Nobody is penalised for an
                honest accident.
              </P>
              <P>
                <T>Deliberately raising a false emergency is a serious matter.</T>{" "}
                It pulls a clinician away from someone who needs them. We suspend
                accounts for it, and we will cooperate with the police where an
                offence has been committed. If you called 112 or 108 falsely, that
                is separately an offence under the Bharatiya Nyaya Sanhita.
              </P>
            </>
          ),
        },
        {
          id: "data",
          title: "Data during an emergency",
          content: (
            <>
              <P>
                An emergency is one of the few places where we may act on your
                data <T>without pausing to collect consent</T>: where you are
                incapable of giving it and there is a threat to your life or
                health, the DPDP Act, 2023 permits processing to respond to a
                medical emergency. In practice that means sharing your location,
                health profile and emergency contact with the people coming to
                help you.
              </P>
              <P>
                Emergency records are retained for three years for incident
                review, see{" "}
                <Xref href="/legal/privacy#retention">retention</Xref>.
              </P>
            </>
          ),
        },
        {
          id: "liability",
          title: "Liability",
          content: (
            <>
              <P>
                SOS is offered <T>as a best-effort convenience</T>. To the extent
                Indian law allows, and subject to the limits in the{" "}
                <Xref href="/legal/terms#liability">Terms of Use</Xref>, we are
                not liable for a delayed response, for no response, for the
                clinical acts of a responder, for the conduct of a third-party
                ambulance operator, or for any failure caused by connectivity,
                device, battery or location accuracy.
              </P>
              <P>
                Nothing here excludes liability for death or personal injury
                caused by our own negligence, or any liability that cannot
                lawfully be excluded.
              </P>
              <Callout tone="warn" title="Do not build your emergency plan on this app">
                <P>
                  If your household&rsquo;s plan for a heart attack is
                  &ldquo;open {COMPANY.brand}&rdquo;, change it today. The plan
                  is 112 or 108, and the nearest hospital you can name without
                  looking it up. {COMPANY.brand} is what you use{" "}
                  <em>in addition</em>.
                </P>
              </Callout>
            </>
          ),
        },
        {
          id: "numbers",
          title: "Numbers worth knowing",
          content: (
            <>
              <Table
                columns={["Service", "Number"]}
                rows={[
                  ["National emergency (all services)", "112"],
                  ["Ambulance", "108"],
                  ["Police", "100"],
                  ["Fire", "101"],
                  ["Medical helpline", "104"],
                  ["Women's helpline", "1091 / 181"],
                  ["Child helpline", "1098"],
                  ["Tele-MANAS (mental health)", "14416 / 1-800-891-4416"],
                  ["Poison information (AIIMS)", "1800-116-117"],
                  ["Senior-citizen helpline", "14567"],
                  ["Disaster management", "1078"],
                ]}
                caption="Verify local numbers for your state, some vary. 112 works everywhere in India."
              />
              <P>
                Concerns about how an SOS was handled? Write to{" "}
                <MailLink address={CONTACTS.medical} />, or raise it through{" "}
                <Xref href="/legal/grievance">Grievance Redressal</Xref>.
              </P>
            </>
          ),
        },
      ]}
    />
  );
}
