---
spec-id: SPEC-021
title: Billing System Fixes & Production Readiness
type: improvement
complexity: high
status: draft
created: 2026-02-27T00:00:00.000Z
approved: null
---

## SPEC-021: Billing System Fixes & Production Readiness

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Fix critical operational gaps in the Hospeda billing system discovered during a production readiness audit, ensuring the system correctly handles payment lifecycle events, enforces subscription limits, protects user data, and meets Argentine legal requirements before production launch.

#### Motivation

The billing system built on QZPay (custom packages: `@qazuor/qzpay-core`, `@qazuor/qzpay-drizzle`, `@qazuor/qzpay-hono`, `@qazuor/qzpay-mercadopago`) is architecturally advanced but has 17 identified gaps ranging from stubbed-out code that silently does nothing, to missing legal compliance requirements (Argentine electronic invoicing), to security vulnerabilities that allow any authenticated user to access sensitive billing operations. These gaps make the system unsafe to use in production.

The findings are categorized as:

- **5 Critical** (BILL-01 to BILL-05): Broken or missing core functionality
- **7 High** (BILL-06 to BILL-12): Security, data integrity, and behavioral errors
- **5 Medium** (BILL-13 to BILL-17): Missing features and technical debt

#### Success Metrics

- Webhook retry processes failed webhooks from `billingWebhookDeadLetter` and updates subscription state
- Grace period of 3 days is enforced for `past_due` subscriptions before access is blocked
- Trial extension updates both subscription metadata AND the actual `trialEnd` field
- Dunning cron retries failed payments on a documented schedule
- AFIP compliance strategy is documented and either implemented or formally deferred with a plan
- All sensitive billing routes require ownership verification (user can only access their own billing data)
- Redis is initialized for notification retry using `HOSPEDA_REDIS_URL`
- Renewal reminders display the actual plan price, not $0
- `POST /api/v1/billing/trial/reactivate` endpoint exists and works
- Properties and staff limit enforcement uses real counts
- Plan change correctly handles quarterly and semi-annual intervals

---

### 2. User Stories & Acceptance Criteria

#### US-01: Webhook Retry Recovery (BILL-01)

**As a** platform operator,
**I want** failed MercadoPago webhooks to be automatically retried,
**so that** subscription state is eventually consistent even when webhooks fail on first delivery.

**Acceptance Criteria:**

- **Given** a webhook has failed and is stored in `billingWebhookDeadLetter`,
  **When** the hourly retry cron runs,
  **Then** the webhook payload is re-processed through the same webhook handler logic used for live webhooks.

- **Given** a dead-letter webhook that was successfully reprocessed,
  **When** the retry cron completes,
  **Then** the entry is marked as resolved and removed from the dead-letter queue.

- **Given** a dead-letter webhook that fails again during retry,
  **When** the retry cron completes,
  **Then** the retry count is incremented, and the entry remains in the queue.

- **Given** a dead-letter webhook that has reached the maximum of 5 retries,
  **When** the retry cron runs,
  **Then** the entry is NOT retried again, and an alert is logged for manual intervention.

- **Given** the retry cron runs,
  **When** there are more than 50 dead-letter entries,
  **Then** only the oldest 50 are processed in that batch (backpressure protection).

- **Given** the cron processes a batch of dead-letter webhooks,
  **When** any single reprocessing throws an unexpected error,
  **Then** the error is caught, logged, the other entries in the batch continue to be processed (no all-or-nothing failure).

#### US-02: Grace Period for Past-Due Subscriptions (BILL-02)

**As an** accommodation owner whose payment failed,
**I want** continued access to my subscription for 3 days while I resolve the payment issue,
**so that** I am not immediately blocked from managing my listings due to a transient payment failure.

**Acceptance Criteria:**

- **Given** a subscription transitions to `past_due` status (payment failed),
  **When** the owner accesses a protected resource,
  **Then** access is granted normally (no 402 error).

- **Given** a subscription has been in `past_due` status for fewer than 3 days,
  **When** the owner accesses a protected resource,
  **Then** access is granted, and a banner is displayed informing them of the payment issue and the days remaining.

