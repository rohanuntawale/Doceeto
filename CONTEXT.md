# Doceeto project context

## Nurse dashboard work completed

The nurse dashboard previously contained hard-coded demo content: requests, dates, earnings, profile data, verification status, and patient names.

It was updated to:

- Use live account/request/earnings/review data instead of static demo data.
- Show empty states for new nurse accounts.
- Include the same live patient map used by the doctor dashboard.
- Support request accept and decline actions.
- Show live metrics for earnings, active visits, open requests, ratings, history, and wallet activity.
- Return nurse identity data from `/api/auth/me`.
- Store a newly created nurse identity in local storage in demo mode.

## Changed files

- `components/nurse/nurse-dashboard.tsx`
- `app/api/auth/me/route.ts`S
- `app/page.tsx`

## Verification

`npm run lint` passes with no warnings or errors.

TypeScript validation was attempted, but the Windows sandbox intermittently failed to start the shell process for `npx tsc --noEmit`.

## Important backend caveat

The existing backend creates nurse user accounts, but it does not yet have a full nurse provider record/request model equivalent to doctors. The dashboard is prepared to consume the shared request and transaction hooks, but nurse-specific persistence, verification records, provider location updates, and server-side nurse authorization may still need to be completed for production use.
