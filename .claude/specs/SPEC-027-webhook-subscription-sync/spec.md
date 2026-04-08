---
spec-id: SPEC-027
title: Webhook Subscription Sync
type: feature
complexity: high
status: completed
created: 2026-03-03T00:00:00.000Z
updated: 2026-04-08T00:00:00.000Z
completed: 2026-04-08T00:00:00.000Z
approved: 2026-03-07T00:00:00.000Z
---

# SPEC-027: Webhook Subscription Sync

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Implement real-time synchronization of subscription state from MercadoPago to the Hospeda database when `subscription_preapproval.updated` webhook events are received, send user notifications on status changes, and provide admin visibility into subscription lifecycle events.

#### Motivation

The current `subscription_preapproval.updated` webhook handler (`apps/api/src/routes/webhooks/mercadopago/subscription-handler.ts`) only logs the event at WARN level and marks it as processed. It performs **zero business logic**. This means:

- When a user cancels their subscription from MercadoPago's dashboard, Hospeda's DB still shows `active`.
- When MercadoPago pauses a subscription due to payment method issues, the user retains full access.
- When a subscription is reactivated after a payment method update, there is no confirmation email.
- The admin dashboard shows stale subscription data until manual intervention.
- The webhook retry job (`webhook-retry.job.ts`) treats `subscription_preapproval.updated` as "no business logic" and resolves dead-letter entries immediately without processing. This case is currently **combined** with `payment.created` in a single switch case block (lines 165-174 of `webhook-retry.job.ts`).. they must be split.

This gap was documented as a known limitation in SPEC-021 (BILL-01 remarks) and deferred to this spec.

#### Success Metrics

- Subscription status in `billing_subscriptions` matches MercadoPago within seconds of webhook delivery (real-time sync, not batched).
- Users receive email notifications when their subscription is cancelled, paused, or reactivated.
- Admin dashboard displays a timeline of subscription state transitions per customer.
- All webhook processing remains idempotent (re-delivery of the same event produces no duplicate side effects).
- Failed syncs enter the existing dead letter queue and are retried with business logic (not auto-resolved).

---

### 2. User Stories & Acceptance Criteria

#### US-01: Subscription State Sync from MercadoPago

**As a** platform operator,
**I want** subscription status changes from MercadoPago to be automatically synced to the Hospeda database,
**so that** the platform always reflects the true subscription state.

**Acceptance Criteria:**

- **Given** MercadoPago sends a `subscription_preapproval.updated` webhook with `data.id` = a preapproval ID,
  **When** the webhook handler processes the event,
  **Then** the handler fetches the full subscription details from MercadoPago API (via `paymentAdapter.subscriptions.retrieve(mpPreapprovalId)`), maps the returned QZPay status to the internal `SubscriptionStatusEnum`, and updates the corresponding row in `billing_subscriptions`.

- **Given** the webhook payload contains `data.id` = `"mp-sub-123"`,
  **When** the handler looks up the local subscription,
  **Then** it queries `billing_subscriptions` WHERE `mp_subscription_id = 'mp-sub-123'` using a direct Drizzle query (QZPay does not expose a `getByMpSubscriptionId()` method).

- **Given** `retrieve()` returns status `active` (mapped from MP `authorized`),
  **When** the handler processes the event,
  **Then** `billing_subscriptions.status` is set to `active`.

- **Given** `retrieve()` returns status `paused` (mapped from MP `paused`),
  **When** the handler processes the event,
  **Then** `billing_subscriptions.status` is set to `paused`.

- **Given** `retrieve()` returns status `canceled` (mapped from MP `cancelled`),
  **When** the handler processes the event,
  **Then** `billing_subscriptions.status` is set to `cancelled` (note: Hospeda uses **two L's**) AND `billing_subscriptions.canceled_at` is set to the current timestamp (if not already set). The field `cancel_at_period_end` is NOT modified for cancellations (it reflects user-initiated cancellation scheduling, not webhook state). However, if a subscription is **reactivated** (new status `active`) and `cancel_at_period_end` is `true`, it MUST be reset to `false`.

- **Given** `retrieve()` returns status `pending` (mapped from MP `pending`),
  **When** the handler processes the event,
  **Then** the event is logged at INFO level but **no status change is applied** (pending is a transient state during initial setup).

- **Given** `retrieve()` returns status `finished` (passthrough, not in QZPay mapping),
  **When** the handler processes the event,
  **Then** `billing_subscriptions.status` is set to `expired` (the `SubscriptionStatusEnum.EXPIRED` value represents a naturally ended subscription).

- **Given** the local subscription status is already equal to the mapped status (e.g., both are `active`),
  **When** the handler processes the event,
  **Then** no database update is performed (idempotent), a debug log is emitted, and the event is marked as processed.

- **Given** `retrieve()` returns a status not in the known mapping (i.e., not `active`, `paused`, `canceled`, `pending`, or `finished`),
  **When** the handler processes the event,
  **Then** the event is logged at WARN level with the unknown status value, no database update is performed, and the event is marked as processed. A Sentry alert is captured for investigation.

- **Given** no local subscription exists with the received `mp_subscription_id`,
  **When** the handler processes the event,
  **Then** the event is logged at WARN level, no database update is performed, and the event is marked as processed (not an error.. the subscription may have been created externally).

- **Given** the MercadoPago API call to fetch subscription details fails (network error, timeout, 5xx),
  **When** the handler processes the event,
  **Then** the handler throws an error, the event enters the dead letter queue for retry, and the error is captured in Sentry.

#### US-02: State Transition Audit Log

**As a** platform operator,
**I want** every subscription state change to be recorded in an audit log,
**so that** I can investigate billing issues and understand the subscription lifecycle.

**Acceptance Criteria:**

- **Given** a subscription status changes (e.g., `active` -> `cancelled`),
  **When** the handler updates `billing_subscriptions`,
  **Then** a new row is inserted into `billing_subscription_events` with: subscription ID, previous status, new status, trigger source (`webhook`), MercadoPago event ID, and timestamp.

- **Given** a subscription webhook is received but the status has NOT changed,
  **When** the handler processes the event,
  **Then** NO audit log entry is created (avoid noise).

- **Given** the audit log insert fails,
  **When** the handler processes the event,
  **Then** the subscription status update still succeeds (audit log failure is non-blocking), and the error is logged at ERROR level.

#### US-03: User Notification on Subscription Cancellation

**As a** user whose subscription was cancelled,
**I want** to receive an email confirming the cancellation,
**so that** I know my subscription is no longer active and can take action if it was unintended.

**Acceptance Criteria:**

- **Given** a subscription transitions from any status to `cancelled`,
  **When** the handler processes the event,
  **Then** an email is sent to the subscription owner with: plan name, cancellation date, a message explaining access will end at the current period end date, and a CTA to resubscribe.

- **Given** the subscription was already `cancelled` and another `cancelled` webhook arrives,
  **When** the handler processes the event,
  **Then** NO duplicate email is sent (idempotent).

- **Given** the email send fails,
  **When** the handler processes the event,
  **Then** the subscription status update still succeeds (notification is fire-and-forget with retry via the existing notification retry system).

#### US-04: User Notification on Subscription Suspension (Paused)

**As a** user whose subscription was paused,
**I want** to receive an email explaining why and what to do,
**so that** I can resolve any payment issues promptly.

**Acceptance Criteria:**

- **Given** a subscription transitions from `active` to `paused`,
  **When** the handler processes the event,
  **Then** an email is sent to the subscription owner with: plan name, a message explaining the subscription was paused (likely due to a payment method issue), and a CTA to update payment method.

- **Given** the subscription was already `paused` and another `paused` webhook arrives,
  **When** the handler processes the event,
  **Then** NO duplicate email is sent.

#### US-05: User Notification on Subscription Reactivation

**As a** user whose subscription was reactivated,
**I want** to receive a confirmation email,
**so that** I know my subscription is active again and I can use the platform normally.

**Acceptance Criteria:**

- **Given** a subscription transitions from `paused` or `cancelled` to `active`,
  **When** the handler processes the event,
  **Then** an email is sent to the subscription owner with: plan name, a confirmation message, next billing date, and a CTA to visit the dashboard.

- **Given** a subscription transitions from `trialing` to `active` (trial conversion),
  **When** the handler processes the event,
  **Then** NO reactivation email is sent (this transition is handled by the existing trial conversion flow).

#### US-06: Admin Notification on Involuntary Cancellation

**As an** admin,
**I want** to be alerted when a subscription is cancelled involuntarily (not by the user from our platform),
**so that** I can investigate potential issues and reach out to the customer if needed.

**Acceptance Criteria:**

- **Given** a subscription transitions to `cancelled` via webhook (i.e., the cancellation originated from MercadoPago, not from our admin panel or user action),
  **When** the handler processes the event,
  **Then** an `ADMIN_SYSTEM_EVENT` notification is sent to all admin emails with the following `eventDetails` structure and severity `warning`:

```typescript
{
    eventType: 'subscription_involuntary_cancellation',
    customerEmail: string,    // from billing.customers.get()
    planName: string,         // from billing.plans.get()
    mpSubscriptionId: string, // the MercadoPago preapproval ID
    previousStatus: string    // what the status was before cancellation
}
```

#### US-07: Dead Letter Queue Integration

**As a** platform operator,
**I want** failed subscription sync attempts to be properly retried,
**so that** transient failures don't leave subscriptions permanently out of sync.

**Acceptance Criteria:**

- **Given** the webhook retry job processes a dead-letter entry of type `subscription_preapproval.updated`,
  **When** the retry runs,
  **Then** it executes the full subscription sync logic (fetch from MP API, map status, update DB, send notifications) instead of auto-resolving.

- **Given** the dead-letter retry succeeds,
  **When** processing completes,
  **Then** the dead-letter entry is marked as resolved.

- **Given** the dead-letter retry fails,
  **When** processing completes,
  **Then** the retry count is incremented and the entry remains for the next retry cycle (up to MAX_RETRY_ATTEMPTS = 5).

---

### 3. UX Considerations

#### Email: Subscription Cancelled

- **Subject**: "Tu suscripcion ha sido cancelada - {planName}"
- **Body**:
  - Greeting with recipient name
  - "Tu suscripcion al plan {planName} ha sido cancelada."
  - "Tu acceso continuara activo hasta el {currentPeriodEnd}."
  - If cancellation was involuntary: "Si no realizaste esta cancelacion, contactanos para resolverlo."
  - CTA button: "Reactivar suscripcion" -> `{baseUrl}/es/precios/propietarios`
- **Category**: TRANSACTIONAL (always sent, cannot opt-out)
- **Note**: CTA URL hardcodes `/es/` locale. This is consistent with all existing email templates. Multi-locale email URLs are a future improvement.

#### Email: Subscription Paused

- **Subject**: "Tu suscripcion ha sido pausada - Accion requerida"
- **Body**:
  - Greeting with recipient name
  - "Tu suscripcion al plan {planName} ha sido pausada."
  - "Esto puede deberse a un problema con tu metodo de pago."
  - "Actualiza tu metodo de pago para reactivar tu suscripcion."
  - CTA button: "Actualizar metodo de pago" -> `{baseUrl}/es/mi-cuenta/suscripcion`
- **Category**: TRANSACTIONAL (always sent, cannot opt-out)

#### Email: Subscription Reactivated

- **Subject**: "Tu suscripcion ha sido reactivada - {planName}"
- **Body**:
  - Greeting with recipient name
  - "Tu suscripcion al plan {planName} esta activa nuevamente."
  - "Tu proxima facturacion es el {nextBillingDate}."
  - CTA button: "Ir al panel" -> `{baseUrl}/es/mi-cuenta`
- **Category**: TRANSACTIONAL (always sent, cannot opt-out)

#### `baseUrl` Resolution

All email templates receive `baseUrl` as a prop. The value comes from `process.env.HOSPEDA_SITE_URL` (server-side env var). This is the same pattern used by all existing notification functions in `notifications.ts`. Example:

```typescript
const baseUrl = process.env.HOSPEDA_SITE_URL ?? 'https://hospeda.tur.ar';
```

#### Admin Panel: Subscription Events Timeline

- New tab "Historial" in the existing `SubscriptionDetailsDialog` component at `apps/admin/src/features/billing-subscriptions/SubscriptionDetailsDialog.tsx`.
- Shows a chronological list of state transitions with:
  - Date/time
  - Previous status -> New status (with colored badges)
  - Source: "webhook", "admin", "system"
  - MercadoPago event ID (if from webhook)
- Sorted newest first, paginated (10 per page).

#### Error States

- **MercadoPago API unavailable**: No user-facing error. Event enters dead letter queue. Admin sees failed webhook in monitoring.
- **Unknown status from retrieve()**: No user-facing error. Sentry alert fires. Admin investigates.
- **Subscription not found locally**: No user-facing error. WARN log for investigation. May indicate a subscription created directly in MercadoPago.

---

### 4. Out of Scope

- **Creating new subscriptions from webhooks**: If a `subscription_preapproval.updated` arrives for an unknown `mp_subscription_id`, we do NOT create a local subscription. We log and skip.
- **Handling `subscription_preapproval.created` events**: Only `.updated` is handled. Creation is managed by our own subscription purchase flow.
- **Entitlement cache invalidation**: This is tracked separately in the specs-gaps-021 document. If it's needed, it should be a separate task or added as a follow-up.
- **Grace period logic**: Grace period for `past_due` subscriptions is handled by SPEC-021 (BILL-02). This spec does NOT implement grace period middleware.
- **Self-service cancellation from Hospeda UI**: Users cannot cancel from our platform in v1. Cancellation happens via MercadoPago dashboard.
- **Subscription creation sync**: Only status updates are synced, not new subscription creation.
- **Payment-related fields**: `currentPeriodStart`, `currentPeriodEnd`, and billing amount changes are NOT synced from this webhook. Those come from `payment.updated` events which are already handled.
- **Multi-locale email URLs**: All CTA links in email templates hardcode the `/es/` locale prefix. This is consistent with all existing email templates and is a known limitation to address separately.

---

## Part 2 - Technical Analysis

### 5. Architecture

#### Important: QZPay Architecture Distinction

The `QZPayBilling` instance (obtained via `getQZPayBilling()`) wraps a **local database** storage adapter. Its methods like `billing.subscriptions.get(id)`, `billing.customers.get(id)`, and `billing.plans.get(id)` query the **local PostgreSQL database**, NOT the MercadoPago API.

To call the MercadoPago API externally, you must use the `paymentAdapter` (instance of `QZPayMercadoPagoAdapter`), obtained from `getWebhookDependencies()` which returns `{ billing, paymentAdapter }`.

**Key distinction:**
- `billing.subscriptions.get(localUuid)` -> queries local DB by internal UUID
- `billing.customers.get(localUuid)` -> queries local DB
- `billing.plans.get(planId)` -> queries local DB
- `paymentAdapter.subscriptions.retrieve(mpPreapprovalId)` -> calls MercadoPago `GET /preapproval/{id}` and returns `QZPayProviderSubscription`

There is **no** `billing.subscriptions.getByMpSubscriptionId()` method. To find a local subscription by its MercadoPago ID, you must use a **direct Drizzle query**.

#### QZPay Helper: `extractMPSubscriptionEventData`

The `@qazuor/qzpay-mercadopago` package exports a helper function that extracts data from webhook events:

```typescript
import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';

const eventData = extractMPSubscriptionEventData(event);
// Returns: { subscriptionId: string, status?: string, payerId?: string, planId?: string }
```

This helper reads `data.id`, `data.status`, `data.payer_id`, and `data.preapproval_plan_id` from the event payload. Use `eventData.subscriptionId` to get the MercadoPago preapproval ID.

**IMPORTANT**: The `status` field from `extractMPSubscriptionEventData` is the **raw MercadoPago status** from the webhook payload. However, MercadoPago webhooks for `subscription_preapproval.updated` often do NOT include the status in the payload.. they only tell you "something changed." Therefore, always call `retrieve()` to get the authoritative current state. Do NOT rely on `eventData.status` alone.

#### Affected Components

```
apps/api/src/
  routes/webhooks/mercadopago/
    subscription-handler.ts     # REWRITE: full sync logic
    subscription-logic.ts       # NEW: extracted business logic (reusable by retry job)
    notifications.ts            # MODIFY: add 3 new notification functions
  cron/jobs/
    webhook-retry.job.ts        # MODIFY: split payment.created case, route subscription events to new logic

packages/notifications/src/
  types/
    notification.types.ts       # MODIFY: add 3 new NotificationType values + payload type
  templates/
    subscription/               # NEW directory
      subscription-cancelled.tsx    # NEW template
      subscription-paused.tsx       # NEW template
      subscription-reactivated.tsx  # NEW template
      index.ts                      # NEW barrel export
    index.ts                    # MODIFY: add subscription template exports
  services/
    notification.service.ts     # MODIFY: add 3 cases to selectTemplate switch
  utils/
    subject-builder.ts          # MODIFY: add 3 new subject patterns
  config/
    notification-categories.ts  # MODIFY: add 3 new type-to-category mappings

packages/db/src/
  schemas/billing/
    billing_subscription_event.dbschema.ts  # NEW: Drizzle schema for audit table
    index.ts                                # MODIFY: export new schema
  schemas/index.ts                          # Already re-exports billing (no change needed)

packages/schemas/src/
  api/billing/
    subscription-event.schema.ts   # NEW: Zod schema for admin API response
    index.ts                       # MODIFY: export new schema

apps/admin/src/
  features/billing-subscriptions/
    types.ts                               # MODIFY: add 'paused' to SubscriptionStatus union
    utils.ts                               # MODIFY: add paused to getStatusVariant + getStatusLabel
    hooks.ts                               # MODIFY: add useSubscriptionEvents query
    SubscriptionDetailsDialog.tsx           # MODIFY: add events timeline tab

apps/api/src/
  routes/billing/admin/
    subscription-events.ts                 # NEW: admin API route for events
    index.ts                               # MODIFY: mount new route

packages/i18n/src/locales/
  es/admin-billing.json                    # MODIFY: add paused label + history tab keys
  en/admin-billing.json                    # MODIFY: add paused label + history tab keys
  pt/admin-billing.json                    # MODIFY: add paused label + history tab keys
```

#### Data Flow: Webhook Processing

```
MercadoPago sends POST /api/v1/webhooks/mercadopago
  |
  v
QZPay webhook middleware (signature verification)
  |
  v
handleWebhookEvent (event-handler.ts)
  - INSERT to billing_webhook_events (status: pending)
  - Idempotency check (skip if already processed)
  |
  v
handleSubscriptionUpdated (subscription-handler.ts)
  |
  v
processSubscriptionUpdated (subscription-logic.ts)  <-- NEW
  |
  +--[1]--> Use extractMPSubscriptionEventData(event) to get mpPreapprovalId
  |
  +--[2]--> Fetch full subscription from MercadoPago API
  |           paymentAdapter.subscriptions.retrieve(mpPreapprovalId)
  |           Returns QZPayProviderSubscription { id, status, currentPeriodEnd, ... }
  |
  +--[3]--> Map QZPay status to SubscriptionStatusEnum
  |           (see Status Mapping Table in Section 6)
  |           CRITICAL: QZPay "canceled" (1 L) -> Hospeda "cancelled" (2 L's)
  |
  +--[4]--> Query local subscription via DIRECT Drizzle query
  |           SELECT FROM billing_subscriptions
  |           WHERE mp_subscription_id = '{mpPreapprovalId}'
  |           AND deleted_at IS NULL
  |
  +--[5]--> Compare statuses
  |           If same: log debug, mark processed, RETURN
  |           If different: continue
  |
  +--[6]--> Update billing_subscriptions
  |           SET status = newStatus,
  |               canceled_at = now() (if newStatus = cancelled AND canceled_at IS NULL),
  |               updated_at = now()
  |
  +--[7]--> Insert audit log entry (non-blocking)
  |           INSERT INTO billing_subscription_events
  |
  +--[8]--> Send notifications (fire-and-forget)
  |           - User notification (cancelled/paused/reactivated)
  |           - Admin notification (if involuntary cancellation)
  |           - billingNotificationLog entries are created automatically by the notification service
  |
  +--[9]--> Mark webhook event as processed
```

**Idempotency layers:**
1. **Layer 1 (webhook level)**: `event-handler.ts` checks `billing_webhook_events` table for duplicate `providerEventId`. If already `processed`, the handler is never called. This prevents any duplicate processing.
2. **Layer 2 (business logic level)**: `processSubscriptionUpdated()` compares the incoming status with the current local status (step 5). If identical, no DB update, no audit log, no notification. This is an EXTRA safety net for edge cases where the event passes Layer 1 but the status is the same.

#### Data Flow: Dead Letter Retry

```
webhookRetryJob (hourly cron)
  |
  v
retryWebhookEvent()
  |
  case 'subscription_preapproval.updated':  <-- SEPARATED from payment.created
    |
    v
  retrySubscriptionUpdated(payload, providerEventId)  <-- NEW function
    |
    v
  processSubscriptionUpdated(data, deps, providerEventId, source='dead-letter-retry')
    |
    (same flow as above, steps 1-9)
```

---

### 6. Status Mapping

#### `retrieve()` Return Value and `mapStatus` Behavior

The `QZPayMercadoPagoSubscriptionAdapter.retrieve()` method:
1. Calls `GET /preapproval/{id}` on the MercadoPago API
2. Passes the raw MP status through `mapStatus()` which uses `MERCADOPAGO_SUBSCRIPTION_STATUS` constant
3. Returns a `QZPayProviderSubscription` object with the mapped status

**`mapStatus` implementation** (from `@qazuor/qzpay-mercadopago` source):
```typescript
mapStatus(mpStatus) {
    const statusMap = MERCADOPAGO_SUBSCRIPTION_STATUS;
    return statusMap[mpStatus] ?? mpStatus;  // PASSTHROUGH for unknown statuses
}
```

**`MERCADOPAGO_SUBSCRIPTION_STATUS` constant:**
```typescript
{
    pending: "pending",      // MP pending -> QZPay "pending"
    authorized: "active",   // MP authorized -> QZPay "active"
    paused: "paused",       // MP paused -> QZPay "paused"
    cancelled: "canceled"   // MP cancelled -> QZPay "canceled" (ONE L)
}
```

**Critical**: `finished` is NOT in this map, so `mapStatus("finished")` returns `"finished"` unchanged (passthrough behavior).

#### QZPay Status -> Hospeda Status Map

Since `retrieve()` returns QZPay-mapped statuses (not raw MP statuses), the mapping is from **QZPay status** to **Hospeda SubscriptionStatusEnum**:

| QZPay Status (from `retrieve()`) | Raw MP Status | Hospeda `SubscriptionStatusEnum` | Action | Notification |
|---|---|---|---|---|
| `active` | `authorized` | `ACTIVE` (`'active'`) | Update status | Reactivation email (only if previous was `paused` or `cancelled`) |
| `paused` | `paused` | `PAUSED` (`'paused'`) | Update status | Suspension email (only if previous was `active`) |
| `canceled` | `cancelled` | `CANCELLED` (`'cancelled'`) | Update status + set `canceled_at` | Cancellation email + admin alert |
| `finished` | `finished` | `EXPIRED` (`'expired'`) | Update status | None (natural end of subscription) |
| `pending` | `pending` | _(no change)_ | Log only, no update | None |
| _(unknown)_ | _(unknown)_ | _(no change)_ | Log WARN + Sentry alert | None |

**CRITICAL - Spelling Mismatch:**
- QZPay uses `"canceled"` (American English, ONE L)
- Hospeda's `SubscriptionStatusEnum.CANCELLED` has value `'cancelled'` (British English, TWO L's)
- The mapping MUST handle this: `"canceled"` -> `SubscriptionStatusEnum.CANCELLED` (value `'cancelled'`)