- **Given** a subscription has been in `past_due` status for exactly 3 days or more,
  **When** the owner accesses a protected resource,
  **Then** access is blocked with a 402 response and a message explaining that the grace period has expired.

- **Given** a subscription transitions from `past_due` back to `active` (payment resolved),
  **When** the owner accesses a protected resource,
  **Then** access is restored without restriction and no banner is shown.

- **Given** the `PAYMENT_GRACE_PERIOD_DAYS` constant in `billing.constants.ts`,
  **When** the grace period logic is implemented,
  **Then** it reads this constant rather than hardcoding the value 3.

#### US-03: Trial Extension Correctly Updates Expiry (BILL-03)

**As an** admin,
**I want** trial extensions to actually delay when the trial expires,
**so that** users whose trials are extended can use the platform until the new expiry date.

**Acceptance Criteria:**

- **Given** a user has an active trial with `trialEnd = 2026-03-10`,
  **When** an admin calls `POST /api/v1/billing/trial/extend` with 7 additional days,
  **Then** the subscription's `trialEnd` field is updated to `2026-03-17`.

- **Given** a trial extension has been applied,
  **When** the trial-expiry cron runs at 2AM,
  **Then** it uses the updated `trialEnd` value (not the original) when determining if trials have expired.

- **Given** a trial extension is applied,
  **When** the response is returned,
  **Then** it includes both the updated `trialEnd` date and the extension metadata.

- **Given** a trial is not in an active state,
  **When** an admin calls `POST /api/v1/billing/trial/extend`,
  **Then** a 422 error is returned explaining the trial cannot be extended in its current state.

#### US-04: Dunning - Automatic Failed Payment Retries (BILL-04)

**As a** platform operator,
**I want** the system to automatically retry failed subscription payments on a defined schedule,
**so that** transient payment failures are resolved without manual intervention.

**Acceptance Criteria:**

- **Given** a subscription payment has failed and the subscription is in `past_due` status,
  **When** the dunning cron runs,
  **Then** a retry charge is attempted via MercadoPago.

- **Given** the dunning retry schedule (Day 1, Day 3, Day 7 after failure),
  **When** the cron runs on a day that does NOT match any retry schedule,
  **Then** no retry is attempted for that subscription.

- **Given** a retry attempt succeeds,
  **When** the charge is confirmed,
  **Then** the subscription transitions back to `active` and the owner receives a payment success notification.

- **Given** all dunning retries have been exhausted (after Day 7 attempt),
  **When** the final retry fails,
  **Then** the subscription is cancelled and the owner receives a subscription cancelled notification.

- **Given** the dunning cron,
  **When** it processes subscriptions,
  **Then** it only processes subscriptions in `past_due` status that are within the dunning window.

#### US-05: AFIP Electronic Invoicing Compliance (BILL-05)

**As** the Hospeda business entity,
**I want** a documented compliance strategy for Argentine electronic invoicing (AFIP),
**so that** the platform can legally charge Argentine customers.

**Acceptance Criteria:**

- **Given** the legal requirement for Factura A/B/C in Argentina,
  **When** the compliance strategy is reviewed,
  **Then** one of the following is formally documented: (a) AFIP integration is implemented, or (b) a formal deferral plan exists that defines the latest date for implementation and the interim business model (e.g., invoicing through a third-party accountant, or launching without direct charges).

- **Given** the AFIP integration path is chosen,
  **When** a subscription payment is processed,
  **Then** an electronic invoice (Factura B or C based on customer CUIT/CUIL) is generated via AFIP web service and the PDF is stored and accessible to the user.

- **Given** the AFIP integration path is chosen,
  **When** a customer registers or updates their billing info,
  **Then** their CUIT/CUIL is validated against the AFIP format (11 digits, valid check digit).

- **Given** the deferral path is chosen,
  **When** the spec is approved,
  **Then** a separate SPEC document is created for AFIP integration with a target milestone date.

#### US-06: Billing Route Ownership Verification (BILL-06)

