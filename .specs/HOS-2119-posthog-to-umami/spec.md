---
title: Migrate product analytics from PostHog to self-hosted Umami, and surface Umami stats to listing owners
linear: HOS-2119
statusSource: linear
created: 2026-11-14
decisionsResolvedOn: 2026-11-14
type: feature
areas:
  - web
  - admin
  - api
  - devops
---

# Migrate product analytics from PostHog to self-hosted Umami

## 1. Summary

Owner decision (12/11/2026, HOS-2119): product analytics moves from PostHog to
**Umami**. Owner request (14/11/2026):

> «quiero migrar de posthog a umami self hosted, con eventos propios etc. y luego
> consultar el api de umami para mostrar estadísticas en hospeda a los clientes»

This spec covers three things, in order:

1. **Infra** — a self-hosted Umami instance on the VPS (Coolify), served first-party.
2. **Migration** — every event in `@repo/analytics` (web, admin, api, including the
   `billing_*` / `trial_*` facts from HOS-1878) emitted to Umami, the six PostHog
   dashboards rebuilt as Umami reports, and PostHog removed.
3. **Owner stats** — Hospeda reads Umami's API server-side and shows enriched
   statistics (traffic sources, countries, devices, contact funnel) to listing
   owners, next to the counts they already get from `entity_views`.

**All open questions in §11 were decided by the owner on 2026-11-14.** They are kept
in place, each marked RESOLVED, as a decision record.

## 2. Problem

- PostHog is wired into four surfaces (web snippet, admin client, `posthog-node` in
  the api, a Cloudflare proxy worker) plus CSP, the env registry, CI, docs and
  `scripts/posthog`. The owner wants to leave it.
- HOS-1887 (rebuild the billing dashboards in PostHog) is superseded: that work now
  happens directly in Umami.
- Listing owners see only raw view counts (`entity_views`). Where visitors come
  from, which country, which device, and how many of them start a contact are
  questions the product cannot answer for them today.

## 3. Goals

- G-1 A self-hosted Umami instance in production and staging, reachable
  first-party, with backups.
- G-2 Every event in `AnalyticsEventSchemas` (`catalog.ts` + `catalog-billing.ts`)
  reaches Umami from the same call sites as today, through `@repo/analytics`, with
  the existing Zod validation and anti-PII guards unchanged.
- G-3 The six PostHog dashboards (`00 Resumen` … `05 Calidad`, from
  `scripts/posthog/data.ts`) exist as Umami boards/reports.
- G-4 PostHog removed: no SDK, no env var, no CSP entry, no worker, no doc that
  presents it as live.
- G-5 An owner sees, for each listing they own — accommodation, venue,
  experience and partner, all in the first release (OQ-7) — enriched stats from
  Umami (top referrers, countries, devices, contact funnel) for 7d / 30d / 90d.
- G-6 The owner stats panel never fails because Umami is down or slow: the Umami
  cards hide, the `entity_views` cards stay.

## 4. Non-goals

- Keeping PostHog historical data in any form. It is discarded (OQ-3).
- Session replay. It is already disabled on web and admin
  (`disable_session_recording: true`), so nothing is lost.
- Feature flags. Admin's feature flags (`apps/admin/src/features/feature-flags`)
  are Hospeda's own and do not use PostHog.
- Replacing `entity_views` as the source of the counts already promised to owners
  and partners (HOS-734, HOS-1063). See OQ-1.
- Giving owners direct access to the Umami UI or share links.
- Mobile (`apps/mobile`) analytics. It has no PostHog today.

## 5. Current baseline

Measured on `origin/staging` @ `a3b8325` (2026-11-13).

### 5.1 The abstraction that already exists

`packages/analytics` is provider-agnostic in its core:

- `catalog.ts` / `catalog-billing.ts` — ~60 typed events with Zod schemas.
- `shared.ts` — `prepareAnalyticsEvent`, global/person property schemas,
  `FORBIDDEN_PROPERTY_KEY_REGEX`, `validateDistinctId`.
- `server.ts` — `createServerAnalytics({ getClient })`, where the client is any
  object with `capture({ distinctId, event, properties, uuid?, timestamp? })`.
- `browser.ts` — browser counterpart.

The PostHog coupling lives outside it.

### 5.2 PostHog footprint

