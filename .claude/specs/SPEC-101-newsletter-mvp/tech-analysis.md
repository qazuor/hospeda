---
spec-id: SPEC-101
title: Newsletter MVP - Technical Analysis
type: tech-analysis
status: draft
created: 2026-05-10T00:00:00.000Z
updated: 2026-05-10T00:00:00.000Z
analyst: tech-analyzer
---

# SPEC-101 Newsletter MVP — Technical Analysis

> **v2 — architecture finalized 2026-05-10.** Previous version assumed QStash for dispatch
> and a dual Resend/Brevo transport. Both are replaced. See section 0 for the dependency
> on `chore/vps-migration` and section 8 for the BullMQ + Brevo-batch dispatch engine.

---

## 0. Dependency on `chore/vps-migration`

**SPEC-101 Phase 1 cannot start until `chore/vps-migration` is merged to `main`.**

That branch provides the three runtime primitives this spec consumes:

| Primitive | What it provides | Key files |
|-----------|-----------------|-----------|
| Brevo email transport | `BrevoEmailTransport` class calling `https://api.brevo.com/v3/smtp/email` via native `fetch`. No SDK. Env var: `HOSPEDA_EMAIL_API_KEY` (format `xkeysib-*`). | `packages/notifications/src/transports/email/resend-transport.ts` (legacy filename, kept for backward compat) |
| node-cron infra | In-process cron scheduler (`startCronScheduler()`). `HOSPEDA_CRON_ADAPTER=node-cron` in prod, `manual` in dev/test. | `apps/api/src/cron/bootstrap.ts`, `apps/api/src/cron/schedules.manifest.ts` |
| Redis on VPS | `hospeda-redis:6379` managed by Coolify. Used today for auth lockout cache and notification idempotency. `disconnectRedis()` in graceful shutdown already wired in `apps/api/src/index.ts`. | `apps/api/src/utils/redis.ts` |

**What is NOT yet done (SPEC-101 adds this):**
- Brevo batch send endpoint (currently each email = 1 POST).
- Brevo webhook handler.
- BullMQ dispatch queue on Redis.
- `RetryService` is currently instantiated with `redis=null` so transactional retry logic is inert. SPEC-101 connects it.

---

## 1. Architecture Overview

```
                              SUBSCRIBE FLOW
                              ─────────────
  Web Footer Island          API (Protected)       service-core          DB
  (NewsletterForm.client.tsx)
       │                            │                    │               │
       │ POST /protected/newsletter/subscribe            │               │
       │───────────────────────────>│                    │               │
       │                            │ NewsletterSubscriberService        │
       │                            │────────────────────>               │
       │                            │                    │ INSERT subscriber (pending)
       │                            │                    │────────────────>
       │                            │                    │               │
       │                            │         @repo/notifications (Brevo)│
       │                            │         sendVerificationEmail()    │
       │<──────────────────────────(200 pending_verification)

                              VERIFY FLOW
                              ───────────
  Browser          API (Public)              service-core          DB
       │                  │                       │               │
       │ GET /public/newsletter/verify?token=...  │               │
       │─────────────────>│                       │               │
       │                  │ verifyHmacToken()     │               │
       │                  │──────────────────────>│               │
       │                  │                       │ UPDATE status=active
       │                  │                       │────────────────>
       │                  │   redirect 302 /{locale}/newsletter/confirmado/
       │<─────────────────│

                          ADMIN CAMPAIGN SEND FLOW
                          ─────────────────────────
  Admin UI          API (Admin)         service-core        DB          BullMQ
       │                 │                   │              │              │
       │ POST /admin/newsletter/campaigns/:id/send          │              │
       │────────────────>│                   │              │              │
       │                 │ NewsletterCampaignService        │              │
       │                 │──────────────────>│              │              │
       │                 │                   │ SELECT active subscribers (+ soft-cap filter)
       │                 │                   │─────────────>│              │
       │                 │                   │ BULK INSERT deliveries (all pending)
       │                 │                   │─────────────>│              │
       │                 │                   │ Enqueue ceil(N/100) jobs    │
       │                 │                   │─────────────────────────────>
       │                 │                   │ UPDATE campaign status=sending
       │                 │                   │─────────────>│              │
       │<───────────────(202 sending, enqueued: M)

               DISPATCH WORKER FLOW (per BullMQ job, embedded in apps/api process)
               ─────────────────────────────────────────────────────────────────
  BullMQ Worker  service-core          DB          Brevo batch API
       │               │               │                 │
       │ job({ deliveryIds: string[] }) │               │
       │──────────────>│               │                 │
       │               │ SELECT delivery rows + subscriber status
       │               │───────────────>                 │
       │               │ renderTiptapContent() (per email)│
       │               │ Build batch (messageVersions[])  │
       │               │ POST /v3/smtp/email (batch, trackOpens+trackClicks)
       │               │─────────────────────────────────>
       │               │ UPDATE deliveries status=delivered + provider_message_id
       │               │───────────────>                 │

                    BREVO WEBHOOK FLOW (bounce / complaint / open / click)
                    ─────────────────────────────────────────────────────
  Brevo        API (Public)           service-core       DB
       │              │                    │              │
       │ POST /public/webhooks/brevo       │              │
       │─────────────>│                    │              │
       │              │ verifyBrevoSignature()            │
       │              │────────────────────>              │
       │              │                    │ UPDATE delivery (opened_at, first_click_at, status)
       │              │                    │ UPDATE subscriber (bounced / complained / unsubscribed)
       │              │                    │──────────────>│
```

**Key change from v1:** QStash is gone. Open/click tracking is handled by Brevo natively (no
custom pixel endpoint or click-redirect endpoint in our API). The `/internal/` tier is removed —
the worker is embedded in the API process and communicates via Redis queue, not HTTP.

---

## 2. Data Model

### 2.1 Three New Tables

#### `newsletter_subscribers`

```ts
// packages/db/src/schemas/newsletter/newsletter-subscriber.table.ts
import {
  pgTable, uuid, varchar, text, timestamp, pgEnum
} from 'drizzle-orm/pg-core';
import { usersTable } from '../user/users.table.js';

export const newsletterSubscriberChannelEnum = pgEnum(
  'newsletter_subscriber_channel', ['email', 'whatsapp']
);

export const newsletterSubscriberStatusEnum = pgEnum(
  'newsletter_subscriber_status',
  ['pending_verification', 'active', 'unsubscribed', 'bounced', 'complained']
);

export const newsletterSubscriberSourceEnum = pgEnum(
  'newsletter_subscriber_source',
  ['web_footer', 'account_preferences', 'migration']
);

export const newsletterSubscriberLocaleEnum = pgEnum(
  'newsletter_subscriber_locale', ['es', 'en', 'pt']
);

export const newsletterSubscribersTable = pgTable(
  'newsletter_subscribers',
  {
    id:              uuid('id').defaultRandom().primaryKey(),
    userId:          uuid('user_id').notNull().references(() => usersTable.id),
    email:           varchar('email', { length: 255 }).notNull(),
    channel:         newsletterSubscriberChannelEnum('channel').notNull().default('email'),
    status:          newsletterSubscriberStatusEnum('status').notNull().default('pending_verification'),
    locale:          newsletterSubscriberLocaleEnum('locale').notNull().default('es'),
    source:          newsletterSubscriberSourceEnum('source').notNull().default('web_footer'),
    // Consent audit (Ley 25.326 AR)
    consentIp:       varchar('consent_ip', { length: 45 }),       // IPv4 or IPv6
    consentUa:       text('consent_ua'),                          // User-Agent string
    consentVersion:  varchar('consent_version', { length: 20 }),  // e.g. "v1"
    // Timestamps
    subscribedAt:    timestamp('subscribed_at').defaultNow().notNull(),
    verifiedAt:      timestamp('verified_at'),
    unsubscribedAt:  timestamp('unsubscribed_at'),
    bouncedAt:       timestamp('bounced_at'),
    complainedAt:    timestamp('complained_at'),
    // Audit
    createdAt:       timestamp('created_at').defaultNow().notNull(),
    updatedAt:       timestamp('updated_at').defaultNow().notNull(),
    deletedAt:       timestamp('deleted_at'),  // Soft delete only; preserves consent audit trail
  }
);
```

**Required indexes (Drizzle can declare these):**

| Index | Columns | Type | Reason |
|-------|---------|------|--------|
| `idx_newsletter_subs_user_channel` | `(user_id, channel)` WHERE `deleted_at IS NULL` | UNIQUE partial | Prevent duplicate active subscriptions per channel |
| `idx_newsletter_subs_status` | `(status)` | BTREE | Filter by status for dispatch and admin list |
| `idx_newsletter_subs_locale` | `(locale)` | BTREE | Locale-segment filtering at dispatch time |
| `idx_newsletter_subs_channel` | `(channel)` | BTREE | Future WhatsApp channel queries |
| `idx_newsletter_subs_email` | `(email)` | BTREE | Brevo webhook lookup by email |

**Manual SQL (apply-postgres-extras.sh):**

The partial unique index `UNIQUE (user_id, channel) WHERE deleted_at IS NULL` cannot be expressed in Drizzle. It must be added to `packages/db/src/migrations/manual/`:

```sql
-- manual/0027_newsletter_subscriber_unique_active.sql
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_newsletter_subscribers_user_channel_active
  ON newsletter_subscribers (user_id, channel)
  WHERE deleted_at IS NULL;
```

---

#### `newsletter_campaigns`

