---
spec-id: SPEC-002
title: Monetization System Phase 2 - Post-Launch Enhancements
type: feature
complexity: high
status: approved
created: 2026-01-31T14:20:00.000Z
---

## SPEC-002: Monetization System Phase 2 - Post-Launch Enhancements

## Part 1: Functional Specification

### 1. Overview & Goals

**Goal:** Complete the monetization system with 5 post-launch capabilities identified as gaps after SPEC-001 completion.

**Motivation:** SPEC-001 delivered the core billing infrastructure (plans, subscriptions, add-ons, trials, webhooks). However, several operational capabilities are missing: add-ons never expire, usage isn't tracked against limits proactively, there's no email notification system, webhook processing lacks audit trail, and dashboards don't show active add-on state.

**Success Metrics:**

- Time-limited add-ons (visibility boosts) expire automatically after their duration
- Users receive email notifications for all billing events (purchase, expiry, trial ending)
- Admins can see webhook audit trail, usage analytics, and notification logs
- Usage tracking provides proactive warnings at 80%/90%/100% of limits
- All new features have 90%+ test coverage

**Target Users:**

- Property owners/complexes (subscription holders)
- Tourists (with tourist plans)
- Platform administrators
- System operators (monitoring)

### 2. User Stories & Acceptance Criteria

#### US-001: Add-on Expiration

**As a** property owner who purchased a 7-day visibility boost,
**I want** the boost to automatically expire after 7 days,
**So that** the billing system accurately reflects my active features.

**Acceptance Criteria:**

```gherkin
Given I purchased a "visibility-boost-7d" add-on on January 1st
When the system runs the daily expiration check on January 8th
Then the add-on status should be "expired"
And the FEATURED_LISTING entitlement should be removed
And I should receive an email notification about the expiration

Given I have an active "visibility-boost-30d" add-on
When there are 3 days remaining until expiration
Then I should receive an email warning about upcoming expiration
And I should see an "expiring soon" badge on my dashboard
```

#### US-002: Email Notifications

**As a** property owner,
**I want** to receive email notifications for billing events,
**So that** I stay informed about my subscription, payments, and add-ons.

**Acceptance Criteria:**

```gherkin
Given I successfully purchase a subscription
When the payment is confirmed via webhook
Then I should receive a purchase confirmation email within 5 minutes
And the email should include plan name, amount, and next billing date

Given my trial expires in 3 days
When the daily notification scheduler runs
Then I should receive a trial-ending reminder email
And the email should include an upgrade CTA link

Given I have opted out of reminder notifications
When a renewal reminder would be sent
Then the notification should be skipped
And a "skipped" entry should be logged in notification_log
```

#### US-003: Usage Tracking

**As a** property owner,
**I want** to see how much of my plan limits I'm using,
**So that** I can decide when to upgrade or purchase add-ons.

**Acceptance Criteria:**

```gherkin
Given I have a plan with max 5 accommodations and I have 4 active
When I view my dashboard
Then I should see a usage meter showing 4/5 (80%) with a warning indicator

Given I have reached 100% of my photo limit
When I try to upload another photo
Then the request should be blocked with a 403 response
And the response should include current usage, max allowed, and upgrade URL

Given my plan allows 3 accommodations and I have 5 (from a previous higher plan)
When I downgrade my plan
Then my existing 5 accommodations should remain active
But I should not be able to create new ones until I'm under the limit
```

#### US-004: Dashboard Enhancements

**As a** property owner,
**I want** to see my active add-ons, usage, and billing history on my dashboard,
**So that** I can manage my subscription effectively.

**Acceptance Criteria:**

```gherkin
Given I have active add-ons
When I visit /mi-cuenta/addons
Then I should see each add-on with its status (active/expiring/expired)
And I should see expiration dates for time-limited add-ons
And I should have options to renew or cancel

Given I am an admin
When I view the billing add-ons section
Then I should see a table of all customer add-on purchases
And I should be able to filter by status, customer, and add-on type
```

#### US-005: Webhook Reliability

**As a** system operator,
**I want** webhook events to be persisted and retried on failure,
**So that** no payment events are lost.

**Acceptance Criteria:**

```gherkin
Given a MercadoPago webhook is received
When the handler processes it
Then the event should be persisted to billing_webhook_events
And duplicate events (same provider_event_id) should be detected and skipped

Given a webhook event fails processing
When the error is caught
Then the event should be moved to the dead letter queue
And the webhook-retry cron job should attempt reprocessing within 1 hour
```

### 3. UX Considerations

#### User Flows

- **Add-on Purchase → Expiration:** Purchase → Email confirmation → Dashboard shows active → 3d warning email → 1d warning email → Expiration → Email notice → Dashboard shows expired → Renewal option
- **Approaching Limit:** Create resource → Warning header at 80% → Dashboard warning → Block at 100% → Upgrade CTA

#### Error States