| Surface | Files |
|---|---|
| api | `apps/api/src/lib/posthog.ts` (lazy `posthog-node` singleton, flush on shutdown), `lib/auth-signup-analytics.ts`, `lib/analytics-event-uuid.ts`, `utils/analytics/analytics-facts.ts`, `services/ai-observability.service.ts` (distinctId `api-server`), routes: `conversations/*/initiate`, `accommodation/protected/publish`, `accommodation/protected/import-from-url`, `host-onboarding/protected/start`, `ai/protected/chat*` |
| web | `components/analytics/PostHogScript.astro`, `posthog.snippet.ts`, `lib/analytics/posthog-client.ts`, the three `*ViewTracker.client.tsx`, ~12 islands calling capture, `layouts/BaseLayout.astro` / `StandaloneLayout.astro`, `lib/cookie-consent.ts` (`CONSENT_CHANGED_EVENT`), `lib/csp-soft-nav-script-hashes.ts`, `lib/middleware-helpers.ts` (CSP) |
| admin | `lib/analytics/posthog-client.ts`, `contexts/auth-context.tsx` (identify), `contexts/tour-context.tsx`, `components/whats-new/*`, `routes/__root.tsx`, `lib/csp-nonce.ts` |
| infra | `infra/cloudflare/posthog-proxy/` (first-party `/api/relay/*`, recovers ad-blocked traffic, BETA-77) |
| config | `HOSPEDA_POSTHOG_KEY/HOST`, `PUBLIC_POSTHOG_KEY/HOST`, `VITE_POSTHOG_KEY/HOST` in `packages/config/src/env-registry*.ts` + app `env-schema.ts`, Dockerfile build args test |
| CI | `.github/workflows/ci.yml`, `e2e-pr.yml`, `e2e-nightly.yml`, `a11y-sweep.yml` |
| dashboards | `scripts/posthog/{client,data,definitions,setup}.ts` — six dashboards, 9 funnels |
| docs | `docs/analytics/*.md` (README, event-catalog, event-migrations, posthog-audit, posthog-dashboards, session-replay-privacy), `docs/guides/*`, two ADRs |

### 5.3 Consent model (web)

Before consent: anonymous, cookieless capture (`persistence: 'memory'`). After
consent: `localStorage+cookie`, `identify`, person properties.

### 5.4 Owner stats today

`entity_views` (SPEC-159) + monthly rollup (HOS-1063 A-6), fed by
`sendViewBeacon` (`apps/web/src/lib/analytics/view-capture.ts`). Read by
`/api/v1/protected/views/*` (e.g. `accommodations/me/daily-series`, scoped by
`actor.id`, `ACCOMMODATION_VIEW_OWN`). Shown in
`apps/web/src/components/host/AnalyticsSection.client.tsx` and admin's
`ViewsWidget`.

Recorded precedent (HOS-734, HOS-1063 OQ-2): *the beacon feeds the owner-facing
number; PostHog feeds funnels*, because querying a third party on an authenticated
render means its outage takes the panel down.

### 5.5 Umami facts this design relies on

- Custom events: `umami.track(name, data)`. Event names are truncated at 50
  chars; event data: strings max 500 chars, max 50 properties, numbers max
  precision 4. All current Hospeda event names fit.
- Identity: `umami.identify(id, data)` sets a Distinct ID plus session data. No
  person profiles comparable to PostHog's.
- Server-side ingestion: `POST /api/send` and `POST /api/batch`, no auth token,
  but a valid `User-Agent` header is required or the request is rejected.
- Read API (self-hosted): API keys are the recommended auth; username/password
  login still works. Endpoints used here: `/api/websites/:id/stats`,
  `/metrics`, `/pageviews`, `/events/stats`, `/event-data/*`.
- Reports: funnels, journeys, retention, goals.

## 6. Proposed design

### 6.1 Infra — **DECIDED: self-hosted**

- Umami container in Coolify, one instance per environment (staging, prod).
- Storage: **its own Postgres container** in Coolify (OQ-6), fully isolated from
  the Hospeda database server.
- Tracker and ingestion served from a **same-origin path behind Cloudflare** (OQ-4),
  reusing the `/api/relay/*` pattern of the PostHog proxy so ad-block recovery is
  kept. Exact path and script name settled in T-0.
- One Umami website per surface: `hospeda-web`, `hospeda-admin`. Server events go
  to the website of the surface they describe (billing/onboarding facts →
  `hospeda-web`).
- A dedicated read-only Umami user with an API key for Hospeda's API. The admin
  account is never used by code.
- Backups: the Umami Postgres container joins the VPS backup routine (`hops`),
  with a restore check in the runbook.

### 6.2 Provider adapter in `@repo/analytics`

