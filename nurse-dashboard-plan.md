# Nurse Dashboard and Marketplace Onboarding Plan

## 1. Objective

Add nurses as a first-class provider type in Iyashi with a separate onboarding flow and dashboard, while reusing the existing provider infrastructure wherever possible.

The first release is for direct patient booking in Nagpur. Patients should be able to find verified nurses for practical home-care services, and nurses should be able to receive, accept, complete, and get paid for requests.

Pregnancy and maternal-care features are explicitly out of scope for this release.

## 2. Product decisions

- Nurses have a separate dashboard at /nurse.
- Patients can discover and book nurses directly; a doctor referral is not required.
- Nurses do not receive the doctor dashboard's gigs, appointments, prescribing, or doctor-specific clinical tools.
- Launch services:
  - Injection and IV assistance at home
  - Wound dressing and post-operative care
  - Elderly and bedridden care
  - Vitals monitoring and sample collection
- Nurse onboarding requires document submission, operations review, and a reference check before discovery.
- The nurse dashboard supports English, Hindi, and Marathi.
- Booking, requests, trips, payments, wallet, ratings, and events should be shared with doctors unless a nurse-specific constraint is required.

## 3. Guiding principles

### Safety before growth

An unverified nurse must not appear in patient search or accept a home-care request. The system should distinguish between submitted, under review, verified, rejected, suspended, and expired credentials.

### Scope of practice is explicit

Nurse services must be represented as controlled capabilities, not vague specialties. Patient-facing copy must not imply that a nurse can diagnose, prescribe, or replace a doctor.

### Provider experiences are role-specific

The nurse dashboard should feel like a work console for home-care delivery, not a copy of the doctor cockpit with different labels.

### Reuse the operational spine

Reuse existing sessions, provider presence, location, request lifecycle, trip stages, payments, ratings, and ops patterns. Do not build parallel nurse versions of these systems.

## 4. Recommended v1 scope

### In scope

1. Nurse role selection during provider signup.
2. Nurse-specific profile and onboarding form.
3. Credential and reference submission.
4. Ops review and verification workflow.
5. Nurse dashboard with home, requests, active visit, history, earnings, profile, and verification.
6. Patient nurse discovery and filtering.
7. Direct booking for supported nurse services.
8. Request acceptance, arrival, visit start, completion, cancellation, and rating.
9. English, Hindi, and Marathi translations.
10. Audit logging for verification and high-risk actions.

### Explicitly out of scope

- Pregnancy or maternal-care workflows.
- Nurse-created diagnoses.
- Prescribing or medication changes by nurses.
- Nurse scheduling calendars and recurring appointments.
- Nurse gigs or long-duration shift packages.
- Automated clinical decisions.
- Insurance claims.
- Hospital or clinic rostering.

## 5. Role and domain model

Extend the current role model:

~~~ts
type Role = "patient" | "doctor" | "nurse" | "ops";
type ProviderCadre = "doctor" | "nurse";
~~~

Every provider record should expose both account role and provider cadre consistently. Add shared helpers so authorization does not depend on scattered checks:

~~~ts
isProviderRole(role)
isDoctorRole(role)
isNurseRole(role)
canPrescribe(role)
~~~

The nurse profile should include:

~~~ts
interface NurseProfile {
  fullName: string;
  gender?: "female" | "male" | "other";
  age?: number;
  languages: string[];
  qualifications: string[];
  registrationCouncil?: string;
  registrationNumber?: string;
  experienceYears: number;
  about?: string;
  serviceCapabilities: NurseService[];
  homeVisitFee?: number;
  serviceRadiusKm?: number;
  lat?: number;
  lng?: number;
}

type NurseService =
  | "injection_iv"
  | "wound_dressing"
  | "elderly_bedridden"
  | "vitals_sample_collection";
~~~

Use controlled service values for search, authorization, and pricing. Free-text notes may supplement them but cannot replace them.

## 6. Verification model

Do not use one boolean as the entire verification system. Add a status:

~~~ts
type ProviderVerificationStatus =
  | "not_started"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "suspended";
~~~

Create verification records for:

- Government identity document metadata.
- Nursing registration or council credential metadata.
- Qualification certificate metadata.
- Reference contact and reference-check result.
- Reviewer ID, decision, reason, and timestamps.
- Secure upload/storage reference and optional expiry date.