```ts
// packages/db/src/schemas/newsletter/newsletter-campaign.table.ts
import {
  pgTable, uuid, varchar, text, jsonb, timestamp,
  integer, pgEnum
} from 'drizzle-orm/pg-core';

export const newsletterCampaignStatusEnum = pgEnum(
  'newsletter_campaign_status',
  ['draft', 'sending', 'sent', 'cancelled']
);

export const newsletterCampaignLocaleFilterEnum = pgEnum(
  'newsletter_campaign_locale_filter',
  ['all', 'es', 'en', 'pt']
);

export const newsletterCampaignsTable = pgTable(
  'newsletter_campaigns',
  {
    id:               uuid('id').defaultRandom().primaryKey(),
    title:            varchar('title', { length: 120 }).notNull(),  // Internal label
    subject:          varchar('subject', { length: 120 }).notNull(),
    bodyJson:         jsonb('body_json').notNull(),  // TipTap document JSON
    status:           newsletterCampaignStatusEnum('status').notNull().default('draft'),
    localeFilter:     newsletterCampaignLocaleFilterEnum('locale_filter').notNull().default('all'),
    totalRecipients:  integer('total_recipients'),     // Set at dispatch time
    totalSoftcapped:  integer('total_softcapped').notNull().default(0),  // Excluded by soft-cap
    sentAt:           timestamp('sent_at'),            // When dispatch was triggered
    scheduledFor:     timestamp('scheduled_for'),      // Reserved for V2; unused in MVP
    createdBy:        uuid('created_by').notNull(),    // FK to users.id (admin)
    // Audit
    createdAt:        timestamp('created_at').defaultNow().notNull(),
    updatedAt:        timestamp('updated_at').defaultNow().notNull(),
    deletedAt:        timestamp('deleted_at'),
  }
);
```

**Required indexes:**

| Index | Columns | Type | Reason |
|-------|---------|------|--------|
| `idx_newsletter_campaigns_status` | `(status)` | BTREE | Admin list filter, cron job query |
| `idx_newsletter_campaigns_created_by` | `(created_by)` | BTREE | Admin audit |

**Manual SQL:** None required. `bodyJson` does not need a GIN index — campaigns are not queried by content.

---

#### `newsletter_campaign_deliveries`

```ts
// packages/db/src/schemas/newsletter/newsletter-campaign-delivery.table.ts
import {
  pgTable, uuid, varchar, text, timestamp, integer,
  pgEnum
} from 'drizzle-orm/pg-core';

export const newsletterDeliveryStatusEnum = pgEnum(
  'newsletter_delivery_status',
  ['pending', 'delivered', 'failed', 'skipped']
);

export const newsletterCampaignDeliveriesTable = pgTable(
  'newsletter_campaign_deliveries',
  {
    id:             uuid('id').defaultRandom().primaryKey(),
    campaignId:     uuid('campaign_id').notNull().references(() => newsletterCampaignsTable.id),
    subscriberId:   uuid('subscriber_id').notNull().references(() => newsletterSubscribersTable.id),
    channel:        varchar('channel', { length: 20 }).notNull().default('email'),
    status:         newsletterDeliveryStatusEnum('status').notNull().default('pending'),
    // Tracking (updated via Brevo webhook — not custom pixel)
    openedAt:       timestamp('opened_at'),
    firstClickAt:   timestamp('first_click_at'),
    deliveredAt:    timestamp('delivered_at'),
    // Error handling
    retryCount:     integer('retry_count').notNull().default(0),
    errorMessage:   text('error_message'),
    // External provider reference
    providerMessageId: varchar('provider_message_id', { length: 255 }),  // Brevo message ID
    // Audit
    createdAt:      timestamp('created_at').defaultNow().notNull(),
    updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  }
  // NOTE: no deletedAt — deliveries are immutable records; use status='skipped' to cancel
);
```

**Required indexes:**

| Index | Columns | Type | Reason |
|-------|---------|------|--------|
| `uq_delivery_campaign_subscriber_channel` | `(campaign_id, subscriber_id, channel)` | UNIQUE | Idempotency: prevents duplicate sends |
| `idx_delivery_campaign_status` | `(campaign_id, status)` | BTREE | Metrics queries, close-campaign cron |
| `idx_delivery_subscriber_delivered_at` | `(subscriber_id, delivered_at)` | BTREE | Soft-cap rolling window lookup |
| `idx_delivery_status_pending` | `(status)` WHERE `status = 'pending'` | PARTIAL BTREE | Fast pending count for cancel |

**Manual SQL:**

```sql
-- manual/0028_newsletter_delivery_constraints.sql

-- Unique constraint (idempotency guard)
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_newsletter_deliveries_campaign_subscriber_channel
  ON newsletter_campaign_deliveries (campaign_id, subscriber_id, channel);

-- Partial index for pending deliveries (cancel operation needs this to be fast)
CREATE INDEX IF NOT EXISTS
  idx_newsletter_deliveries_pending
  ON newsletter_campaign_deliveries (campaign_id)
  WHERE status = 'pending';
```

### 2.2 Migration Strategy

This is a new entity — no existing data migration risk on the tables themselves.

**One-time data migration** for legacy opt-in users must run as manual SQL:

```sql
-- manual/0029_newsletter_seed_existing_optins.sql
-- Idempotent: ON CONFLICT DO NOTHING
INSERT INTO newsletter_subscribers
  (id, user_id, email, channel, status, locale, source, subscribed_at, verified_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  'email',
  'active',
  COALESCE(
    (u.settings->>'languageWeb')::newsletter_subscriber_locale,
    'es'
  ),
  'migration',
  u.created_at,
  u.created_at,
  NOW(),
  NOW()
FROM users u
WHERE
  (u.settings->>'newsletter')::boolean = true
  AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

**Push-only policy applies:** Run `drizzle-kit push` to create the three tables + Drizzle-managed indexes, then run `packages/db/scripts/apply-postgres-extras.sh` to apply manual SQL files 0027, 0028, and 0029 in order.

---

## 3. API Design

The newsletter routes follow the three-tier pattern. All routes live under `apps/api/src/routes/newsletter/`.

Directory structure:
```
routes/newsletter/
  index.ts              # Re-exports all tiers
  public/index.ts       # verify, unsubscribe, webhook
  protected/index.ts    # subscribe, status, resend-verification, unsubscribe
  admin/index.ts        # subscriber list, campaign CRUD, test-send, send, cancel, metrics

routes/webhooks/
  brevo.ts              # Brevo webhook handler (POST /public/webhooks/brevo)
  index.ts
```

**Note:** There is no `/internal/` tier. QStash is gone. The dispatch worker is embedded in-process
and consumes BullMQ jobs — it does not receive HTTP calls. The `close-campaigns` job is a
node-cron job in `apps/api/src/cron/jobs/newsletter-close-campaigns.ts`.

### 3.1 Public Endpoints

```
GET /api/v1/public/newsletter/verify
  Auth: none (token-gated)
  Query: { token: string }
  Response 302: redirect /{locale}/newsletter/confirmado/
  Response 302: redirect /{locale}/newsletter/error/?reason=token_expired|invalid_token
  Rate limit: 10 req/min per IP

GET /api/v1/public/newsletter/unsubscribe
  Auth: none (token-gated)
  Query: { token: string }
  Response 302: redirect /{locale}/newsletter/desuscripto/
  Response 302: redirect /{locale}/newsletter/error/?reason=invalid_token
  Rate limit: 20 req/min per IP

POST /api/v1/public/webhooks/brevo
  Auth: X-Sib-Webhook-Token static secret (HOSPEDA_BREVO_WEBHOOK_SECRET), timingSafeEqual
  Body: BrevoWebhookPayload (event, email, date, messageId, etc.)
  Response 200: { ok: true }
  Response 401: { error: 'invalid_signature' }
  Rate limit: 1000 req/min (Brevo infrastructure volume)
  NOTE: No open/click tracking endpoints in OUR API — Brevo handles both natively.
        Open pixel and link rewriting are configured via Brevo API params, not by us.
```

### 3.2 Protected Endpoints (authenticated users)

```
POST /api/v1/protected/newsletter/subscribe
  Auth: user session required
  Body: none (email resolved from session, locale from Astro.locals.locale via header)
  Response 200: { status: 'pending_verification' | 'active' | 'already_pending' }
  Rate limit: 5 req/min per user

GET /api/v1/protected/newsletter/status
  Auth: user session required
  Query: { channel?: 'email' } (default: 'email')
  Response 200: {
    subscribed: boolean,
    status: 'pending_verification' | 'active' | 'unsubscribed' | 'bounced' | 'complained' | null,
    subscribedAt: string | null,
    verifiedAt: string | null
  }

POST /api/v1/protected/newsletter/resend-verification
  Auth: user session required
  Body: none
  Response 200: { sent: true }
  Response 400: { error: 'already_active' | 'not_subscribed' }
  Rate limit: 3 req/min per user

DELETE /api/v1/protected/newsletter/unsubscribe
  Auth: user session required
  Body: none
  Response 200: { status: 'unsubscribed' }
  Response 400: { error: 'not_subscribed' }

PATCH /api/v1/protected/user/newsletter   (existing endpoint - bug fix)
  Auth: user session required
  Body: { newsletter: boolean }
  Response 200: { updated: true }
  NOTE: Fix to write settings.newsletter (not settings.notifications.allowEmails).
        Mark @deprecated in JSDoc. No behavioral changes beyond the bug fix.
```

### 3.3 Admin Endpoints

```
GET /api/v1/admin/newsletter/subscribers
  Auth: NEWSLETTER_SUBSCRIBER_VIEW permission
  Query: { page, pageSize, status?, locale?, source?, search? }
  Response 200: PaginatedResponse<NewsletterSubscriber>
  NOTE: use createAdminListRoute; search targets email field via safeIlike()

GET /api/v1/admin/newsletter/subscribers/stats
  Auth: NEWSLETTER_SUBSCRIBER_VIEW permission
  Response 200: {
    totalActive: number,
    totalPending: number,
    totalUnsubscribed: number,
    totalBounced: number,
    totalComplained: number
  }

