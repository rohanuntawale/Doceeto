/**
 * The whole site, described once.
 *
 * Two consumers with different needs read this: the human site map at /sitemap
 * lists everything including the signed-in surfaces (marked as such, so a
 * visitor understands why a link asks them to log in), while /sitemap.xml emits
 * only the entries marked `indexable` — a search engine has no business being
 * pointed at a patient's dashboard or a prescription share link.
 */

export interface SiteEntry {
  href: string;
  label: string;
  /** One line for the human site map. Omitted for self-evident links. */
  description?: string;
  /** Which session, if any, is needed. Rendered as a chip. */
  requires?: "Patient" | "Doctor" | "Nurse" | "Operations";
  /** Include in sitemap.xml. Default false — opt in deliberately. */
  indexable?: boolean;
  /** Relative priority for sitemap.xml, 0–1. */
  priority?: number;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
}

export interface SiteSection {
  id: string;
  title: string;
  blurb: string;
  entries: SiteEntry[];
}

export const SITE_SECTIONS: SiteSection[] = [
  {
    id: "main",
    title: "Main",
    blurb: "The public front of Doceeto.",
    entries: [
      {
        href: "/",
        label: "Home",
        description:
          "What Doceeto is: emergency help, on-demand doctors and nurses, and medicine.",
        indexable: true,
        priority: 1,
        changeFrequency: "weekly",
      },
      {
        href: "/about",
        label: "About",
        description: "Why we are building a single front door to care in India.",
        indexable: true,
        priority: 0.7,
        changeFrequency: "monthly",
      },
      {
        href: "/support",
        label: "Support",
        description:
          "How Doceeto works, how providers are verified, common questions, and who to contact about what.",
        indexable: true,
        priority: 0.8,
        changeFrequency: "monthly",
      },
      {
        href: "/contact",
        label: "Contact",
        description: "Partnerships, press, investment and support.",
        indexable: true,
        priority: 0.6,
        changeFrequency: "monthly",
      },
    ],
  },
  {
    // The preview surfaces. Indexable on purpose, and the only pages that show
    // provider information to anyone without an account — which is exactly why
    // they return a hand-built projection with no coordinates or contact
    // details (see app/api/public/route.ts) rather than the patient app's data.
    id: "preview",
    title: "Try it",
    blurb: "What the product does, without an account.",
    entries: [
      {
        href: "/try/doctors",
        label: "Doctors",
        description: "Browse verified doctors: specialty, experience, languages and fees.",
        indexable: true,
        priority: 0.7,
        changeFrequency: "daily",
      },
      {
        href: "/try/nurses",
        label: "Nurses",
        description: "Browse verified home care nurses and the services they cover.",
        indexable: true,
        priority: 0.7,
        changeFrequency: "daily",
      },
      {
        href: "/try/urgent",
        label: "Urgent care",
        description: "Doctors free to take a request right now.",
        indexable: true,
        priority: 0.7,
        changeFrequency: "daily",
      },
      {
        href: "/try/checker",
        label: "Symptom check",
        description:
          "Describe a symptom and get a plain-language read on what it might be and who treats it.",
        indexable: true,
        priority: 0.8,
        changeFrequency: "monthly",
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    blurb: "Signing in and joining, for every kind of user.",
    entries: [
      {
        href: "/login",
        label: "Sign in",
        description: "For patients, doctors and nurses.",
        indexable: true,
        priority: 0.5,
        changeFrequency: "yearly",
      },
      {
        href: "/signup",
        label: "Create an account",
        description:
          "Register as a patient, or apply to join as a doctor or a nurse.",
        indexable: true,
        priority: 0.6,
        changeFrequency: "yearly",
      },
      {
        href: "/ops-signin",
        label: "Operations sign-in",
        description: "Internal console. Staff only.",
      },
    ],
  },
  {
    id: "patient",
    title: "For patients",
    blurb: "Everything behind a patient sign-in.",
    entries: [
      {
        href: "/patient",
        label: "Dashboard",
        description: "Your care at a glance, health score, and what to do next.",
        requires: "Patient",
      },
      {
        href: "/patient/now",
        label: "Get care now",
        description: "Emergency help and the SOS button.",
        requires: "Patient",
      },
      {
        href: "/patient/care",
        label: "Symptom checker",
        description:
          "Answer a few questions and find out which clinician to see, and how urgently.",
        requires: "Patient",
      },
      {
        href: "/patient/doctors",
        label: "Find a doctor",
        description: "Search by specialty, distance, language and fee.",
        requires: "Patient",
      },
      {
        href: "/patient/nurses",
        label: "Find a nurse",
        description:
          "Home nursing: wound care, injections and IV, vitals, elder care.",
        requires: "Patient",
      },
      {
        href: "/patient/medicine",
        label: "Order medicine",
        description: "Order from a licensed pharmacy, or straight off a prescription.",
        requires: "Patient",
      },
      {
        href: "/patient/prescriptions",
        label: "Prescriptions",
        description: "Every prescription issued to you, ready to share or print.",
        requires: "Patient",
      },
      {
        href: "/patient/account",
        label: "Account",
        description:
          "Health profile, language, data export, and account deletion.",
        requires: "Patient",
      },
    ],
  },
  {
    id: "doctor",
    title: "For doctors",
    blurb: "The cockpit, behind a doctor sign-in.",
    entries: [
      {
        href: "/doctor",
        label: "Cockpit",
        description: "Go online, and see what is waiting.",
        requires: "Doctor",
      },
      {
        href: "/doctor/requests",
        label: "Requests",
        description: "Incoming consultations, home visits and SOS calls.",
        requires: "Doctor",
      },
      {
        href: "/doctor/consults",
        label: "Consultations",
        description: "Run a consultation and issue a prescription.",
        requires: "Doctor",
      },
      {
        href: "/doctor/schedule",
        label: "Schedule",
        description: "Your availability and booked slots.",
        requires: "Doctor",
      },
      {
        href: "/doctor/gigs",
        label: "Services",
        description: "The services you offer, and what you charge.",
        requires: "Doctor",
      },
      {
        href: "/doctor/earnings",
        label: "Earnings",
        description: "Your ledger: gross, commission, net, and payouts.",
        requires: "Doctor",
      },
      {
        href: "/doctor/profile",
        label: "Profile",
        description: "Credentials, registration, fees and photograph.",
        requires: "Doctor",
      },
    ],
  },
  {
    id: "nurse",
    title: "For nurses",
    blurb: "The nursing console, behind a nurse sign-in.",
    entries: [
      {
        href: "/nurse",
        label: "Dashboard",
        description: "Go online, and see what is waiting.",
        requires: "Nurse",
      },
      {
        href: "/nurse/requests",
        label: "Requests",
        description: "Incoming home-visit requests within your skills.",
        requires: "Nurse",
      },
      {
        href: "/nurse/active",
        label: "Active visit",
        description: "The visit you are on now.",
        requires: "Nurse",
      },
      {
        href: "/nurse/gigs",
        label: "Services",
        description: "Wound care, elder care, vitals, injections and IV.",
        requires: "Nurse",
      },
      {
        href: "/nurse/history",
        label: "History",
        description: "Visits you have completed.",
        requires: "Nurse",
      },
      {
        href: "/nurse/earnings",
        label: "Earnings",
        description: "Your ledger and payouts.",
        requires: "Nurse",
      },
      {
        href: "/nurse/profile",
        label: "Profile",
        description: "Council registration, qualifications, skills and fees.",
        requires: "Nurse",
      },
    ],
  },
  {
    id: "ops",
    title: "Operations",
    blurb: "Internal console. Staff only.",
    entries: [
      {
        href: "/ops",
        label: "Console",
        description: "Live SOS dispatch and network health.",
        requires: "Operations",
      },
      {
        href: "/ops/doctors",
        label: "Provider network",
        description: "Verification, listings and provider health.",
        requires: "Operations",
      },
      {
        href: "/ops/orders",
        label: "Orders",
        description: "Medicine order tracking and fulfilment.",
        requires: "Operations",
      },
    ],
  },
];

/**
 * Legal pages are appended as their own site-map section, built from the
 * document registry rather than listed again here — one list, not two.
 */
export const LEGAL_SECTION_META = {
  id: "legal",
  title: "Legal",
  blurb: "Every policy that governs your use of Doceeto.",
} as const;

/** Every non-legal indexable entry, for sitemap.xml. */
export const indexableEntries = (): SiteEntry[] =>
  SITE_SECTIONS.flatMap((s) => s.entries).filter((e) => e.indexable);
