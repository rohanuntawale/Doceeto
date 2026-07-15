# Iyashi — Product & Market Audit (VC lens)

> A brutally honest, evidence-based audit of Iyashi written as an investment
> committee would read it, plus the roadmap of real functionality to build.
> Grounded in current (2025–2026) web research + a line-by-line read of the
> codebase. Share freely with the team.

**What Iyashi is:** an India-focused "Uber for freelance doctors" — patients
request a doctor for a **home visit, clinic visit, or video** and nearby licensed
doctors accept, Uber-style; plus an emergency **SOS/ambulance** module and
**medicine delivery**.

---

## 0. The verdict in one paragraph

The market is unicorn-sized and the wedge is **real but narrow and closing**. The
concept is *not* owned by the giants (Practo, Apollo 24|7, Tata 1mg are
video/pharmacy/diagnostics plays) — but it **is** executed by tiny
under-capitalised startups (Treat at Home does literal 2–4-min nearest-doctor
matching with live ETA), and **Apollo HomeCare launched a "90-minute
doctor-on-call guarantee" in Bangalore in May 2025**. The two companies that were
most literally "Uber for doctors" — **Heal** (lone doctors to homes) and
**Forward** (tech-replaces-doctor) — both **died on the same math**. Today Iyashi
is a **beautiful booking demo with no dispatch engine, no trust layer, no clinical
output, and no money**. It becomes fundable only if it stops being "Uber for
doctors" and becomes **the ABDM-native orchestration + trust + continuity layer**.

---

## 1. What it's supposed to be vs what it is

It's supposed to be a **real-time dispatch + trust + clinical + payments**
marketplace. What exists today: a patient can filter doctors, see them on a map,
and send a request; a doctor can accept. Everything below the surface is
simulated. That's the honest starting line. The architecture (clean data seam,
real auth, Neo4j) is genuinely good scaffolding to build the rest on.

---

## 2. Competitive map