GET /api/v1/admin/newsletter/campaigns
  Auth: NEWSLETTER_CAMPAIGN_VIEW permission
  Query: { page, pageSize, status?, search? }
  Response 200: PaginatedResponse<NewsletterCampaign>

POST /api/v1/admin/newsletter/campaigns
  Auth: NEWSLETTER_CAMPAIGN_WRITE permission
  Body: { title, subject, bodyJson, localeFilter }
  Response 201: NewsletterCampaign (status='draft')

GET /api/v1/admin/newsletter/campaigns/:id
  Auth: NEWSLETTER_CAMPAIGN_VIEW permission
  Response 200: NewsletterCampaign

PATCH /api/v1/admin/newsletter/campaigns/:id
  Auth: NEWSLETTER_CAMPAIGN_WRITE permission
  Body: Partial<{ title, subject, bodyJson, localeFilter }>
  Response 200: NewsletterCampaign
  Response 409: { error: 'campaign_not_editable' } if status != 'draft'

DELETE /api/v1/admin/newsletter/campaigns/:id
  Auth: NEWSLETTER_CAMPAIGN_WRITE permission
  Response 200: { deleted: true }
  Response 409: { error: 'campaign_not_deletable' } if status in ('sending','sent')

POST /api/v1/admin/newsletter/campaigns/:id/test-send
  Auth: NEWSLETTER_CAMPAIGN_SEND permission
  Body: none (sends to the authenticated admin's email)
  Response 200: { sent: true, sentTo: string }
  Response 400: { error: 'campaign_not_ready' }

POST /api/v1/admin/newsletter/campaigns/:id/send
  Auth: NEWSLETTER_CAMPAIGN_SEND permission
  Body: { ignoreSoftCap?: boolean }  (requires same NEWSLETTER_CAMPAIGN_SEND permission)
  Response 202: { dispatched: true, enqueued: number, softcapped: number }
  Response 409: { error: 'campaign_not_sendable' } if status != 'draft'
  Response 200: { dispatched: false, reason: 'no_eligible_subscribers' }
  Rate limit: 1 req/min per admin (double-click guard)

POST /api/v1/admin/newsletter/campaigns/:id/cancel
  Auth: NEWSLETTER_CAMPAIGN_SEND permission
  Body: none
  Response 200: { cancelled: true, skipped: number }
  Response 409: { error: 'campaign_not_cancellable' } if status not in ('sending')

GET /api/v1/admin/newsletter/campaigns/:id/metrics
  Auth: NEWSLETTER_CAMPAIGN_VIEW permission
  Response 200: {
    totalRecipients: number,
    totalSoftcapped: number,
    delivered: number,
    failed: number,
    pending: number,
    skipped: number,
    openRate: number,
    clickRate: number,
    openCount: number,
    clickCount: number
  }
  Cache-Control: no-cache (real-time data)

GET /api/v1/admin/newsletter/campaigns/:id/errors
  Auth: NEWSLETTER_CAMPAIGN_VIEW permission
  Query: { page, pageSize }
  Response 200: PaginatedResponse<{
    id: string,
    emailMasked: string,  // 'a***@domain.com'
    errorMessage: string,
    retryCount: number
  }>
```

---

## 4. Service Layer

All services live in `packages/service-core/src/services/newsletter/`.

```
services/newsletter/
  newsletter-subscriber.service.ts
  newsletter-subscriber.permissions.ts
  newsletter-campaign.service.ts
  newsletter-campaign.permissions.ts
  newsletter-delivery.service.ts
  newsletter-tracking.service.ts
  newsletter-token.helpers.ts    # HMAC token generation/verification (pure, testable)
  index.ts
```

### 4.1 `NewsletterSubscriberService`

Extends `BaseCrudService<NewsletterSubscriber, NewsletterSubscriberModel, ...>`.

| Method | Input | Output | Permission |
|--------|-------|--------|-----------|
| `subscribe({ userId, email, locale, source, consentIp, consentUa })` | Subscribe request | `Result<{ status: SubscriberStatus }>` | None (self-service) |
| `verifyToken({ token })` | HMAC token string | `Result<{ subscriberId: string, locale: string }>` | None (public) |
| `resendVerification({ userId })` | Actor user ID | `Result<{ sent: boolean }>` | None (self-service) |
| `unsubscribeByToken({ token })` | HMAC unsubscribe token | `Result<{ locale: string }>` | None (public) |
| `unsubscribeAuthenticated({ userId })` | Actor user ID | `Result<void>` | None (self-service) |
| `getStatus({ userId, channel })` | User ID + channel | `Result<SubscriberStatus \| null>` | None (self-service) |
| `getEligibleForCampaign({ campaignId, localeFilter, softCapDays, ignoreSoftCap })` | Campaign params | `Result<{ subscribers: NewsletterSubscriber[], softcappedCount: number }>` | `NEWSLETTER_CAMPAIGN_SEND` |
| `adminList({ filters })` | AdminSearchParams | `Result<PaginatedResult<NewsletterSubscriber>>` | `NEWSLETTER_SUBSCRIBER_VIEW` |
| `getStats()` | none | `Result<SubscriberStats>` | `NEWSLETTER_SUBSCRIBER_VIEW` |

Key business rules in `subscribe()`:
- If subscriber exists with `status='active'` — return `{ status: 'active' }` without sending email.
- If subscriber exists with `status='pending_verification'` — return `{ status: 'pending_verification' }` without sending a new email.
- If subscriber was `status='unsubscribed'` — reset: update to `pending_verification`, set new `subscribedAt`, send verification email.
- If no subscriber — INSERT and send verification email.
- Verification email is sent via `@repo/notifications` using the existing `BrevoEmailTransport`.

### 4.2 `NewsletterCampaignService`

Extends `BaseCrudService<NewsletterCampaign, NewsletterCampaignModel, ...>`.

| Method | Input | Output | Permission |
|--------|-------|--------|-----------|
| `create({ title, subject, bodyJson, localeFilter, createdBy })` | Campaign draft | `Result<NewsletterCampaign>` | `NEWSLETTER_CAMPAIGN_WRITE` |
| `update({ id, data })` | Partial campaign | `Result<NewsletterCampaign>` | `NEWSLETTER_CAMPAIGN_WRITE` |
| `softDelete({ id })` | Campaign ID | `Result<void>` | `NEWSLETTER_CAMPAIGN_WRITE` |
| `send({ id, actor, ignoreSoftCap? })` | Campaign ID + actor + options | `Result<{ enqueued: number, softcapped: number }>` | `NEWSLETTER_CAMPAIGN_SEND` |
| `testSend({ id, actor })` | Campaign ID + actor | `Result<{ sentTo: string }>` | `NEWSLETTER_CAMPAIGN_SEND` |
| `cancel({ id })` | Campaign ID | `Result<{ skipped: number }>` | `NEWSLETTER_CAMPAIGN_SEND` |
| `computeMetrics({ id })` | Campaign ID | `Result<CampaignMetrics>` | `NEWSLETTER_CAMPAIGN_VIEW` |
| `getFailedDeliveries({ id, page, pageSize })` | Campaign ID + pagination | `Result<PaginatedResult<FailedDelivery>>` | `NEWSLETTER_CAMPAIGN_VIEW` |
| `closeSentCampaigns()` | none | `Result<number>` | Internal (no actor) — called by node-cron job |

Key rules in `send()`:
1. Assert `campaign.status === 'draft'` (otherwise throw `campaign_not_sendable`).
2. Call `NewsletterSubscriberService.getEligibleForCampaign()`. Soft-cap exclusion happens here (see section 8).
3. If 0 eligible subscribers — return `{ enqueued: 0, softcapped }` without changing campaign status.
4. `BULK INSERT` deliveries via single round-trip: `db.insert().values(batchArray).onConflictDoNothing()`.
5. Call `NewsletterDeliveryService.enqueueBatches({ deliveryIds, batchSize })` — groups delivery IDs into batches of `HOSPEDA_NEWSLETTER_BATCH_SIZE` (default 100) and enqueues M = ceil(N/100) BullMQ jobs.
6. UPDATE campaign: `status='sending'`, `sentAt=now()`, `totalRecipients=enqueued`, `totalSoftcapped=softcappedCount`.
7. Steps 4, 6 in a single `withServiceTransaction()`. Step 5 (external BullMQ enqueue) runs AFTER the transaction commits.

### 4.3 `NewsletterDeliveryService`

Does NOT extend `BaseCrudService` — delivery records are immutable outbox entries with their own lifecycle.

| Method | Input | Output | Permission |
|--------|-------|--------|-----------|
| `enqueueBatches({ deliveryIds, batchSize })` | Delivery IDs + batch size | `Result<{ jobsEnqueued: number }>` | Internal |
| `processBatch({ deliveryIds })` | Batch of delivery IDs (BullMQ job payload) | `Result<{ delivered: number, skipped: number, failed: number }>` | Internal (worker handler) |
| `markDelivered({ deliveryId, providerMessageId })` | Delivery ID | `Result<void>` | Internal |
| `markFailed({ deliveryId, errorMessage })` | Delivery ID + error | `Result<void>` | Internal |
| `skipDelivery({ deliveryId })` | Delivery ID | `Result<void>` | Internal |
| `bulkSkipPending({ campaignId })` | Campaign ID | `Result<number>` | Internal (called from cancel) |

`processBatch()` logic (runs inside the BullMQ worker):
1. Load delivery rows for all IDs in the batch; skip any where `status !== 'pending'` (idempotency).
2. For each pending delivery, load associated subscriber; skip if `status !== 'active'`.
3. Render campaign `bodyJson` to HTML via `renderTiptapContent()` + email-safe-html transformer.
4. Build Brevo batch payload: `messageVersions[]` with one entry per recipient. Include `params: { trackOpens: true, trackClicks: true }` so Brevo injects the open pixel and rewrites links natively.
5. Call `sendBatch()` from `packages/notifications/src/transports/email/brevo-batch.ts`.
6. Map Brevo response `messageId` array back to individual delivery rows.
7. Bulk UPDATE delivered rows: `status='delivered'`, `deliveredAt=now()`, `providerMessageId`.
8. On Brevo API error: throw so BullMQ retries the full batch (up to `attempts: 3`). Individual delivery `retryCount` is incremented on each attempt via the job attempt count. After 3 failures, BullMQ moves job to failed queue; mark affected deliveries `status='failed'`.

### 4.4 `NewsletterTrackingService`

| Method | Input | Output | Permission |
|--------|-------|--------|-----------|
| `processBrevoWebhookEvent({ event, email, messageId, date })` | Brevo event payload | `Result<void>` | None (signature-verified) |

`processBrevoWebhookEvent()` maps Brevo event types:
- `delivered` → delivery `status='delivered'`, `deliveredAt=date`
- `hard_bounce` → delivery `status='failed'`; subscriber `status='bounced'`, `bouncedAt=date`
- `soft_bounce` → increment `retryCount` on delivery (do not change subscriber status)
- `spam` / `complained` → subscriber `status='complained'`, `complainedAt=date`
- `unsubscribed` → subscriber `status='unsubscribed'`, `unsubscribedAt=date`
- `invalid_email` → subscriber `status='bounced'`, `bouncedAt=date`
- `opened` → delivery `openedAt=date` (UPDATE only WHERE `opened_at IS NULL` — first open only)
- `click` → delivery `firstClickAt=date` (UPDATE only WHERE `first_click_at IS NULL`)

Lookup strategy: find delivery by `provider_message_id`. Fallback: find subscriber by `email` if message ID not found (for events arriving before our DB is updated).

**Note:** There are no `recordOpen()` or `recordClick()` methods here. Open and click tracking
are handled 100% by Brevo natively via webhook events. No custom pixel endpoint, no click-redirect
endpoint in our API.

---

## 5. Schema Layer

All schemas live in `packages/schemas/src/entities/newsletter/`.

### 5.1 Files per entity

```
src/entities/newsletter/
  newsletter-subscriber.schema.ts
  newsletter-subscriber.crud.schema.ts
  newsletter-subscriber.query.schema.ts
  newsletter-subscriber.http.schema.ts
  newsletter-subscriber.access.schema.ts
  newsletter-subscriber.admin-search.schema.ts
  newsletter-campaign.schema.ts
  newsletter-campaign.crud.schema.ts
  newsletter-campaign.query.schema.ts
  newsletter-campaign.http.schema.ts
  newsletter-campaign.access.schema.ts
  newsletter-campaign.admin-search.schema.ts
  newsletter-delivery.schema.ts          # Immutable; no crud schema
  newsletter-delivery.http.schema.ts
  index.ts
```

### 5.2 Key schema definitions

**`newsletter-subscriber.schema.ts`:**
```ts
export const NewsletterSubscriberChannelSchema = z.enum(['email', 'whatsapp']);
export const NewsletterSubscriberStatusSchema = z.enum([
  'pending_verification', 'active', 'unsubscribed', 'bounced', 'complained'
]);
export const NewsletterSubscriberSourceSchema = z.enum([
  'web_footer', 'account_preferences', 'migration'
]);
export const NewsletterSubscriberLocaleSchema = z.enum(['es', 'en', 'pt']);

export const NewsletterSubscriberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  channel: NewsletterSubscriberChannelSchema,
  status: NewsletterSubscriberStatusSchema,
  locale: NewsletterSubscriberLocaleSchema,
  source: NewsletterSubscriberSourceSchema,
  consentIp: z.string().nullable(),
  consentUa: z.string().nullable(),
  consentVersion: z.string().nullable(),
  subscribedAt: z.date(),
  verifiedAt: z.date().nullable(),
  unsubscribedAt: z.date().nullable(),
  bouncedAt: z.date().nullable(),
  complainedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
```

**`newsletter-subscriber.admin-search.schema.ts`:**
```ts
export const NewsletterSubscriberAdminSearchSchema = AdminSearchBaseSchema.extend({
  status: NewsletterSubscriberStatusSchema.optional(),
  locale: NewsletterSubscriberLocaleSchema.optional(),
  source: NewsletterSubscriberSourceSchema.optional(),
  channel: NewsletterSubscriberChannelSchema.optional(),
});
```

**`newsletter-campaign.schema.ts`:**
```ts
export const NewsletterCampaignStatusSchema = z.enum(['draft', 'sending', 'sent', 'cancelled']);
export const NewsletterCampaignLocaleFilterSchema = z.enum(['all', 'es', 'en', 'pt']);

export const TiptapDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()),
});

