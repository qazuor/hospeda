# ADR-027: Newsletter Dispatch Architecture

## Status

Accepted (2026-05-13)

## Context

SPEC-101 introduces a self-hosted newsletter MVP (email + WhatsApp channel CTA
link). The dispatch engine has to fan out a single campaign into thousands of
per-subscriber emails, survive partial provider failures, and honor a rolling
soft-cap window per subscriber, all while running on the existing VPS
infrastructure deployed in `chore/vps-migration` (Coolify on Vultr, Postgres,
shared Redis, no external task queue).

Four architectural choices needed to be locked in:

1. Job runtime (queue + worker).
2. Worker process topology (embedded vs separate service).
3. Email transport (per-recipient vs batch).
4. Verify / unsubscribe token design.

The constraints were:

- No new infrastructure components (the VPS was just stabilized; adding a
  dedicated queue service would re-open Phase 16.4 cleanup).
- No external HTTP-cron dependency (QStash was decommissioned with the rest of
  the Vercel teardown).
- Operate within Brevo's free / Pro tier rate limits (14 req/s sustained).
- Cost-aware: MVP traffic is small (low hundreds to low thousands of
  subscribers), so any per-job hosting cost has to be near zero.
- Privacy- and auditability-friendly token model (no opaque random tokens that
  require a DB lookup on the public verification path).

## Decision

### 1. Job runtime: BullMQ on the existing Redis