- New `packages/analytics/src/providers/umami-server.ts`: implements
  `ServerAnalyticsClient` over `POST /api/batch` with native fetch, a small
  in-memory queue (flush at N events or T seconds, flush on shutdown — same
  lifecycle as `lib/posthog.ts` today), a fixed server `User-Agent`, and a timeout.
  Failures log via `@repo/logger` and never throw into the caller.
- New `packages/analytics/src/providers/umami-browser.ts`: wraps `window.umami`
  behind the existing browser interface; no-op when the tracker is not loaded.
- `apps/api/src/lib/posthog.ts` → `apps/api/src/lib/analytics-client.ts`, which
  returns a **fan-out client** during coexistence (PostHog + Umami) and only Umami
  after the cut (OQ-2).
- Mapping:
  - `event` → Umami event name (unchanged, snake_case).
  - `properties` (already sanitized by `prepareAnalyticsEvent`) → event `data`.
    Arrays become strings (Umami behavior); the only array today is `roles`, which
    is acceptable.
  - `distinctId` → Umami Distinct ID, only for events that today carry a real user
    id; `api-server` events send none.
  - `uuid` (`analytics-event-uuid.ts`) → kept as a `data.event_uuid` property for
    dedup audits.
  - Person properties (`AnalyticsPersonPropertiesSchema`) → `identify` session data,
    only after consent (§6.3).
- New guard: every `AnalyticsEventSchemas` entry fits Umami's limits (name ≤ 50
  chars, ≤ 50 properties, no string enum value > 500 chars). Unit test in
  `packages/analytics/test/`.

### 6.3 Web and admin

- `PostHogScript.astro` → `UmamiScript.astro`, with `data-auto-track` for pageviews
  and explicit `track` calls through `@repo/analytics/browser`.
- Consent: Umami is cookieless, so pre-consent capture keeps working without the
  memory-persistence trick. `identify` (Distinct ID + session data) runs only after
  consent, listening to `CONSENT_CHANGED_EVENT` exactly as today.
- Admin: same, without `identify` beyond the staff user id (OQ-5).
- CSP: remove PostHog hosts/hashes, add the Umami script origin; update
  `csp-soft-nav-script-hashes.ts` and `csp-nonce.ts`.

### 6.4 Dashboards

- `scripts/posthog/` → `scripts/umami/`: same idea (definitions as code, idempotent
  `setup.ts`), targeting Umami's boards/reports API.