export const NewsletterCampaignSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  subject: z.string().min(1).max(120),
  bodyJson: TiptapDocumentSchema,
  status: NewsletterCampaignStatusSchema,
  localeFilter: NewsletterCampaignLocaleFilterSchema,
  totalRecipients: z.number().int().nullable(),
  totalSoftcapped: z.number().int().default(0),
  sentAt: z.date().nullable(),
  scheduledFor: z.date().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
```

**`newsletter-delivery.schema.ts`:**
```ts
export const NewsletterDeliveryStatusSchema = z.enum([
  'pending', 'delivered', 'failed', 'skipped'
]);

export const NewsletterDeliverySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  subscriberId: z.string().uuid(),
  channel: z.string(),
  status: NewsletterDeliveryStatusSchema,
  openedAt: z.date().nullable(),
  firstClickAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  retryCount: z.number().int().default(0),
  errorMessage: z.string().nullable(),
  providerMessageId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### 5.3 New Permissions

Add to `packages/schemas/src/enums/permission.enum.ts`:

```ts
// PermissionCategoryEnum — add:
NEWSLETTER_CAMPAIGN = 'NEWSLETTER_CAMPAIGN',
NEWSLETTER_SUBSCRIBER = 'NEWSLETTER_SUBSCRIBER',

// PermissionEnum — add:
NEWSLETTER_CAMPAIGN_VIEW   = 'newsletter.campaign.view',
NEWSLETTER_CAMPAIGN_WRITE  = 'newsletter.campaign.write',
NEWSLETTER_CAMPAIGN_SEND   = 'newsletter.campaign.send',
NEWSLETTER_SUBSCRIBER_VIEW = 'newsletter.subscriber.view',
```

Seed these permissions in `packages/seed/` and assign them to `super_admin` and `admin` roles.

---

## 6. Notifications Integration

### 6.1 Current State (post `chore/vps-migration`)

`@repo/notifications` already uses `BrevoEmailTransport` as its sole email transport. The class
in `packages/notifications/src/transports/email/resend-transport.ts` (legacy filename kept for
backward compat) calls `POST https://api.brevo.com/v3/smtp/email` via native `fetch`. No SDK.
Env var: `HOSPEDA_EMAIL_API_KEY` (format `xkeysib-*`).

The legacy alias `ResendEmailTransport = BrevoEmailTransport` is exported for existing call sites.
New code for SPEC-101 imports `BrevoEmailTransport` directly.

**No new transport is needed.** The transactional emails (verification, welcome) go through the
same existing `BrevoEmailTransport`. Campaign batch sends go through the new `brevo-batch.ts`
helper described below.

### 6.2 Changes to `@repo/notifications`

**Add `NotificationType` values:**
```ts
NEWSLETTER_VERIFICATION     = 'newsletter_verification',
NEWSLETTER_WELCOME          = 'newsletter_welcome',
NEWSLETTER_CAMPAIGN         = 'newsletter_campaign',
```

**Add `NotificationCategory.NEWSLETTER`:**
```ts
NEWSLETTER = 'newsletter',   // Can be opted out; managed by subscriber table
```

**Update `NOTIFICATION_CATEGORY_MAP`:**
```ts
[NotificationType.NEWSLETTER_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
[NotificationType.NEWSLETTER_WELCOME]:      NotificationCategory.NEWSLETTER,
[NotificationType.NEWSLETTER_CAMPAIGN]:     NotificationCategory.NEWSLETTER,
```

**Add Brevo batch helper:**

```
packages/notifications/src/transports/email/
  brevo-batch.ts         # NEW: Brevo multi-recipient batch send
```

`brevo-batch.ts` exports:

```ts
export interface BatchMessage {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  headers?: { 'X-Newsletter-Delivery-Id': string };
  tags?: string[];
  params?: {
    trackOpens?: boolean;
    trackClicks?: boolean;
  };
}

export interface SendBatchResult {
  messageIds: Array<{ email: string; messageId: string }>;
}

export async function sendBatch({
  client,
  sender,
  messages,
}: {
  client: EmailClient;
  sender: { email: string; name?: string };
  messages: BatchMessage[];
}): Promise<SendBatchResult>
```

