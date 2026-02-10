---
spec-id: SPEC-003
title: Billing System Production Readiness
type: improvement
complexity: high
status: approved
created: 2026-02-07T14:30:00.000Z
approved: 2026-02-07T14:45:00.000Z
---

## SPEC-003: Billing System Production Readiness

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Bring the Hospeda billing/monetization system to production readiness by resolving critical blockers, closing security gaps, achieving comprehensive test coverage, completing internationalization, optimizing performance, and adding end-to-end validation.

#### Motivation

A comprehensive audit identified 16 action items across 8 phases. The system has solid architecture (TypeScript strict mode, atomic promo code redemption, idempotent webhook processing, comprehensive DB indexes) but has critical blockers that prevent production deployment: disabled seed data, placeholder UI component, and missing webhook security enforcement.

#### Success Metrics

- All billing seed data loads successfully against QZPay schema
- PlanChangeDialog supports upgrade/downgrade with real API integration
- Webhook secret is mandatory in production mode
- Zero SQL injection patterns in codebase
- All billing services have >= 90% test coverage
- All 15 billing components use i18n (no hardcoded strings)
- BillingMetricsService uses singleton pattern
- E2E tests pass for complete payment flow

#### Target Users

- **Accommodation owners** (subscription management, plan changes, addons)
- **Complex managers** (subscription management)
- **Tourists** (free/paid plans, addons)
- **Admins** (billing metrics, webhook monitoring, notification logs)

### 2. User Stories & Acceptance Criteria

#### US-001: Billing Seed Data Initialization

**As a** DevOps engineer deploying to production,
**I want** billing seed data to load correctly,
**So that** the production database has plans, addons, entitlements, and limits.

**Acceptance Criteria:**

- **Given** a fresh database with migrations applied
  **When** `pnpm db:seed` is executed
  **Then** all billing plans (9), addons (5), entitlements (31), and limits (6) are inserted

- **Given** seed data already exists in the database
  **When** `pnpm db:seed` is executed again
  **Then** no duplicate records are created (upsert behavior)

- **Given** the QZPay schema version changes
  **When** seeds are run
  **Then** they remain compatible (validated by CI)

#### US-002: Plan Change (Upgrade/Downgrade)

**As an** accommodation owner with an active subscription,
**I want** to change my plan from the billing dashboard,
**So that** I can upgrade for more features or downgrade to save costs.

**Acceptance Criteria:**

- **Given** user has an active subscription on "Owner Basico"
  **When** they open PlanChangeDialog
  **Then** they see all available plans with pricing, highlighting current plan

- **Given** user selects a higher-tier plan (upgrade)
  **When** they confirm the change
  **Then** a prorated amount is calculated and shown before confirmation
  **And** the subscription is updated immediately
  **And** new entitlements are applied
  **And** a confirmation notification is sent

- **Given** user selects a lower-tier plan (downgrade)
  **When** they confirm the change
  **Then** the downgrade is scheduled for end of current billing period
  **And** current entitlements are maintained until period end
  **And** a confirmation notification is sent

- **Given** user is on a trial
  **When** they try to change plan
  **Then** they see a message that plan change is available after trial ends

- **Given** the API request fails
  **When** user confirms plan change
  **Then** an error message is shown with retry option
  **And** no subscription state is modified

#### US-003: Webhook Security Enforcement

**As a** security engineer,
**I want** webhook signature verification to be mandatory in production,
**So that** attackers cannot forge payment webhooks.

**Acceptance Criteria:**

- **Given** production mode (`sandbox === false`)
  **When** MercadoPago adapter is created without webhook secret
  **Then** an error is thrown preventing app startup

- **Given** sandbox mode
  **When** adapter is created without webhook secret
  **Then** a warning is logged but app starts normally

- **Given** a webhook arrives with invalid signature
  **When** it is processed
  **Then** it is rejected with 401 status
  **And** the attempt is logged

#### US-004: Billing i18n Support

**As a** user browsing in English,
**I want** billing components to display in my language,
**So that** I can understand my subscription, payments, and addons.

**Acceptance Criteria:**

- **Given** locale is set to `en`
  **When** any billing component renders
  **Then** all text is displayed in English

- **Given** locale is set to `es` (default)
  **When** any billing component renders
  **Then** all text is displayed in Spanish

