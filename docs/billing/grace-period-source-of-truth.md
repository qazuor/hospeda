# Grace Period - Source of Truth

## Overview

The grace period defines how many days a user retains access after a payment failure
(`past_due` status) before the system blocks their requests.

## Source of Truth

**QZPay is the authoritative source** for grace period calculation at runtime.
When `billing.subscriptions.getByCustomerId()` returns subscriptions with helpers,
the `.daysRemainingInGrace()` and `.isInGracePeriod()` methods perform the canonical
calculation. **Both helpers compute against `current_period_end + 7 days`** —
i.e. the dunning window, not a separate payment-grace window.

This was previously documented as a 3-day window. That was wrong; the runtime
behavior allows up to ~7 days of grace from `current_period_end` before
`isInGracePeriod()` flips to `false`. Confirmed empirically in the SPEC-143
T-143-63 past-due-grace test (`apps/api/test/e2e/flows/billing/past-due-grace.test.ts`):
setting `current_period_end = now - 1d` returned `daysRemainingInGrace() = 6`
(matches `-1 + 7`).

## Reference Values

| Location | Constant | Value | Status |
|----------|----------|-------|--------|
| QZPay (internal) | `DUNNING_GRACE_PERIOD_DAYS` | 7 | **Actual runtime enforcement** — used by `isInGracePeriod()` + `daysRemainingInGrace()` |
| `@repo/billing` | `PAYMENT_GRACE_PERIOD_DAYS` | 3 | **Reference only, NOT enforced** — used by warning logs + this doc. Kept for backwards compatibility; flagged as historical reference in `packages/billing/src/constants/billing.constants.ts`. |
| `billing_settings` DB table | `gracePeriodDays` | 3 | Stored for a future admin UI; currently unused at runtime. |

### Why two constants exist

The original design intent was two distinct windows:

1. **Initial payment grace** (3 days) — soft window where the user kept full access while the first retry attempts happened.
2. **Dunning grace** (7 days) — the cancellation cutoff after which the subscription gets cancelled.

In practice, qzpay-core implements only the dunning window. Both `isInGracePeriod()`
and `daysRemainingInGrace()` use `DUNNING_GRACE_PERIOD_DAYS=7` against `current_period_end`.
There is no separate payment-grace enforcement. The `PAYMENT_GRACE_PERIOD_DAYS=3`
constant is reference-only.

To restore the original intent, qzpay-core would have to honor `PAYMENT_GRACE_PERIOD_DAYS`
as a distinct shorter window for `isInGracePeriod()` while keeping
`DUNNING_GRACE_PERIOD_DAYS` for the dunning cron. Until that lands, this doc treats
the runtime window as 7 days.

## Dunning Process

1. **Day 0**: Payment fails, subscription enters `past_due`.
2. **Days 0-7**: Grace window — `isInGracePeriod()` returns `true`, user retains access,
   `pastDueGraceMiddleware` allows requests and emits `X-Grace-Period-Days-Remaining`.
3. **Day 0+ retry schedule**: Dunning cron retries at days relative to original failure
   per `DUNNING_RETRY_INTERVALS = [1, 3, 5, 7]`.
4. **Day 7+**: If retries fail, `isInGracePeriod()` returns `false`. The middleware
   responds with **402 GRACE_PERIOD_EXPIRED** and the dunning cron may cancel the
   subscription.

Total window from failure to potential cancellation: **~7 days** (7 days grace,
last retry on day 7, cancellation eligible after that).

## Frontend Integration

The subscription endpoint (`GET /api/v1/protected/users/me/subscription`) exposes:

- `gracePeriodDaysRemaining: number | null` — days left in grace (null if not past_due).
  Sourced from `daysRemainingInGrace()`, so the maximum value clients should expect
  is **7**, not 3.
- `gracePeriodExpiresAt: string | null` — ISO date when grace expires (null if not past_due).

The `SubscriptionCard` component uses these fields to show a countdown in the
past_due banner. If you copy the banner copy from older designs that say "3 days",
update it to match the actual ~7-day window.

## Changing the Grace Period Duration

To change the runtime grace window:

1. **Update qzpay-core's `DUNNING_GRACE_PERIOD_DAYS`** — this is the only place
   that affects runtime behavior.
2. (Optional) **Update `PAYMENT_GRACE_PERIOD_DAYS`** in `@repo/billing` if you want
   the reference constant + the warning log to stay coherent.
3. (Optional) **Update `billing_settings.gracePeriodDays`** if you wire the future
   admin UI to read the value from the DB.

## Known Gaps

- `PAYMENT_GRACE_PERIOD_DAYS=3` is misleading: the constant name suggests it controls
  the initial grace window, but nothing reads it for that purpose.
- `daysRemainingInGrace()` returns `null` once the window expires; the past-due
  middleware previously collapsed this to `daysOverdue: 0` in the 402 response
  (fixed: now computed from `current_period_end` directly — see
  `apps/api/src/middlewares/past-due-grace.middleware.ts`).
- The dunning retry schedule (`[1, 3, 5, 7]`) places the last retry on the same day
  as cancellation eligibility — a race we accept because the cron runs daily and
  the cancel only fires after the retry attempt completes.