Implementation: calls `POST https://api.brevo.com/v3/smtp/email` with a `messageVersions` array
(Brevo's multi-recipient batch variant). Verify exact contract shape from Brevo v3 API docs
before implementing (the field name `messageVersions` vs `recipients` varies by Brevo plan tier —
check context7 for current docs). Returns one `messageId` per recipient in the batch.

**Add newsletter email templates:**
```
packages/notifications/src/templates/newsletter/
  newsletter-verify-email.tsx      # Verification email
  newsletter-welcome-email.tsx     # Post-verification welcome email (with optional WA CTA)
  newsletter-campaign.tsx          # Campaign email wrapper (receives pre-rendered HTML body)
  index.ts
```

The `newsletter-campaign.tsx` template receives an already-rendered HTML string (`bodyHtml`) and
wraps it in a minimal email layout with header and unsubscribe footer. Open pixel and link
rewriting are NOT injected by our code — Brevo does it via `trackOpens: true, trackClicks: true`.

**Brevo webhook handler location:**

```
apps/api/src/routes/webhooks/
  brevo.ts    # createSimpleRoute({ skipAuth: true, customRateLimit: ... })
  index.ts
```

Registered as `POST /api/v1/public/webhooks/brevo`. Signature verification:

```ts
const token = c.req.header('x-sib-webhook-token');
if (!timingSafeEqual(Buffer.from(token ?? ''), Buffer.from(env.HOSPEDA_BREVO_WEBHOOK_SECRET))) {
  return c.json({ error: 'invalid_signature' }, 401);
}
```

Note: Brevo uses `X-Sib-Webhook-Token` (static bearer-like secret, NOT HMAC). Verify header name
against current Brevo webhook docs before implementing — Brevo has renamed headers in past releases.

---

## 7. TipTap Rendering

### Decision: Extract to `@repo/utils` (or `@repo/notifications`)

The current `renderTiptapContent()` function lives in `apps/web/src/lib/tiptap-renderer.ts`. It
needs to be used in:
- `apps/admin/` — live preview pane in the campaign editor.
- `apps/api/` (via `NewsletterDeliveryService.processBatch()`) — HTML generation at dispatch time.

**Recommended approach:** Move to `packages/utils/src/tiptap-renderer.ts` and export from
`@repo/utils`. Both consumers import from there.

**Email-safe-html transformer (new):**

When rendering for email (not web preview), the output must pass through an email-safe transformer:
- Add `style="max-width:100%;height:auto;display:block;"` inline to every `<img>`.
- Add `style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; margin: 0 0 12px 0;"` to `<p>`.
- Add inline styles to `<h1>`-`<h4>` (font-size, font-weight, margin).
- Strip disallowed tags (use allowlist similar to `apps/web/src/lib/sanitize-html.ts` + email tweaks).
- Preserve `<a>` tags (Brevo rewrites the hrefs for click tracking automatically).

Renderer location candidates:
- `packages/utils/src/tiptap-renderer.ts` — general renderer (shared with web).
- `packages/notifications/src/utils/tiptap-email-renderer.ts` — email-specific transformer that calls the base renderer then applies inline styles.

Use the second approach: keep the base renderer in `@repo/utils`, the email variant in `@repo/notifications`. This keeps email-specific logic out of general utils.

**TipTap Image extension support:**

Toolbar extensions for admin: `StarterKit` + `Link` + `Image` + `Underline` + `TextAlign`.

Image upload integrates with the existing media upload endpoint. Find the current endpoint by
inspecting `apps/api/src/routes/media/` — it likely returns a CDN URL (Cloudinary). Admin uploads
the image → gets CDN URL back → TipTap inserts `<img src="cdn-url" />`. The email-safe transformer
adds inline max-width styles before dispatch.

**Key edge case:** The current renderer does not handle the `horizontalRule` node type. Add a case
returning `<hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />`.

---

## 8. Dispatch Architecture

### 8.1 BullMQ on Existing Redis

**Dependency addition:** `bullmq` to `apps/api/package.json`.

Queue name: `hospeda-newsletter-dispatch`.

Redis connection: same instance as `hospeda-redis:6379` used by auth lockout cache and
notification idempotency. Import the Redis client from `apps/api/src/utils/redis.ts`.

**Side effect:** Connecting `RetryService` to this Redis instance revives the currently-dead
transactional retry logic (today `redis=null` in `notification-helper.ts`). Pass the same Redis
client to `NotificationService` constructor so `RetryService` is live.

### 8.2 Worker Topology

Worker module: `apps/api/src/workers/newsletter-dispatch.worker.ts`

```ts
export function startNewsletterWorker({
  redis,
  db,
  brevoClient,
  logger,
}: NewsletterWorkerDeps): Worker
```

Returns a BullMQ `Worker` instance. Startup is called from `apps/api/src/index.ts` AFTER
`serve()` resolves AND AFTER `startCronScheduler()` completes:

```ts
// In the serve() callback (after apiLogger.info('Server running')):
if (env.NODE_ENV !== 'test') {
  startCronScheduler().catch(...);
  startNewsletterWorker({ redis, db, brevoClient, logger: apiLogger });
}
```

**Worker configuration:**

```ts
new Worker('hospeda-newsletter-dispatch', processBatchJob, {
  connection: redis,
  concurrency: env.HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY,  // default 5
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
});
```

Concurrency = 5 gives ~70 concurrent Brevo API calls (5 workers × batch size 100 / ~7 req per
batch call assuming messageVersions). Well within Brevo Pro rate limit of 14 req/s for the burst,
and sustained throughput is bounded by queue drain rate.

**Graceful shutdown order (update `gracefulShutdown` in `apps/api/src/index.ts`):**

```
SIGTERM
  → stopCronJobs() (existing — node-cron tasks)
  → await worker.close()    (drain in-flight BullMQ jobs, max 30s)
  → closeSentry(2000)
  → destroyUserPermissionsCache()
  → disconnectRedis()
  → closeDatabase()
  → server.close()
```

BullMQ `worker.close()` waits for in-flight jobs to complete before returning. This prevents
partial batch sends on rolling deploys.

### 8.3 Job Enqueue Flow

When admin triggers send:

1. `getEligibleForCampaign()` returns `N` subscribers plus `softcappedCount`.
2. Delivery rows bulk inserted: N rows with `status='pending'`.
3. `enqueueBatches()` groups delivery IDs into batches of 100 and enqueues M = ceil(N/100) jobs:
   ```ts
   const queue = new Queue('hospeda-newsletter-dispatch', { connection: redis });
   await queue.addBulk(
     batches.map((deliveryIds, i) => ({
       name: `campaign-${campaignId}-batch-${i}`,
       data: { campaignId, deliveryIds },
       opts: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
     }))
   );
   ```
4. DB transaction updates campaign: `status='sending'`, `totalRecipients=N`, `totalSoftcapped`.

**Throughput estimate:**
- 1 worker × concurrency 5 × Brevo batch 100 = 500 emails/dispatch-cycle.
- Brevo Pro allows 14 req/s. With 5 concurrent batch calls at ~0.1-0.5s each, we saturate ~10-50
  req/s. Add `worker.rateLimit` if sustained 429s appear in monitoring.
- 10,000-subscriber campaign: ~20 BullMQ jobs × concurrency 5 = 4 rounds = ~2s active dispatch.
  End-to-end (enqueue + process) well under 30s NFR.

### 8.4 Soft-Cap Rolling 7 Days

At enqueue time (NOT at job time), `getEligibleForCampaign()` queries:

```sql
SELECT ns.* FROM newsletter_subscribers ns
WHERE ns.status = 'active'
  AND ns.deleted_at IS NULL
  AND (ns.locale = $localeFilter OR $localeFilter = 'all')
  AND ns.id NOT IN (
    SELECT ncd.subscriber_id
    FROM newsletter_campaign_deliveries ncd
    WHERE ncd.subscriber_id = ANY($allSubscriberIds)
      AND ncd.delivered_at > NOW() - INTERVAL '$softCapDays days'
      AND ncd.status = 'delivered'
  )
```

The excluded count is returned as `softcappedCount` and stored in `campaign.total_softcapped`.

Env var `HOSPEDA_NEWSLETTER_SOFTCAP_DAYS` (default 7) controls the window. Admin can bypass via
`ignoreSoftCap: true` in the send request body (requires same `NEWSLETTER_CAMPAIGN_SEND` permission).

### 8.5 Campaign Closure

The `/internal/newsletter/close-campaigns` QStash endpoint is REMOVED. Instead, register a
`node-cron` job in `apps/api/src/cron/jobs/newsletter-close-campaigns.ts`:

```
Schedule: every 5 minutes ('*/5 * * * *')
Handler: calls NewsletterCampaignService.closeSentCampaigns()
```

Query:
```sql
SELECT id FROM newsletter_campaigns
WHERE status = 'sending'
  AND NOT EXISTS (
    SELECT 1 FROM newsletter_campaign_deliveries
    WHERE campaign_id = newsletter_campaigns.id
      AND status = 'pending'
  )
```

### 8.6 Open/Click Tracking

**Brevo handles this natively.** We set `trackOpens: true, trackClicks: true` in each batch send
request. Brevo injects a 1x1 pixel and rewrites `<a>` hrefs. When opens and clicks happen, Brevo
fires the webhook at `POST /api/v1/public/webhooks/brevo` with event type `opened` or `click`.

**We do NOT implement:**
- `GET /public/newsletter/track/open/:deliveryId` (1x1 GIF endpoint).
- `GET /public/newsletter/track/click/:deliveryId` (redirect endpoint).
- `injectOpenPixel()` or `rewriteClickLinks()` utility functions.
- Any link rewriting logic in `processDelivery()`.

This simplifies the implementation by ~3 endpoints and ~150 lines of tracking logic.

### 8.7 Cancel Flow

When admin cancels a `sending` campaign:
1. UPDATE `newsletter_campaigns SET status='cancelled'`.
2. `NewsletterDeliveryService.bulkSkipPending({ campaignId })` — bulk UPDATE all pending
   deliveries to `status='skipped'`.
3. BullMQ jobs already picked up by workers will call `processBatch()`. At the start of
   `processBatch()`, each delivery row is checked: `status !== 'pending'` → skip. The accepted
   edge-case window (a few emails sent after cancel click) is documented in AC-101-12.2.

---

## 9. Security

### 9.1 HMAC Token Design

Two token types, different semantics:

**Verification token (time-limited, 72h TTL):**
```ts
function generateVerificationToken({ subscriberId, channel, subscribedAt, secret }): string {
  const payload = `v1:${subscriberId}:${channel}:${subscribedAt.getTime()}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}