- **Given** a translation key is missing
  **When** the component renders
  **Then** the Spanish fallback text is shown

### 3. UX Considerations

#### Plan Change Flow

1. User clicks "Cambiar de plan" on SubscriptionStatusCard
2. PlanChangeDialog opens showing available plans
3. Plans displayed as cards with: name, price, feature highlights, current plan badge
4. Upgrade plans show prorated cost for remainder of period
5. Downgrade plans show "effective at period end" notice
6. User selects plan -> confirmation step with price summary
7. User confirms -> loading state -> success/error feedback
8. On success: dialog closes, subscription card updates

#### Error States

- API unreachable: "No se pudo conectar. Reintenta en unos minutos."
- Payment failure: "El pago no pudo procesarse. Verifica tu metodo de pago."
- Promo code invalid: Specific error messages per error code
- Webhook processing failure: logged to dead letter queue, admin notified

#### Accessibility

- All billing components must have proper ARIA labels
- Error states must use `role="alert"`
- Loading states must use `aria-busy="true"` and `role="status"`
- Plan selection must be keyboard navigable
- Color contrast must meet WCAG 2.1 AA

### 4. Out of Scope

- New billing features (new plans, new addons)
- Pricing changes
- UI redesign of billing components
- Integration with payment providers other than MercadoPago
- Mobile app billing
- Billing analytics dashboard redesign

---

## Part 2 - Technical Analysis

### 5. Architecture

#### Affected Components

```
packages/billing/          # Config validation, webhook secret enforcement
packages/seed/             # QZPay schema fix, re-enable seeds
packages/db/               # New migration (expiredAt index)
packages/i18n/             # New billing namespace (es + en)
apps/api/src/services/     # SQL fix, promo migration, singleton metrics
apps/api/src/routes/       # Webhook tests
apps/api/src/middlewares/   # Billing middleware tests
apps/web/src/components/billing/  # PlanChangeDialog, error boundaries, i18n, props cleanup
apps/web/src/lib/sentry.ts       # Release config
apps/api/src/lib/sentry.ts       # Release config
apps/admin/src/lib/sentry/       # Release config
```

#### Data Flow for Plan Change

```
PlanChangeDialog (React)
  -> fetch GET /api/v1/billing/plans (list available plans)
  -> fetch POST /api/v1/billing/subscriptions/:id/change-plan
     -> SubscriptionService.changePlan()
       -> QZPay SDK: update subscription
       -> Update entitlements
       -> Send notification
     <- Return new subscription state
  <- Update UI
```

### 6. Data Model Changes

#### New Migration: Add index on billing_notification_log.expired_at

```sql
CREATE INDEX IF NOT EXISTS "idx_notification_log_expired_at"
  ON "billing_notification_log" ("expired_at");
```

#### Promo Code Migration: Seed local codes to DB

Insert the 3 local config promo codes into `billing_promo_codes` table:

- HOSPEDA_FREE (100% off, permanent, internal)
- LANZAMIENTO_50 (50% off, 3 months, max 100 uses)
- BIENVENIDO_30 (30% off, 1 month, max 500 uses)

### 7. API Design

#### GET /api/v1/billing/plans

Returns available plans for plan change dialog.

**Auth:** Required (user must have active subscription)

**Response 200:**

```json
{
  "data": [
    {
      "id": "plan_owner_pro",
      "slug": "owner-pro",
      "name": "Owner Pro",
      "category": "owner",
      "monthlyPriceArs": 15000000,
      "annualPriceArs": 150000000,
      "entitlements": ["CAN_LIST_ACCOMMODATION", "CAN_USE_RICH_DESCRIPTION"],
      "limits": [{"key": "max_accommodations", "value": 10}],
      "isCurrent": false
    }
  ]
}
```

#### POST /api/v1/billing/subscriptions/:id/change-plan

**Auth:** Required (subscription owner only)

**Request:**

```json
{
  "newPlanId": "plan_owner_pro",
  "billingInterval": "monthly"
}
```

**Response 200 (upgrade):**

```json
{
  "data": {
    "subscriptionId": "sub_123",
    "previousPlanId": "plan_owner_basico",
    "newPlanId": "plan_owner_pro",
    "effectiveAt": "2026-02-07T15:00:00Z",
    "proratedAmount": 750000,
    "status": "active"
  }
}
```

