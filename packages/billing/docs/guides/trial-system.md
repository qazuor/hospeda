# Trial System

## Overview

Owner and complex plan categories include a trial period. Tourist plans do not have trials.. the free tier (`tourist-free`) serves as the default entry point.

| Category | Trial Duration | Default Trial Plan | Eligible |
|----------|---------------|-------------------|----------|
| Owner | 30 days (raised from 14, owner decision 2026-08-15) | `owner-basico` | Yes |
| Complex | 14 days | `complex-basico` | Yes |
| Tourist | N/A | `tourist-free` (permanent) | No |

## Constants

```typescript
import { OWNER_TRIAL_DAYS, COMPLEX_TRIAL_DAYS } from '@repo/billing';

// Deliberately independent since HOS-301 D1 — do not re-couple them.
console.log(OWNER_TRIAL_DAYS);   // 30
console.log(COMPLEX_TRIAL_DAYS); // 14
```

## Plan Configuration

Trial availability is configured per plan via the `hasTrial` and `trialDays` fields on `PlanDefinition`:

```typescript
// Owner plans have trials
{ hasTrial: true, trialDays: 30 }

// Tourist plans do not
{ hasTrial: false, trialDays: 0 }
```

## Lifecycle Summary

1. **Registration** .. Owner/complex users automatically get a trial subscription on the default plan for their category
2. **Active trial** .. Full access to all entitlements of the trial plan for the category's trial length (30 days for owner, 14 for complex)
3. **Trial expiry** .. Dashboard access is blocked. User data is preserved.
4. **Upgrade** .. User subscribes to a paid plan at any time (during or after trial)

## Grace Period and Dunning

After a paid subscription payment fails:

- **3-day grace period** (`PAYMENT_GRACE_PERIOD_DAYS`) before dunning starts
- **7-day dunning window** (`DUNNING_GRACE_PERIOD_DAYS`) with retry attempts at days 1, 3, 5, and 7
- **3 max retry attempts** (`MAX_PAYMENT_RETRY_ATTEMPTS`) for initial payment flow
- Subscription is cancelled if all retries fail within the grace period

## Detailed Documentation

For the full trial system implementation including API endpoints, cron jobs, and state transitions, see:

- [Trial System (API Documentation)](../../../../apps/api/docs/trial-system.md)
