# Legal pages — what must be true before you submit to the App Store and Play Store

The policy pages under [`/legal`](../app/legal) are written and live. They are
accurate about how the product *works today* (data flows, cookies, AI, sessions,
retention). Three things still stand between them and a store submission:

1. **[Entity details are blank](#1-fill-in-the-entity-details)** — deliberately, so nothing fake is published.
2. **[Some promised controls do not exist in the app yet](#2-build-the-controls-the-policies-promise)** — including one Apple and Google both *require*.
3. **[Store console fields need filling](#3-store-console-fields)**.

Work them in that order.

---

## 1. Fill in the entity details

Everything lives in one file: [`lib/legal/company.ts`](../lib/legal/company.ts).
Fields are empty strings rather than placeholder text, and the rendering
components **skip empty rows** — so an unfilled CIN prints nothing rather than
publishing `[CIN here]`. Fill these and they appear everywhere at once.

| Field | Where it shows | Blocking? |
|---|---|---|
| `COMPANY.cin` | Privacy, Terms, Legal hub | Recommended |
| `COMPANY.gstin` | Privacy, Terms, Legal hub | Needed once you invoice |
| `COMPANY.registeredOffice.lines` / `.postalCode` | Every contact block | **Yes** — both stores require a real address |
| `OFFICERS.grievance.name` / `.phone` | Grievance, Privacy, Terms | **Yes** — a name is legally required, a role address alone is not |
| `OFFICERS.dataProtection.name` / `.phone` | Privacy | **Yes** under the DPDP Act |
| `OFFICERS.medical.name` / `.registrationNo` | Clinical governance | Recommended |
| `COMPANY.web.origin` | `sitemap.xml`, `robots.txt`, store links | **Yes** if the live domain is not `doceeto.health` |

Also confirm:

- **Legal name.** Everything says `Doceeto Health Private Limited`. The repo,
  cookie prefix (`iyashi_sid_*`), database file and several env vars still say
  **Iyashi**. That mismatch is *disclosed honestly* in the Privacy and Cookie
  policies via `COMPANY.internalCodename`, so it is safe to ship — but if the
  registered entity is actually named something else, change `legalName` now.
- **Email addresses.** Seven role addresses are cited
  (`privacy@`, `grievance@`, `support@`, `medical@`, `legal@`, `security@`,
  `hello@`). **Every one must actually receive mail** before launch — a store
  reviewer will email at least one, and a bounce is a rejection.
- **Jurisdiction.** `COMPANY.jurisdiction` currently says Nagpur. Change if your
  registered office is elsewhere.

Then bump `POLICY_VERSION` (version + both dates) so the stamp on every page is
the date you actually publish.

---

## 2. Build the controls the policies promise

The policies describe self-service controls. Some do not exist yet. **A policy
that promises a control the app does not have is worse than no policy** — it is
a documented, reviewer-verifiable false statement.

### Hard blocker — both stores will reject without it

- [ ] **In-app account deletion.** Apple *App Store Review Guideline 5.1.1(v)*
      and Google Play's *Data deletion policy* both require an account-deletion
      path **inside the app**, not only by email.
      - Referenced as **Account → Delete account** in
        [`data-deletion`](../app/legal/data-deletion/page.tsx) and
        [`terms`](../app/legal/terms/page.tsx).
      - Must re-authenticate, must block while a consult/order/refund is open
        (the policy says so), and must erase exactly the "Deleted" table and
        retain exactly the "Retained" table in `data-deletion`.
      - Play additionally wants a **web URL** for deletion requests reachable
        without signing in. That already exists: `/legal/data-deletion`.

### Also promised, currently missing

- [ ] **Account → Download my data** (export profile, health record, vitals,
      prescriptions, care history in a machine-readable format). Promised in
      `data-deletion` and in `privacy` under portability.
- [ ] **Records → Revoke link** on a prescription. Promised in `data-deletion`
      and `security`. The schema has `prescriptions.share_token` but nothing
      revokes it.
- [ ] **Account → Addresses** management (add / remove a saved address).
- [ ] **Account → unlink Google** (after setting a password first).
- [ ] **Delete a review you wrote.**
- [ ] **Account → Payments** with downloadable tax invoices, and a **GSTIN
      field** set *before* checkout. Both are promised in
      [`sales`](../app/legal/sales/page.tsx).

### Already exists

- Clear saved symptom checks — `account.clearData` in
  [`lib/i18n`](../lib/i18n/index.ts), wired in
  [`app/patient/account`](../app/patient/account/page.tsx).
- Health-profile field editing.
- Sign out, including all devices.

### Decide, then correct the page if the answer is no

The policies assert these. Confirm each is true, or soften the wording:

- [ ] **Provider verification is actually enforced.** `doctors.verified` and
      `ProviderVerificationStatus` exist, but see the known gap: `verified` is
      read in many places and **never set**. The
      [`providers`](../app/legal/providers/page.tsx) page publishes a six-state
      verification table as though it runs. Either implement the workflow or
      rewrite that section before launch — this is the highest-risk claim on the
      site, because it is a safety claim about clinicians entering homes.
- [ ] **Payment gateway is live**, and card data genuinely never touches your
      servers (`sales` asserts this).
- [ ] **Refund timelines** in `sales` match what your gateway actually does.
- [ ] **Commission rate** is displayed in the provider dashboard (`sales` and
      `providers` both say it is).
- [ ] **OpenRouter is contractually directed not to train on your data**
      (`privacy` asserts this under "What we do not do with it"). Verify against
      your OpenRouter plan's data-retention setting and enable zero-retention.
- [ ] **Database region** — `privacy` says you keep Indian users' records in a
      selected region. Confirm your Neon/Supabase project region.
- [ ] **Backup rotation ≤ 90 days** (`data-deletion` asserts this).
- [ ] **Audit logging** of admin access to records — the `audits` table exists;
      confirm it is actually written on record access.

---

## 3. Store console fields

### Both stores

| Field | Value |
|---|---|
| Privacy policy URL | `https://<domain>/privacy` → `/legal/privacy` |
| Terms / EULA URL | `https://<domain>/terms` |
| Account deletion URL | `https://<domain>/delete-account` |
| Support URL | `https://<domain>/contact` |

Short aliases are configured in
[`next.config.mjs`](../next.config.mjs) as permanent redirects, precisely so
these are typeable and survive being read aloud.

### Apple — App Store Connect

- [ ] **Guideline 1.4.1 (medical apps).** Expect scrutiny. Point the reviewer at
      `/legal/medical-disclaimer` and `/legal/emergency`, which state plainly
      that the app is not a substitute for emergency services.
- [ ] **Privacy Nutrition Labels.** Declare: Contact Info, Health & Fitness,
      Location, Identifiers, Usage Data, Diagnostics, Financial Info. Mark
      **"Data Not Used to Track You"** — true, and the Cookie Policy backs it.
- [ ] **Account deletion** (5.1.1(v)) — see the blocker above.
- [ ] **Reviewer demo account** with pre-seeded data, plus a note saying no real
      clinician will be dispatched to a test booking.
- [ ] **Guideline 5.1.3** — if you ever read Apple Health data, it may not be
      used for advertising or shared with brokers. `privacy` already commits to
      this.
- [ ] Age rating: **17+** ("Frequent/Intense Medical or Treatment Information").

### Google — Play Console

- [ ] **Health apps declaration.** Telemedicine requires a declaration form and
      proof you may lawfully operate — company registration, and evidence
      clinicians are council-registered.
- [ ] **Data safety form.** Must match `/legal/privacy` *field for field*.
      Mismatch is a common rejection. Declare collection + sharing of health
      data, and that data is encrypted in transit and deletable.
- [ ] **Sensitive permissions.** `ACCESS_FINE_LOCATION` needs a justification;
      background location (providers only) needs a **demo video** and a
      prominent-disclosure screen. The permission table in `privacy` is written
      to match.
- [ ] **Target audience:** adults only. The app is 18+ by the Terms, and DPDP
      treats under-18s as children.
- [ ] Content rating questionnaire — declare medical content.

### India-specific, before you take money

- [ ] Payment aggregator onboarding (Razorpay / Cashfree / PayU) — they will ask
      for the Terms, Privacy, Refund and Contact pages. All four now exist.
- [ ] GST registration, if not already held.
- [ ] Confirm pharmacy partners hold valid **Form 20/21** retail licences.
- [ ] Professional indemnity insurance verified for every listed provider
      (`providers` requires it of them).

---

## Maintenance

- **One version stamp.** `POLICY_VERSION` in `company.ts` drives the version and
  dates on all 13 pages. Bump it on any material change, notify users, and
  re-prompt consent where the change widens data use.
- **Adding a policy?** Add it to
  [`lib/legal/documents.ts`](../lib/legal/documents.ts) only. The hub, footer,
  site map, `sitemap.xml` and every page's related-links block all read from
  that registry, so one entry publishes it everywhere.
- **Adding a page or route?** Add it to
  [`lib/legal/site-map.ts`](../lib/legal/site-map.ts). Set `indexable: true`
  **only** if it is public — anything behind a session must stay out of
  `sitemap.xml`, and `/rx/` must never be indexed.
- **Keep the docs honest.** If you change how data flows — a new processor, a
  new field, a different AI provider — update `/legal/privacy` in the same PR.
  The value of these pages is that they are true.