**As an** authenticated user,
**I want** to be prevented from accessing other users' billing data,
**so that** my subscription, invoice, and payment information remains private.

**Acceptance Criteria:**

- **Given** an authenticated user,
  **When** they request their own customer record (`GET /api/v1/billing/customers/:id`),
  **Then** the response returns their data successfully.

- **Given** an authenticated user,
  **When** they request another user's customer record (`GET /api/v1/billing/customers/:otherId`),
  **Then** a 403 Forbidden response is returned.

- **Given** an authenticated user without admin permissions,
  **When** they attempt a refund or invoice void operation,
  **Then** a 403 Forbidden response is returned.

- **Given** an authenticated user,
  **When** they list their own invoices,
  **Then** only invoices belonging to their customer ID are returned (never another user's invoices).

- **Given** any billing route that accepts a resource ID,
  **When** the request is processed,
  **Then** ownership is verified by confirming the resource's `customerId` matches the authenticated user's customer ID before executing the operation.

#### US-07: Redis for Notification Retry (BILL-07)

**As a** platform operator,
**I want** notification retry to be backed by Redis,
**so that** notification idempotency keys survive process restarts and duplicate notifications are not sent.

**Acceptance Criteria:**

- **Given** the `HOSPEDA_REDIS_URL` environment variable is configured,
  **When** the API server starts,
  **Then** the notification scheduler initializes a Redis client using that URL.

- **Given** a notification is sent,
  **When** its idempotency key is stored,
  **Then** it is written to Redis (not only in-memory).

- **Given** the API process restarts,
  **When** a notification with a previously sent idempotency key is about to be sent,
  **Then** the deduplication check reads from Redis and prevents a duplicate send.

- **Given** `HOSPEDA_REDIS_URL` is NOT configured,
  **When** the API server starts,
  **Then** a warning is logged and the system falls back to in-memory tracking (existing behavior preserved for development).

#### US-08: Renewal Reminders with Correct Amount (BILL-08)

**As a** user with an active subscription,
**I want** my renewal reminder email to show the actual amount I will be charged,
**so that** I can ensure sufficient funds are available before the renewal date.

**Acceptance Criteria:**

- **Given** a subscription renewal is approaching,
  **When** the renewal reminder notification is generated,
  **Then** the `amount` field contains the actual plan price in ARS centavos (not 0).

- **Given** a user with a monthly plan,
  **When** a renewal reminder is sent,
  **Then** the displayed amount matches the `monthlyPriceArs` from the plan configuration.

- **Given** a user with an annual plan,
  **When** a renewal reminder is sent,
  **Then** the displayed amount matches the `annualPriceArs` from the plan configuration.

- **Given** a plan price cannot be retrieved for any reason,
  **When** the notification is generated,
  **Then** the amount is omitted from the notification (not shown as 0) and an error is logged.

#### US-09: Trial Reactivation Endpoint (BILL-09)

**As a** user whose trial has expired,
**I want** to reactivate from trial to a paid subscription via the API,
**so that** I can continue using the platform without losing my data.

**Acceptance Criteria:**

- **Given** a user whose trial has expired,
  **When** they call `POST /api/v1/billing/trial/reactivate` with a plan ID and payment method,
  **Then** their subscription is transitioned to `active` with the selected plan.

- **Given** a user with an active trial (not yet expired),
  **When** they call `POST /api/v1/billing/trial/reactivate`,
  **Then** a 422 error is returned indicating reactivation is only available after trial expiry.

- **Given** a user with a `cancelled` subscription (not from trial),
  **When** they call `POST /api/v1/billing/trial/reactivate`,
  **Then** a 422 error is returned indicating this endpoint is only for trial-to-paid transitions.

- **Given** the reactivation payment fails,
  **When** `POST /api/v1/billing/trial/reactivate` is called,
  **Then** the subscription remains in expired/cancelled state and an error response is returned with the payment failure reason.

#### US-10: Trial Auto-Start for All Eligible Roles (BILL-10)

**As a** newly registered user with the COMPLEX manager role,
**I want** my trial to start automatically upon registration,
**so that** I can immediately evaluate the platform without a manual setup step.

**Acceptance Criteria:**

- **Given** a new user registers with the HOST role,
  **When** account creation completes,
  **Then** a 14-day trial is automatically started on the `owner-basico` plan (existing behavior preserved).

- **Given** a new user registers with the COMPLEX role,
  **When** account creation completes,
  **Then** a 14-day trial is automatically started on an appropriate plan for complex managers.

- **Given** a new user registers with neither HOST nor COMPLEX role,
  **When** account creation completes,
  **Then** no trial is started (existing behavior preserved).

- **Given** trial auto-start fails for any reason (e.g., QZPay unavailable),
  **When** the failure occurs,
  **Then** user registration still succeeds, the failure is logged as an error with the user ID, and an alert is raised for manual resolution.

#### US-11: Properties and Staff Limit Enforcement (BILL-11)

**As** the platform,
**I want** to enforce the properties and staff account limits defined in the user's plan,
**so that** users cannot exceed what their subscription allows.

**Acceptance Criteria:**

- **Given** a user on a plan with `max_properties = 3` who already has 3 active properties,
  **When** they attempt to create a fourth property,
  **Then** a 402 response is returned explaining they have reached their plan limit.

- **Given** a user on a plan with `max_staff_accounts = 5` who already has 5 active staff accounts,
  **When** they attempt to create a sixth staff account,
  **Then** a 402 response is returned explaining they have reached their plan limit.

- **Given** a user on an unlimited plan (no `max_properties` limit),
  **When** they create a property,
  **Then** no limit check blocks the operation.

- **Given** the limit enforcement middleware,
  **When** it checks the properties count,
  **Then** it queries the actual count from the database (not `currentCount = 0`).

- **Given** a user deletes a property (soft delete),
  **When** the properties limit is checked for a new creation,
  **Then** soft-deleted properties are NOT counted against the limit.

#### US-12: Correct Interval Mapping for Plan Changes (BILL-12)

**As a** user changing their subscription plan,
**I want** the billing interval to be correctly mapped when I select quarterly or semi-annual billing,
**so that** I am charged the correct amount for the selected period.

**Acceptance Criteria:**

- **Given** a user selects a plan with `monthly` billing interval during plan change,
  **When** the request is processed,
  **Then** QZPay receives `interval: "month"` with `intervalCount: 1`.

- **Given** a user selects a plan with `quarterly` billing interval during plan change,
  **When** the request is processed,
  **Then** QZPay receives `interval: "month"` with `intervalCount: 3`.

- **Given** a user selects a plan with `semi_annual` billing interval during plan change,
  **When** the request is processed,
  **Then** QZPay receives `interval: "month"` with `intervalCount: 6`.

- **Given** a user selects a plan with `annual` billing interval during plan change,
  **When** the request is processed,
  **Then** QZPay receives `interval: "year"` with `intervalCount: 1`.

- **Given** the interval mapping,
  **When** an unsupported or unknown interval is encountered,
  **Then** the plan change is rejected with a 422 error listing the supported intervals.

---

### 3. UX Considerations

#### Grace Period User Flow (BILL-02)

1. User's payment fails. MercadoPago notifies via webhook. Subscription moves to `past_due`.
2. User logs in and visits the accommodation dashboard. An informational banner appears at the top: "Tu pago del [fecha] no pudo procesarse. Tienes hasta [fecha + 3 dias] para regularizar tu situacion. Actualiza tu metodo de pago."
3. Banner includes a CTA button: "Actualizar metodo de pago" linking to the billing section.
4. For days 1-3: all normal features continue to work.
5. Day 4+: banner changes to a blocking state. Navigation to protected pages returns a 402 screen with: "Tu acceso ha sido suspendido por falta de pago. Actualiza tu metodo de pago para continuar."
6. If user resolves payment: banner disappears on next visit, normal access restored.

#### Renewal Reminder Notification (BILL-08)

- Email subject: "Tu suscripcion se renueva el [fecha]"
- Body includes: plan name, billing period, exact amount in ARS, link to billing dashboard
- Reminder sent 7 days before renewal and 1 day before renewal

#### Trial Reactivation Flow (BILL-09)

1. Trial expires. User sees blocked state with 402.
2. On 402 screen: "Tu prueba gratuita ha terminado. Elige un plan para continuar." with a CTA.
3. User selects a plan and enters payment method.
4. Calls `POST /api/v1/billing/trial/reactivate`.
5. On success: access restored immediately, welcome email sent, billing cycle starts.
6. On failure: error shown with specific reason (card declined, etc.), user can retry or choose different payment method.

#### Error States

- **Webhook retry exhausted (BILL-01)**: No user-facing error. Admin is alerted via logging. Manual intervention required.
- **Grace period expired (BILL-02)**: Full-screen blocking page with payment update CTA. Not a dismissible banner.
- **Limit exceeded (BILL-11)**: Inline error at the point of action (form submit). "Has alcanzado el limite de [X] propiedades de tu plan [nombre]. Actualiza tu plan para agregar mas."
- **Plan change with invalid interval (BILL-12)**: Error shown in the PlanChangeDialog before submission.

#### Accessibility

- Grace period banner: `role="alert"` with appropriate `aria-live` level
- Blocking page: adequate color contrast (WCAG 2.1 AA), not relying on color alone to convey blocked state
- Limit exceeded error: associated with the triggering form field via `aria-describedby`
- Renewal reminder email: plain-text alternative for screen readers

---

### 4. Out of Scope

- **New billing plans or pricing changes**: This spec fixes existing functionality, not product decisions.
- **Billing UI redesign**: The web billing dashboard appearance is not changed (except the grace period banner).
- **Self-service plan cancellation flow**: Outside this spec. Users must contact support.
- **Multi-currency support**: All amounts remain in ARS.
- **B2B invoicing (Factura A)**: If AFIP is implemented in v1, only Factura B/C for consumers. Factura A requires additional validation.
- **Automated AFIP e-invoice for existing historical invoices**: Only new invoices from implementation date forward.
- **Refund workflows**: Outside this spec.
- **SPEC-019 security items**: Ownership verification for billing routes (BILL-06) is implemented in the billing context, but the broader API security hardening belongs to SPEC-019.
- **Admin-facing dunning controls**: Admins cannot manually configure the dunning schedule through a UI in v1.

---

## Part 2 - Technical Analysis

### 5. Architecture

#### Affected Components

```
apps/api/src/
  cron/jobs/
    webhook-retry.job.ts       # BILL-01: implement retry logic
    notification-schedule.job.ts # BILL-07: Redis client, BILL-08: plan price
    trial-expiry.job.ts        # BILL-03: verify uses updated trialEnd
    dunning.job.ts             # BILL-04: NEW FILE
  routes/billing/
    index.ts                   # BILL-06: ownership middleware
    plan-change.ts             # BILL-12: fix interval mapping
    trial.ts                   # BILL-03: fix extend, BILL-09: add reactivate
  services/
    trial.service.ts           # BILL-03: update trialEnd, BILL-09: reactivate
  middlewares/
    limit-enforcement.ts       # BILL-11: real count queries
    past-due-grace.middleware.ts  # BILL-02: NEW FILE
  lib/
    auth.ts                    # BILL-10: complex user trial start
    redis.ts                   # BILL-07: NEW or EXISTING FILE
packages/billing/
  src/
    constants/billing.constants.ts  # BILL-02: PAYMENT_GRACE_PERIOD_DAYS already defined
```

#### Key Architectural Decisions

1. **Grace period middleware placement**: The new `past-due-grace.middleware.ts` should be layered between the existing `billingAuthMiddleware` (which verifies user identity) and the route handlers. It reads the subscription status from the billing context already set by `billingAuthMiddleware`.

2. **Dunning cron**: A new cron job file. Should follow the pattern of existing cron jobs in `apps/api/src/cron/jobs/`. Triggered daily at 6AM. Reads `past_due` subscriptions, checks the failure date against the retry schedule, and calls MercadoPago to retry the charge.

3. **Ownership verification**: Implement as middleware that reads the `:id` or `:customerId` parameter, fetches the resource, and compares its `customerId` to the authenticated user's customer ID. Admins bypass this check via `PermissionEnum.BILLING_MANAGE_ALL`.

4. **Redis initialization**: Follow the same singleton pattern used for the database. Initialize once in `apps/api/src/index.ts`, pass to services that need it. Use the `ioredis` library (already a peer dep of QZPay packages).

#### Data Flow for Webhook Retry (BILL-01)

```
HourlyCron
  -> webhookRetryJob.execute()
    -> billingWebhookDeadLetter.findPending(limit: 50, maxRetries: 5)
    -> for each entry:
         -> webhookHandler.processWebhook(entry.payload, entry.source)
         -> if success: deadLetter.markResolved(entry.id)
         -> if failure: deadLetter.incrementRetry(entry.id)
```

#### Data Flow for Grace Period (BILL-02)

```
Request -> billingAuthMiddleware (sets billingContext with subscription)
         -> pastDueGraceMiddleware
              -> if subscription.status === 'past_due':
                   -> calculate daysPastDue = now - subscription.statusChangedAt
                   -> if daysPastDue < PAYMENT_GRACE_PERIOD_DAYS: allow, set grace banner header
                   -> else: return 402 with grace expired message
              -> else: continue
         -> route handler
```

---

### 6. Data Model Changes

#### No new database migrations required for most fixes

The following existing columns are used:

- `billing_subscriptions.trial_end` (already exists, BILL-03 fix reads/writes it correctly)
- `billing_subscriptions.status` (already exists, BILL-02 reads this)
- `billing_webhook_dead_letter` (already exists, BILL-01 reads/updates this)

#### New fields needed (evaluate if migration required)

- `billing_subscriptions.status_changed_at` (BILL-02): If this column does not exist, either add it via migration or compute grace period from `billing_payment_failures` table. **Decision required before implementation.**

- `billing_dunning_attempts` table (BILL-04): New table to track which subscriptions have been retried, when, and how many times. Prevents duplicate retry attempts.

  Schema:

  ```
  id               uuid PK
  subscription_id  varchar FK
  attempt_number   integer
  attempted_at     timestamp
  result           varchar ('success' | 'failed' | 'pending')
  error_message    text nullable
  created_at       timestamp
  ```

---

### 7. API Design

#### New Endpoint: POST /api/v1/billing/trial/reactivate (BILL-09)

**Auth:** Required (authenticated user)

**Request:**

```json
{
  "planId": "plan_owner_basico",
  "billingInterval": "monthly",
  "paymentMethodId": "pm_abc123"
}
```

**Response 200:**

```json
{
  "data": {
    "subscriptionId": "sub_123",
    "planId": "plan_owner_basico",
    "status": "active",
    "currentPeriodEnd": "2026-03-27T00:00:00Z"
  }
}
```

**Response 422 (trial still active):**

```json
{
  "error": "TRIAL_STILL_ACTIVE",
  "message": "Your trial is still active. Reactivation is only available after trial expiry."
}
```

#### Modified Endpoint: POST /api/v1/billing/trial/extend (BILL-03)

**Change:** Now updates `subscription.trialEnd` in addition to metadata.

**Response 200 (updated):**

```json
{
  "data": {
    "subscriptionId": "sub_123",
    "previousTrialEnd": "2026-03-10T00:00:00Z",
    "newTrialEnd": "2026-03-17T00:00:00Z",
    "extensionDays": 7,
    "metadata": {
      "extensions": [{ "days": 7, "reason": "manual", "grantedAt": "2026-02-27T10:00:00Z" }]
    }
  }
}
```

#### Ownership Middleware Applied to Routes (BILL-06)

The following QZPay-exposed routes must have ownership verification added:

| Route | Ownership Check |
|-------|-----------------|
| `GET /api/v1/billing/customers/:id` | `customer.userId === authUser.id` |
| `PUT /api/v1/billing/customers/:id` | `customer.userId === authUser.id` |
| `GET /api/v1/billing/subscriptions/:id` | `subscription.customerId === authUser.customerId` |
| `GET /api/v1/billing/invoices/:id` | `invoice.customerId === authUser.customerId` |
| `GET /api/v1/billing/invoices` | Filter by `customerId` automatically |
| `POST /api/v1/billing/payments/refund` | `PermissionEnum.BILLING_MANAGE_ALL` only |
| `DELETE /api/v1/billing/customers/:id` | `PermissionEnum.BILLING_MANAGE_ALL` only |

---

### 8. Dependencies

#### External (new)

- **AFIP web services** (BILL-05, if integration path chosen): `soap` npm package or direct HTTP calls to AFIP WSFE service. Requires CUIT/key pair obtained from AFIP. High effort, separate spike recommended.

#### Internal (no new packages)

- `ioredis` - Already available via QZPay packages peer dependencies (BILL-07)
- `@repo/billing` - Read `PAYMENT_GRACE_PERIOD_DAYS` constant (BILL-02)
- `@repo/db` - New migration for `billing_dunning_attempts` table (BILL-04)
- `@repo/schemas` - New schemas for trial reactivate request/response (BILL-09)

---

### 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AFIP integration is multi-month effort blocking launch | High | High | Formally defer with documented interim strategy. Launch with manual invoicing via accountant. Set hard deadline for AFIP integration post-launch. |
| Webhook retry re-processing causes duplicate state changes | Medium | High | Ensure webhook handler is idempotent (check if already processed before applying changes). QZPay should already handle deduplication by event ID. |
| Grace period `status_changed_at` column missing | Medium | Medium | Audit schema before implementation. If missing, derive from payment failure event timestamp or add migration. |
| Dunning charge retry triggers fraud detection at MercadoPago | Low | Medium | Use same payment method token as original. Follow MercadoPago retry best practices. Log all attempts. |
| Trial extend fix breaks existing metadata format | Low | Medium | Maintain backward compatibility in metadata structure. Add `trialEnd` update as additive change. |
| Properties/staff count queries add latency to create operations | Low | Low | Count queries should be fast with proper indexes. Add index on `accommodation.owner_id` + `deleted_at` if not present. |
| Ownership middleware breaks existing admin integrations | Medium | High | Admins bypass ownership check via `PermissionEnum.BILLING_MANAGE_ALL`. Test admin panel thoroughly after implementation. |
| Redis connection failure brings down notifications | Low | High | Implement circuit breaker. Fall back to in-memory on Redis failure. Log and alert on fallback activation. |
| Incorrect IVA treatment in renewal amounts (BILL-08) | Medium | Medium | Document whether stored prices include or exclude IVA. Display amounts consistently. Address properly in AFIP spec (BILL-05). |

---

### 10. Implementation Approach

#### Phase 1: Critical Fixes (BILL-01, BILL-02, BILL-03)

These are the highest impact issues that affect core subscription lifecycle correctness.

1. **BILL-01 - Webhook Retry**: Implement actual retry logic in `webhook-retry.job.ts`. Re-use the existing webhook processing pipeline. Remove the `"TODO"` stub. Add unit tests for batch processing, success marking, retry counting, and max retry guard.

2. **BILL-02 - Grace Period**: Determine if `status_changed_at` exists or needs migration. Create `past-due-grace.middleware.ts`. Register middleware in protected billing routes. Add unit tests for boundary conditions (day 0, day 2, day 3, day 4).

3. **BILL-03 - Trial Extend**: Fix `TrialService.extendTrial()` to call the QZPay subscription update with the new `trialEnd` date in addition to saving metadata. Add regression test that verifies `trialEnd` on the subscription record itself.

#### Phase 2: Security Fix (BILL-06)

4. **BILL-06 - Ownership Verification**: Create `billingOwnershipMiddleware`. Apply to all sensitive QZPay-exposed routes. Add integration tests that verify a user cannot access another user's data. Verify admin bypass works.

#### Phase 3: High Priority Fixes (BILL-04, BILL-07, BILL-08, BILL-09, BILL-10, BILL-11, BILL-12)

5. **BILL-04 - Dunning Cron**: Create `dunning.job.ts`. Define retry schedule as constants. Create `billing_dunning_attempts` migration. Register cron job at 6AM daily.

6. **BILL-07 - Redis**: Initialize Redis client in API startup. Wire to `notification-schedule.job.ts`. Implement fallback to in-memory. Add startup log indicating Redis mode vs fallback mode.

7. **BILL-08 - Renewal Amount**: Fetch plan price in `notification-schedule.job.ts` before building renewal reminder payload. Remove hardcoded `amount: 0`.

8. **BILL-09 - Reactivate Endpoint**: Add route `POST /api/v1/billing/trial/reactivate`. Implement in `TrialService.reactivateFromExpiredTrial()`. Add schema and tests.

9. **BILL-10 - Complex User Trial**: Extend the Better Auth `after` hook for user.create. Determine which plan COMPLEX users start on (requires product decision). Add conditional logic and tests.

10. **BILL-11 - Limit Enforcement**: Replace `currentCount = 0` with actual DB queries in `enforcePropertiesLimit()` and `enforceStaffAccountsLimit()`. Ensure soft-deleted records are excluded from counts.

11. **BILL-12 - Interval Mapping**: Fix `quarterly` -> `month x3` and `semi_annual` -> `month x6` in `plan-change.ts`. Add unit tests for all 4 intervals.

#### Phase 4: AFIP Decision (BILL-05)

12. **BILL-05 - AFIP Strategy**: Hold a product/legal meeting. Document the decision. Either create SPEC-022 for AFIP integration with timeline, or document the interim manual invoicing process. This phase is a decision gate, not an implementation task.

#### Phase 5: Medium Issues (BILL-13 to BILL-17)

Evaluate each item for v1 scope:

- **BILL-13**: Non-trial reactivation. Assess if needed before launch or can be handled by support manually.
- **BILL-14**: User billing dashboard. Identify minimum viable UI (at least a page showing current plan, next billing date, and payment method).
- **BILL-15**: IVA handling. Define whether prices are IVA-inclusive or exclusive. Document for AFIP integration.
- **BILL-16**: Persist idempotency keys in Redis (covered by BILL-07 if Redis is implemented).
- **BILL-17**: Dispute/chargeback handling. Document manual process. Webhook events from MercadoPago for disputes should at minimum be logged.

---

### 11. Testing Strategy

#### Unit Tests

- `webhook-retry.job.ts`: batch limit respected, success marking, retry increment, max retry guard, error isolation per entry
- `past-due-grace.middleware.ts`: day 0 (same day), day 2 (within grace), day 3 (boundary), day 4+ (blocked), resolved subscription (active)
- `trial.service.ts`: extend updates `trialEnd` field, reactivate transitions state, reactivate fails on active trial
- `dunning.job.ts`: correct subscriptions selected, retry schedule respected, success handling, exhausted retries handling
- `limit-enforcement.ts`: real count against mock DB, soft-deleted excluded, unlimited plan bypasses check
- `plan-change.ts`: all 4 interval mappings produce correct QZPay parameters, unknown interval returns 422

#### Integration Tests

- Ownership middleware: user A cannot access user B's customer, subscription, invoice
- Admin bypass: admin can access any customer record
- Trial extend: end-to-end verifying DB `trial_end` column is updated
- Dunning: subscription in `past_due`, cron runs, charge attempted, `billing_dunning_attempts` record created

#### Manual QA Checklist

- [ ] Let payment fail in sandbox. Verify `past_due` status. Verify grace period banner appears.
- [ ] Wait for grace period to expire. Verify 402 blocking page.
- [ ] Resolve payment in sandbox. Verify banner disappears and access is restored.
- [ ] Extend a trial via API. Verify `trialEnd` in DB is updated. Wait for cron. Verify trial does not expire at original date.
- [ ] Attempt to access another user's subscription endpoint. Verify 403.
- [ ] Change plan with quarterly interval. Verify MercadoPago receives `month x3`.
- [ ] Renewal reminder email: verify price displayed matches plan config.
- [ ] Create properties up to plan limit. Verify 402 on next attempt.