**Implementation as a constant map:**

```typescript
import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * Maps QZPay subscription statuses (returned by retrieve()) to internal SubscriptionStatusEnum.
 * - A non-null value means "update the local subscription to this status".
 * - A null value means "no status change, log only".
 * - If the status is not in this map, it's unknown (WARN + Sentry).
 *
 * IMPORTANT: QZPay uses "canceled" (1 L) while Hospeda uses "cancelled" (2 L's).
 * The mapStatus() in @qazuor/qzpay-mercadopago passes through unknown statuses,
 * so "finished" arrives as-is.
 */
const QZPAY_TO_HOSPEDA_STATUS: Record<string, SubscriptionStatusEnum | null> = {
    active: SubscriptionStatusEnum.ACTIVE,
    paused: SubscriptionStatusEnum.PAUSED,
    canceled: SubscriptionStatusEnum.CANCELLED,   // "canceled" (1L) -> "cancelled" (2L)
    finished: SubscriptionStatusEnum.EXPIRED,     // passthrough from MP, not in QZPay map
    pending: null  // null = no status change, log only
} as const;
```

#### Transition Rules for Notifications

Not every status change triggers a notification. The rules are:

| Previous Status | New Status | User Notification | Admin Notification |
|---|---|---|---|
| `active` | `cancelled` | SUBSCRIPTION_CANCELLED | ADMIN_SYSTEM_EVENT (warning) |
| `active` | `paused` | SUBSCRIPTION_PAUSED | None |
| `active` | `expired` | None (natural end) | None |
| `paused` | `active` | SUBSCRIPTION_REACTIVATED | None |
| `paused` | `cancelled` | SUBSCRIPTION_CANCELLED | ADMIN_SYSTEM_EVENT (warning) |
| `cancelled` | `active` | SUBSCRIPTION_REACTIVATED | None |
| `trialing` | `active` | None (handled by trial conversion) | None |
| `trialing` | `cancelled` | SUBSCRIPTION_CANCELLED | ADMIN_SYSTEM_EVENT (warning) |
| `trialing` | `paused` | SUBSCRIPTION_PAUSED | None |
| `past_due` | `active` | SUBSCRIPTION_REACTIVATED | None |
| `past_due` | `cancelled` | SUBSCRIPTION_CANCELLED | ADMIN_SYSTEM_EVENT (warning) |
| `past_due` | `paused` | SUBSCRIPTION_PAUSED | None |
| `expired` | `cancelled` | None (already ended naturally) | None |
| `expired` | `active` | None (unexpected, audit log only) | None |
| Any | `expired` | None (natural lifecycle) | None |
| Any | Same status | None (idempotent, no-op) | None |

**Helper to determine notifications:**

```typescript
function shouldSendReactivationEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.ACTIVE &&
        (previousStatus === SubscriptionStatusEnum.PAUSED ||
         previousStatus === SubscriptionStatusEnum.CANCELLED ||
         previousStatus === SubscriptionStatusEnum.PAST_DUE)
    );
    // Note: trialing -> active is excluded (handled by trial conversion flow)
}

function shouldSendPausedEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.PAUSED &&
        previousStatus !== SubscriptionStatusEnum.PAUSED
    );
}

function shouldSendCancelledEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.EXPIRED  // Already ended naturally, no email needed
    );
}

function shouldSendAdminAlert(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.EXPIRED  // Already ended naturally, no alert needed
    );
}
```

---

### 7. Data Model Changes

#### New Table: `billing_subscription_events`

Stores the audit trail of subscription state transitions.

```sql
CREATE TABLE "billing_subscription_events" (
    "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subscription_id"     uuid NOT NULL,
    "previous_status"     varchar(50) NOT NULL,
    "new_status"          varchar(50) NOT NULL,
    "trigger_source"      varchar(50) NOT NULL,
    "provider_event_id"   varchar(255),
    "metadata"            jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at"          timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "fk_subscription_events_subscription"
        FOREIGN KEY ("subscription_id")
        REFERENCES "billing_subscriptions"("id")
        ON DELETE CASCADE
);

CREATE INDEX "idx_subscription_events_subscription_id"
    ON "billing_subscription_events"("subscription_id");

CREATE INDEX "idx_subscription_events_created_at"
    ON "billing_subscription_events"("created_at" DESC);
```

**Column Details:**

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key, auto-generated |
| `subscription_id` | uuid | NOT NULL | FK to `billing_subscriptions.id` |
| `previous_status` | varchar(50) | NOT NULL | Status before the change (e.g., `active`). Uses varchar, not enum, to store historical values |
| `new_status` | varchar(50) | NOT NULL | Status after the change (e.g., `cancelled`) |
| `trigger_source` | varchar(50) | NOT NULL | What caused the change: `webhook`, `admin`, `system`, `cron`, `dead-letter-retry` |
| `provider_event_id` | varchar(255) | NULL | MercadoPago event ID (only for webhook-triggered changes) |
| `metadata` | jsonb | NOT NULL | Additional context (e.g., raw QZPay status, preapproval ID) |
| `created_at` | timestamptz | NOT NULL | When the transition occurred |

**Why varchar instead of enum for status columns:** The audit log must preserve historical status values even if the enum changes in the future. Using varchar ensures old records remain valid.

**Drizzle Schema File:** `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts`

**IMPORTANT**: This file is a **new Hospeda-local schema**, NOT part of the `@qazuor/qzpay-drizzle` package. It follows the same naming pattern as existing Hospeda-specific billing schemas:
- `billing_addon_purchase.dbschema.ts` (singular entity name)
- `billing_dunning_attempt.dbschema.ts` (singular entity name)
- `billing_notification_log.dbschema.ts` (singular entity name)

```typescript
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * Audit trail of subscription state transitions.
 * Records every status change with its source and context.
 */
export const billingSubscriptionEvents = pgTable(
    'billing_subscription_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        previousStatus: varchar('previous_status', { length: 50 }).notNull(),
        newStatus: varchar('new_status', { length: 50 }).notNull(),
        triggerSource: varchar('trigger_source', { length: 50 }).notNull(),
        providerEventId: varchar('provider_event_id', { length: 255 }),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        idx_subscription_events_subscription_id: index('idx_subscription_events_subscription_id').on(table.subscriptionId),
        idx_subscription_events_created_at: index('idx_subscription_events_created_at').on(table.createdAt)
    })
);
```

**Import path note:** The import `from '../../billing/index.ts'` follows the same pattern as `billing_addon_purchase.dbschema.ts` which imports `billingCustomers` and `billingSubscriptions` from the same relative path. This path resolves to the QZPay re-exports in `packages/db/src/billing/index.ts`.

**Barrel exports to update:**

1. `packages/db/src/schemas/billing/index.ts` .. add:
```typescript
export * from './billing_subscription_event.dbschema.ts';
```

2. `packages/db/src/schemas/index.ts` .. already does `export * from './billing/index.ts'` (no change needed)

**Migration generation:**
```bash
cd packages/db
pnpm db:generate  # Generates the migration SQL file
pnpm db:migrate   # Applies the migration
```

**Rollback**: This table is purely additive. No existing data is affected. To rollback, simply `DROP TABLE billing_subscription_events CASCADE;` and remove the migration file.

#### No Changes to Existing Tables

