# Doceeto page audit

## Entry and trust
| Routes | Audit result | Change made |
| --- | --- | --- |
| `/`, `/about`, `/contact`, `/support` | Landing route carried a key-dependent map and low-contrast hero footage. | Keyless attributed OpenStreetMap tiles; stronger hero readability wash and reduced video opacity. |
| `/login`, `/signup`, `/signup/role`, `/verification` | Provider signup could look complete before a credential review. | Direct invite path or a clear reviewed-pending holding page. |
| `/legal/*`, `/privacy`, `/terms`, `/sitemap`, `/robots.txt` | Static policy and discovery routes use the shared public shell. | No functional change required. |

## Patient experience
| Routes | Audit result | Change made |
| --- | --- | --- |
| `/patient`, `/patient/now`, `/patient/doctors`, `/patient/doctors/[id]`, `/patient/nurses` | New patients could enter operational pages without providing even minimal context. | New patient onboarding guard and optional lightweight identity import. |
| `/patient/onboarding`, `/patient/account` | The account surface lacked a consistent visual hierarchy and safe identity path. | Profile styling, completion signal, voluntary signed-document import, and preservation of verified fields on later saves. |
| `/patient/care` | Typed answers could lose their displayed-question relationship and assessment could stop too early. | Mira companion, white chat treatment, question-linked text state, eight topic intake floor, server-owned transcript/context graph, and a 16-question cap. |
| `/patient/medicine`, `/patient/prescriptions`, `/patient/prescriptions/[id]` | Prescription paths already use server records and shared detail components. | Context graph now brings prescription history into care with clinician-record provenance. |

## Provider experience
| Routes | Audit result | Change made |
| --- | --- | --- |
| `/doctor`, `/doctor/consults`, `/doctor/earnings`, `/doctor/gigs`, `/doctor/network`, `/doctor/requests`, `/doctor/schedule` | Role checks did not consistently enforce approval. | Unverified clinicians are redirected to review status; API sessions and listings enforce the same rule. |
| `/doctor/profile`, `/nurse/profile` | Profile pages sat outside the patient account visual language. | Shared profile-page styling and more legible fee/profile surfaces. |
| `/nurse`, `/nurse/active`, `/nurse/earnings`, `/nurse/gigs`, `/nurse/history`, `/nurse/requests` | Same approval gap as doctor routes. | Nurse sessions and listings receive identical verified-provider gating. |

## Operations, trials, and sharing
| Routes | Audit result | Change made |
| --- | --- | --- |
| `/ops`, `/ops/doctors`, `/ops/doctors/[id]`, `/ops/orders`, `/ops-signin` | Existing operations screens already provide the human approval endpoint. | Signup now emits review-request audit events into existing storage; no schema change required. |
| `/try/checker`, `/try/doctors`, `/try/nurses`, `/try/urgent` | Public demos remain intentionally separate from authenticated records. | No auth or clinical-data change required. |
| `/rx/[token]` | Share token route is a deliberately isolated prescription reader. | Regression pipeline continues to verify it opens without a session and exposes no unrelated records. |

## Cross-cutting checks
- Map sources never read a public vendor key; OpenStreetMap attribution remains visible.
- Medical identity upload is unavailable until the server-only UIDAI certificate is configured.
- No Aadhaar number, XML, share code, or photograph is persisted by the identity import.
- Diagnosis UI is positioned as assessment and care guidance, with emergency interruptions; it does not claim a confirmed diagnosis.