```

Token encodes `subscribedAt` timestamp so expiry is computed without a DB query.

**Unsubscribe token (stable, deterministic):**
```ts
function generateUnsubscribeToken({ subscriberId, channel, secret }): string {
  const payload = `unsub:${subscriberId}:${channel}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}
```

Rotating `HOSPEDA_NEWSLETTER_HMAC_SECRET` invalidates all outstanding unsubscribe links.
Use `HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV` for a graceful rotation window (see §9.2).

### 9.2 Secret Rotation

- `HOSPEDA_NEWSLETTER_HMAC_SECRET` rotation:
  1. Add `HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV` (old key).
  2. Token handlers try new key first, fall back to old key.
  3. After 72h (verification TTL), remove `HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV`.
- Document in `docs/guides/newsletter-hmac-rotation.md`.

### 9.3 Brevo Webhook Signature

`X-Sib-Webhook-Token` static secret. Verify via `timingSafeEqual`. Log failed attempts with IP
to Sentry as warnings (not exceptions — could be benign probes).

### 9.4 Additional Security Controls

- **Rate limiting:** All public newsletter endpoints have custom per-IP rate limits (§3.1, §3.2).
- **CSRF:** Admin endpoints protected by existing admin auth middleware. Send confirmation uses
  standard HTTP POST.
- **Email HTML:** `renderTiptapContent()` HTML-escapes all text nodes and link hrefs. Campaign
  admins are trusted actors, but escaping is applied regardless.
- **No open redirect:** There is no click-redirect endpoint in our API (Brevo handles it), so no
  open-redirect risk exists in SPEC-101. However, verify Brevo's link rewriting policy with
  respect to JavaScript URI and data URI schemes before shipping.

---

## 10. Observability

### 10.1 Structured Logging

Each `processBatch()` call emits:

```ts
logger.info('newsletter.batch.attempt', {
  campaignId, batchIndex, deliveryCount, concurrencySlot,
});
logger.info('newsletter.batch.success', {
  campaignId, delivered, skipped, durationMs,
});
logger.error('newsletter.batch.failure', {
  campaignId, error: error.message, attempt,
});
```

### 10.2 Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `newsletter_deliveries_total` | counter | `status` (delivered/failed/skipped) |
| `newsletter_batch_duration_ms` | histogram | `campaign_id` |
| `newsletter_open_events_total` | counter | (none) — from webhook |
| `newsletter_click_events_total` | counter | (none) — from webhook |
| `newsletter_subscribers_by_status` | gauge | `status`, `locale` |
| `newsletter_bullmq_jobs_active` | gauge | (none) |
| `newsletter_bullmq_jobs_failed` | gauge | (none) |

### 10.3 Sentry Integration

- Wrap `processBatch()` in a Sentry transaction for distributed tracing.
- Attach `campaign_id`, `batch_index` as Sentry context tags.
- BullMQ failed jobs (after 3 attempts) are captured as Sentry exceptions.
- Brevo webhook signature failures are Sentry warnings.

---

## 11. Performance Considerations

### 11.1 Dispatch Throughput

Target: 10,000 subscribers enqueued in < 30s, dispatched in < 60s end-to-end.

- Enqueue: `addBulk()` for 100 BullMQ jobs takes ~50-200ms. Enqueue time is negligible.
- Worker dispatch: concurrency 5 × batch 100 = 500 emails/round. 10k campaign = 20 jobs.
  At 5 concurrent workers processing ~0.5s each, 20 jobs complete in ~2s.
- **Effective throughput: ~500 emails/sec.** Well within the spec NFR.
- Brevo Pro rate limit 14 req/s applies per batch API call, not per email. One batch call with
  100 `messageVersions` = 1 req against the rate limit. Worker concurrency 5 = 5 simultaneous
  batch calls = 5 req/s against the rate limit. No 429 risk at these volumes.

### 11.2 Admin List Queries

Subscriber list at 50,000 rows must return in < 1s. All admin filter paths are covered by indexes.

### 11.3 Soft-Cap Query

The eligibility query uses `idx_delivery_subscriber_delivered_at (subscriber_id, delivered_at)`.
At 50k subscribers and 10k deliveries per campaign, the subquery scan is bounded.

### 11.4 Cron Close-Campaign

EXISTS subquery covered by `idx_delivery_campaign_status (campaign_id, status)`.

### 11.5 Redis Memory

BullMQ stores job data and results in Redis. For a 10k campaign: 100 jobs × avg 5KB payload =
~500KB. Job result expiration: configure `removeOnComplete: { age: 3600 }` and
`removeOnFail: { age: 86400 }` to cap Redis memory growth. Monitor `newsletter_bullmq_jobs_failed`
gauge and set alert at > 100.

---

## 12. Migration Steps (Ordered)

Following the push-only policy:

1. **Prerequisite:** Merge `chore/vps-migration` to `main`.

2. **Phase 0 (bug fix):** Deploy fix to `PATCH /api/v1/protected/user/newsletter`. Code-only,
   no schema migration.

3. **Schema push:** Add three Drizzle table definitions to `packages/db/src/schemas/newsletter/`.
   Run `pnpm db:push`. Creates tables + Drizzle-managed indexes.

4. **Manual SQL (`apply-postgres-extras.sh` additions):**
   - `manual/0027_newsletter_subscriber_unique_active.sql`
   - `manual/0028_newsletter_delivery_constraints.sql`
   - `manual/0029_newsletter_seed_existing_optins.sql`
   Apply in order.

5. **Integration test** (`packages/db/test/integration/newsletter.test.ts`):
   - Unique constraint on `(user_id, channel)` WHERE `deleted_at IS NULL`.
   - Unique constraint on `(campaign_id, subscriber_id, channel)`.
   - ON CONFLICT DO NOTHING on data migration.

6. **Permission seed:** Add new `PermissionEnum` values, assign to admin roles.

7. **Env var registration:** Add new vars to `packages/config/src/env-registry.hospeda.ts` (§14).
   Run `pnpm env:sync` for each environment.

8. **Redis connectivity:** Confirm `hospeda-redis:6379` is reachable from the API container in
   Coolify. Update `NotificationService` instantiation in `notification-helper.ts` to pass
   the real Redis client (removing the `retryService: null` placeholder).

---

## 13. i18n Keys

All keys added to `packages/i18n/src/locales/{es,en,pt}/`. Primary locale is `es`; `en` and `pt`
files get the same Spanish strings as fallback until translated.

### Footer Newsletter Form
```json
{
  "footer": {
    "newsletter": {
      "title": "Suscribite al newsletter",
      "emailPlaceholder": "Tu email",
      "subscribeButton": "Suscribirme",
      "loadingText": "Enviando...",
      "pendingMessage": "Revisá tu email para confirmar tu suscripción.",
      "alreadySubscribed": "Ya estás suscripto.",
      "manageLink": "Gestionar suscripción",
      "errorMessage": "No pudimos procesar tu suscripción. Intentá de nuevo.",
      "alreadyPendingMessage": "Ya enviamos un email de confirmación. Revisá tu bandeja de entrada o spam.",
      "consentNote": "Al suscribirte aceptás recibir nuestro newsletter y métricas de entrega básicas.",
      "guestLockLabel": "Iniciá sesión para suscribirte"
    }
  }
}
```

### Auth Required Popover
```json
{
  "newsletter": {
    "authPopover": {
      "title": "Iniciá sesión para suscribirte",
      "message": "Creá una cuenta gratuita y recibí novedades del Litoral en tu email.",
      "registerCta": "Registrarse",
      "loginLink": "Ya tengo cuenta"
    }
  }
}
```

### Verification Pages
```json
{
  "newsletter": {
    "verify": {
      "successTitle": "¡Bienvenido! Tu suscripción fue confirmada.",
      "successDescription": "A partir de ahora recibirás novedades de Hospeda en tu email.",
      "homeLink": "Ir al sitio",
      "preferencesLink": "Gestionar preferencias"
    },
    "error": {
      "tokenExpiredTitle": "El enlace expiró",
      "tokenExpiredDescription": "El enlace de confirmación expiró. Podés solicitar uno nuevo.",
      "resendButton": "Reenviar email de confirmación",
      "resendSuccess": "Reenviamos el email de confirmación. Revisá tu bandeja de entrada.",
      "invalidTokenTitle": "Enlace inválido",
      "invalidTokenDescription": "El enlace de confirmación no es válido."
    }
  }
}
```

### Unsubscribe Page
```json
{
  "newsletter": {
    "unsubscribe": {
      "title": "Tu suscripción fue cancelada.",
      "description": "Ya no recibirás emails de Hospeda.",
      "resubscribeLink": "Si fue un error, volver a suscribirme"
    }
  }
}
```

### Account Preferences Page
```json
{
  "account": {
    "newsletter": {
      "title": "Newsletter",
      "statusLabel": "Estado",
      "statusActive": "Activo",
      "statusPending": "Pendiente de verificación",
      "statusUnsubscribed": "No suscripto",
      "statusBounced": "Email inválido",
      "statusComplained": "Cancelado",
      "subscribedSince": "Suscripto desde",
      "cancelButton": "Cancelar suscripción",
      "subscribeButton": "Suscribirme",
      "pendingBanner": "Revisá tu email para confirmar tu suscripción.",
      "resendVerification": "Reenviar email de confirmación",
      "confirmCancelTitle": "¿Cancelar suscripción?",
      "confirmCancelYes": "Sí, cancelar",
      "confirmCancelNo": "No, quedarme"
    }
  }
}
```

### WhatsApp CTA Block
```json
{
  "newsletter": {
    "whatsapp": {
      "title": "Sumate al canal de WhatsApp de Hospeda",
      "description": "Recibí ofertas exclusivas y novedades del Litoral en tu WhatsApp.",
      "ctaButton": "Unirse al canal"
    }
  }
}
```

### Admin UI
```json
{
  "admin": {
    "newsletter": {
      "subscribers": {
        "title": "Suscriptores",
        "filterStatus": "Estado",
        "filterLocale": "Idioma",
        "filterSource": "Origen"
      },
      "campaigns": {
        "title": "Campañas",
        "newCampaign": "Nueva campaña",
        "titleField": "Título interno",
        "subjectField": "Asunto del email",
        "bodyField": "Contenido",
        "localeFilterField": "Audiencia",
        "saveDraft": "Guardar borrador",
        "savedDraftToast": "Borrador guardado.",
        "testSend": "Enviar email de prueba",
        "testSendConfirm": "Se enviará a {email}. ¿Confirmar?",
        "testSentToast": "Email de prueba enviado a {email}.",
        "sendCampaign": "Enviar campaña",
        "readOnlyBanner": "Esta campaña ya fue enviada y no puede editarse.",
        "confirmSendTitle": "Confirmar envío",
        "confirmSendAudience": "{count} suscriptores activos en {locale}",
        "confirmSendSoftcapNote": "Los suscriptores que recibieron un email en los últimos 7 días serán omitidos. {softcapped} excluidos.",
        "confirmSendButton": "Confirmar envío",
        "ignoreSoftCap": "Ignorar límite de frecuencia",
        "noEligibleSubscribers": "No hay suscriptores elegibles para esta campaña.",
        "cancelSend": "Cancelar envío",
        "metrics": {
          "totalRecipients": "Destinatarios",
          "totalSoftcapped": "Excluidos (frecuencia)",
          "delivered": "Entregados",
          "failed": "Fallidos",
          "openRate": "Tasa de apertura",
          "clickRate": "Tasa de clics",
          "viewErrors": "Ver errores"
        }
      }
    }
  }
}
```

### Email Templates (server-side rendered)
```json
{
  "email": {
    "newsletter": {
      "verification": {
        "subject": "Confirmá tu suscripción a Hospeda",
        "greeting": "Hola {firstName},",
        "body": "Gracias por suscribirte al newsletter de Hospeda. Para confirmar tu suscripción, hacé clic en el botón:",
        "ctaButton": "Confirmar suscripción",
        "ignoreNote": "Si no te suscribiste, podés ignorar este email.",
        "linkFallback": "O copiá este enlace en tu navegador:"
      },
      "welcome": {
        "subject": "¡Bienvenido al newsletter de Hospeda!",
        "greeting": "Hola {firstName},",
        "body": "Tu suscripción fue confirmada. Recibirás novedades sobre destinos y alojamientos del Litoral.",
        "whatsappNote": "También podés seguirnos en WhatsApp:",
        "whatsappLink": "Unirse al canal de WhatsApp"
      },
      "unsubscribeLink": "Cancelar suscripción",
      "testBanner": "Este es un email de prueba. No fue enviado a suscriptores reales."
    }
  }
}
```

---

## 14. Dependencies to Add

### `apps/api/package.json`

| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | `^5.x` | In-process Redis job queue for newsletter dispatch |

No other new dependencies in `apps/api`. `node-cron` already added by `chore/vps-migration`.

### `apps/admin/package.json`

| Package | Version | Purpose |
|---------|---------|---------|
| `@tiptap/extension-image` | `^2.x` | Image node support in campaign editor |
| `@tiptap/extension-link` | `^2.x` | Link node support |
| `@tiptap/extension-underline` | `^2.x` | Underline mark support |
| `@tiptap/extension-text-align` | `^2.x` | Text alignment support |

`@tiptap/react` and `@tiptap/starter-kit` are assumed already present per the spec plan.
Confirm before adding duplicates.

### `packages/notifications/package.json`

No new dependencies. `brevo-batch.ts` uses native `fetch` (same pattern as `resend-transport.ts`).

---

## 15. Environment Variables

All new vars must be added to `packages/config/src/env-registry.hospeda.ts` with full metadata,
and to `apps/api/.env.example`.

| Variable | Description | Type | Required | Secret | Default | Apps |
|----------|-------------|------|----------|--------|---------|------|
| `HOSPEDA_NEWSLETTER_HMAC_SECRET` | HMAC-SHA256 secret for verification + unsubscribe tokens. Min 32 bytes. | `string` | Yes | Yes | — | `api` |
| `HOSPEDA_BREVO_WEBHOOK_SECRET` | Static secret for Brevo webhook `X-Sib-Webhook-Token` header verification. | `string` | Yes | Yes | — | `api` |
| `HOSPEDA_NEWSLETTER_SOFTCAP_DAYS` | Rolling window (days) for the per-subscriber send frequency cap. | `number` | No | No | `7` | `api` |
| `HOSPEDA_NEWSLETTER_BATCH_SIZE` | Emails per Brevo batch call (1-100; Brevo batch limit per messageVersions). | `number` | No | No | `100` | `api` |
| `HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY` | BullMQ worker concurrency (number of parallel batch jobs). | `number` | No | No | `5` | `api` |
| `PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL` | WhatsApp channel link. If unset, CTA block is hidden. | `string` | No | No | — | `web`, `admin` |

**Variables already provided by `chore/vps-migration` (keep, do not re-register):**

| Variable | Already provides |
|----------|-----------------|
| `HOSPEDA_EMAIL_API_KEY` | Brevo API key for transactional emails (format `xkeysib-*`) |
| `HOSPEDA_EMAIL_FROM_EMAIL` | Sender email address |
| `HOSPEDA_EMAIL_FROM_NAME` | Sender display name |
| `HOSPEDA_CRON_ADAPTER` | `node-cron` in prod, `manual` in dev/test |

**Removed from v1 (do not add):**

- `HOSPEDA_BREVO_API_KEY` — superseded by `HOSPEDA_EMAIL_API_KEY`.
- `HOSPEDA_BREVO_FROM_EMAIL` — superseded by `HOSPEDA_EMAIL_FROM_EMAIL`.
- `HOSPEDA_BREVO_FROM_NAME` — superseded by `HOSPEDA_EMAIL_FROM_NAME`.
- `QSTASH_TOKEN`, `QSTASH_URL` — QStash is gone.
- `HOSPEDA_NEWSLETTER_BATCH_SIZE` at default 500 — changed to 100 (Brevo's messageVersions limit).

**Zod validation additions in `apps/api/src/utils/env.ts`:**
```ts
HOSPEDA_NEWSLETTER_HMAC_SECRET:          z.string().min(32),
HOSPEDA_BREVO_WEBHOOK_SECRET:            z.string().min(10),
HOSPEDA_NEWSLETTER_SOFTCAP_DAYS:         z.coerce.number().int().min(1).max(365).optional().default(7),
HOSPEDA_NEWSLETTER_BATCH_SIZE:           z.coerce.number().int().min(1).max(100).optional().default(100),
HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY:   z.coerce.number().int().min(1).max(20).optional().default(5),
```

**Zod validation for web/admin:**
```ts
PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL: z.string().url().optional(),
```

After adding env vars: run `pnpm env:sync --app=api --env=production` for each environment.

---

## 16. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Worker process crash mid-dispatch** | Low | Medium (in-flight batch lost) | BullMQ persists jobs in Redis. On restart, jobs in `active` state are requeued. Combined with delivery idempotency check (`status !== 'pending'` guard), already-sent emails are not re-sent. |
| **Redis OOM under large campaign spikes** | Low (10k jobs × 5KB = 50MB) | Medium (queue unavailable) | Configure `removeOnComplete: { age: 3600 }` and `removeOnFail: { age: 86400 }`. Monitor Redis memory via Better Stack. Alert at 70% used. |
| **Brevo webhook replay attacks** | Low | Medium (fake bounce events, subscriber suppression) | `timingSafeEqual` on `X-Sib-Webhook-Token`. Delivery idempotency: `processBrevoWebhookEvent()` uses `UPDATE ... WHERE opened_at IS NULL` pattern. Log all signature failures to Sentry. |
| **Brevo API key rotation procedure unclear** | Low | High (newsletter delivery stops until key updated) | Document rotation procedure in `docs/guides/brevo-api-key-rotation.md`. Key lives in Coolify env vars — update there, redeploy API container. No code change needed. |
| **HMAC secret leak** | Low | High (tokens forged to mass-unsubscribe) | Secret stored only in env var (not in DB or logs). Rotation procedure documented (§9.2). Token signing includes subscriber ID so a leaked token affects only one subscriber. |
| **BullMQ job re-trigger causes duplicate send** | Low | High (subscribers receive email twice) | Unique constraint on `(campaign_id, subscriber_id, channel)` prevents duplicate delivery rows. `processBatch()` checks `status !== 'pending'` at the start of each delivery. |
| **Brevo webhook header name change** | Low | Medium (webhook verification breaks silently) | Verify `X-Sib-Webhook-Token` against current Brevo docs before implementation. Add integration test that mocks the header. Pin Brevo webhook config in the Brevo dashboard. |
| **Brevo batch `messageVersions` limit is not 100** | Medium (Brevo docs vary by plan) | Medium (batch calls fail) | Verify exact limit from context7 Brevo docs before implementing `brevo-batch.ts`. `HOSPEDA_NEWSLETTER_BATCH_SIZE` env var allows runtime adjustment without deploy. |
| **`settings.newsletter` boolean out of sync** | High (migration edge cases) | Low | Migration SQL uses `ON CONFLICT DO NOTHING`. Legacy flag is not removed; users may re-toggle it via the deprecated endpoint. Accepted V2 cleanup item. |
| **Subscriber list performance at 50k+ rows** | Low (current scale) | Medium | All admin filter paths indexed. Confirm with EXPLAIN ANALYZE before Phase 4 go-live. |
| **TipTap JSON XSS in email body** | Low | High (if not mitigated) | `renderTiptapContent()` escapes all text nodes and link hrefs. Campaign body is admin-authored (trusted), but escaping is applied regardless. Click URL scheme validation is Brevo's responsibility. |
| **Campaign cancel race (emails sent after cancel)** | Low | Low (few emails sent in edge window) | Documented accepted edge case (AC-101-12.2). BullMQ workers check delivery status at start of `processBatch()`. |

---

## 17. Testing Strategy

### 17.1 Unit Tests (pure logic, TDD-first)

**`packages/service-core/src/services/newsletter/`**
- `newsletter-token.helpers.test.ts` — generateVerificationToken (TTL enforcement, HMAC mismatch, base64url), generateUnsubscribeToken (stability, rotation behavior)
- `newsletter-subscriber.service.test.ts` — subscribe state machine (all transitions), resend rate limit, eligibility query logic with soft-cap
- `newsletter-campaign.service.test.ts` — send() preconditions, cancel() transitions, metrics computation, closeSentCampaigns()
- `newsletter-delivery.service.test.ts` — processBatch() idempotency, skipped-subscriber check, retry count increment, batch grouping logic

**`packages/schemas/src/entities/newsletter/`**
- Schema validation happy/sad paths for all three entities
- Admin search schema unknown-field rejection

**`packages/utils/src/`** (after tiptap-renderer.ts extraction)
- `tiptap-renderer.test.ts` — existing tests plus new `horizontalRule` case plus email-safe transformer (img inline styles, p inline styles)

### 17.2 Integration Tests

**API routes (route + service + real DB)**
- `apps/api/test/integration/newsletter/subscribe.test.ts` — double opt-in flow end-to-end
- `apps/api/test/integration/newsletter/dispatch.test.ts` — send campaign, BullMQ mocked with `bullmq/testing`, DB state verified
- `apps/api/test/integration/newsletter/webhook.test.ts` — Brevo webhook signature validation and subscriber state transitions
- `apps/api/test/integration/newsletter/worker.test.ts` — `processBatch()` with Brevo API mocked, delivery row assertions

**DB constraints**
- `packages/db/test/integration/newsletter.test.ts` — unique constraint on subscriber, unique constraint on delivery, partial index behavior on soft-deleted rows

### 17.3 E2E Tests (Playwright)

- `newsletter/subscribe-verify.spec.ts` — footer subscribe → verification email (mocked) → confirmado page → WA CTA visible
- `newsletter/unsubscribe-email.spec.ts` — unsubscribe token link → desuscripto page
- `newsletter/account-preferences.spec.ts` — account preferences page states
- `newsletter/admin-campaign.spec.ts` — create draft → test send → send campaign → view metrics → cancel

### 17.4 Webhook Simulation

- POST with valid `X-Sib-Webhook-Token` for bounce, complaint, opened, click, unsubscribed events.
- POST with invalid token — assert 401.
- Assert delivery and subscriber DB state after each event type.

### 17.5 Dispatch Idempotency Test

- Call `processBatch({ deliveryIds: [id] })` twice concurrently for the same delivery.
- Assert exactly one Brevo API call was made (second call detects `status !== 'pending'`).
- Assert `providerMessageId` is set from first call only.

---

## 18. Open Questions / Decisions Resolved vs Still Open

### Resolved by architecture decision:

- **QStash vs BullMQ** — resolved: BullMQ on existing Redis (embedded worker).
- **Resend vs Brevo transport** — resolved: Brevo only (already merged in `chore/vps-migration`).
- **Custom pixel vs Brevo native tracking** — resolved: Brevo native (`trackOpens`, `trackClicks`).
- **Single send vs batch send** — resolved: Brevo `messageVersions` batch, 100 per call.
- **Separate worker service vs embedded** — resolved: embedded in `apps/api` process.
- **Image support in TipTap** — resolved: supported via existing media upload endpoint + `@tiptap/extension-image`.

### Still open (decide before implementation):

1. **Brevo `messageVersions` exact field shape and plan-tier limit.** The batch endpoint field name
   may be `messageVersions` or the body may use a different structure depending on Brevo plan.
   Check via context7 Brevo v3 API docs before implementing `brevo-batch.ts`.

2. **Brevo webhook header exact name.** `X-Sib-Webhook-Token` is the historical name. Verify
   against current Brevo webhook docs before implementing signature check.

3. **`consentVersion` initial value.** Decide the string (e.g., `"v1"`) and where it is defined
   (constant in `newsletter-token.helpers.ts` or env var). Recommend: hardcoded constant `"v1"`.

4. **Redis client import pattern.** `apps/api/src/utils/redis.ts` must export a Redis client
   suitable for passing to BullMQ `Queue` and `Worker`. Confirm it exports an `ioredis` `Redis`
   instance (BullMQ requires `ioredis`). If it exports a different client, wrap it or change the
   export.

---

## 19. Implementation Approach (Phase Ordering)

Phases mirror the spec outline, ordered bottom-up by layer:

**Phase 0 — Bug fix (no schema changes)**
1. Fix `PATCH /api/v1/protected/user/newsletter` to write `settings.newsletter`.
2. Add regression test.

**Phase 1 — Foundation (bottom-up)**
1. Confirm `chore/vps-migration` is merged. Verify Brevo transport + Redis + node-cron in `main`.
2. Add `bullmq` to `apps/api/package.json`.
3. Verify Redis client in `apps/api/src/utils/redis.ts` exports `ioredis` instance.
4. Extract `renderTiptapContent()` to `@repo/utils`. Add email-safe transformer in `@repo/notifications`.
5. Add Drizzle schema definitions for three tables. Register in schema index.
6. Add `NewsletterSubscriberModel`, `NewsletterCampaignModel`, `NewsletterDeliveryModel` to `@repo/db`.
7. Add manual SQL files 0027, 0028, 0029. Update `apply-postgres-extras.sh`.
8. Run `pnpm db:push` + `apply-postgres-extras.sh` in dev.
9. Add Zod schemas to `@repo/schemas` (all files per entity).
10. Add new `PermissionEnum` values + seed.
11. Add `brevo-batch.ts` to `@repo/notifications`. Add `NotificationType.NEWSLETTER_*` values.
12. Add newsletter email templates (verify, welcome, campaign wrapper).
13. Implement `newsletter-token.helpers.ts`.
14. Implement `NewsletterSubscriberService` + unit tests.
15. Implement `NewsletterCampaignService` + unit tests.
16. Implement `NewsletterDeliveryService` (including `enqueueBatches` + `processBatch`) + unit tests.
17. Implement `NewsletterTrackingService.processBrevoWebhookEvent()` + unit tests.
18. Implement `apps/api/src/workers/newsletter-dispatch.worker.ts`.
19. Wire worker startup + graceful shutdown in `apps/api/src/index.ts`.
20. Add `newsletter-close-campaigns` node-cron job to `apps/api/src/cron/jobs/`.
21. Connect `RetryService` to real Redis in `notification-helper.ts`.

**Phase 2 — Subscription flow (API + Web)**
22. Add public API routes (verify, unsubscribe).
23. Add protected API routes (subscribe, status, resend, unsubscribe).
24. Add Brevo webhook route (`POST /api/v1/public/webhooks/brevo`).
25. Add `NewsletterForm.client.tsx` React island + `AuthRequiredPopover`.
26. Add web pages: `/newsletter/confirmado/`, `/newsletter/error/`, `/newsletter/desuscripto/`.
27. Add account preferences page `/mi-cuenta/preferencias/newsletter/`.
28. Add all i18n keys.
29. Add env vars to registry + `apps/api/src/utils/env.ts` + `.env.example`.

**Phase 3 — Admin UI**
30. Install TipTap packages in `apps/admin` (`@tiptap/extension-image`, link, underline, text-align).
31. Create `RichTextEditor` component wrapping TipTap (StarterKit + extensions).
32. Add admin API routes (all campaign + subscriber routes).
33. Add admin pages: `/admin/newsletter/subscribers/`, `/admin/newsletter/campaigns/`, campaigns detail.
34. Add TanStack Query hooks for all admin endpoints.
35. Wire permission guards with new `NEWSLETTER_*` permissions.

**Phase 4 — Dispatch engine integration tests**
36. Integration + E2E tests for dispatch, webhook, worker idempotency.
37. Load test: seed 1k subscribers, trigger campaign, measure end-to-end delivery time.

**Phase 5 — Polish**
38. ADR documenting BullMQ + Brevo-batch + Brevo-native-tracking architecture decisions.
39. Update `packages/db/docs/triggers-manifest.md` with new manual SQL files.
40. VPS smoke tests.
41. Coverage audit (target: 90% services, 80% routes/UI).

---

*Analysis v2 complete. Sections changed from v1: Architecture Overview (§1), Dispatch Architecture (§8, entirely rewritten), Notifications Integration (§6, Brevo transport clarified + batch helper added), Open/Click Tracking (removed custom pixel/redirect, replaced with Brevo native), Data Model (§2, added `total_softcapped` column), Service Layer (§4, added `enqueueBatches`, `processBatch`, `processBrevoWebhookEvent`), Environment Variables (§15, removed QStash + old Brevo vars, added BullMQ-specific vars), Risk Assessment (§16, added 4 new risks), Dependencies (§14, new section), Implementation Approach (§19, QStash steps replaced with BullMQ + worker steps), added §0 (dependency on vps-migration).*