The `billing_subscriptions` table already has all required columns (defined in `@qazuor/qzpay-drizzle`):
- `status` (varchar 50, NOT NULL) .. updated by the handler
- `canceled_at` (timestamptz, nullable) .. set when status becomes `cancelled`
- `mp_subscription_id` (varchar 255, nullable) .. used to correlate webhook `data.id` to local subscription
- `updated_at` (timestamptz, NOT NULL, default now) .. updated on every modification
- `cancel_at_period_end` (boolean, default false) .. reset to `false` ONLY when reactivating (new status = `active` AND current value is `true`). Not modified for other transitions.
- `deleted_at` (timestamptz, nullable) .. soft delete, must be filtered in queries

---

### 8. API Design

#### New Admin Endpoint: GET /api/v1/admin/billing/subscriptions/:id/events

Returns the subscription state transition history for admin display.

**Route file:** `apps/api/src/routes/billing/admin/subscription-events.ts`

**Mounting:** In `apps/api/src/routes/billing/admin/index.ts`, mount as:
```typescript
import { subscriptionEventsRoute } from './subscription-events';

// Mount under /subscriptions path to support /:id/events sub-path
app.route('/subscriptions', subscriptionEventsRoute);
```

This makes the full URL: `/api/v1/admin/billing/subscriptions/:id/events` (since admin billing routes are mounted at `/api/v1/admin/billing` in `apps/api/src/routes/index.ts` line 217).

**Auth:** Required (admin with `PermissionEnum.BILLING_READ_ALL`)

**Path Parameters:**
- `id` (uuid) .. Subscription ID (internal UUID, not MercadoPago ID)

**Query Parameters:**
- `page` (integer, default: 1) .. Page number
- `pageSize` (integer, default: 10, max: 50) .. Items per page

**Zod Schema (add to `packages/schemas/src/api/billing/subscription-event.schema.ts`):**

```typescript
import { z } from 'zod';

/** Schema for a single subscription event in API responses */
export const subscriptionEventSchema = z.object({
    id: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    previousStatus: z.string().max(50),
    newStatus: z.string().max(50),
    triggerSource: z.string().max(50),
    providerEventId: z.string().max(255).nullable(),
    metadata: z.record(z.unknown()).default({}),
    createdAt: z.string().datetime()
});

/** Schema for paginated subscription events response */
export const subscriptionEventsResponseSchema = z.object({
    data: z.array(subscriptionEventSchema),
    pagination: z.object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative()
    })
});

export type SubscriptionEvent = z.infer<typeof subscriptionEventSchema>;
```

**Barrel export update** in `packages/schemas/src/api/billing/index.ts`:
```typescript
export * from './subscription-event.schema.ts';
```

**Response 200:**

```json
{
    "success": true,
    "data": [
        {
            "id": "evt-uuid-1",
            "subscriptionId": "sub-uuid-1",
            "previousStatus": "active",
            "newStatus": "cancelled",
            "triggerSource": "webhook",
            "providerEventId": "mp-event-12345",
            "metadata": {
                "qzpayStatus": "canceled",
                "mpPreapprovalId": "mp-sub-abc"
            },
            "createdAt": "2026-03-06T15:30:00Z"
        }
    ],
    "pagination": {
        "page": 1,
        "pageSize": 10,
        "totalItems": 3,
        "totalPages": 1
    }
}
```

**Response 404:** Not used. If the subscription ID does not exist or has no events, the endpoint returns 200 with an empty `data: []` array and `totalItems: 0`. This is simpler and avoids an extra DB query to verify subscription existence. The admin UI handles empty state gracefully.

#### No Changes to Webhook Endpoint

The existing `POST /api/v1/webhooks/mercadopago` endpoint is unchanged. The handler registered for `subscription_preapproval.updated` is replaced internally.

---

### 9. Notification System Changes

#### 9.1 New NotificationType Values

Add to `packages/notifications/src/types/notification.types.ts`:

```typescript
export enum NotificationType {
    // ... existing 14 values (SUBSCRIPTION_PURCHASE through FEEDBACK_REPORT) ...
    // Add these 3 new values AFTER FEEDBACK_REPORT:
    SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
    SUBSCRIPTION_PAUSED = 'subscription_paused',
    SUBSCRIPTION_REACTIVATED = 'subscription_reactivated'
}
```

#### 9.2 New Payload Interface

Add to `packages/notifications/src/types/notification.types.ts`:

**Context**: `BaseNotificationPayload` is the base interface for all payloads. It contains:
```typescript
interface BaseNotificationPayload {
    type: NotificationType;
    recipientEmail: string;
    recipientName: string;
    userId: string | null;
    customerId?: string;
}
```

The new payload interface:

```typescript
/**
 * Payload for subscription lifecycle change notifications (cancel, pause, reactivate).
 *
 * NOTE: This is intentionally separate from the existing `SubscriptionEventPayload` which
 * is used for renewal reminders and plan change confirmations. The field sets are different:
 * - SubscriptionEventPayload has: amount, currency, renewalDate, daysRemaining, oldPlanName, newPlanName
 * - SubscriptionLifecyclePayload has: planName, currentPeriodEnd, nextBillingDate
 *
 * Flow: These fields are passed through sendNotification() -> notificationService.send() ->
 * selectTemplate() which casts the payload to SubscriptionLifecyclePayload and extracts
 * planName, currentPeriodEnd, nextBillingDate to pass as template props.
 */
export interface SubscriptionLifecyclePayload extends BaseNotificationPayload {
    type:
        | NotificationType.SUBSCRIPTION_CANCELLED
        | NotificationType.SUBSCRIPTION_PAUSED
        | NotificationType.SUBSCRIPTION_REACTIVATED;
    /** Name of the subscription plan (e.g., "Propietario Basico") */
    planName: string;
    /** ISO date string when the current billing period ends (for cancellation emails) */
    currentPeriodEnd?: string;
    /** ISO date string for next billing date (for reactivation emails) */
    nextBillingDate?: string;
}
```

Update the `NotificationPayload` union type:

```typescript
export type NotificationPayload =
    | PurchaseConfirmationPayload
    | PaymentNotificationPayload
    | SubscriptionEventPayload
    | SubscriptionLifecyclePayload    // <-- NEW
    | AddonEventPayload
    | TrialEventPayload
    | AdminNotificationPayload
    | FeedbackReportPayload;
```

#### 9.3 New Subject Patterns

Add to `packages/notifications/src/utils/subject-builder.ts` (inside the `SUBJECT_PATTERNS` object):

```typescript
[NotificationType.SUBSCRIPTION_CANCELLED]: 'Tu suscripcion ha sido cancelada - {planName}',
[NotificationType.SUBSCRIPTION_PAUSED]: 'Tu suscripcion ha sido pausada - Accion requerida',
[NotificationType.SUBSCRIPTION_REACTIVATED]: 'Tu suscripcion ha sido reactivada - {planName}'
```

#### 9.4 New Category Mappings

Add to `packages/notifications/src/config/notification-categories.ts` (inside the `NOTIFICATION_CATEGORY_MAP` object):

```typescript
// All three are TRANSACTIONAL (always sent, cannot opt-out)
[NotificationType.SUBSCRIPTION_CANCELLED]: NotificationCategory.TRANSACTIONAL,
[NotificationType.SUBSCRIPTION_PAUSED]: NotificationCategory.TRANSACTIONAL,
[NotificationType.SUBSCRIPTION_REACTIVATED]: NotificationCategory.TRANSACTIONAL,
```

#### 9.5 New Email Templates

Three new templates in `packages/notifications/src/templates/subscription/`:

**Pattern to follow**: Use the same component structure as existing templates (e.g., `addon/addon-expiration-warning.tsx`):

- Import components **individually** (NOT from barrel), all with `.js` extension:
  ```typescript
  import { Section, Text } from '@react-email/components';
  import { Button } from '../components/button.js';
  import { EmailLayout } from '../components/layout.js';
  import { Heading } from '../components/heading.js';
  import { InfoRow } from '../components/info-row.js';
  import { formatDate } from '../utils/index.js';
  ```
  **NOTE**: Existing templates use individual component imports (e.g., `../components/button.js`), NOT the barrel import (`../components/index.js`). Follow the existing pattern for consistency.
- Use `EmailLayout` with `previewText` prop and `showUnsubscribe={false}` (TRANSACTIONAL emails cannot be opted out)
- All text in Spanish
- Props interface with `readonly` fields
- Named export (no default export)
- Inline `styles` object with the project color palette (`#1e293b`, `#475569`, `#0f766e`)

**Template props interfaces:**

```typescript
// subscription-cancelled.tsx
export interface SubscriptionCancelledProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly currentPeriodEnd?: string;
    readonly baseUrl: string;
}

// subscription-paused.tsx
export interface SubscriptionPausedProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly baseUrl: string;
}

// subscription-reactivated.tsx
export interface SubscriptionReactivatedProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly nextBillingDate?: string;
    readonly baseUrl: string;
}
```

**Barrel export**: Create `packages/notifications/src/templates/subscription/index.ts`:

```typescript
export { SubscriptionCancelled } from './subscription-cancelled.js';
export { SubscriptionPaused } from './subscription-paused.js';
export { SubscriptionReactivated } from './subscription-reactivated.js';
```

Update `packages/notifications/src/templates/index.ts` to add:

```typescript
export * from './subscription/index.js';
```

#### 9.6 Template Selection

Add to the `selectTemplate()` switch in `packages/notifications/src/services/notification.service.ts`.

**IMPORTANT**: The existing 14 cases in `selectTemplate()` use **string literal values** (e.g., `case 'subscription_purchase':`), NOT enum references. For consistency, use the same pattern:

```typescript
case 'subscription_cancelled': {
    const lifecyclePayload = payload as SubscriptionLifecyclePayload;
    return SubscriptionCancelled({
        recipientName: payload.recipientName,
        planName: lifecyclePayload.planName,
        currentPeriodEnd: lifecyclePayload.currentPeriodEnd,
        baseUrl
    });
}
case 'subscription_paused': {
    const lifecyclePayload = payload as SubscriptionLifecyclePayload;
    return SubscriptionPaused({
        recipientName: payload.recipientName,
        planName: lifecyclePayload.planName,
        baseUrl
    });
}
case 'subscription_reactivated': {
    const lifecyclePayload = payload as SubscriptionLifecyclePayload;
    return SubscriptionReactivated({
        recipientName: payload.recipientName,
        planName: lifecyclePayload.planName,
        nextBillingDate: lifecyclePayload.nextBillingDate,
        baseUrl
    });
}
```

Where `baseUrl` is `this.siteUrl` (already available in the service instance).

---

### 10. Implementation Details

#### 10.1 New File: `subscription-logic.ts`

Located at `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`.

**This is a NEW file. Create it from scratch.** It contains the shared business logic, reusable by both the live webhook handler and the dead letter retry job. It follows the same pattern as `payment-logic.ts` in the same directory.

**All imports for this file:**

```typescript
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { getDb, billingSubscriptions, billingSubscriptionEvents } from '@repo/db';
import { eq, and, isNull } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../../../utils/logger';
import {
    sendSubscriptionCancelledNotification,
    sendSubscriptionPausedNotification,
    sendSubscriptionReactivatedNotification
} from './notifications';
```

**Interfaces:**

```typescript

/**
 * Input for processing a subscription_preapproval.updated event.
 *
 * NOTE: Unlike ProcessPaymentUpdatedInput (which only receives `data` and `billing`),
 * this interface also receives `paymentAdapter` because we need to call the MercadoPago API
 * to fetch the current subscription state. The payment handler processes data from the webhook
 * payload directly, but subscription webhooks only tell us "something changed" - we must
 * fetch the current state from the API.
 */
interface ProcessSubscriptionUpdatedInput {
    /** The full webhook event (used by extractMPSubscriptionEventData helper) */
    readonly event: QZPayWebhookEvent;
    /** QZPay billing instance (for local DB queries: customers, plans, subscriptions) */
    readonly billing: QZPayBilling;
    /** MercadoPago adapter (for external API calls: retrieve subscription) */
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    /** MercadoPago event ID for audit trail */
    readonly providerEventId: string;
    /** Caller context label for log messages */
    readonly source?: string;
}

/** Result of processing a subscription_preapproval.updated event */
interface ProcessSubscriptionUpdatedResult {
    readonly success: boolean;
    /** Whether a status change was applied */
    readonly statusChanged: boolean;
    /** The new status if changed */
    readonly newStatus?: string;
    /** Error message if failed */
    readonly error?: string;
}
```

**Function: `processSubscriptionUpdated()`**

Step-by-step logic:

1. **Extract MercadoPago preapproval ID** using the QZPay helper:
   ```typescript
   import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';

   const eventData = extractMPSubscriptionEventData(input.event);
   const mpPreapprovalId = eventData.subscriptionId;
   ```
   If `mpPreapprovalId` is empty/falsy, log error and return `{ success: true, statusChanged: false }` (nothing to do).

2. **Fetch subscription from MercadoPago API** via the adapter:
   ```typescript
   const mpSubscription = await input.paymentAdapter.subscriptions.retrieve(mpPreapprovalId);
   ```
   If this throws (network error, timeout, 5xx), **let the error propagate**. The caller (webhook handler or retry job) will handle it by marking the event as failed / entering dead letter queue.

   This returns a `QZPayProviderSubscription` with these fields:
   ```typescript
   interface QZPayProviderSubscription {
       id: string;                    // MercadoPago preapproval ID
       status: string;                // QZPay-mapped status (see Section 6)
       currentPeriodStart: Date;      // Start of current billing period
       currentPeriodEnd: Date;        // End of current billing period (calculated by QZPay)
       cancelAtPeriodEnd: boolean;    // Whether cancel is scheduled
       canceledAt: Date | null;       // When it was cancelled (if applicable)
       trialStart: Date | null;       // Trial start (if applicable)
       trialEnd: Date | null;         // Trial end (if applicable)
       metadata: Record<string, string>;
   }
   ```

3. **Extract QZPay status** from the API response:
   ```typescript
   const qzpayStatus = mpSubscription.status;  // e.g., "active", "canceled", "paused", "finished"
   ```

4. **Map to internal status** using `QZPAY_TO_HOSPEDA_STATUS` constant map. Three possible outcomes:
   - **Mapped to a SubscriptionStatusEnum value** (e.g., `"canceled"` -> `CANCELLED`): Continue to step 5.
   - **Mapped to `null`** (i.e., `"pending"`): Log at INFO level and return `{ success: true, statusChanged: false }`.
   - **Not in the map** (unknown status): Log WARN with the raw status value, capture Sentry alert via `Sentry.captureException(new Error(`Unknown QZPay subscription status: ${qzpayStatus}`))` (using the `import * as Sentry from '@sentry/node'` at the top of the file), and return `{ success: true, statusChanged: false }`.

5. **Query local subscription** from DB using a **direct Drizzle query** (QZPay does not have a `getByMpSubscriptionId` method):
   ```typescript
   import { eq, and, isNull } from 'drizzle-orm';
   import { billingSubscriptions } from '@repo/db';
   import { getDb } from '@repo/db';

   const db = getDb();
   const [localSubscription] = await db
       .select()
       .from(billingSubscriptions)
       .where(
           and(
               eq(billingSubscriptions.mpSubscriptionId, mpPreapprovalId),
               isNull(billingSubscriptions.deletedAt)  // Filter soft-deleted records
           )
       )
       .limit(1);
   ```
   If not found, log WARN "No local subscription found for mp_subscription_id={mpPreapprovalId}" and return `{ success: true, statusChanged: false }`.

   **IMPORTANT NOTES**:
   - `mp_subscription_id` is assumed unique per subscription (one-to-one with MercadoPago preapproval). If duplicates are found (`.limit(1)` takes the first), log a WARN with the count.
   - `billing_subscriptions.plan_id` is **varchar** (not UUID), even though `billing_plans.id` is UUID. This is a known schema quirk. `billing.plans.get(localSubscription.planId)` still works because it accepts `string`.