- Payment webhook fails → Retry silently, alert admin after 3 failures
- Email send fails → Queue for retry (3 attempts), log failure
- Cron job times out → Log error, continue with next job

#### Accessibility

- Usage meters use both color AND text/percentage indicators
- Email templates are responsive and support screen readers

### 4. Out of Scope

- Push notifications / in-app notifications (future)
- SMS notifications
- Usage historical analytics / graphs (billing_usage_snapshots deferred)
- Automated dunning (payment recovery sequences)
- Custom notification templates per customer

---

## Part 2: Technical Analysis

### 1. Architecture

#### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email Provider | Resend | React Email native support, TypeScript SDK |
| Job Scheduler | HTTP-first + node-cron adapter | Works on Vercel and VPS identically |
| Add-on Storage | New `billing_addon_purchases` table | Replace JSON metadata with proper table |
| Webhook Audit | Use existing QZPay tables | `billing_webhook_events` + `billing_webhook_dead_letter` already exist |
| Notification Package | `@repo/notifications` | Separate package for reusability |
| Usage Snapshots | Deferred | QZPay's `billing_customer_limits` is sufficient |
| Retry Queue | ioredis lightweight | Redis already available in docker-compose |

#### Component Overview

```
@repo/notifications (new package)
├── Types + Config
├── Resend Transport
├── React Email Templates (13 templates)
└── Services (Notification, Preference, Retry)

apps/api/src/cron/ (new module)
├── HTTP routes + auth middleware
├── Registry + bootstrap
└── 4 job handlers

apps/api/src/services/ (enhanced)
├── addon-expiration.service.ts (new)
├── usage-tracking.service.ts (new)
├── addon-entitlement.service.ts (refactored)
└── addon.service.ts (refactored)

packages/db/src/schemas/billing/ (new schemas)
├── billing_addon_purchase.dbschema.ts
└── billing_notification_log.dbschema.ts
```

### 2. Data Model Changes

#### New Table: `billing_addon_purchases`

- Replaces JSON in `subscription.metadata.addonAdjustments`
- Proper FK to `billing_customers`, queryable status/expires_at
- Indexes on customer_id, status, expires_at, (customer_id, status)

#### New Table: `billing_notification_log`

- Tracks all sent/failed notifications
- Indexes on customer_id, type, status, created_at

#### No New Webhook Table

- QZPay already provides `billing_webhook_events` and `billing_webhook_dead_letter`

### 3. API Design

#### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/billing/usage | User | Current user's usage summary |
| GET | /api/v1/billing/usage/:limitKey | User | Specific limit details |
| GET | /api/v1/admin/billing/usage/:customerId | Admin | Customer usage (admin) |
| GET | /api/v1/webhooks/health | System | Webhook event statistics |
| POST | /api/v1/cron/:jobName | CRON_SECRET | Execute a cron job |
| GET | /api/v1/cron | CRON_SECRET | List registered cron jobs |

### 4. Dependencies

#### New External Dependencies

- `resend` - Email delivery API
- `@react-email/components` - Email template components
- `node-cron` (optional) - In-process scheduler for VPS
- `ioredis` - Redis client for notification retry queue

#### Internal Dependencies

- `@repo/notifications` → `@repo/config`, `@repo/logger`, `@repo/db`
- `apps/api` → `@repo/notifications`

### 5. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Email delivery failures | Medium | Medium | Retry queue with 3 attempts, admin alerts |
| Cron job timeout | Low | Medium | 60s timeout, error logging, jobs are idempotent |
| Data migration (JSON → table) | Medium | High | Backward compat reading, staged migration |
| Redis unavailable | Low | Low | Graceful degradation, skip retry queue |
| Add-on expiration race condition | Low | Medium | Database-level status check before processing |

### 6. Performance Considerations

- **Cron jobs**: Process in batches (100 records per batch) to avoid memory issues
- **Email sending**: Fire-and-forget pattern, don't block API responses
- **Usage tracking**: Read from QZPay `billing_customer_limits` (already cached)
- **Webhook idempotency**: Index on `provider_event_id` for fast duplicate detection
- **Notification preferences**: Cached in user context, no extra DB query per notification

---

## Implementation Approach

### Phase 1: Setup (8 tasks)

Foundation: DB schemas, package scaffold, cron scaffold, env config

### Phase 2: Core Services (12 tasks)

Business logic: Refactored add-on services, new expiration/usage/notification services, email templates

### Phase 3: Integration (12 tasks)

Wiring: Webhook persistence, notification triggers, cron jobs, API endpoints

### Phase 4: UI Dashboard (10 tasks)

Frontend: User dashboard widgets, admin data tables

### Phase 5: Testing (10 tasks)

Quality: Unit + integration tests for all new services and flows

### Phase 6: Documentation (3 tasks)

Docs: Cron setup, notification system, API endpoints

Total: 55 tasks across 6 phases
