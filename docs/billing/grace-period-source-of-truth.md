# Grace Period - Source of Truth

## Overview

The grace period defines how many days a user retains access after a payment failure
(`past_due` status) before the system blocks their requests.

## Source of Truth

**QZPay is the authoritative source** for grace period calculation at runtime.
When `billing.subscriptions.getByCustomerId()` returns subscriptions with helpers,
the `.daysRemainingInGrace()` and `.isInGracePeriod()` methods perform the canonical
calculation based on the subscription's `past_due` transition date.

## Reference Values

Three places reference the grace period duration. They must be kept in sync manually:

| Location | Constant | Value | Purpose |
|----------|----------|-------|---------|
| `@repo/billing` | `PAYMENT_GRACE_PERIOD_DAYS` | 3 | Reference constant for documentation and logging |
| QZPay config | (internal) | 3 | Actual runtime enforcement |
| `billing_settings` DB table | `gracePeriodDays` | 3 | Future admin UI configuration (not used at runtime) |

## Dunning Process

After the initial grace period (3 days), the dunning job takes over:

1. **Day 0**: Payment fails, subscription enters `past_due`
2. **Days 0-3**: Initial grace period.. user retains full access (PAYMENT_GRACE_PERIOD_DAYS = 3)
3. **Day 3+**: Dunning process begins with retry attempts at days 1, 3, 5, 7 relative to failure (DUNNING_RETRY_INTERVALS = [1, 3, 5, 7])
4. **Day 7**: If all retries fail, subscription is cancelled (DUNNING_GRACE_PERIOD_DAYS = 7)

Total window from failure to cancellation: 7 days.

Note: The DUNNING_RETRY_INTERVALS days are relative to the original payment failure (day 0), not to the start of the dunning phase. The last retry interval (7) equals DUNNING_GRACE_PERIOD_DAYS, meaning the final retry happens on the same day as potential cancellation.

## Frontend Integration

The subscription endpoint (`GET /api/v1/protected/users/me/subscription`) exposes:

- `gracePeriodDaysRemaining: number | null` - Days left in grace (null if not past_due)
- `gracePeriodExpiresAt: string | null` - ISO date when grace expires (null if not past_due)

The `SubscriptionCard` component uses these fields to show a countdown in the past_due banner.

## Warning

Changing the grace period duration requires updating:

1. QZPay configuration (the actual enforcement)
2. `PAYMENT_GRACE_PERIOD_DAYS` in `@repo/billing` (reference)
3. `billing_settings.gracePeriodDays` in the database (future admin UI)