6. **Compare statuses**. If `localSubscription.status === mappedStatus`, log debug "No status change for subscription {localSubscription.id}: still {mappedStatus}" and return `{ success: true, statusChanged: false }`.

7. **Update `billing_subscriptions`** via Drizzle:

   **NOTE**: `updatedAt` must be set manually because Drizzle does NOT auto-update this column on `UPDATE` statements (unlike `defaultNow()` which only applies on `INSERT`).

   ```typescript
   const updateData: Record<string, unknown> = {
       status: mappedStatus,
       updatedAt: new Date()
   };

   // Only set canceled_at if transitioning TO cancelled and not already set
   if (mappedStatus === SubscriptionStatusEnum.CANCELLED && !localSubscription.canceledAt) {
       updateData.canceledAt = new Date();
   }

   // Reset cancel_at_period_end when reactivating (user cancelled but then reactivated)
   if (mappedStatus === SubscriptionStatusEnum.ACTIVE && localSubscription.cancelAtPeriodEnd) {
       updateData.cancelAtPeriodEnd = false;
   }

   await db
       .update(billingSubscriptions)
       .set(updateData)
       .where(eq(billingSubscriptions.id, localSubscription.id));
   ```

8. **Insert audit log** (non-blocking):
   ```typescript
   import { billingSubscriptionEvents } from '@repo/db';

   try {
       await db.insert(billingSubscriptionEvents).values({
           subscriptionId: localSubscription.id,
           previousStatus: localSubscription.status,
           newStatus: mappedStatus,
           triggerSource: input.source ?? 'webhook',
           providerEventId: input.providerEventId,
           metadata: {
               qzpayStatus: qzpayStatus,       // The status returned by retrieve()
               mpPreapprovalId: mpPreapprovalId
           }
       });
   } catch (auditError) {
       apiLogger.error(
           { error: auditError, subscriptionId: localSubscription.id },
           'Failed to insert subscription audit log entry'
       );
       // Do NOT throw - audit failure is non-blocking
   }
   ```

9. **Send notifications** (fire-and-forget):

   Determine previous and new status: `previousStatus = localSubscription.status`, `newStatus = mappedStatus`.

   Look up customer and plan data for notification content. These calls are **non-blocking**: if either fails or returns null, notifications are skipped but the status update (step 7-8) has already succeeded:
   ```typescript
   let customer: QZPayCustomer | null = null;
   let plan: QZPayPlan | null = null;
   try {
       customer = await input.billing.customers.get(localSubscription.customerId);
       plan = await input.billing.plans.get(localSubscription.planId);
   } catch (lookupError) {
       apiLogger.warn(
           { error: lookupError, subscriptionId: localSubscription.id },
           'Failed to fetch customer/plan for notification. Status update succeeded, skipping notifications.'
       );
       return { success: true, statusChanged: true, newStatus: mappedStatus };
   }
   const planName = plan?.name ?? 'Plan';
   ```

   **NOTE on `planId` type mismatch**: `billing_subscriptions.plan_id` is `varchar` while `billing_plans.id` is `UUID`. The QZPay `billing.plans.get()` method handles this internally by accepting either format. If the lookup fails due to a type mismatch, the `catch` block above ensures the status update is not rolled back.

   Extract customer info (same pattern as `sendPaymentSuccessNotification` in `notifications.ts`):
   ```typescript
   const customerName = typeof customer?.metadata?.name === 'string'
       ? customer.metadata.name
       : customer?.email ?? 'Usuario';
   const userId = typeof customer?.metadata?.userId === 'string'
       ? customer.metadata.userId
       : null;
   ```

   **NOTE**: The fallback chain for `customerName` is: `metadata.name` → `customer.email` → `'Usuario'`. This matches the existing pattern in `notifications.ts` and `payment-logic.ts`, where `customer.email` is used as fallback (not a hardcoded string). The final `'Usuario'` fallback only applies if `customer` is null (e.g., `billing.customers.get()` returned null).

   Get period dates from the `retrieve()` response. Only include `currentPeriodEnd` in emails if the date is in the future (a past date would confuse the user with "your access continues until [past date]"):
   ```typescript
   const periodEndDate = mpSubscription.currentPeriodEnd;
   const currentPeriodEnd = periodEndDate && periodEndDate > new Date()
       ? periodEndDate.toISOString()
       : undefined;
   // For next billing date: use currentPeriodEnd as approximation
   const nextBillingDate = currentPeriodEnd;
   ```

   Call notification functions based on transition rules (Section 6). All wrapped in `.catch()`:
   ```typescript
   if (shouldSendCancelledEmail(previousStatus, newStatus)) {
       sendSubscriptionCancelledNotification({
           customerId: localSubscription.customerId,
           customerEmail: customer?.email ?? '',
           customerName,
           userId,
           planName,
           currentPeriodEnd,
           mpSubscriptionId: mpPreapprovalId,
           previousStatus
       }).catch((err) => {
           apiLogger.debug({ error: err }, 'Subscription cancelled notification failed');
       });
   }

   if (shouldSendPausedEmail(previousStatus, newStatus)) {
       sendSubscriptionPausedNotification({
           customerId: localSubscription.customerId,
           customerEmail: customer?.email ?? '',
           customerName,
           userId,
           planName
       }).catch((err) => {
           apiLogger.debug({ error: err }, 'Subscription paused notification failed');
       });
   }

   if (shouldSendReactivationEmail(previousStatus, newStatus)) {
       sendSubscriptionReactivatedNotification({
           customerId: localSubscription.customerId,
           customerEmail: customer?.email ?? '',
           customerName,
           userId,
           planName,
           nextBillingDate
       }).catch((err) => {
           apiLogger.debug({ error: err }, 'Subscription reactivated notification failed');
       });
   }
   ```

10. **Return** `{ success: true, statusChanged: true, newStatus: mappedStatus }`.

#### 10.2 Modified File: `subscription-handler.ts`

Replace the current handler body (currently lines 36-53):

```typescript
import { processSubscriptionUpdated } from './subscription-logic';
import { markEventProcessedByProviderId } from './utils';
import { apiLogger } from '../../../utils/logger';
import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { getWebhookDependencies } from './utils';

export const handleSubscriptionUpdated: QZPayWebhookHandler = async (c, event) => {
    const deps = getWebhookDependencies();

    if (!deps) {
        apiLogger.warn('Billing not configured, skipping subscription sync');
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
        return undefined;
    }

    const result = await processSubscriptionUpdated({
        event,
        billing: deps.billing,
        paymentAdapter: deps.paymentAdapter,
        providerEventId: String(event.id),
        source: 'webhook'
    });

    if (result.success) {
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    }
    // If !success, the error will propagate and the event handler
    // will mark it as failed + add to dead letter queue

    return undefined;
};
```

#### 10.3 Modified File: `webhook-retry.job.ts`

**CRITICAL**: The current code has `payment.created` and `subscription_preapproval.updated` in the **same case block** (lines 165-174). They must be **split** so that `payment.created` continues to auto-resolve while `subscription_preapproval.updated` gets the new business logic.

**Before (current code, lines 165-174):**
```typescript
case 'payment.created':
case 'subscription_preapproval.updated': {
    // These event types have no custom business logic beyond persistence.
    apiLogger.info(
        { eventId: event.id, type: event.type },
        'No business logic to retry for event type - resolving dead letter'
    );
    return true;
}
```

**After (new code):**
```typescript
case 'payment.created': {
    // payment.created has no custom business logic beyond persistence.
    apiLogger.info(
        { eventId: event.id, type: event.type },
        'No business logic to retry for event type - resolving dead letter'
    );
    return true;
}

case 'subscription_preapproval.updated': {
    return await retrySubscriptionUpdated(event.payload, event.providerEventId);
}
```

Add new function `retrySubscriptionUpdated()` in the same file (follows same pattern as `retryMercadoPagoPaymentUpdated()`):

**NOTE**: These are NEW imports that must be added to the top of `webhook-retry.job.ts`. The file currently does NOT import `createMercadoPagoAdapter` or `processSubscriptionUpdated`.

```typescript
// ADD these imports at the top of webhook-retry.job.ts (new imports):
import { processSubscriptionUpdated } from '../routes/webhooks/mercadopago/subscription-logic.js';
import { createMercadoPagoAdapter } from '@repo/billing';
import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
// NOTE: getQZPayBilling is already imported in this file (line 28)

async function retrySubscriptionUpdated(
    payload: unknown,
    providerEventId: string
): Promise<boolean> {
    const billing = getQZPayBilling();

    if (!billing) {
        apiLogger.warn('Billing not configured, skipping subscription retry');
        return true;
    }

    let paymentAdapter: ReturnType<typeof createMercadoPagoAdapter>;
    try {
        paymentAdapter = createMercadoPagoAdapter();
    } catch (error) {
        apiLogger.error({ error }, 'Failed to create MercadoPago adapter for subscription retry');
        return false;
    }

    // Reconstruct a minimal QZPayWebhookEvent from the stored payload
    const payloadObj =
        payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : null;

    if (!payloadObj) {
        apiLogger.debug('No payload in dead letter entry, skipping subscription retry');
        return true;
    }

    // QZPayWebhookEvent only has: id, type, data, created
    const reconstructedEvent: QZPayWebhookEvent = {
        id: providerEventId,
        type: 'subscription_preapproval.updated',
        data: (payloadObj.data as Record<string, unknown>) ?? payloadObj,
        created: new Date((payloadObj.date_created as string) ?? Date.now())
    };

    const result = await processSubscriptionUpdated({
        event: reconstructedEvent,
        billing,
        paymentAdapter,
        providerEventId,
        source: 'dead-letter-retry'
    });

    return result.success;
}
```

#### 10.4 Notification Helper Functions

Add to `apps/api/src/routes/webhooks/mercadopago/notifications.ts`.

**Pattern note**: The existing functions in this file (`sendPaymentSuccessNotification`, `sendPaymentFailureNotifications`) use positional parameters. The new functions use the RO-RO (Receive Object, Return Object) pattern per the project's CLAUDE.md guidelines. This is an intentional improvement over the legacy pattern.. do NOT refactor the existing functions to match.

```typescript
import { sendNotification } from '../../../utils/notification-helper';
import { NotificationType } from '@repo/notifications';
import { apiLogger } from '../../../utils/logger';

/**
 * Sends a cancellation notification to the user AND an admin alert.
 * The admin alert includes mpSubscriptionId and previousStatus for investigation.
 */
export async function sendSubscriptionCancelledNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
    readonly currentPeriodEnd?: string;
    readonly mpSubscriptionId: string;
    readonly previousStatus: string;
}): Promise<void> {
    try {
        // User notification
        if (params.customerEmail) {
            sendNotification({
                type: NotificationType.SUBSCRIPTION_CANCELLED,
                recipientEmail: params.customerEmail,
                recipientName: params.customerName,
                userId: params.userId,
                customerId: params.customerId,
                planName: params.planName,
                currentPeriodEnd: params.currentPeriodEnd
            }).catch((err) => {
                apiLogger.debug(
                    { error: err, customerId: params.customerId },
                    'Subscription cancelled user notification failed (will retry)'
                );
            });
        }

        // Admin alert for involuntary cancellation
        const adminEmails =
            process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) ?? [];
        for (const adminEmail of adminEmails) {
            if (adminEmail) {
                sendNotification({
                    type: NotificationType.ADMIN_SYSTEM_EVENT,
                    recipientEmail: adminEmail,
                    recipientName: 'Admin',
                    userId: null,
                    severity: 'warning' as const,
                    eventDetails: {
                        eventType: 'subscription_involuntary_cancellation',
                        customerEmail: params.customerEmail,
                        planName: params.planName,
                        mpSubscriptionId: params.mpSubscriptionId,
                        previousStatus: params.previousStatus
                    }
                }).catch((err) => {
                    apiLogger.debug(
                        { error: err, adminEmail },
                        'Admin cancellation alert failed (will retry)'
                    );
                });
            }
        }
    } catch (error) {
        apiLogger.debug(
            { error, customerId: params.customerId },
            'sendSubscriptionCancelledNotification failed'
        );
    }
}

/**
 * Sends a pause/suspension notification to the user.
 */
export async function sendSubscriptionPausedNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
}): Promise<void> {
    try {
        if (!params.customerEmail) return;

        sendNotification({
            type: NotificationType.SUBSCRIPTION_PAUSED,
            recipientEmail: params.customerEmail,
            recipientName: params.customerName,
            userId: params.userId,
            customerId: params.customerId,
            planName: params.planName
        }).catch((err) => {
            apiLogger.debug(
                { error: err, customerId: params.customerId },
                'Subscription paused notification failed (will retry)'
            );
        });
    } catch (error) {
        apiLogger.debug(
            { error, customerId: params.customerId },
            'sendSubscriptionPausedNotification failed'
        );
    }
}

/**
 * Sends a reactivation confirmation to the user.
 */
export async function sendSubscriptionReactivatedNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
    readonly nextBillingDate?: string;
}): Promise<void> {
    try {
        if (!params.customerEmail) return;

        sendNotification({
            type: NotificationType.SUBSCRIPTION_REACTIVATED,
            recipientEmail: params.customerEmail,
            recipientName: params.customerName,
            userId: params.userId,
            customerId: params.customerId,
            planName: params.planName,
            nextBillingDate: params.nextBillingDate
        }).catch((err) => {
            apiLogger.debug(
                { error: err, customerId: params.customerId },
                'Subscription reactivated notification failed (will retry)'
            );
        });
    } catch (error) {
        apiLogger.debug(
            { error, customerId: params.customerId },
            'sendSubscriptionReactivatedNotification failed'
        );
    }
}
```

---

### 11. Admin Frontend Changes

#### 11.1 New Hook: `useSubscriptionEventsQuery`

Add to `apps/admin/src/features/billing-subscriptions/hooks.ts` (existing file, 208 lines).

**IMPORTANT**: The admin app uses `fetchApi()` from `@/lib/api/client`, NOT an `apiClient.get()` method. Follow the existing pattern:

```typescript
import { fetchApi } from '@/lib/api/client';

async function fetchSubscriptionEvents(
    subscriptionId: string,
    page: number,
    pageSize: number
) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
    });
    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
    }>({
        path: `/api/v1/admin/billing/subscriptions/${subscriptionId}/events?${params.toString()}`
    });
    return { items: result.data.data, pagination: result.data.pagination };
}

export function useSubscriptionEventsQuery(params: {
    readonly subscriptionId: string;
    readonly page?: number;
    readonly pageSize?: number;
    readonly enabled?: boolean;
}) {
    return useQuery({
        queryKey: [
            'billing-subscriptions',
            params.subscriptionId,
            'events',
            params.page ?? 1
        ],
        queryFn: () => fetchSubscriptionEvents(
            params.subscriptionId,
            params.page ?? 1,
            params.pageSize ?? 10
        ),
        enabled: params.enabled ?? true,
        staleTime: 60_000
    });
}
```

#### 11.2 Subscription Details Dialog Update

Modify `apps/admin/src/features/billing-subscriptions/SubscriptionDetailsDialog.tsx` (existing file, 338 lines).

**New imports to add at the top of the file:**

```typescript
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { useSubscriptionEventsQuery } from './hooks';
import { getStatusVariant } from './utils';
```

**NOTE**: `useState` may or may not already be imported. Check before adding a duplicate import.

**Changes to the component body:**

1. Add state for active tab:
```typescript
const [activeTab, setActiveTab] = useState('detalles');
const [eventsPage, setEventsPage] = useState(1);
```

2. Add the events query (only fetches when tab is active):
```typescript
const eventsQuery = useSubscriptionEventsQuery({
    subscriptionId: subscription.id,
    page: eventsPage,
    pageSize: 10,
    enabled: activeTab === 'historial'
});
```

