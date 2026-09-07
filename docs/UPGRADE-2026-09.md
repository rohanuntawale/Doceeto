# Doceeto upgrade

## Execution plan
1. Pull main and preserve the previous landing edit.
2. Inventory every web route and trace profile, onboarding, map and care data flows.
3. Replace keyed basemaps with attributed OpenStreetMap tiles; restore hero contrast.
4. Enforce practitioner approval in pages and APIs; add email-bound expiring invites and a review waiting page using existing provider and audit storage.
5. Add optional signed Aadhaar XML import with consent and pinned certificate validation; preserve server-owned identity fields on profile saves.
6. Preserve typed question context and gather relevant history before conclusions; assemble patient context from profile, saved conversations and prescriptions with provenance.
7. Add Mira, a reactive local GLB companion, and a white chat interface; unify profile styling.
8. Run type checks, regression tests and local browser checks. Record deployment setup.

## Confirmed defects
- Invalid configured MapTiler keys override the keyless map fallback.
- Hero footage plays at full opacity with the readability wash disabled.
- Typed replies record the inferred offline question instead of the displayed AI question.
- AI failure closes assessments after three answers; the model prompt permits early conclusions.
- Assistant history is a short client-provided list of conclusions, omitting original conversations.
- Provider guards check roles without verification; directories expose unverified doctors.
- Password registration lacks checks present in Google completion.
- Profile replacement drops identity-verification fields.

## Boundaries
Mira offers symptom assessment and care guidance, not a confirmed diagnosis. Urgent red flags interrupt questioning. Historical AI suggestions remain unconfirmed possibilities. Aadhaar is voluntary; signature verification authenticates a document, not ownership by its uploader. No OTP service is simulated.

## References
- https://uidai.gov.in/en/307-faqs/aadhaar-online-services/aadhaar-paperless-offline-e-kyc/10726-what-is-aadhaar-offline-e-kyc.html
- https://www.uidai.gov.in/images/FAQ_OVSE.pdf
- https://operations.osmfoundation.org/policies/tiles/
- https://www.nhs.uk/symptoms/chest-pain/