Patients should receive only safe verification facts such as verified: true. Document numbers, images, and reference details must never appear in public provider responses.

## 7. Database and repository changes

### Users and sessions

- Add nurse to role unions and database constraints.
- Add the nurse surface to role-cookie and middleware mappings.
- Ensure nurse logout does not affect patient or doctor sessions.
- Update redirects and session guards for /nurse/*.

### Provider records

Keep one canonical provider representation:

- Reuse the existing provider entity/table.
- Add cadre: doctor | nurse.
- Store nurse-specific fields in structured JSONB initially if that best fits the current repository abstraction.
- Add indexes for cadre, verification status, active status, and location.
- Filter nurse results out of doctor-only lists and vice versa.

### Services

Store nurse capability tags through a server-side sanitizer with:

- An allowlist of supported service values.
- A maximum number of capabilities.
- Text length limits.
- Numeric bounds for fees, experience, and radius.

### Verification

Add a verification table/entity instead of adding unrelated fields to the provider row. It should support multiple documents and an audit trail:

~~~text
id
provider_id
provider_cadre
document_type
storage_key
document_status
reviewer_id
review_note
submitted_at
reviewed_at
expires_at
created_at
updated_at
~~~

Reference checks should be protected from patient-facing access.

## 8. Onboarding flow

### Step 1: Account type

The provider path presents Doctor and Nurse. The selected type controls the remaining form and destination after signup.

### Step 2: Account basics

- Name
- Email
- Password or Google sign-in
- Phone number if required by current authentication
- Preferred language

### Step 3: Professional profile

For nurses:

- Qualifications
- Registration council and registration number
- Years of experience
- Languages spoken
- Service capabilities
- Preferred service radius
- Home-visit pricing
- Short professional introduction

### Step 4: Verification submission

Support:

- Identity document
- Nursing qualification document
- Registration or council credential
- One or more reference contacts

Explain why each item is required and that the nurse cannot receive patient requests until review is complete.

### Step 5: Review state

After submission, route the nurse to /nurse, but show a verification state instead of an active request queue:

- Submitted: waiting for review.
- Under review: operations is checking the application.
- Changes requested: show exact missing or incorrect items.
- Verified: profile can become discoverable.
- Rejected: show a safe reason and support path.
- Suspended: remove the nurse from discovery and active dispatch.

## 9. Nurse dashboard information architecture

Create a separate NurseShell using the existing design system but with nurse-specific navigation.

Recommended routes:

~~~text
/nurse
/nurse/requests
/nurse/active
/nurse/history
/nurse/earnings
/nurse/profile
/nurse/verification
~~~

### /nurse — Home

Show:

- Offline, available, or busy status.
- Verification status.
- New request count.
- Active visit summary.
- Today's completed visits and earnings.
- Safety reminder and escalation guidance.
- A clear Go available control only after verification.

### /nurse/requests — Request inbox

Each request should show:

- Service requested.
- Patient first name and appropriate age band.
- Approximate location and distance.
- Requested time or urgency.
- Key patient-provided notes.
- Estimated fee.
- Expiration countdown.
- Accept and decline actions.

Avoid exposing unnecessary patient history before acceptance.

### /nurse/active — Active visit

Use the shared lifecycle:

~~~text
accepted -> enroute -> arrived -> in_progress -> completed
~~~

Include:

- Patient contact and navigation action.
- Arrival confirmation.
- Service checklist.
- Permitted notes.
- Doctor/SOS escalation action.
- Completion confirmation and payment summary.

### /nurse/history — Visit history

Show completed and cancelled visits with date, service, patient-safe summary, fee, payout status, rating, and permitted notes.

### /nurse/earnings — Wallet

Reuse the existing wallet and payout engine. Show pending balance, available balance, visit earnings, commission, and payout history.

### /nurse/profile — Profile

Allow editing of biography, languages, capabilities, service radius, fees, availability status, and profile photo.

Do not allow editing of verification decisions, ratings, account role, or reviewer data.

### /nurse/verification — Verification center

Show document checklist, upload status, review status, requested changes, and support contact. This page must be fully translated.

## 10. Patient-side marketplace

Add nurses as a separate provider category rather than mixing them into doctor lists by default.

Recommended entry points:

- Find a nurse card on patient home.
- Nurse tab or filter in the provider directory.
- Service-first search for wound dressing, elder care, vitals, or injection assistance.

Search results should include:

- Verified badge.
- Service capabilities.
- Languages.
- Experience.
- Distance.
- Price.
- Rating.
- Response or availability status.

Only verified, active nurses within the configured service radius should be discoverable. Booking must validate the selected service against the nurse's capabilities on the server.

## 11. Care-safety rules

### Nurse actions allowed

- Accept supported home-care requests.
- Record permitted observations and vitals.
- Complete a service checklist.
- Escalate concerning findings.
- Contact the patient and operations.

### Nurse actions prohibited

- Diagnosing a condition.
- Prescribing or changing medication.
- Ordering treatment outside service scope.
- Closing an emergency without escalation.

### Escalation

Every active visit should provide:

1. Contact with the patient's doctor, if one exists.
2. An urgent doctor-consult request.
3. SOS for an immediate emergency.
4. Operations notification for safety, access, abuse, or payment issues.

Escalation events must be timestamped and auditable.

### Service checklists

Use structured operational checklists, reviewed by a qualified clinician before production use:

- Wound dressing: supplies, dressing change, wound observations, escalation flag.
- Elder care: arrival, hydration/meal assistance, mobility support, safety observations.
- Vitals: blood pressure, pulse, temperature, oxygen saturation, authorized glucose, collection status.
- Injection/IV: order or authorization reference, medication supplied by patient/facility, administration status, adverse-reaction escalation.

## 12. Operations dashboard

Add a nurse review queue separate from the doctor roster while sharing administrative patterns.

Operations must be able to:

- Filter applications by status.
- Inspect documents securely.
- Record document checks.
- Record reference-check outcomes.
- Request changes.
- Verify, reject, or suspend a nurse.
- View the audit history.
- Hide or restore a nurse from patient search.
- See active visits and safety escalations.

All verification actions must be server-authorized, rate-limited, and auditable.

## 13. API and authorization

Recommended endpoint groups:

~~~text
/api/auth/register
/api/nurse/profile
/api/nurse/verification
/api/nurse/requests
/api/nurse/visits
/api/nurse/status
/api/nurse/earnings
/api/data?cadre=nurse
/api/ops/nurses
/api/ops/nurses/:id/verification
~~~

Every handler must validate:

- A valid session exists.
- The session role is correct.
- The provider belongs to the current user.
- The nurse is verified before becoming available, accepting, or starting a visit.
- The requested service is supported.
- The state transition is valid and idempotent.

Keep these distinctions explicit:

- isProvider: common provider infrastructure.
- isDoctor: doctor-only workflows.
- isNurse: nurse-only workflows.
- canPrescribe: false for nurses.

## 14. Frontend structure

Suggested components:

~~~text
components/nurse/nurse-shell.tsx
components/nurse/nurse-status-card.tsx
components/nurse/nurse-request-card.tsx
components/nurse/nurse-visit-checklist.tsx
components/nurse/nurse-verification-card.tsx
components/nurse/nurse-profile-form.tsx
components/nurse/nurse-earnings-card.tsx
~~~

Suggested pages:

~~~text
app/nurse/layout.tsx
app/nurse/page.tsx
app/nurse/requests/page.tsx
app/nurse/active/page.tsx
app/nurse/history/page.tsx
app/nurse/earnings/page.tsx
app/nurse/profile/page.tsx
app/nurse/verification/page.tsx
~~~

Reuse existing hooks and API client patterns. Keep all nurse-facing strings in the i18n dictionary.

## 15. Translation and accessibility

Add nurse-specific keys for English, Hindi, and Marathi covering navigation, service names, verification states, request actions, visit lifecycle, safety copy, empty states, validation, and errors.

Design for:

- Mobile-first usage.
- Large touch targets.
- High contrast.
- Clear status colors plus text labels.
- Low-bandwidth loading.
- Safe behavior after refresh or temporary network loss.
- Bilingual clinical/legal copy reviewed by a qualified local reviewer.

## 16. Security and privacy

- Store document metadata and files securely.
- Never include identity documents in patient search responses.
- Restrict document access to the applicant and authorized ops reviewers.
- Audit verification, suspension, escalation, and visit completion.
- Rate-limit registration, uploads, verification, and request actions.
- Validate every payload server-side.
- Prevent nurses from changing their own verification status.
- Prevent nurse access to doctor-only patient data and prescription actions.
- Minimize patient information shown before acceptance.
- Define retention and deletion rules for rejected applications and documents.

## 17. Delivery phases

### Phase 0: Foundation

- Add nurse role and provider cadre.
- Update database constraints, cookies, middleware, redirects, and session guards.
- Replace doctor-only provider checks with explicit role helpers.
- Fix the existing verification gap so ops can actually verify and suspend providers.
- Add sanitizers and authorization tests.

### Phase 1: Onboarding and verification

- Add Doctor/Nurse provider choice.
- Add nurse profile form.
- Add document and reference submission.
- Add ops nurse review queue.
- Make only verified nurses discoverable.

### Phase 2: Dashboard shell

- Build NurseShell.
- Add translated navigation.
- Add home, profile, verification, history, and earnings.
- Add available/busy/offline status.

### Phase 3: Direct booking

- Add patient nurse discovery.
- Add service filters.
- Add nurse request inbox.
- Reuse request/trip transitions with nurse authorization.
- Add active visit checklist and escalation.

### Phase 4: Pilot hardening

- Add end-to-end role-boundary tests.
- Test Hindi and Marathi at mobile widths.
- Test poor network, refresh, retry, and duplicate actions.
- Run a small Nagpur nurse pilot.
- Review service checklists with a qualified clinical reviewer.
- Track response time, acceptance, completion, cancellation, escalation, complaints, and safety incidents.

## 18. Testing strategy

### Unit tests

- Role and cadre helpers.
- Nurse profile sanitization.
- Capability validation.
- Verification transitions.
- Request authorization.
- Visit state transitions.
- Translation fallback.

### API tests

- Patient cannot access nurse actions.
- Nurse cannot access doctor actions.
- Unverified nurse cannot become available.
- Unverified nurse cannot accept a request.
- Nurse cannot accept an unsupported service.
- Ops can verify, reject, request changes, and suspend.
- A nurse can mutate only their own profile and requests.

### End-to-end test

1. Register as nurse.
2. Submit profile and documents.
3. Confirm the nurse is undiscoverable.
4. Ops verifies the nurse.
5. Confirm the nurse appears in patient search.
6. Patient books a supported service.
7. Nurse accepts and completes the visit.
8. Patient rates the nurse.
9. Nurse sees the earning.
10. Ops suspends the nurse and confirm discovery and acceptance stop.

## 19. Acceptance criteria

The release is complete when:

- A user can register as a nurse and land on /nurse.
- The nurse can submit all required professional information and documents.
- Operations can review and record a verification decision.
- Unverified nurses are invisible and cannot accept requests.
- Verified nurses can become available and receive direct requests.
- Patients can find nurses by service, language, verification, distance, and price.
- A nurse can accept, travel, arrive, start, complete, and escalate a visit.
- Nurse earnings appear in the shared wallet.
- Nurse pages work in English, Hindi, and Marathi on mobile.
- Nurse accounts cannot access prescribing or doctor-only workflows.
- Verification, suspension, escalation, and completion actions are auditable.
- Demo/file-store mode and Postgres mode behave consistently.

## 20. Recommended first vertical slice

Start with one complete marketplace loop:

1. Add nurse role and provider cadre.
2. Build nurse signup and profile submission.
3. Add ops verification with a document checklist.
4. Build /nurse and /nurse/requests.
5. Launch one service first: wound dressing/post-operative care.
6. Reuse the existing request and completion lifecycle.
7. Add patient search for verified nurses.
8. Test signup through completed paid visit.

Then add elderly care, vitals/sample collection, and injection/IV as additional capabilities.

## 21. Risks to resolve before production

1. Which nursing credentials are accepted for the Nagpur pilot?
2. Which services require a doctor order or prescription?
3. Who clinically reviews the service checklists?
4. What happens when a nurse encounters an emergency?
5. How are document files stored, retained, and deleted?
6. What is the cancellation and no-show policy?
7. How are complaints, abuse, and unsafe-home reports handled?
8. Are nurses employees, contractors, or marketplace providers?
9. What insurance or liability coverage is required?
10. Which accessibility and language needs must be supported beyond English, Hindi, and Marathi?