We adopted [BullMQ 5.x](https://docs.bullmq.io/) backed by the same Redis
instance already used by the auth lockout cache and the notification
idempotency layer. The dispatch queue is named `hospeda-newsletter-dispatch`;
delivery row IDs are batched into jobs of 100 and processed with concurrency 5
(driven by `HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY`, max 20). Job-level retry is
`attempts: 3` with exponential backoff at 30s. After exhaustion the worker
bulk-updates the affected deliveries to `status='failed'`.

### 2. Worker topology: embedded in `apps/api`

The BullMQ worker boots inside the API process via `startNewsletterWorker()`
from `apps/api/src/index.ts`, gated by `NODE_ENV !== 'test'`. Graceful
shutdown drains in-flight jobs by awaiting `worker.close()` before disconnecting
Redis and closing the DB pool.

### 3. Email transport: Brevo batch API

Each BullMQ job calls `NewsletterDeliveryService.processBatch()`, which renders
the campaign body to HTML once, builds per-recipient `messageVersions`, and
sends a single batch request to Brevo's `/v3/smtp/email`. Open and click
tracking are handled by Brevo natively (`trackOpens: true, trackClicks: true`);
the Brevo webhook posts events back to
`POST /api/v1/public/webhooks/brevo/:token`, where `:token` is a static
shared secret (`HOSPEDA_BREVO_WEBHOOK_SECRET`) embedded in the URL. See
SPEC-115 for why URL-embedded auth was chosen over header-based: Brevo
strips custom auth on dashboard edits, but accepts arbitrary URLs.

### 4. Token model: HMAC-SHA256 with embedded payload

Verify and unsubscribe tokens are not opaque random strings. They are
`HMAC_SHA256(payload, HOSPEDA_NEWSLETTER_HMAC_SECRET)` over a payload that
encodes `{ subscriberId, type: 'verify' | 'unsubscribe', exp }`. The public
endpoints validate the HMAC and exp without a DB lookup on the hot path,
falling back to redirect-to-error for expired / tampered tokens.

## Alternatives considered

### Job runtime alternatives

- **QStash (the previous design).** Rejected. QStash was removed in Phase 16.4
  along with the rest of the Vercel-era stack and is not reachable from the
  VPS without re-introducing an external paid dependency. Also, schedule-based
  invocation is a poor fit for the soft-cap fan-out (we'd need a self-managed
  job table for retries anyway).
- **`node-cron` + an in-process queue array.** Rejected. node-cron is already
  used for scheduled jobs (16 of them) but it has no persistence, retries, or
  visibility into in-flight work. A crash mid-campaign would lose pending
  batches and silently drop emails.
- **A dedicated worker service (e.g. Temporal, sidekiq-style).** Rejected for
  MVP scale. Adds an extra Coolify app, an extra deploy target, and an extra
  failure mode for tens of thousands of emails per month at most.

### Worker topology alternatives

- **Separate Coolify app for the worker.** Rejected. The API is already
  long-running and stateful (Redis client, DB pool, Sentry). Splitting the
  worker into its own service would duplicate the boot wiring and double the
  ops surface for negligible isolation benefit at MVP traffic.
- **Self-managed worker pool (custom polling loop).** Rejected. We'd be
  re-implementing BullMQ poorly. BullMQ already handles atomic claim, job
  state, retry timing, and event hooks.

### Email transport alternatives

- **Per-recipient sends through the existing `NotificationService`.** Rejected.
  A 10k-subscriber campaign would hit Brevo with 10k individual HTTP calls and
  burn the rate limit budget for transactional email. Brevo's batch endpoint
  fits exactly this fan-out shape.
- **Resend.** Rejected. We already pay for Brevo for transactional email and
  account confirmations; introducing a second ESP doubles credentials,
  webhook plumbing, and bounce-handling logic.
- **AWS SES.** Rejected. Operationally heavier for MVP (deliverability warmup,
  reputation management, SNS bounce wiring) and we'd lose the existing Brevo
  webhook payload schema that's already wired.

### Token model alternatives

- **Opaque random tokens stored in a `newsletter_tokens` table.** Rejected.
  Forces a DB lookup on every public verification or unsubscribe click,
  including bot traffic against expired links. Also pushes a TTL-cleanup cron
  job onto our plate.
- **JWT.** Rejected. Overkill for two single-purpose tokens. Smaller surface
  area to audit with a hand-rolled HMAC envelope, and we avoid pulling a JWT
  library into the public verification path.

## Consequences

### Positive

- Zero new infrastructure. Same Redis, same API process, same Brevo account.
- Worker close on `SIGTERM` drains in-flight jobs, so rolling deploys don't
  drop emails mid-batch.
- The Redis connection used by BullMQ is the same one passed to
  `RetryService` — connecting it revives transactional retry logic that was
  previously inert (see notification-helper.ts).
- Public verify / unsubscribe links are stateless; no DB hit on the hot path.
- Brevo batch + `messageVersions` keeps the per-campaign HTTP volume at
  ~`ceil(N / 100)` requests, comfortably inside Brevo Pro rate limits.

### Negative / accepted tradeoffs

- A campaign in flight survives only as long as Redis does. If we lose Redis
  (eviction, container crash without persistence) mid-dispatch, BullMQ job
  state is lost; remaining `pending` delivery rows would be re-discovered by
  the `closeSentCampaigns` cron after manual intervention. Acceptable at MVP
  scale; revisit if we move beyond ~10k subscribers per campaign.
- The HMAC token can be replayed up to its `exp` if an attacker captures it.
  Tokens are time-bounded and single-purpose, and the unsubscribe action is
  idempotent. Acceptable.
- Embedded worker means worker CPU contends with HTTP traffic. Concurrency is
  capped at 5 by default and capped at 20 by env validation, which keeps
  worst-case dispatch CPU bounded.
- `processBatch()` throws (instead of returning a `Result`) when Brevo HTTP
  fails, so retry can be driven by BullMQ. Service callers other than the
  worker have to handle that throw explicitly — documented in the service
  JSDoc and in the worker's try/catch contract.

## Related work

- SPEC-101 tech-analysis §8 (Dispatch Architecture)
- T-101-44 — BullMQ worker implementation (`apps/api/src/workers/newsletter-dispatch.worker.ts`)
- T-101-45 — Worker lifecycle in `apps/api/src/index.ts`
- T-101-46 — RetryService → Redis (`apps/api/src/utils/notification-helper.ts`)
- T-101-47 — `closeSentCampaigns` cron (every 5 minutes)
- ADR-024 — env schema SSOT (registers the newsletter env vars)