- The six dashboards and nine funnels are rebuilt. Where PostHog relied on person
  properties or SQL insights Umami cannot express, the gap is listed in
  `docs/analytics/umami-dashboards.md` with what replaces it (an `event-data`
  breakdown, or an admin page reading Hospeda's own DB).
- HOS-1887 is closed as superseded by this spec.

### 6.5 Owner stats from the Umami API

- `packages/service-core`: `ListingTrafficStatsService` with an injected
  `UmamiStatsClient` (`apps/api/src/lib/umami-stats-client.ts`, native fetch,
  API-key auth, 3 s timeout).
- Route: `GET /api/v1/protected/views/:entityType/:entityId/traffic-stats?window=7d|30d|90d`,
  next to the existing `routes/views/protected/*`. `entityType` ∈ `ACCOMMODATION`,
  `VENUE`, `EXPERIENCE`, `PARTNER` (the owner-facing subset of
  `TRACKABLE_ENTITY_TYPES`).
  - Authorization through `resolveListingAccess` (`middlewares/listing-access.ts`, ownership). Someone else's
    listing → **404**.
  - Response: `{ window, available: boolean, referrers[], countries[], devices[],
    contactFunnel: { views, contactStarted, contactCompleted } }`.
  - On Umami error or timeout: `200` with `available: false` and empty arrays.
    Never `5xx` for an Umami failure.
- Filtering per listing: by event data `entity_id` (sent by the view trackers and
  the contact events), **not** by URL path — slugs change and every listing has
  `/es/`, `/en/` and `/pt/` paths.
- Cache: Redis, key `traffic-stats:{entityType}:{entityId}:{window}`, TTL 1 h.
- UI: one shared island (`TrafficStatsCards.client.tsx`) mounted below the
  existing `entity_views` cards in every owner panel: accommodation
  (`AnalyticsSection.client.tsx`), venue, experience, and the partner panel from
  HOS-1063. Cards hide when `available: false`. Copy in es/en/pt.
- All four verticals ship together (OQ-7). Their pages already send `entity_id`
  through `EntityViewTracker`; T-0 confirms the property reaches Umami for each.

### 6.6 Removal

After the cut (OQ-2): delete PostHog clients, env vars (registry, `env.ts`,
`.env.example`, Coolify via `hops env-*`), CI references, the Cloudflare worker
(and its Wrangler deploy), `scripts/posthog`, PostHog docs. Rewrite
`docs/analytics/README.md` and `event-catalog.md` for Umami. Add an ADR
"Umami over PostHog".

## 7. Data model / contracts

- No Hospeda DB migration.
- New env vars (server): `HOSPEDA_UMAMI_URL`, `HOSPEDA_UMAMI_WEBSITE_ID_WEB`,
  `HOSPEDA_UMAMI_WEBSITE_ID_ADMIN`, `HOSPEDA_UMAMI_API_KEY` (read-only user).
  Client: `PUBLIC_UMAMI_SCRIPT_URL`, `PUBLIC_UMAMI_WEBSITE_ID`,
  `VITE_UMAMI_SCRIPT_URL`, `VITE_UMAMI_WEBSITE_ID`. Registered per the env-var rule
  (registry + Zod + `.env.example` + docs + Coolify). Label `release-env-var-change`.
- New Zod schema `ListingTrafficStatsResponseSchema` in `packages/schemas`.

## 8. UX / UI behavior

- Owner panel: existing view-count cards unchanged. New cards: «De dónde vienen»
  (top 5 referrers), «Países», «Dispositivos», «Contactos» (views → started →
  completed).
- Window selector shared with the existing cards.
- When Umami is unavailable, the new cards are not rendered; no error banner.
- Empty state (listing with no traffic): the cards show «Todavía no hay datos».

## 9. Acceptance criteria

- AC-1 Staging and prod Umami instances run in Coolify, are backed up, and a
  restore was tested once (runbook entry).
- AC-2 With `HOSPEDA_UMAMI_*` set, every server call site in §5.2 produces the
  same event name and properties in Umami that it produces in PostHog (compared
  over the coexistence window, ±5% on counts).
- AC-3 With Umami unreachable, no api request fails or slows by more than the
  adapter's timeout budget; errors are logged once per flush.
- AC-4 A unit test fails if any catalog event exceeds Umami's limits.
- AC-5 Web before consent: pageviews and anonymous events reach Umami; no
  `identify`. After consent: `identify` with the user's id runs once per session.
- AC-6 The six dashboards exist in Umami, created by `scripts/umami/setup.ts`
  idempotently (running it twice changes nothing).
- AC-7 `GET …/traffic-stats` returns 404 for a listing the actor does not own,
  and 200 with data for their own, for each of the four entity types.
- AC-8 With Umami down or slow (> 3 s), `…/traffic-stats` returns
  `available: false` within budget and the panel shows only the `entity_views`
  cards.
- AC-9 After removal: `grep -ri posthog apps packages infra scripts .github`
  (excluding historical docs/ADRs) returns nothing, and `pnpm check:guards` is
  green.
- AC-10 HOS-1878's pending smoke checks (AC-P4, AC-P5) can be signed from Umami
  if the cut happens before they are observed.

## 10. Risks

- R-1 **Server-side event attribution.** Umami derives sessions from IP +
  User-Agent; every server event comes from the api's IP. Without care, all
  server events land in one session and skew visitor counts. Mitigation: send the
  Distinct ID when there is a user, and verify in the spike (T-0) whether server
  events should forward the original client headers or be counted only as events.
- R-2 **Loss of person-level analysis.** PostHog person properties
  (`last_checkout_outcome`, `plan_status`, `converted_from_trial`…) power some
  insights. Umami session data is weaker. Mitigation: billing cohort questions
  move to admin pages reading Hospeda's DB (the source of truth anyway).
- R-3 **Ad-block loss returns** if the tracker is served from a recognizable path.
  Mitigation: OQ-4.
- R-4 **Owner-facing dependency on Umami.** Mitigated by §6.5 (fail-soft, cache)
  and by keeping `entity_views` as the source of the promised numbers.
- R-5 **Operational load**: two more stateful containers on the VPS (Umami and its
  own Postgres — disk, upgrades, backups).
- R-6 **HOS-1878 verification gap** if PostHog is removed before its external
  events occur. Mitigated by coexistence (OQ-2) and AC-10.

## 11. Open questions — all RESOLVED (owner, 2026-11-14)

### OQ-1 · Source of truth for owner numbers — RESOLVED: hybrid

`entity_views` stays the source of the view/click counts already promised
(HOS-734, HOS-1063). Umami adds referrers, countries, devices and the contact
funnel. The HOS-734 precedent stands; no new ADR for this point.

*Rejected:* Umami only — would retire `entity_views`, need an ADR superseding
HOS-734, and lose ad-blocked views in owner numbers.

### OQ-2 · Coexistence or direct cut — RESOLVED: dual-write 2–4 weeks

Events go to both providers; counts are compared (AC-2) and HOS-1878's pending
smokes can still be signed in PostHog prod. Then T-6 removes PostHog.

*Rejected:* direct cut.

### OQ-3 · PostHog history — RESOLVED: discard

Nothing is exported or archived. When T-6 runs, the PostHog project is simply
abandoned. Consequence: trends before the Umami start date are not available
anywhere; billing questions about that period are answered from Hospeda's DB.

*Rejected:* exporting dashboard snapshots; keeping PostHog read-only for N months.

### OQ-4 · First-party serving — RESOLVED: same-origin path behind Cloudflare

Reuses the proven `/api/relay/*` pattern. Exact path and tracker script name are
settled in the T-0 spike.

*Rejected:* a `stats.` subdomain.

### OQ-5 · Distinct ID scope — RESOLVED: as proposed

Distinct ID is always Hospeda's internal user id, never an email. Web: only after
cookie consent. Admin: the staff user id. Server events: the user id when there is
one; `api-server` events carry none.

### OQ-6 · Umami database — RESOLVED: its own Postgres container

Fully isolated from the Hospeda database server. Costs one more container to back
up and upgrade (R-5).

*Rejected:* a separate database on the existing Postgres server.

### OQ-7 · v1 scope of owner stats — RESOLVED: all four cards, all four verticals

Cards: «De dónde vienen», «Países», «Dispositivos», «Contactos». Verticals:
accommodation, venue, experience and partner, together in T-5.

## 12. Implementation notes

Phases (each its own PR to `staging`, title `[HOS-2119] …`):

- **T-0 Spike** — Umami on local Docker + staging Coolify; validate R-1 (server
  attribution), OQ-4 (first-party path), API key auth and the per-`entity_id`
  filters needed by §6.5 for all four entity types. Output: a short note in
  `docs/` with the relay path and the answer to R-1.
- **T-1 Infra** — staging + prod instances, backups, env vars (AC-1).
- **T-2 Adapter** — `providers/umami-*`, fan-out client, limits guard (AC-2–4).
- **T-3 Web/admin** — tracker, consent, CSP (AC-5).
- **T-4 Dashboards** — `scripts/umami`, docs, close HOS-1887 (AC-6).
- **T-5 Owner stats** — service, route, schema, cache, UI, i18n (AC-7, AC-8).
- **T-6 Cut & removal** — after the coexistence window (AC-9, AC-10), ADR.

Smoke: `status-needs-smoke-staging` on T-1, T-3 and T-5; `status-needs-smoke-prod`
on T-6.

### File map

| Area | Files |
|---|---|
| analytics | `packages/analytics/src/providers/umami-server.ts`, `umami-browser.ts`, `test/umami-limits.test.ts` |
| api | `apps/api/src/lib/analytics-client.ts` (replaces `posthog.ts`), `lib/umami-stats-client.ts`, `routes/views/protected/traffic-stats.ts`, `index.ts` (shutdown flush) |
| service-core | `src/services/listing-traffic-stats/*` |
| schemas | `src/entities/analytics/listing-traffic-stats.schema.ts` |
| web | `components/analytics/UmamiScript.astro`, `components/analytics/TrafficStatsCards.client.tsx`, `lib/analytics/umami-client.ts`, the four owner panels (`components/host/AnalyticsSection.client.tsx`, venue, experience, partner), CSP files, layouts |
| admin | `lib/analytics/umami-client.ts`, `contexts/auth-context.tsx`, `routes/__root.tsx`, `lib/csp-nonce.ts` |
| config | env registry, app `env-schema.ts`, `.env.example` |
| scripts | `scripts/umami/*` (replaces `scripts/posthog/*`) |
| infra | remove `infra/cloudflare/posthog-proxy/` (T-6) |
| docs | `docs/analytics/*`, new ADR |
| i18n | owner stats card copy (es/en/pt) |

### Fit with the target model

Fits: the provider swap stays behind `@repo/analytics`; owner stats go through
`service-core` + `resolveListingAccess`; the HOS-734 precedent is preserved under
OQ-1. The only new moving parts are the Umami service and its Postgres (R-5).