**Response 200 (downgrade):**

```json
{
  "data": {
    "subscriptionId": "sub_123",
    "previousPlanId": "plan_owner_pro",
    "newPlanId": "plan_owner_basico",
    "effectiveAt": "2026-03-07T00:00:00Z",
    "status": "scheduled"
  }
}
```

### 8. Dependencies

#### External

- None new (MercadoPago SDK already integrated)

#### Internal

- `@repo/billing` - Config validation
- `@repo/db` - New migration
- `@repo/i18n` - New billing namespace
- `@repo/schemas` - Plan change request/response schemas

### 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| QZPay schema incompatibility is deep/structural | Medium | High | Investigate first (Phase 0), fallback to writing seeds that bypass qzpay types |
| Plan change proration calculation errors | Medium | High | Extensive unit tests, manual QA with sandbox |
| Promo code migration breaks existing usage | Low | High | Run in transaction, backup before migration, test with production data copy |
| i18n extraction misses strings | Low | Medium | Grep audit after i18n phase, add lint rule for hardcoded strings |
| E2E tests with sandbox are flaky | High | Low | Separate test suite, don't block CI, retry logic |

### 10. Performance Considerations

- **BillingMetricsService**: Currently instantiated per request. Move to singleton with lazy initialization.
- **Metrics queries**: Complex SQL aggregations. Add caching layer with 5-minute TTL for dashboard queries.
- **Plan list endpoint**: Static data. Cache in memory, invalidate on plan config change.
- **Notification retention cron**: Ensure new index on `expired_at` prevents full table scans.

---

## Implementation Approach

### Phase 0: Investigation (prerequisite)

- Investigate QZPay schema incompatibility
- Document findings and determine fix approach

### Phase 1: Blockers (P0)

- Fix QZPay schema compatibility and re-enable billing seeds
- Complete PlanChangeDialog with upgrade/downgrade API integration
- Make webhook secret mandatory in production mode

### Phase 2: Security & Hardening (P1)

- Fix SQL injection risk in notification retention service
- Migrate local promo codes to database
- Add startup validation for billing configuration

### Phase 3: Test Coverage (P1)

- Add tests for MercadoPago webhook handler
- Add tests for all billing services without coverage

### Phase 4: UI/DX Improvements (P2)

- Add error boundaries to billing components
- Configure Sentry release (git SHA)
- Add index for expiredAt in billing notification log
- Remove deprecated apiUrl props

### Phase 5: i18n Billing

- Create billing namespace in packages/i18n (es + en)
- Extract hardcoded strings from all 15 billing components
- Integrate useTranslation in all components

### Phase 6: Performance

- Singleton BillingMetricsService
- Add caching for billing metrics queries
- Review service instantiation patterns

### Phase 7: E2E & Validation

- E2E tests for complete payment flow (mocked)
- E2E tests with MercadoPago sandbox (separate suite)

---

## Testing Strategy

### Unit Tests (Phase 3)

- MercadoPago webhook handler: signature verification, event processing, idempotency, error handling
- billing-metrics.service.ts: all metric calculation methods
- billing-settings.service.ts: CRUD operations
- addon-entitlement.service.ts: entitlement grant/revoke
- addon-expiration.service.ts: expiration detection and processing
- notification-retention.service.ts: mark expired, purge expired
- notification-retry.service.ts: retry logic, backoff
- billing-error-handler.ts: error classification and response formatting
- billing middleware: initialization, context setup

### Integration Tests (Phase 1, 2, 3)

- Seed execution against test database
- Plan change API endpoint (upgrade + downgrade scenarios)
- Promo code migration (local -> DB)
- Webhook processing pipeline

### Component Tests (Phase 1, 4, 5)

- PlanChangeDialog: plan fetching, selection, upgrade/downgrade, error states
- Error boundaries: crash recovery, fallback UI
- i18n: component rendering in es and en

### E2E Tests (Phase 7)

- Complete subscription lifecycle: create -> upgrade -> payment -> downgrade -> cancel
- Webhook processing: receive -> deduplicate -> process -> notify
- Promo code flow: validate -> apply -> track usage
- Concurrent scenarios: simultaneous plan changes, duplicate webhooks