3. Wrap the existing dialog body content in a `Tabs` component. The existing content goes into the "Detalles" tab. The new "Historial" tab renders the events timeline:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList>
        <TabsTrigger value="detalles">
            {t('admin-billing.subscriptions.detailsDialog.tabs.details')}
        </TabsTrigger>
        <TabsTrigger value="historial">
            {t('admin-billing.subscriptions.detailsDialog.tabs.history')}
        </TabsTrigger>
    </TabsList>

    <TabsContent value="detalles">
        {/* === EXISTING DIALOG BODY CONTENT GOES HERE (move, don't copy) === */}
    </TabsContent>

    <TabsContent value="historial">
        <div className="space-y-4 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('admin-billing.subscriptions.detailsDialog.history.title')}
            </h3>

            {eventsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando...</p>
            )}

            {eventsQuery.data && eventsQuery.data.items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('admin-billing.subscriptions.detailsDialog.history.emptyState')}
                </p>
            )}

            {eventsQuery.data && eventsQuery.data.items.length > 0 && (
                <>
                    <div className="space-y-3">
                        {eventsQuery.data.items.map((event: Record<string, unknown>) => (
                            <div
                                key={event.id as string}
                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant={getStatusVariant(event.previousStatus as SubscriptionStatus)}>
                                        {event.previousStatus as string}
                                    </Badge>
                                    <span className="text-muted-foreground">→</span>
                                    <Badge variant={getStatusVariant(event.newStatus as SubscriptionStatus)}>
                                        {event.newStatus as string}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{event.triggerSource as string}</span>
                                    <span>
                                        {formatDate(event.createdAt as string)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {eventsQuery.data.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={eventsPage <= 1}
                                onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                            >
                                {t('admin-billing.subscriptions.detailsDialog.history.pagination.previous')}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {eventsPage} / {eventsQuery.data.pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={eventsPage >= eventsQuery.data.pagination.totalPages}
                                onClick={() => setEventsPage((p) => p + 1)}
                            >
                                {t('admin-billing.subscriptions.detailsDialog.history.pagination.next')}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    </TabsContent>
</Tabs>
```

**NOTE**: `Badge`, `Button`, `formatDate`, `t`, and `SubscriptionStatus` are already imported in the existing file (line 15: `import { formatArs, formatDate, getPlanBySlug, getStatusLabel, getStatusVariant } from './utils'`). The `formatDate` function signature is `formatDate(date: string, locale?: string)` with locale defaulting to `'es-AR'`. Verify before adding duplicate imports. For the events timeline, call it as `formatDate(event.createdAt as string)` (locale defaults are fine for admin).

#### 11.3 Admin API Route

Create `apps/api/src/routes/billing/admin/subscription-events.ts`:

```typescript
import { createRouter } from '../../../utils/create-app';
import { getDb, billingSubscriptionEvents } from '@repo/db';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiLogger } from '../../../utils/logger';

const app = createRouter();

/**
 * GET /:id/events
 * Returns paginated subscription state transition history.
 *
 * NOTE: ResponseFactory does NOT have a .success() method. It only provides
 * OpenAPI schema generators (createCRUDResponses, createListResponses, etc.).
 * Use c.json() directly for the response, matching the pattern used by
 * other simple admin endpoints.
 */
app.get(
    '/:id/events',
    zValidator('param', z.object({ id: z.string().uuid() })),
    zValidator('query', z.object({
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(50).default(10)
    })),
    async (c) => {
        const { id } = c.req.valid('param');
        const { page, pageSize } = c.req.valid('query');

        const db = getDb();
        const offset = (page - 1) * pageSize;

        try {
            const [events, countResult] = await Promise.all([
                db
                    .select()
                    .from(billingSubscriptionEvents)
                    .where(eq(billingSubscriptionEvents.subscriptionId, id))
                    .orderBy(desc(billingSubscriptionEvents.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                db
                    .select({ count: sql<number>`count(*)` })
                    .from(billingSubscriptionEvents)
                    .where(eq(billingSubscriptionEvents.subscriptionId, id))
            ]);

            const totalItems = Number(countResult[0]?.count ?? 0);
            const totalPages = Math.ceil(totalItems / pageSize);

            return c.json({
                success: true,
                data: events.map((e) => ({
                    ...e,
                    createdAt: e.createdAt.toISOString()
                })),
                pagination: { page, pageSize, totalItems, totalPages }
            });
        } catch (error) {
            apiLogger.error(
                { error: error instanceof Error ? error.message : 'Unknown error', subscriptionId: id },
                'Failed to fetch subscription events'
            );
            return c.json({ success: false, error: 'Failed to fetch subscription events' }, 500);
        }
    }
);

export { app as subscriptionEventsRoute };
```

**Mount in billing admin router** at `apps/api/src/routes/billing/admin/index.ts`:

```typescript
import { subscriptionEventsRoute } from './subscription-events';

// Add to the existing routes:
app.route('/subscriptions', subscriptionEventsRoute);
```

**Auth middleware**: The admin billing router is already mounted behind the admin auth middleware (`adminAuthMiddleware`) which checks for admin session. No additional permission check is needed for this read-only endpoint since the admin auth middleware already ensures only admin users can access `/api/v1/admin/*` routes. This is consistent with the other endpoints in the admin billing router (usage, notifications, customer-addons) which also do not add individual permission checks beyond the base admin auth.

---

### 12. Dependencies

#### External

- **MercadoPago API**: `GET /preapproval/{id}` .. available via `paymentAdapter.subscriptions.retrieve()`. No new external dependencies.

#### Internal (existing packages, no new dependencies)

- `@repo/db` .. new migration for `billing_subscription_events` table + new schema file
- `@repo/notifications` .. new notification types, templates, and categories
- `@repo/schemas` .. new Zod schema for subscription events API response
- `@repo/billing` .. `createMercadoPagoAdapter()`
- `@repo/schemas` .. `SubscriptionStatusEnum`

#### QZPay Methods Used

| Method | Package | Source | Purpose |
|---|---|---|---|
| `paymentAdapter.subscriptions.retrieve(id)` | `@qazuor/qzpay-mercadopago` | `QZPayMercadoPagoSubscriptionAdapter` | Fetch subscription state from MercadoPago API (external HTTP call). Returns `QZPayProviderSubscription`. |
| `extractMPSubscriptionEventData(event)` | `@qazuor/qzpay-mercadopago` | Exported function | Extract subscription ID from webhook event payload. |
| `billing.customers.get(customerId)` | `@qazuor/qzpay-core` | `QZPayBilling` (local DB) | Get customer email/name for notifications |
| `billing.plans.get(planId)` | `@qazuor/qzpay-core` | `QZPayBilling` (local DB) | Get plan name for notification emails |

**Direct Drizzle queries used (NOT through QZPay):**

| Query | Purpose | Import |
|---|---|---|
| `SELECT FROM billing_subscriptions WHERE mp_subscription_id = :id AND deleted_at IS NULL` | Find local subscription by MercadoPago preapproval ID | `billingSubscriptions` from `@repo/db` |
| `UPDATE billing_subscriptions SET status = :status, ...` | Update subscription status | `billingSubscriptions` from `@repo/db` |
| `INSERT INTO billing_subscription_events VALUES (...)` | Insert audit log entry | `billingSubscriptionEvents` from `@repo/db` |
| `SELECT FROM billing_subscription_events WHERE subscription_id = :id` | Admin events timeline | `billingSubscriptionEvents` from `@repo/db` |
| `getDb()` | Get the Drizzle DB instance | `getDb` from `@repo/db` |

---

### 13. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| MercadoPago API rate limiting when fetching subscription details | Low | Medium | The handler only calls `retrieve()` once per webhook. MercadoPago rate limits are generous (hundreds/min). If rate limited, the event enters dead letter queue and retries. |
| Race condition: two webhooks for the same subscription arrive simultaneously | Low | Medium | The `billing_webhook_events` idempotency check (Layer 1) prevents duplicate processing. Additionally, the status comparison check (Layer 2, step 6) makes the update idempotent. |
| `mp_subscription_id` is NULL for subscriptions created before this field was populated | Medium | Medium | Log WARN when lookup returns no results. The operator can manually populate `mp_subscription_id` for legacy subscriptions. Document this in migration notes. |
| Notification sends slow down webhook response time | Low | Low | Notifications use fire-and-forget pattern (`.catch()`). They do not block the webhook response. |
| Dead letter retry loop if MercadoPago API is persistently down | Low | Medium | Existing MAX_RETRY_ATTEMPTS = 5 limit prevents infinite loops. After 5 failures, the entry is permanently marked as failed and an admin alert fires. |
| Unknown future MercadoPago statuses break the handler | Low | Low | Unknown statuses from `retrieve()` are logged + Sentry alert but do NOT cause errors. The handler gracefully ignores them via the passthrough behavior of `mapStatus`. |
| Spelling mismatch `canceled` vs `cancelled` causes missed mapping | Medium | High | The `QZPAY_TO_HOSPEDA_STATUS` map explicitly handles `"canceled"` (1 L) -> `SubscriptionStatusEnum.CANCELLED` (2 L's). Tests must verify this mapping. |
| `finished` status not in QZPay mapping causes unexpected behavior | Low | Medium | `mapStatus` passes through unknown values, so `"finished"` arrives as-is. The `QZPAY_TO_HOSPEDA_STATUS` map explicitly handles `"finished"` -> `EXPIRED`. |
| `billing.customers.get()` or `billing.plans.get()` fails or returns null | Low | Low | Customer/plan lookups are non-blocking. If they fail, the status update has already succeeded. Notifications are skipped with a WARN log. Fallbacks: `planName` defaults to `'Plan'`, `customerName` falls back to `customer.email` then `'Usuario'`. |
| `currentPeriodEnd` is a past date for cancelled subscriptions | Medium | Low | If `currentPeriodEnd` is in the past, the email would show "your access continues until [past date]" which is confusing. Mitigation: only include `currentPeriodEnd` in emails when the date is in the future (see Step 9 in Section 10.1). |
| `planId` varchar vs UUID type mismatch in `billing.plans.get()` | Low | Low | `billing_subscriptions.plan_id` is varchar while `billing_plans.id` is UUID. QZPay `billing.plans.get()` handles this internally. If lookup fails, caught by the non-blocking try/catch around customer/plan lookups. |

---

### 14. Implementation Phases

#### Phase 1: Core Sync Logic (Priority: Critical)

**Tasks:**

1. **Database migration**: Create `billing_subscription_event.dbschema.ts` in `packages/db/src/schemas/billing/`. Update barrel export in `packages/db/src/schemas/billing/index.ts`. Generate and apply migration.
2. **Zod schema**: Create `packages/schemas/src/api/billing/subscription-event.schema.ts`. Update barrel export in `packages/schemas/src/api/billing/index.ts`.
3. **Status mapping constant**: Create `QZPAY_TO_HOSPEDA_STATUS` map and notification helper functions (`shouldSendCancelledEmail`, etc.) in `subscription-logic.ts`.
4. **Business logic**: Create `subscription-logic.ts` with `processSubscriptionUpdated()` function.
5. **Handler rewrite**: Replace `subscription-handler.ts` body to call `processSubscriptionUpdated()`.
6. **Retry job update**: Split the combined `payment.created` + `subscription_preapproval.updated` case in `webhook-retry.job.ts` (lines 165-174). Keep `payment.created` as auto-resolve. Route `subscription_preapproval.updated` to new `retrySubscriptionUpdated()` function.
7. **Tests for Phase 1**: Unit tests for status mapping, processSubscriptionUpdated logic, handler, and retry integration.

**Estimated files changed:** 5 modified, 3 new

#### Phase 2: Notifications (Priority: High)

**Tasks:**

8. **NotificationType additions**: Add 3 new enum values and `SubscriptionLifecyclePayload` interface to `notification.types.ts`.
9. **Subject patterns**: Add 3 new subject patterns to `subject-builder.ts`.
10. **Category mappings**: Add 3 new entries to `notification-categories.ts`.
11. **Email templates**: Create 3 new React Email templates in `templates/subscription/` with barrel export (`index.ts`). Update `templates/index.ts`. Use `.js` extensions in imports. Set `showUnsubscribe={false}` on EmailLayout.
12. **Template selection**: Add 3 cases to `selectTemplate()` switch in `notification.service.ts`.
13. **Notification functions**: Add 3 new functions to `notifications.ts` in the webhook directory. Use RO-RO pattern. Include `mpSubscriptionId` and `previousStatus` as explicit params in the cancelled function.
14. **Wire notifications**: Call notification functions from `processSubscriptionUpdated()` based on transition rules.
15. **Tests for Phase 2**: Unit tests for templates, notification dispatch, and idempotency.

**Estimated files changed:** 6 modified, 5 new

#### Phase 3: Admin Visibility (Priority: Medium)

**Tasks:**

16. **Admin type updates**: Add `'paused'` to `SubscriptionStatus` type in `types.ts`. Add `paused` cases to `getStatusVariant()` and `getStatusLabel()` in `utils.ts`. Add `paused` status label to all 3 i18n locale files (`es`, `en`, `pt`). See Section 26 for exact changes.
17. **Admin API route**: Create `apps/api/src/routes/billing/admin/subscription-events.ts`. Mount in billing admin router index.ts under `/subscriptions` path using `app.route('/subscriptions', subscriptionEventsRoute)`. Use `c.json()` for response (NOT `ResponseFactory.success()` which does not exist).
18. **Admin query hook**: Add `fetchSubscriptionEvents()` and `useSubscriptionEventsQuery` to `apps/admin/src/features/billing-subscriptions/hooks.ts` using `fetchApi()` pattern.
19. **Details dialog update**: Add "Historial" tab to `SubscriptionDetailsDialog.tsx` using `Tabs` from `@/components/ui-wrapped` (barrel import). Import `useState` from React if not already imported. See Section 11.2 for complete JSX.
20. **i18n keys for history tab**: Add translation keys for the history tab labels, column headers, source labels, and pagination to all 3 locale files. See Section 23.
21. **Tests for Phase 3**: Integration test for the admin endpoint, component test for the timeline UI.

**Estimated files changed:** 8 modified, 1 new

---

### 15. Testing Strategy

#### Unit Tests

All test file paths below are relative to `apps/api/` (except notification templates which are in `packages/notifications/`):

| Test File | What It Tests |
|---|---|
| `apps/api/test/webhooks/subscription-logic.test.ts` | `processSubscriptionUpdated()`: all status mappings, unknown status handling, subscription not found, same status no-op, DB update fields, audit log insert, error propagation, `canceled`/`cancelled` spelling mapping |
| `apps/api/test/webhooks/subscription-handler.test.ts` | Handler wiring: calls processSubscriptionUpdated, marks event processed on success, propagates error on failure |
| `apps/api/test/cron/webhook-retry.job.test.ts` (modify) | Add test: `subscription_preapproval.updated` events are retried with business logic (not auto-resolved). Also verify `payment.created` still auto-resolves after the case split. |
| `packages/notifications/test/templates/subscription-templates.test.ts` | Template rendering: correct Spanish text, handles missing optional fields, CTA links are correct, `showUnsubscribe` is false |

#### Mocking Strategy

For `processSubscriptionUpdated()` tests, mock the following:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. MercadoPago API call (paymentAdapter)
const mockPaymentAdapter = {
    subscriptions: {
        retrieve: vi.fn()  // Returns QZPayProviderSubscription
    }
};

// 2. extractMPSubscriptionEventData helper
vi.mock('@qazuor/qzpay-mercadopago', () => ({
    extractMPSubscriptionEventData: vi.fn().mockReturnValue({
        subscriptionId: 'mp-preapproval-abc123'
    })
}));

// 3. Drizzle database queries
vi.mock('@repo/db', () => ({
    getDb: () => mockDb,
    billingSubscriptions: { id: 'id', mpSubscriptionId: 'mpSubscriptionId', deletedAt: 'deletedAt', status: 'status' },
    billingSubscriptionEvents: { subscriptionId: 'subscriptionId' }
}));
const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([mockLocalSubscription]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
};

// 4. Billing instance (local DB operations via QZPay)
const mockBilling = {
    customers: { get: vi.fn().mockResolvedValue(mockCustomer) },
    plans: { get: vi.fn().mockResolvedValue(mockPlan) },
};

// 5. Notification helper
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

// 6. Sentry
vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// 7. Logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
```

**Test fixture for webhook event:**
```typescript
// QZPayWebhookEvent only has: id, type, data, created
const mockWebhookEvent: QZPayWebhookEvent = {
    id: 'mp-event-12345',
    type: 'subscription_preapproval.updated',
    data: { id: 'mp-preapproval-abc123' },
    created: new Date('2026-03-06T12:00:00Z')
};

const mockLocalSubscription = {
    id: 'local-uuid-1',
    customerId: 'customer-uuid-1',
    planId: 'plan-uuid-1',
    status: 'active',
    mpSubscriptionId: 'mp-preapproval-abc123',
    canceledAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date('2026-04-01'),
    deletedAt: null
};

const mockMpSubscription = {
    id: 'mp-preapproval-abc123',
    status: 'canceled',  // QZPay-mapped (1 L)
    currentPeriodStart: new Date('2026-03-01'),
    currentPeriodEnd: new Date('2026-04-01'),
    cancelAtPeriodEnd: false,
    canceledAt: new Date('2026-03-06'),
    trialStart: null,
    trialEnd: null,
    metadata: {}
};

const mockCustomer = {
    id: 'customer-uuid-1',
    email: 'user@example.com',
    metadata: { name: 'Test User', userId: 'auth-user-1' }
};

const mockPlan = {
    id: 'plan-uuid-1',
    name: 'Propietario Basico'
};
```

#### Key Test Cases for `processSubscriptionUpdated()`

```
1. QZPay status "active" + local status "paused"
   -> updates to "active", creates audit log, sends reactivation email, NO admin alert

2. QZPay status "canceled" (1 L) + local status "active"
   -> updates to "cancelled" (2 L's), sets canceled_at, creates audit log,
      sends cancellation email + admin alert with mpSubscriptionId and previousStatus

3. QZPay status "paused" + local status "active"
   -> updates to "paused", creates audit log, sends suspension email

4. QZPay status "active" + local status "active"
   -> no-op (same status), no audit log, no notification

5. QZPay status "pending"
   -> no-op (pending is ignored), no audit log, no notification

6. QZPay status "finished" + local status "active"
   -> updates to "expired", creates audit log, NO notification

7. QZPay status "unknown_value"
   -> no-op, WARN log, Sentry alert, no notification

8. mp_subscription_id not found in local DB
   -> no-op, WARN log, event marked as processed

9. MercadoPago API call (retrieve) fails
   -> error propagates, event NOT marked as processed (enters dead letter)

10. Audit log insert fails
    -> subscription status update STILL succeeds, ERROR logged

11. Notification send fails
    -> subscription status update STILL succeeds, notification retried by retry system

12. extractMPSubscriptionEventData returns empty subscriptionId
    -> no-op, event marked as processed

13. billing/paymentAdapter not configured (getWebhookDependencies returns null)
    -> no-op, event marked as processed

14. Retry job: subscription_preapproval.updated retried with business logic
    -> full sync flow executed, NOT auto-resolved

15. Retry job: payment.created still auto-resolves after case split
    -> returns true without calling processSubscriptionUpdated

16. Subscription has deleted_at set (soft-deleted)
    -> not found by query (filtered by isNull), treated as "not found"

17. QZPay status "canceled" (1 L) + local already has canceled_at set
    -> updates status to "cancelled" (2 L's) but does NOT overwrite existing canceled_at

18. Local status "past_due" + QZPay status "active"
    -> updates to "active", sends reactivation email

19. Local status "trialing" + QZPay status "active"
    -> updates to "active", NO reactivation email (trial conversion handled elsewhere)

20. Local status "expired" + QZPay status "canceled"
    -> updates to "cancelled", creates audit log, NO cancellation email, NO admin alert
       (subscription already ended naturally, no point notifying)

21. Local status "active" + cancel_at_period_end=true + QZPay status "active"
    -> same status (active==active), step 6 returns early (no-op), cancel_at_period_end is NOT reset.
       This is acceptable: cancel_at_period_end will be reset when the subscription actually transitions
       through cancelled/paused and back to active. No webhook-driven fix needed for this edge case.

22. Local status "cancelled" + cancel_at_period_end=true + QZPay status "active"
    -> updates to "active", resets cancel_at_period_end to false, sends reactivation email
```

#### Integration Tests

| Test | What It Validates |
|---|---|
| Webhook end-to-end | POST webhook -> DB updated -> audit log created -> event marked processed |
| Dead letter retry | Failed event in dead letter -> retry job runs -> subscription synced |
| Admin events endpoint | GET returns correct events, paginated, sorted by created_at DESC |
| Idempotency | Same webhook delivered twice -> only one DB update, one audit log, one notification |

#### Manual QA Checklist

- [ ] In MercadoPago sandbox, cancel a subscription. Verify Hospeda DB shows `cancelled` (2 L's).
- [ ] In MercadoPago sandbox, pause a subscription. Verify Hospeda DB shows `paused`.
- [ ] In MercadoPago sandbox, reactivate a subscription. Verify Hospeda DB shows `active`.
- [ ] Verify cancellation email is received with correct plan name and period end date.
- [ ] Verify pause email is received with correct plan name and CTA link.
- [ ] Verify reactivation email is received with correct plan name and next billing date.
- [ ] Verify admin receives alert email on involuntary cancellation with mpSubscriptionId and previousStatus.
- [ ] In admin panel, open a subscription's details and verify "Historial" tab shows transitions.
- [ ] Kill the API server after a webhook is received but before processing completes. Verify the event enters dead letter queue and is retried successfully on next cron run.
- [ ] Send the same webhook event twice. Verify no duplicate DB updates or emails.

---

### 16. Environment Variables

**No new environment variables required.**

Existing variables used:
- `MERCADO_PAGO_ACCESS_TOKEN` .. used by `createMercadoPagoAdapter()` for API calls to fetch subscription details
- `MERCADO_PAGO_WEBHOOK_SECRET` .. used for webhook signature verification (existing)
- `ADMIN_NOTIFICATION_EMAILS` .. comma-separated list of admin emails for alert notifications (e.g., `admin1@hospeda.com,admin2@hospeda.com`)
- `HOSPEDA_SITE_URL` .. base URL for CTA links in email templates (e.g., `https://hospeda.tur.ar`)
- `RESEND_API_KEY` .. used by the notification service for email sending (existing)

---

### 17. Migration Notes

- The `billing_subscription_events` table is additive (no existing data affected).
- Schema file: `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts` (singular "event")
- Run `pnpm db:generate` from `packages/db` to create the migration, then `pnpm db:migrate` to apply.
- **Barrel exports**: Update `packages/db/src/schemas/billing/index.ts` to export the new schema AND `packages/schemas/src/api/billing/index.ts` to export the new Zod schema.
- **Legacy subscriptions**: Any `billing_subscriptions` row where `mp_subscription_id IS NULL` will be silently skipped by the webhook handler. Operators should populate this field for existing subscriptions if sync is needed.
- **Notification types**: Adding new values to the `NotificationType` enum is backward-compatible (no breaking changes to existing notification flows).
- **Rollback**: `DROP TABLE billing_subscription_events CASCADE;` and remove migration file. No data loss to existing tables.

---

### 18. Glossary & API Reference

This section provides a quick-reference for all external APIs, types, and imports used in this spec.

#### QZPay Types

| Type | Package | Description |
|---|---|---|
| `QZPayBilling` | `@qazuor/qzpay-core` | Main billing instance. Methods query the LOCAL PostgreSQL database (not MercadoPago API). |
| `QZPayMercadoPagoAdapter` | `@qazuor/qzpay-mercadopago` | MercadoPago API adapter. Used for external HTTP calls to MercadoPago. |
| `QZPayProviderSubscription` | `@qazuor/qzpay-core` | Return type of `retrieve()`. Fields: `id: string`, `status: string`, `currentPeriodStart: Date`, `currentPeriodEnd: Date`, `cancelAtPeriodEnd: boolean`, `canceledAt: Date \| null`, `trialStart: Date \| null`, `trialEnd: Date \| null`, `metadata: Record<string, string>`. |
| `QZPayWebhookEvent` | `@qazuor/qzpay-core` | Webhook event object. Fields: `id: string`, `type: string`, `data: unknown`, `created: Date`. **NOTE**: Does NOT have `liveMode`, `dateCreated`, or `action` fields. |
| `QZPayWebhookHandler` | `@qazuor/qzpay-hono` | Type for webhook handler functions: `(c: Context, event: QZPayWebhookEvent) => Promise<Response \| undefined>`. |

#### QZPay Methods

| Method | Signature | Returns | Calls |
|---|---|---|---|
| `paymentAdapter.subscriptions.retrieve(id)` | `(providerSubscriptionId: string) => Promise<QZPayProviderSubscription>` | `QZPayProviderSubscription` with QZPay-mapped status | `GET /preapproval/{id}` on MercadoPago API |
| `billing.customers.get(id)` | `(customerId: string) => Promise<QZPayCustomer \| null>` | Customer object with `email`, `name` (top-level, nullable), `externalId`, `metadata: Record<string, string>` (may contain custom `name` and `userId` keys). Existing code accesses name via `metadata.name` with fallback to `email`. | Local DB query |
| `billing.plans.get(id)` | `(planId: string) => Promise<QZPayPlan \| null>` | Plan object with `name` | Local DB query |
| `extractMPSubscriptionEventData(event)` | `(event: QZPayWebhookEvent) => { subscriptionId, status?, payerId?, planId? }` | Extracted webhook data | Pure function (no I/O) |

#### QZPay Constants

| Constant | Package | Values |
|---|---|---|
| `MERCADOPAGO_SUBSCRIPTION_STATUS` | `@qazuor/qzpay-mercadopago` | `{ pending: "pending", authorized: "active", paused: "paused", cancelled: "canceled" }` |
| `QZPAY_SUBSCRIPTION_STATUS` | `@qazuor/qzpay-core` | `{ ACTIVE: "active", TRIALING: "trialing", PAST_DUE: "past_due", PAUSED: "paused", CANCELED: "canceled", UNPAID: "unpaid", INCOMPLETE: "incomplete", INCOMPLETE_EXPIRED: "incomplete_expired" }` |

#### Hospeda Imports

| Symbol | Import Path | Purpose |
|---|---|---|
| `getDb` | `@repo/db` | Get the Drizzle DB instance (singleton, initialized at app startup) |
| `billingSubscriptions` | `@repo/db` | Drizzle table reference for `billing_subscriptions` (re-exported from `@qazuor/qzpay-drizzle`) |
| `billingSubscriptionEvents` | `@repo/db` | Drizzle table reference for `billing_subscription_events` (new, Hospeda-local) |
| `SubscriptionStatusEnum` | `@repo/schemas` | Enum: `ACTIVE='active'`, `TRIALING='trialing'`, `PAST_DUE='past_due'`, `PAUSED='paused'`, `CANCELLED='cancelled'` (2 L's), `EXPIRED='expired'` |
| `apiLogger` | `../../../utils/logger` (relative from webhook handlers) | Structured logger for API app |
| `sendNotification` | `../../../utils/notification-helper` (relative from webhook handlers) | Fire-and-forget notification dispatch. Signature: `(payload: NotificationPayload, options?: SendNotificationOptions) => Promise<void>` |
| `getWebhookDependencies` | `./utils` (relative from webhook handlers) | Returns `{ billing: QZPayBilling, paymentAdapter: QZPayMercadoPagoAdapter } \| null` |
| `markEventProcessedByProviderId` | `./utils` (relative from webhook handlers) | Marks webhook event as processed. Signature: `({ providerEventId: string }) => Promise<void>` |
| `getQZPayBilling` | `../middlewares/billing` (relative from cron jobs) | Get QZPay billing instance |
| `createMercadoPagoAdapter` | `@repo/billing` | Create a new MercadoPago adapter instance |
| `createRouter` | `../../../utils/create-app` (relative from admin routes) | Create a new Hono router |
| `ResponseFactory` | `../../../utils/response-factory` (relative from admin routes) | Standard API response helper |
| `fetchApi` | `@/lib/api/client` (admin app) | Admin app API client. Signature: `<T>({ path: string, ... }) => Promise<{ data: T }>` |
| `Tabs, TabsList, TabsTrigger, TabsContent` | `@/components/ui-wrapped` (admin app, barrel import) | Radix UI Tabs wrapper from shadcn |

#### Notification Template Imports

All template files must use `.js` extensions in their imports (required by the package's module resolution). Use **individual component imports** (NOT the barrel `../components/index.js`), matching the existing template pattern:

```typescript
import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { EmailLayout } from '../components/layout.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDate } from '../utils/index.js';
```

---

### 19. `retrieve()` Data Flow Documentation

This section documents exactly what happens when `paymentAdapter.subscriptions.retrieve(mpPreapprovalId)` is called.

#### Call Chain

```
Your code calls:
  paymentAdapter.subscriptions.retrieve('mp-preapproval-abc123')
    |
    v
QZPayMercadoPagoSubscriptionAdapter.retrieve()
    |
    +--[1]--> Calls MercadoPago API: GET /preapproval/mp-preapproval-abc123
    |         Returns raw MP response with fields including:
    |           - id: string
    |           - status: "pending" | "authorized" | "paused" | "cancelled" | "finished" | ...
    |           - date_created: string
    |           - auto_recurring: { frequency, frequency_type }
    |           - last_modified: string
    |
    +--[2]--> Calls this.mapToProviderSubscription(preapproval, autoRecurring)
    |           |
    |           +--[a]--> Calls this.mapStatus(preapproval.status ?? "pending")
    |           |           |
    |           |           v
    |           |         Looks up MERCADOPAGO_SUBSCRIPTION_STATUS[mpStatus]
    |           |           - "authorized" -> "active"
    |           |           - "paused" -> "paused"
    |           |           - "cancelled" -> "canceled" (1 L)
    |           |           - "pending" -> "pending"
    |           |           - ANY OTHER VALUE -> returned as-is (passthrough)
    |           |           Example: "finished" -> "finished" (not in map)
    |           |
    |           +--[b]--> Constructs QZPayProviderSubscription:
    |                       {
    |                         id: preapproval.id,
    |                         status: mappedStatus,
    |                         currentPeriodStart: new Date(date_created),
    |                         currentPeriodEnd: calculated from startDate + auto_recurring,
    |                         cancelAtPeriodEnd: false,
    |                         canceledAt: (status === "cancelled" ? last_modified : null),
    |                         trialStart: null,
    |                         trialEnd: null,
    |                         metadata: {}
    |                       }
    |
    v
Returns QZPayProviderSubscription to your code
```

#### Status Flow Example: Cancellation

```
MercadoPago subscription status: "cancelled" (raw MP value)
  |
  v
mapStatus("cancelled") -> MERCADOPAGO_SUBSCRIPTION_STATUS["cancelled"] -> "canceled" (1 L)
  |
  v
QZPayProviderSubscription.status = "canceled" (1 L, QZPay convention)
  |
  v
QZPAY_TO_HOSPEDA_STATUS["canceled"] -> SubscriptionStatusEnum.CANCELLED = "cancelled" (2 L's)
  |
  v
billing_subscriptions.status is updated to "cancelled" (Hospeda convention)
```

#### Status Flow Example: Natural End (finished)

```
MercadoPago subscription status: "finished" (raw MP value)
  |
  v
mapStatus("finished") -> not in MERCADOPAGO_SUBSCRIPTION_STATUS -> "finished" (passthrough)
  |
  v
QZPayProviderSubscription.status = "finished" (passed through unchanged)
  |
  v
QZPAY_TO_HOSPEDA_STATUS["finished"] -> SubscriptionStatusEnum.EXPIRED = "expired"
  |
  v
billing_subscriptions.status is updated to "expired"
```

#### `currentPeriodEnd` Behavior

The `currentPeriodEnd` returned by `retrieve()` is **calculated** by QZPay based on the subscription's `date_created` and `auto_recurring` frequency. It is NOT a field directly from MercadoPago's API. This is an approximation but sufficient for email notifications (showing "your access continues until X").

**Important**: For cancelled subscriptions that have been inactive for a while, `currentPeriodEnd` may be a past date. The implementation must check `currentPeriodEnd > now()` before including it in emails to avoid confusing messages like "your access continues until [past date]". If the date is in the past, the `currentPeriodEnd` field is omitted from the notification payload and the email template renders without the access end date line.

---

### 20. Audit Trail: Changes from Previous Versions

#### Version 6 (current) - Pre-implementation review audit

82. **FIXED**: `customerName` fallback changed from hardcoded `'Usuario'` to `customer?.email ?? 'Usuario'` in Step 9 (Section 10.1). This matches the existing pattern in `notifications.ts` and `payment-logic.ts` where `customer.email` is used as the primary fallback. Added documentation of the fallback chain: `metadata.name` → `customer.email` → `'Usuario'`.
83. **FIXED**: Notification type count verified as 14 in Sections 9.1 and 9.6 (SUBSCRIPTION_PURCHASE through FEEDBACK_REPORT = 14 values).
84. **ADDED**: Non-blocking error handling for `billing.customers.get()` and `billing.plans.get()` failures in Step 9 (Section 10.1). If either lookup fails, the status update (already completed in step 7-8) is preserved and notifications are skipped with a WARN log.
85. **ADDED**: `currentPeriodEnd` past-date validation in Step 9 (Section 10.1). Only includes the date in email payloads if `currentPeriodEnd > now()`. Prevents confusing "your access continues until [past date]" messages. Added documentation in Section 19 (`currentPeriodEnd` Behavior).
86. **ADDED**: Three new risks to Section 13: customer/plan lookup failures (Low/Low), `currentPeriodEnd` past date (Medium/Low), and `planId` varchar/UUID mismatch (Low/Low).
87. **FIXED**: Glossary entry for `billing.customers.get()` (Section 18) updated to accurately describe the `QZPayCustomer` type. The customer has a top-level `name` field (nullable) and `externalId`, plus `metadata: Record<string, string>` which may contain custom `name` and `userId` keys. Existing code accesses name via `metadata.name` with fallback to `email`.
88. **ADDED**: `planId` type mismatch note in Step 9 (Section 10.1) documenting that `billing_subscriptions.plan_id` is varchar while `billing_plans.id` is UUID.

#### Version 5 - Exhaustive codebase cross-verification audit

74. **FIXED (CRITICAL)**: `QZPayWebhookEvent` interface corrected. The actual interface (from `@qazuor/qzpay-core@1.1.0`) only has 4 fields: `id: string`, `type: string`, `data: unknown`, `created: Date`. Previous versions incorrectly documented `liveMode`, `dateCreated`, and `action` which do NOT exist. Fixed in: Section 10.3 (`reconstructedEvent`), Section 15 (`mockWebhookEvent`), Section 18 (Glossary).
75. **FIXED (IMPORTANT)**: Template import pattern in Section 18 (Notification Template Imports) corrected from barrel import (`../components/index.js`) to individual component imports (`../components/button.js`, `../components/layout.js`, etc.) to match existing template code and Sections 9.5/22. The barrel pattern was a contradictory leftover.
76. **FIXED (GAP)**: Added `cancel_at_period_end` reset rule in Step 7 of Section 10.1. When a subscription is reactivated (new status `active`) and `cancel_at_period_end` is `true`, it must be reset to `false`. Updated AC in US-01 (Section 2) accordingly.
77. **FIXED (GAP)**: Added `expired` → `cancelled` exclusion rule in Section 6 transition table and `shouldSendCancelledEmail`/`shouldSendAdminAlert` helpers. If `previousStatus` is `expired`, no cancellation email or admin alert is sent (subscription already ended naturally).
78. **ADDED**: Note in Step 5 (Section 10.1) about `mp_subscription_id` assumed uniqueness and `plan_id` being varchar (not UUID) despite `billing_plans.id` being UUID.
79. **ADDED**: Note in Step 7 (Section 10.1) explaining why `updatedAt` must be set manually (Drizzle `defaultNow()` only applies on INSERT).
80. **ADDED**: `formatDate` import clarification in Section 11.2 note. Already imported in SubscriptionDetailsDialog (line 15 from `./utils`), signature is `formatDate(date: string, locale?: string)`.
81. **ADDED**: 4 new test cases (#20-#22) in Section 15: `expired→cancelled` no notification, `cancel_at_period_end` reset on reactivation.
82. **ADDED**: `expired → cancelled` and `expired → active` rows in transition rules table (Section 6).

#### Version 4 - Full codebase verification audit

57. **FIXED**: `formatDate()` call in template Section 22 changed from `formatDate(new Date(currentPeriodEnd), 'es')` to `formatDate({ dateString: currentPeriodEnd })` to match actual function signature in `packages/notifications/src/templates/utils/format-helpers.ts`.
58. **FIXED**: `ResponseFactory.success(c, {...})` replaced with `c.json({ success: true, ... })` in admin API route. `ResponseFactory` only has OpenAPI schema generators, not a `.success()` method.
59. **FIXED**: Status badge mappings in Section 24 corrected to match actual `getStatusVariant()` values: `expired` is `outline` (not `secondary`), `past_due` is `outline` (not `destructive`).
60. **FIXED**: `selectTemplate()` cases changed from enum references (`NotificationType.SUBSCRIPTION_CANCELLED`) to string literals (`'subscription_cancelled'`) to match existing 14 cases pattern.
61. **FIXED**: Template import pattern in Section 9.5 corrected from barrel import (`../components/index.js`) to individual imports (`../components/button.js`, etc.) to match existing templates.
62. **FIXED**: Drizzle schema `metadata` field now uses `.$type<Record<string, unknown>>()` for TypeScript typing, matching existing schemas.
63. **FIXED**: Removed redundant `.notNull()` from `id` column in Drizzle schema (`.primaryKey()` already implies NOT NULL), matching existing pattern in `billing_addon_purchase.dbschema.ts`.
64. **ADDED**: Complete JSX template for `subscription-paused.tsx` (Section 22.2).
65. **ADDED**: Complete JSX template for `subscription-reactivated.tsx` (Section 22.3).
66. **ADDED**: Complete JSX for "Historial" tab in SubscriptionDetailsDialog (Section 11.2) with pagination, badges, and empty state.
67. **ADDED**: Section 26 - Admin Type Updates: `SubscriptionStatus` type, `getStatusVariant()`, `getStatusLabel()`, and i18n labels must be updated to include `paused`.
68. **ADDED**: 5 additional files to MODIFY checklist (Section 21): `types.ts`, `utils.ts`, 3 i18n locale files.
69. **ADDED**: Phase 3 tasks 16 (admin type updates) and 20 (i18n keys for history tab).
70. **ADDED**: `useState` import note in Section 11.2.
71. **ADDED**: Full absolute paths for test files in Section 15.
72. **ADDED**: Error handling with try/catch in admin API route.
73. **ADDED**: `apiLogger` import in admin API route for error logging.

#### Version 3 - Exhaustive cross-reference audit

39. **FIXED**: Import path in notification helpers section 10.4: `'../../utils/notification-helper'` (2 levels) -> `'../../../utils/notification-helper'` (3 levels, correct path from `routes/webhooks/mercadopago/`).
40. **FIXED**: Logger import in notification helpers: `'../../../lib/logger'` -> `'../../../utils/logger'` (correct path).
41. **FIXED**: Drizzle index syntax changed from array `(table) => [...]` to object `(table) => ({...})` to match existing schemas in `packages/db/src/schemas/billing/`.
42. **FIXED**: Tabs import changed from `'@/components/ui-wrapped/Tabs'` to `'@/components/ui-wrapped'` (barrel import, matching existing pattern in `TabsLayout.tsx`).
43. **FIXED**: Removed dead `billing` parameter from all 3 notification helper functions (`sendSubscriptionCancelledNotification`, `sendSubscriptionPausedNotification`, `sendSubscriptionReactivatedNotification`). The `billing` instance is used in `processSubscriptionUpdated()` to look up customer/plan data, not in the notification helpers.
44. **FIXED**: Response 404 removed from admin endpoint spec. Returns 200 with empty array instead (simpler, no extra DB query needed).
45. **FIXED**: Permission check documentation clarified. No individual `PermissionEnum.BILLING_READ_ALL` check needed since admin auth middleware already restricts `/api/v1/admin/*`.
46. **ADDED**: Complete imports block for `subscription-logic.ts` (Sentry, apiLogger, drizzle-orm, all notification functions).
47. **ADDED**: Note that `subscription-logic.ts` is a **new file** to create from scratch.
48. **ADDED**: `BaseNotificationPayload` interface documentation for dev junior context.
49. **ADDED**: Payload flow documentation (sendNotification -> notificationService -> selectTemplate -> template props).
50. **ADDED**: `.js` extension requirement for retry job imports.
51. **ADDED**: Note that `createMercadoPagoAdapter` and `processSubscriptionUpdated` are **new imports** for `webhook-retry.job.ts`.
52. **ADDED**: Complete file checklist (Section 21) with 8 files to create, 18 files to modify.
53. **ADDED**: Full template JSX example for `subscription-cancelled.tsx` (Section 22).
54. **ADDED**: i18n translation keys for admin timeline tab (Section 23).
55. **ADDED**: Status badge color mapping for admin timeline (Section 24).
56. **ADDED**: Edge case documentation for `expired` -> `active` and `trialing` -> `active` transitions (Section 25).

#### Version 2 - Initial exhaustive code audit

This version corrects the following issues found during exhaustive code audit:

1. **FIXED**: `paymentAdapter.preapprovals.get()` does not exist. Changed to `paymentAdapter.subscriptions.retrieve()` which is the actual method on `QZPayMercadoPagoSubscriptionAdapter`.
2. **FIXED**: Added `extractMPSubscriptionEventData` helper usage from `@qazuor/qzpay-mercadopago` (canonical way to extract subscription data from webhook events).
3. **FIXED**: Zod schema path changed from `packages/schemas/src/billing/` (does not exist) to `packages/schemas/src/api/billing/` (actual location).
4. **FIXED**: Admin API endpoint mounting documented with exact router structure (`app.route('/subscriptions', subscriptionEventsRoute)` in admin billing router).
5. **FIXED**: `getDb` import changed from `'../../../lib/db'` (does not exist) to `'@repo/db'` (actual import used across 31+ files).
6. **FIXED**: `billingSubscriptions` import changed from `'@repo/db/billing'` to `'@repo/db'` (correct re-export path).
7. **FIXED**: Schema file naming changed from `billing_subscription_events.dbschema.ts` (plural) to `billing_subscription_event.dbschema.ts` (singular, matching existing pattern).
8. **FIXED**: Admin hook pattern changed from `apiClient.get()` to `fetchApi({ path: '...' })` (actual pattern in admin app).
9. **FIXED**: Status mapping completely rewritten to use QZPay-mapped statuses instead of raw MP statuses, reflecting actual `retrieve()` behavior and `mapStatus` passthrough logic.
10. **FIXED**: `canceled`/`cancelled` spelling mismatch documented and handled (QZPay 1L vs Hospeda 2L).
11. **FIXED**: Permission changed from `BILLING_VIEW`/`BILLING_MANAGE_ALL` to `BILLING_READ_ALL` (the only billing permission that exists).
12. **FIXED**: Admin route path verified as `routes/billing/admin/` (matching existing convention).
13. **FIXED**: Retry job case split documented (was combined with `payment.created`, lines 165-174).
14. **FIXED**: Drizzle schema location in `packages/db/src/schemas/billing/` (not `packages/db/src/billing/schema.ts`).
15. **FIXED**: SubscriptionDetailsDialog correctly referenced at 337 lines.
16. **FIXED**: Notification functions use RO-RO pattern (project standard) with explicit note about intentional divergence from legacy positional params.
17. **FIXED**: `mpSubscriptionId` and `previousStatus` added as explicit parameters to `sendSubscriptionCancelledNotification` (were missing but used inside function).
18. **FIXED**: metadata column consistency between SQL DDL and Drizzle schema (both now `NOT NULL`).
19. **ADDED**: `extractMPSubscriptionEventData` helper documentation with implementation details.
20. **ADDED**: `QZPayProviderSubscription` interface with all field types documented.
21. **ADDED**: `retrieve()` data flow diagram showing the full call chain from API to mapped status.
22. **ADDED**: `MERCADOPAGO_SUBSCRIPTION_STATUS` and `QZPAY_SUBSCRIPTION_STATUS` constant values.
23. **ADDED**: Complete Glossary & API Reference section with all imports, types, and method signatures.
24. **ADDED**: `past_due` status handling in transition rules table.
25. **ADDED**: Idempotency layers documentation (Layer 1: webhook events table, Layer 2: status comparison).
26. **ADDED**: `.js` extension requirement for template imports.
27. **ADDED**: `showUnsubscribe={false}` requirement for transactional email templates.
28. **ADDED**: `previewText` prop requirement for EmailLayout.
29. **ADDED**: Complete notification function implementations with all parameters.
30. **ADDED**: `createRouter` and `ResponseFactory` import documentation for admin route.
31. **ADDED**: Barrel export update for `packages/schemas/src/api/billing/index.ts`.
32. **ADDED**: `currentPeriodEnd` sourcing documentation (from `retrieve()` response, calculated by QZPay).
33. **ADDED**: `reconstructedEvent` pattern for dead letter retry (converting stored payload back to `QZPayWebhookEvent`).
34. **ADDED**: Notification helper functions (`shouldSendReactivationEmail`, etc.) with explicit logic.
35. **ADDED**: Test cases 18-19 for `past_due` and `trialing` transition scenarios.
36. **ADDED**: Admin route complete implementation snippet with Drizzle queries.
37. **ADDED**: `RESEND_API_KEY` to environment variables list.
38. **ADDED**: Status flow examples (cancellation and finished) with step-by-step mapping.

---

### 21. File Checklist

Complete list of files to create and modify, in implementation order.

#### Files to CREATE (8 files)

| # | File Path | Phase | Description |
|---|-----------|-------|-------------|
| 1 | `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts` | 1 | Drizzle schema for audit table |
| 2 | `packages/schemas/src/api/billing/subscription-event.schema.ts` | 1 | Zod schema for admin API response |
| 3 | `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` | 1 | Shared business logic (new file from scratch) |
| 4 | `packages/notifications/src/templates/subscription/subscription-cancelled.tsx` | 2 | Cancellation email template |
| 5 | `packages/notifications/src/templates/subscription/subscription-paused.tsx` | 2 | Suspension email template |
| 6 | `packages/notifications/src/templates/subscription/subscription-reactivated.tsx` | 2 | Reactivation email template |
| 7 | `packages/notifications/src/templates/subscription/index.ts` | 2 | Barrel export for templates |
| 8 | `apps/api/src/routes/billing/admin/subscription-events.ts` | 3 | Admin API route for events timeline |

#### Files to MODIFY (18 files)

| # | File Path | Phase | What to Change |
|---|-----------|-------|----------------|
| 1 | `packages/db/src/schemas/billing/index.ts` | 1 | Add `export * from './billing_subscription_event.dbschema.ts'` |
| 2 | `packages/schemas/src/api/billing/index.ts` | 1 | Add `export * from './subscription-event.schema.ts'` |
| 3 | `apps/api/src/routes/webhooks/mercadopago/subscription-handler.ts` | 1 | Replace body to call `processSubscriptionUpdated()` |
| 4 | `apps/api/src/cron/jobs/webhook-retry.job.ts` | 1 | Split combined case (lines 165-174), add `retrySubscriptionUpdated()` function, add 3 new imports |
| 5 | `packages/notifications/src/types/notification.types.ts` | 2 | Add 3 enum values + `SubscriptionLifecyclePayload` interface + update union type |
| 6 | `packages/notifications/src/utils/subject-builder.ts` | 2 | Add 3 subject patterns inside `SUBJECT_PATTERNS` object |
| 7 | `packages/notifications/src/config/notification-categories.ts` | 2 | Add 3 entries to `NOTIFICATION_CATEGORY_MAP` object |
| 8 | `packages/notifications/src/services/notification.service.ts` | 2 | Add 3 cases to `selectTemplate()` switch, add imports for new templates |
| 9 | `packages/notifications/src/templates/index.ts` | 2 | Add `export * from './subscription/index.js'` |
| 10 | `apps/api/src/routes/webhooks/mercadopago/notifications.ts` | 2 | Add 3 new notification functions at end of file |
| 11 | `apps/admin/src/features/billing-subscriptions/hooks.ts` | 3 | Add `fetchSubscriptionEvents()` + `useSubscriptionEventsQuery` hook |
| 12 | `apps/admin/src/features/billing-subscriptions/SubscriptionDetailsDialog.tsx` | 3 | Wrap content in Tabs (import `useState` from React), add "Historial" tab |
| 13 | `apps/api/src/routes/billing/admin/index.ts` | 3 | Add import + mount `app.route('/subscriptions', subscriptionEventsRoute)` |
| 14 | `apps/admin/src/features/billing-subscriptions/types.ts` | 3 | Add `'paused'` to `SubscriptionStatus` union type (see Section 26.1) |
| 15 | `apps/admin/src/features/billing-subscriptions/utils.ts` | 3 | Add `paused` to `getStatusVariant()` and `getStatusLabel()` (see Section 26.2-26.3) |
| 16 | `packages/i18n/src/locales/es/admin-billing.json` | 3 | Add `paused` status label + history tab i18n keys (see Sections 23, 26.4) |
| 17 | `packages/i18n/src/locales/en/admin-billing.json` | 3 | Add `paused` status label + history tab i18n keys (see Sections 23, 26.4) |
| 18 | `packages/i18n/src/locales/pt/admin-billing.json` | 3 | Add `paused` status label + history tab i18n keys (see Sections 23, 26.4) |

#### Database Migration

After creating file #1, run from `packages/db/`:
```bash
pnpm db:generate   # Creates migration SQL
pnpm db:migrate    # Applies migration
```

---

### 22. Complete Email Template Example

Full implementation of `subscription-cancelled.tsx` to serve as reference for the other two templates.

**File**: `packages/notifications/src/templates/subscription/subscription-cancelled.tsx`

```tsx
import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { EmailLayout } from '../components/layout.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for the subscription cancelled email template
 */
export interface SubscriptionCancelledProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly currentPeriodEnd?: string;
    readonly baseUrl: string;
}

const styles = {
    section: {
        padding: '24px 0'
    },
    text: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px 0'
    },
    warningText: {
        color: '#92400e',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '16px 0',
        padding: '12px 16px',
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        border: '1px solid #fde68a'
    }
};

/**
 * Email template for subscription cancellation notification.
 * Sent when a subscription transitions to "cancelled" status via webhook.
 */
export function SubscriptionCancelled({
    recipientName,
    planName,
    currentPeriodEnd,
    baseUrl
}: SubscriptionCancelledProps) {
    const formattedPeriodEnd = currentPeriodEnd
        ? formatDate({ dateString: currentPeriodEnd })
        : null;

    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} ha sido cancelada`}
            showUnsubscribe={false}
        >
            <Section style={styles.section}>
                <Heading>Suscripcion cancelada</Heading>

                <Text style={styles.text}>
                    Hola {recipientName},
                </Text>

                <Text style={styles.text}>
                    Tu suscripcion al plan <strong>{planName}</strong> ha sido cancelada.
                </Text>

                {formattedPeriodEnd && (
                    <Text style={styles.text}>
                        Tu acceso continuara activo hasta el <strong>{formattedPeriodEnd}</strong>.
                    </Text>
                )}

                <InfoRow label="Plan" value={planName} />
                {formattedPeriodEnd && (
                    <InfoRow label="Acceso hasta" value={formattedPeriodEnd} />
                )}

                <Text style={styles.warningText}>
                    Si no realizaste esta cancelacion, contactanos para resolverlo.
                </Text>

                <Button href={`${baseUrl}/es/precios/propietarios`}>
                    Reactivar suscripcion
                </Button>
            </Section>
        </EmailLayout>
    );
}
```

#### 22.2 Complete Template: `subscription-paused.tsx`

**File**: `packages/notifications/src/templates/subscription/subscription-paused.tsx`

```tsx
import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { EmailLayout } from '../components/layout.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

/**
 * Props for the subscription paused email template
 */
export interface SubscriptionPausedProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly baseUrl: string;
}

const styles = {
    section: {
        padding: '24px 0'
    },
    text: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px 0'
    },
    warningText: {
        color: '#92400e',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '16px 0',
        padding: '12px 16px',
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        border: '1px solid #fde68a'
    }
};

/**
 * Email template for subscription pause/suspension notification.
 * Sent when a subscription transitions to "paused" status via webhook.
 */
export function SubscriptionPaused({
    recipientName,
    planName,
    baseUrl
}: SubscriptionPausedProps) {
    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} ha sido pausada`}
            showUnsubscribe={false}
        >
            <Section style={styles.section}>
                <Heading>Suscripcion pausada</Heading>

                <Text style={styles.text}>
                    Hola {recipientName},
                </Text>

                <Text style={styles.text}>
                    Tu suscripcion al plan <strong>{planName}</strong> ha sido pausada.
                </Text>

                <Text style={styles.warningText}>
                    Esto puede deberse a un problema con tu metodo de pago.
                    Actualiza tu metodo de pago para reactivar tu suscripcion.
                </Text>

                <InfoRow label="Plan" value={planName} />

                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>
                    Actualizar metodo de pago
                </Button>
            </Section>
        </EmailLayout>
    );
}
```

#### 22.3 Complete Template: `subscription-reactivated.tsx`

**File**: `packages/notifications/src/templates/subscription/subscription-reactivated.tsx`

```tsx
import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { EmailLayout } from '../components/layout.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for the subscription reactivated email template
 */
export interface SubscriptionReactivatedProps {
    readonly recipientName: string;
    readonly planName: string;
    readonly nextBillingDate?: string;
    readonly baseUrl: string;
}

const styles = {
    section: {
        padding: '24px 0'
    },
    text: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px 0'
    },
    successText: {
        color: '#065f46',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '16px 0',
        padding: '12px 16px',
        backgroundColor: '#ecfdf5',
        borderRadius: '8px',
        border: '1px solid #a7f3d0'
    }
};

/**
 * Email template for subscription reactivation confirmation.
 * Sent when a subscription transitions back to "active" from "paused" or "cancelled".
 */
export function SubscriptionReactivated({
    recipientName,
    planName,
    nextBillingDate,
    baseUrl
}: SubscriptionReactivatedProps) {
    const formattedNextBilling = nextBillingDate
        ? formatDate({ dateString: nextBillingDate })
        : null;

    return (
        <EmailLayout
            previewText={`Tu suscripcion al plan ${planName} esta activa nuevamente`}
            showUnsubscribe={false}
        >
            <Section style={styles.section}>
                <Heading>Suscripcion reactivada</Heading>

                <Text style={styles.text}>
                    Hola {recipientName},
                </Text>

                <Text style={styles.successText}>
                    Tu suscripcion al plan <strong>{planName}</strong> esta activa nuevamente.
                </Text>

                <InfoRow label="Plan" value={planName} />
                {formattedNextBilling && (
                    <InfoRow label="Proxima facturacion" value={formattedNextBilling} />
                )}

                <Button href={`${baseUrl}/es/mi-cuenta`}>
                    Ir al panel
                </Button>
            </Section>
        </EmailLayout>
    );
}
```

**Pattern notes for all three templates:**
- All three: `showUnsubscribe={false}` (TRANSACTIONAL), named export (no default), `.js` extension imports, `readonly` props.
- `formatDate` uses `{ dateString: string }` input (NOT `(Date, locale)` signature).

---

### 23. i18n Translation Keys for Admin

The following translation keys must be added to `@repo/i18n` under the `admin-billing` namespace. Add to all 3 locale files (`es.json`, `en.json`, `pt.json`).

**Spanish (`es`) values (primary):**

```json
{
    "admin-billing": {
        "subscriptions": {
            "detailsDialog": {
                "tabs": {
                    "details": "Detalles",
                    "history": "Historial"
                },
                "history": {
                    "title": "Historial de cambios",
                    "emptyState": "No hay cambios registrados para esta suscripcion.",
                    "columns": {
                        "date": "Fecha",
                        "transition": "Cambio de estado",
                        "source": "Origen",
                        "eventId": "ID evento MP"
                    },
                    "sources": {
                        "webhook": "Webhook",
                        "admin": "Admin",
                        "system": "Sistema",
                        "cron": "Cron",
                        "dead-letter-retry": "Reintento"
                    },
                    "pagination": {
                        "previous": "Anterior",
                        "next": "Siguiente",
                        "showing": "Mostrando {from}-{to} de {total}"
                    }
                }
            }
        }
    }
}
```

**English and Portuguese**: Translate the Spanish values accordingly.

---

### 24. Status Badge Colors for Admin Timeline

Use the `getStatusVariant()` utility from `apps/admin/src/features/billing-subscriptions/utils.ts` for status badges in the timeline.

**IMPORTANT**: The current `getStatusVariant()` does NOT include `paused`. You must update it as part of this spec (see Section 26 - Admin Type Updates). After the update, the full mapping will be:

| Status | Badge Variant | Visual |
|--------|--------------|--------|
| `active` | `default` (green) | Active state |
| `trialing` | `secondary` (gray) | Trial period |
| `paused` | `outline` (bordered) | Paused state (NEW) |
| `cancelled` | `destructive` (red) | Cancelled |
| `expired` | `outline` (bordered) | Natural end |
| `past_due` | `outline` (bordered) | Payment issues |

**NOTE**: The `expired` and `past_due` variants are `outline` (not `secondary`/`destructive`). These values match the CURRENT implementation in `utils.ts` lines 32-41.

For the transition arrow display, use a simple format: `<Badge>{previousStatus}</Badge> → <Badge>{newStatus}</Badge>`.

For `triggerSource`, use simple text badges with muted styling (no color coding needed).

---

### 25. Transition Edge Cases

#### `expired` -> `active`

This transition is **not expected** from MercadoPago. A `finished` (expired) subscription cannot be reactivated in MercadoPago's system.. the user must create a new subscription. However, the code handles it gracefully via the generic logic:

- `QZPAY_TO_HOSPEDA_STATUS["active"]` = `SubscriptionStatusEnum.ACTIVE`
- Since `expired` != `active`, the status updates
- `shouldSendReactivationEmail("expired", "active")` returns `false` (only triggers for `paused`, `cancelled`, or `past_due` -> `active`)
- No notification sent, but audit log is created

If this transition ever occurs, the Sentry + audit log will capture it for investigation.

#### `expired` -> `cancelled`

This transition is **unusual** but can occur if MercadoPago sends a cancellation event for an already-finished subscription. The code handles it gracefully:

- `QZPAY_TO_HOSPEDA_STATUS["canceled"]` = `SubscriptionStatusEnum.CANCELLED`
- Since `expired` != `cancelled`, the status updates and audit log is created
- `shouldSendCancelledEmail("expired", "cancelled")` returns `false` (excluded because `previousStatus === EXPIRED`)
- `shouldSendAdminAlert("expired", "cancelled")` returns `false` (same exclusion)
- No notifications sent, but the audit log records the transition for investigation

#### `trialing` -> `active` (Trial Conversion)

Handled by the existing trial conversion flow (separate from this spec). The `shouldSendReactivationEmail` helper explicitly excludes this transition by only checking for `paused`, `cancelled`, and `past_due` as previous statuses.

---

### 26. Admin Type Updates (Required Pre-requisite)

The current admin app does NOT support the `paused` status. The following files MUST be updated as part of Phase 3 (before the timeline tab can properly display paused subscriptions).

#### 26.1 Update `SubscriptionStatus` Type

**File**: `apps/admin/src/features/billing-subscriptions/types.ts` (line 4)

**Before:**
```typescript
export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired';
```

**After:**
```typescript
export type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'cancelled' | 'past_due' | 'expired';
```

#### 26.2 Update `getStatusVariant()` Utility

**File**: `apps/admin/src/features/billing-subscriptions/utils.ts` (lines 32-41)

**Before:**
```typescript
const variantMap: Record<
    SubscriptionStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    active: 'default',
    trialing: 'secondary',
    cancelled: 'destructive',
    past_due: 'outline',
    expired: 'outline'
};
```

**After:**
```typescript
const variantMap: Record<
    SubscriptionStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    active: 'default',
    trialing: 'secondary',
    paused: 'outline',
    cancelled: 'destructive',
    past_due: 'outline',
    expired: 'outline'
};
```

#### 26.3 Update `getStatusLabel()` Utility

**File**: `apps/admin/src/features/billing-subscriptions/utils.ts` (lines 52-58)

**Before:**
```typescript
const labels: Record<SubscriptionStatus, string> = {
    active: t('admin-billing.subscriptions.statuses.active'),
    trialing: t('admin-billing.subscriptions.statuses.trialing'),
    cancelled: t('admin-billing.subscriptions.statuses.cancelled'),
    past_due: t('admin-billing.subscriptions.statuses.pastDue'),
    expired: t('admin-billing.subscriptions.statuses.expired')
};
```

**After:**
```typescript
const labels: Record<SubscriptionStatus, string> = {
    active: t('admin-billing.subscriptions.statuses.active'),
    trialing: t('admin-billing.subscriptions.statuses.trialing'),
    paused: t('admin-billing.subscriptions.statuses.paused'),
    cancelled: t('admin-billing.subscriptions.statuses.cancelled'),
    past_due: t('admin-billing.subscriptions.statuses.pastDue'),
    expired: t('admin-billing.subscriptions.statuses.expired')
};
```

#### 26.4 Add i18n Label for `paused`

Add to the `statuses` object in all 3 locale files:

**`packages/i18n/src/locales/es/admin-billing.json`** (inside `subscriptions.statuses`):
```json
"paused": "Pausada"
```

**`packages/i18n/src/locales/en/admin-billing.json`** (inside `subscriptions.statuses`):
```json
"paused": "Paused"
```

**`packages/i18n/src/locales/pt/admin-billing.json`** (inside `subscriptions.statuses`):
```json
"paused": "Pausada"
```