| Capability | Iyashi (today) | Practo | Apollo 24\|7 | MediBuddy | Portea | Treat at Home (direct clone) | DispatchHealth (US ref) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| On-demand **home** doctor | booking only | ✗ | ~ 90-min SLA (Blr) | ~ nursing | ✓ *scheduled* | ✓ **2–4 min, live ETA** | ✓ kit-equipped team |
| Video / clinic | ✓ | ✓ 60-sec | ✓ 15-min | ✓ 10-min | ~ | ~ | ~ |
| **Real dispatch + live GPS/ETA** | ✗ fake coords | ✗ | ~ | ✗ | ✗ | ✓ | ✓ auditable |
| AI triage / acuity routing | ✗ | ~ | ✓ "Ask Apollo" | ~ | ✗ | ✗ | ✓ (the whole model) |
| e-Prescription (NMC reg #) | ✗ | ✓ | ✓ | ✓ | ~ | ~ | ✓ |
| ABHA/ABDM record | ✗ | ~ | ✓ | ✓ | ~ | ✗ | n/a |
| Diagnostics-at-home | ✗ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ point-of-care |
| Meds fulfilment | demo | ~ | ✓ 19-min | ✓ | ~ | ~ | n/a |
| Doctor verification depth | ✗ self-serve | ✓ Bluebook+NMR+ID | ✓ | ~ | ✓ employed | ~ | ✓ credentialed |
| Continuity / chronic subscription | ✗ | ~ 7-day f/u | ~ | ✓ corp | ✓ | ✗ | ✓ value-based |
| Money (payments/escrow/payout) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

The row that matters: **Iyashi is red or demo-only on almost every line that makes
this a company, not a clone.**

---

## 3. What competitors do that we don't (table-stakes gaps)

1. **Real availability + dispatch** — Zocdoc's 175 EHR/calendar integrations and
   Okadoc's ~60% UAE HIS coverage make a shown slot *real*. Serious dispatch is
   **batched MIP optimisation** (DoorDash "DeepRed", Uber H3 + DeepETA), not
   "nearest available → ping."
2. **e-Prescription with NMC registration number** — legally mandated (Telemedicine
   Guidelines 2020); every incumbent does it natively.
3. **AI symptom triage** — Apollo "Ask Apollo" (1,300+ conditions); Infermedica
   drove a **33% drop in ER-intent across 1.55M interactions**.
4. **Live ETA + GPS** — Orange Health ("eMedic"), RED.Health, Treat at Home.
5. **ABHA/ABDM record + HPR/NMR verification** — ~90 cr ABHA IDs, **1 billion
   linked records** (May 2026).
6. **Diagnostics + meds loop** — every giant closes consult→test→meds in-app.
7. **Vernacular** — MediBuddy 16 langs; HealthifyMe's Ria 50+.
8. **AI ambient scribe for doctors** — Abridge is a **$5.3B** company; Carbon cuts
   notes 16→<4 min. The #1 *supply-side retention* lever.

---

## 4. What we could do that none of them do well (the white space)

1. **One unified, triaged, emergency-grade dispatch** — one SOS that *decides*
   home-doctor vs ambulance vs video and dispatches with an SLA + live tracking.
   These are separate companies today (RED.Health = ambulances, Treat at Home =
   scheduled GPs). Fusing triage → right-resource → tracking is un-owned.
2. **The first well-capitalised, ABDM-native, SLA-backed home-doctor network.**
3. **Gig-supply liquidity as the core asset** — a doctor-side app with heat-maps,
   surge, instant payouts, route-batching (~12 visits/day, à la Sprinter Health).
4. **A continuity layer bolted onto gig delivery** — a persistent ABHA/FHIR record
   that follows the patient across whichever doctor shows up.

---

## 5. Why the look-alikes died — and our guardrails

| Company | Cause of death | Iyashi guardrail |
|---|---|---|
| **Heal** | Doctor windshield time → too few visits/day at consumer prices | Cluster + route-batch; APP+nurse tiers; premium/payer money for home |
| **Forward** ($650M, shut 2024) | Removed the human ("CarePods"); flat $150/mo unlimited on a high-marginal-cost service | Never flat-fee unlimited; keep the clinician central |
| **Babylon** (bankrupt, ~$2B) | Unvalidated **autonomous AI diagnosis** + capitated lives it couldn't serve | AI is *routing*, clinician-in-the-loop, never "the doctor" |
| **Cerebral** (DOJ settlement) | Tied clinician pay to **prescribing** → over-prescribed controlled drugs | Never tie pay to Rx; hard-block Schedule-X/NDPS (already illegal here) |
| **Mfine → LifeWell** | Pure teleconsult = thin/negative margin; forced merger into diagnostics | Consult is a **loss-leader**; monetise meds/diagnostics/SOS/subscription |
| **Teladoc/BetterHelp** ($1B loss '24) | Consumer-CAC treadmill, weak retention | Build retention (continuity/subscription) + B2B2C |

**Through-line:** failures died from (a) high-marginal-cost service at flat/consumer
price, (b) CAC dependency with weak retention, (c) removing/over-incentivising the
clinician, or (d) AI-as-the-product. Our current model is exposed to all four by
default — the strategy must neutralise each.

---

## 6. The real functionality to build — ranked for fundability

| # | Build this | Why a VC leans in | Status |
|---|---|---|---|
| 1 | **ABDM-native records + verified supply** (ABHA HIP/HIU, HPR/NMR) | Compounding data moat + trust source-of-truth; unique to India | Not started |
| 2 | **Two-sided KYC + primary-source credentialing + background checks** | "Investable" vs "a lawsuit" for a stranger entering a home | In progress |
| 3 | **Real dispatch engine** — offer state machine, batched MIP, HHCRSP constraints, OSRM travel-time | The actual "Uber"; core technical moat | In progress (demo) |
| 4 | **Continuity / chronic-care subscription** (care plans, RPM, family accounts) | Turns leaky marketplace into a **128% NRR annuity** (Omada); continuity cuts mortality (AHR 0.54) | Not started |
| 5 | **AI triage / acuity routing** (Infermedica-style) | Lifts match quality, conversion, safety; API not R&D | In progress (demo) |
| 6 | **In-visit safety suite** (two-sided SOS, live tracking, anomaly, masking, post-visit check) | Non-negotiable for home visits | Partial |
| 7 | **Live doctor GPS + patient ETA** (H3 + Redis GEOSEARCH + ETA residual) | Visible trust/UX layer | In progress (demo) |
| 8 | **Vernacular AI voice + WhatsApp** (booking/intake/reminders/no-show + agentic follow-up) | India field is fragmented/unvalidated → winnable | Not started |
| 9 | **e-Rx + meds-delivery orchestration** (ABDM e-Rx → 1mg/Apollo) | Closes consult→Rx→delivery; revenue + retention | In progress (demo) |
| 10 | **Outcomes & clinical-quality scoring** (process + PREMs + validated PROMs) | Turns "4.8★" into data for insurance deals | Partial |

**#1–#4 are the durable moat; #5–#10 compound it.**

---

## 7. The unfair advantage: India's DPI

- **ABDM/ABHA:** ~90 cr IDs, **1 billion linked records** (May 2026).
- **HPR / NMR:** ~5.4 lakh professionals in a national medical register.
- **UPI:** 23.2 B txns/month — payments are a solved commodity.
- **DigiLocker + Aadhaar e-KYC:** ~57 cr users; verify degrees + KYC instantly.

A US/MENA competitor would have to *build* all of this. Iyashi gets it for the cost
of integration.

---

## 8. Business model

- The consult is a **loss-leader**. Money is in **meds + diagnostics + subscription
  + B2B2C**. Every Indian survivor owns a fulfilment-margin pool or sells to
  employers/insurers; every pure-consult play died.
- **Don't market "doctor in X minutes"** — the govt forced Zepto/Blinkit to drop
  "10-minute" branding. Market **reliability + SLA + safety**.
- **Reserve home visits; route by acuity.** Async/video default; home visit
  clustered and premium/payer-funded; SOS always triaged, never blind-dispatched.

---

## 9. The sharpest wedge (what to do first)

On-demand home-doctor + triaged SOS in **ONE affluent metro cluster** (South
Bengaluru / South Mumbai / Gurugram), targeting **elderly + chronic + post-op**,
with a **chronic/elder-care subscription as the real product** and the home visit
as the acquisition hook. Nail supply liquidity in a few pincodes; layer ABHA
continuity + diagnostics + meds for margin; only scale to a second city after
retention proves out.

---

## 10. Idea rating

| Dimension | Score |
|---|---|
| Market size | 9/10 |
| Wedge / white space | 7/10 |
| Defensibility | 6/10 (only if #1–#4 get built) |
| Regulatory feasibility | 6/10 (in-person home visit is *advantaged* on prescribing vs video-only) |
| Unit economics | 5/10 (works only via subscription + fulfilment + B2B2C) |
| Execution difficulty | Hard |
| **Blended** | **~6.3/10** |

**The one-line pitch:** *"We're building India's ABDM-native home-care dispatch
network — triaged SOS-to-home-doctor with live tracking and verified clinicians —
that turns one-off visits into a chronic-care subscription. Uber's dispatch +
DispatchHealth's clinical model + India's 1-billion-record health rail, aimed at
the elderly and chronically ill."*

---

## Key sources

Apollo HomeCare 90-min guarantee (eHealth, May 2025) · Treat at Home
(treatathomes.com) · Orange Health "eMedic" · RED.Health · Connect & Heal · Loop
Health · DispatchHealth × Medically Home merger (Home Health Care News / Fierce
Healthcare) · Sesame (sesamecare.com) · Zocdoc integration program · Ro (Wikipedia)
· Halodoc (CleverTap) · Vezeeta/Okadoc (Menabytes) · Babylon bankruptcy (TechCrunch)
· Forward shutdown (Fierce Healthcare) · Cerebral DOJ settlement · Teladoc 2024
results (Healthcare Dive) · India Telemedicine Practice Guidelines 2020 (PMC /
Lexology) · ABDM 100 crore records (PIB / DD News) · Infermedica external validation
· Abridge $5.3B (TechCrunch) · Omada Q1-2026 results (128% NRR) · Continuity &
mortality (PMC / BJGP) · Uber H3 / DeepETA / DoorDash DeepRed engineering blogs.
