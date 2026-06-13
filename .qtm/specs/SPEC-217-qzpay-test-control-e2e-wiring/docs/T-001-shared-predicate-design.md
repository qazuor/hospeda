# T-001 — Shared `isSubscriptionLive` predicate design (decision note)

Investigation output for T-001. Feeds T-003 (implement predicate), T-004 (use it in the
gate), T-005 (refactor middleware).

## Facts gathered (file:line)

- **Grace constant**: `BILLING_CRON_LAG_GRACE_HOURS = 6` at
  `packages/billing/src/constants/billing.constants.ts:85`, exported via `@repo/billing`.
  Only importer today: `apps/api/src/middlewares/entitlement.ts:19`.
- **Middleware grace check**: `apps/api/src/middlewares/entitlement.ts:465-490`. Guards
  `status === 'active'` AND `currentPeriodEnd instanceof Date`; computes
  `hoursOverdue = (Date.now() - currentPeriodEnd) / 3_600_000`; `withinWindow =
  hoursOverdue <= 6`. **It is pass-through — it NEVER blocks**; it only sets the
  `X-Cron-Lag-Grace-Hours-Remaining` header and logs/alerts.
- **The gate**: `checkEligibility` is at
  `apps/api/src/services/accommodation-publish-deps.ts:71-94` — **NOT in `service-core`**
  as the spec body states (path correction; the service-core accommodation dir has no
  such file). It reads raw Drizzle rows from `billingSubscriptions`, currently
  status-only (`active`/`trialing`), and does NOT read `currentPeriodEnd`/`trialEnd`
  (both present in the row as `Date | null`, unused).
- **Shape reconciliation**: both sources use the same field names (`status`,
  `currentPeriodEnd`, `trialEnd`) and the same JS type (`Date`). The middleware sees
  `QZPaySubscriptionWithHelpers` (adapter object, has helper methods); the gate sees a
  plain Drizzle row. A single pure predicate over the common subset works for both.
- **Existing tests**: middleware grace pattern at
  `apps/api/test/middlewares/entitlement.test.ts:2708-2922` (SPEC-148 T-002 block, 5
  cases, helper `makeActiveSub`). `checkEligibility` has NO unit tests yet
  (`accommodation-publish-deps.test.ts` only covers `startTrial`).

## Decisions

1. **Home: `@repo/billing`** (e.g. `packages/billing/src/predicates/is-subscription-live.ts`).
   The grace constant already lives there; both `apps/api` and `@repo/service-core`
   already depend on `@repo/billing`; no new dep edge, no cycle risk.

2. **Signature** (pure, RO-RO, no `any`):
   ```ts
   export function isSubscriptionLive(input: {
       readonly status: string;
       readonly trialEnd?: Date | null;
       readonly currentPeriodEnd?: Date | null;
       readonly nowMs?: number;                  // default Date.now() at call site
       readonly graceHours?: number;             // default BILLING_CRON_LAG_GRACE_HOURS
   }): boolean;
   ```
   Logic:
   - `status` not in `{ 'active', 'trialing' }` → `false`.
   - `'trialing'` → live iff `trialEnd` is null/undefined OR `now - trialEnd <= grace`.
   - `'active'` → live iff `currentPeriodEnd` is null/undefined OR `now - currentPeriodEnd <= grace`.
   - Null/undefined date = treat as live (cannot determine expiry → fail open, matches
     today's behaviour where the gate ignores dates entirely).

3. **Gate usage (T-004)**: `checkEligibility` replaces its status-only `.some(...)` with
   `subscriptions.some((s) => isSubscriptionLive({ status: s.status, trialEnd: s.trialEnd,
   currentPeriodEnd: s.currentPeriodEnd }))`. This is the new BLOCKING use that closes the
   prod gap.

4. **Middleware refactor (T-005) — keep MINIMAL / low-risk.** The middleware does more
   than a boolean (header detail `hoursRemaining`, Sentry alert, pass-through). Do NOT
   restructure that. Scope T-005 to: have the middleware's `withinWindow` decision call
   `isSubscriptionLive` (or share the threshold comparison) so there is one definition of
   "within grace", while keeping all detail math and the never-block behaviour. If the
   refactor risks changing the header/alert semantics, reduce T-005 to a confirmation that
   both paths use `BILLING_CRON_LAG_GRACE_HOURS` consistently. Regression test
   (entitlement.test.ts:2708 pattern) must stay green unchanged.

## Spec correction

The spec body and several task descriptions reference
`packages/service-core/src/services/accommodation/accommodation-publish-deps.ts`. The
real path is `apps/api/src/services/accommodation-publish-deps.ts`. Use the real path.
Both consumers (gate + middleware) live in `apps/api`, which imports `@repo/billing` —
so the predicate home decision is unaffected.
