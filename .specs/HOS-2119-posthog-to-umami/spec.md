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
| dashboards | `scripts/posthog/{client,data,definitions,setup}.ts` — six dashboards, 8 funnel insights (5 distinct; the earlier "9" was a miscount, corrected 2026-11-16) |
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

Measured on Umami 3.5.0 in the T-0 spike (`docs/analytics/umami-spike.md`):

- Custom events: `umami.track(name, data)`. Over-limit values are truncated
  silently with HTTP 200: event name 50 chars, string values and data keys 500,
  url/title/referrer path 500, hostname 100, Distinct ID 50. There is NO
  property-count limit. Numbers are `numeric(19,4)`: decimals round to 4 places,
  and `|n| >= 1e15` returns 400 and loses the whole event. Arrays are stored as
  one JSON string and nested objects are flattened with dots. All current
  Hospeda event names fit.
- Identity: `umami.identify(id, data)` sets a Distinct ID plus session data. No
  person profiles comparable to PostHog's. The session id is
  `uuid(website, ip, ua, salt, distinctId ?? '')`, except that an identify
  carrying the tracker's `x-umami-cache` token claims the anonymous session
  (same session id, Distinct ID attached, a `session_link` row). The token comes
  from the answer to an earlier request of the same document and lives only in
  the tracker's memory. An identify that is the document's FIRST request (no
  token yet) opens the per-user session `uuid(…, id)`, and a server event that
  carries the same Distinct ID lands in it (OQ-5, revised 2026-11-17). An
  identify that claims the anonymous session leaks it: every later visitor on
  the same device/IP keeps landing in that session, attributed to the first
  user, until Umami rotates its salt.
- Server-side ingestion: `POST /api/send` and `POST /api/batch` (max 500 items,
  ~10 MB), no auth token. A bot-like `User-Agent` (curl, node, anything with
  "api") is answered 200 and silently dropped. `payload.ip` and
  `payload.userAgent` override the request headers. A batch with invalid items
  still returns 200 with `processed < size` and per-item `details[]`.
- Read API (self-hosted): API keys (`POST /api/me/api-keys`, sent as
  `Authorization: Bearer umami_…`). Endpoints used here: `/api/websites/:id/stats`,
  `/metrics`, `/pageviews`, `/events/stats`, and for per-entity filtering only
  `/event-data-pivot` and `/event-data-pivot/property-series`
  (`pf_<prop>=eq.<value>`). The other endpoints silently ignore event-property
  filters and return site totals.
- Reports: funnels, journeys, retention, goals and boards, all creatable over the
  API (no upsert).

## 6. Proposed design

### 6.1 Infra — **DECIDED: self-hosted**

- Umami container in Coolify, one instance per environment (staging, prod).
- Storage: **its own Postgres container** in Coolify (OQ-6), fully isolated from
  the Hospeda database server.
- Tracker and ingestion served from a **same-origin path behind Cloudflare** (OQ-4),
  reusing the `/api/relay/*` pattern of the PostHog proxy so ad-block recovery is
  kept. Exact path and script name settled in T-0. Whatever T-0 picks must not
  depend on `infra/cloudflare/posthog-proxy/`: that worker is deleted in the same
  cut (§6.6).
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
  lifecycle as `lib/posthog.ts` today), and a timeout. Failures log via
  `@repo/logger` and never throw into the caller. A batch answered with
  `processed < size` or a non-empty `details[]` counts as a failure.
- Visitor attribution (R-1, decided 2026-11-15): `capture` gains an optional
  `visitor: { ip, userAgent }`.
  - Request-scoped events (`conversations/*/initiate`, `accommodation/protected/publish`,
    `accommodation/protected/import-from-url`, `host-onboarding/protected/start`,
    `auth` signup, `ai/protected/chat*`) pass the visitor's IP
    (`cf-connecting-ip`, then `x-forwarded-for`) and `User-Agent`, so the event
    lands in the visitor's browser session and inherits its referrer, UTM and
    path. When the visitor is logged in, the event also carries their user id
    as Distinct ID (see the `distinctId` mapping below), so it lands in the
    user's per-user session.
  - Events with no visitor request (crons, webhooks, `api-server`) send a fixed
    synthetic identity: IP `127.0.0.1` and a browser-like, non-bot `User-Agent`.
    This counts as one synthetic visitor and stays out of `/stats` and path
    metrics.
  - A route reached through Astro SSR must forward the original visitor's IP and
    User-Agent; otherwise the event falls back to the synthetic identity.
- New `packages/analytics/src/providers/umami-browser.ts`: wraps `window.umami`
  behind the existing browser interface; no-op when the tracker is not loaded.
- `apps/api/src/lib/posthog.ts` → `apps/api/src/lib/analytics-client.ts`, which
  returns the Umami client only. There is no fan-out and no coexistence window
  (OQ-2, direct cut).
- Mapping:
  - `event` → Umami event name (unchanged, snake_case).
  - `properties` (already sanitized by `prepareAnalyticsEvent`) → event `data`.
    Arrays become strings (Umami behavior); the only array today is `roles`, which
    is acceptable.
  - `distinctId` → a real user id is sent BOTH as `data.user_id` and as the Umami
    Distinct ID (`payload.id`), so the event lands in `uuid(…, userId)`, the
    same per-user session the browser opens with its identify (OQ-5, revised
    2026-11-17, owner, after staging smoke: claimed fingerprint session leaked
    across accounts). `api-server` and `anon:*` ids, and events with no user
    id, send NO Distinct ID: they keep the fingerprint session (anonymous
    visitor) or the synthetic identity (crons, webhooks).
  - Every server event sends `hostname` (the surface's host) and a virtual `url`
    `/_server/<event>` unless the visitor's page url is known.
  - `uuid` (`analytics-event-uuid.ts`) → kept as a `data.event_uuid` property for
    dedup audits.
  - Person properties (`AnalyticsPersonPropertiesSchema`) → `identify` session data,
    only after consent (§6.3).
- New guard: every `AnalyticsEventSchemas` entry fits Umami's limits (name ≤ 50
  chars, data keys ≤ 500, no string enum value > 500 chars, no number that can
  reach `1e15`). Unit test in `packages/analytics/test/`. The adapter also
  truncates and validates at runtime (name 50, strings and keys 500, url/title
  500, hostname 100, `|n| < 1e15`, 4 decimals, batches ≤ 500) so nothing is cut
  or dropped silently.

### 6.3 Web and admin

- `PostHogScript.astro` → `UmamiScript.astro`. The tracker renders with
  `data-auto-pageview="false"` and the web sends one pageview per
  `astro:page-load` itself (initial load and every `<ClientRouter />` swap), so
  each pageview carries the current page's tag and referrer. Custom events are
  explicit `track` calls through `@repo/analytics/browser`.
- Decision (2026-11-16): only a router navigation counts as a pageview. An app's
  own `pushState` without the router (the destinations filters,
  `DestinationPOIFilter`) changes the URL but no longer counts as a pageview.
  `ListingLayout`'s synthetic `astro:page-load` does count, with the last counted
  page as its referrer.
- Consent: Umami is cookieless, so pre-consent capture keeps working without the
  memory-persistence trick. `identify` (Distinct ID + session data) runs only after
  consent, listening to `CONSENT_CHANGED_EVENT` exactly as today.
- Order (OQ-5, revised 2026-11-17, owner, after staging smoke: claimed
  fingerprint session leaked across accounts): the web must NOT claim the
  anonymous session. Logged-in traffic (web + server) lives in a per-user
  `uuid(…, id)` session; anonymous traffic lives in the fingerprint session,
  never claimed. The identify is sent as soon as consent and the tracker are
  present (no wait for the pageview's answer) and only while the tracker holds no
  `x-umami-cache` token (`getSession().cache`, shared `hasUmamiCacheToken` in
  `@repo/analytics`): with the token it would claim the fingerprint session, so
  it is SKIPPED, never delayed, and that document stays anonymous. The tracker
  keeps the id in memory, so every document identifies again (nothing persists
  across reloads) and a changed person property re-sends it. Trade-off:
  pageviews before the login do not join the post-login session. Known race: if
  the document's first pageview is answered before the identify runs (the
  `<ClientRouter />` pageview goes out on `window.load`; an island that
  hydrates later loses the race), that document is not identified.
- Admin: same rule for the staff user id (OQ-5). It keeps the tracker's auto
  pageview, so the race above is more likely there (the session resolves
  asynchronously); a lost race leaves that document anonymous (fail-closed).
- CSP: remove PostHog hosts/hashes, add the Umami script origin; update
  `csp-soft-nav-script-hashes.ts` and `csp-nonce.ts`.

### 6.4 Dashboards

- `scripts/posthog/` → `scripts/umami/`: same idea (definitions as code, idempotent
  `setup.ts`), targeting Umami's boards/reports API.
- The six dashboards and the five distinct funnels are rebuilt (PostHog had 8 funnel insights, 5 distinct; the earlier "nine" was a miscount, corrected 2026-11-16). Where PostHog relied on person
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
  - Authorization: someone else's listing → **404**. T-0 found that
    `resolveListingAccess` only knows ACCOMMODATION, VENUE and EXPERIENCE, and
    that today's owner-stats routes do not use it: they use `enforceUserGate`
    with the `view_basic_stats` key plus `findIdsByOwnerId`. PARTNER stats
    (`/protected/partners/mine/stats`) check `partner.ownerUserId` and have no
    entitlement gate by design. The new route follows the same split.
  - Response: `{ window, available: boolean, referrers[], countries[], devices[],
    contactFunnel: { views, contactStarted, contactCompleted } | null }`.
    `contactFunnel` is `null` for VENUE, EXPERIENCE and PARTNER (OQ-7 addendum).
  - On Umami error or timeout: `200` with `available: false` and empty arrays.
    Never `5xx` for an Umami failure.
- Filtering per listing: by entity id, **not** by URL path — slugs change and
  every listing has `/es/`, `/en/` and `/pt/` paths. Two mechanisms were measured
  on Umami 3.5.0 (T-0):
  - **Referrers, countries, devices:** Umami computes these from pageviews only,
    and event-data filters do not apply to them. On a listing's detail page the
    tracker sets `data-tag="<entityId>"` (a UUID, 36 chars, under the 50-char
    `tag` limit). Then `metrics?type=referrer|country|device&tag=<entityId>`
    returns that listing's breakdown, and an unknown tag returns `[]`, never the
    site total.
  - **Counts and the contact funnel:** the view and contact events carry
    `data.entity_id` + `data.entity_type`, read through `event-data-pivot`
    (`pf_entity_id=eq.<id>`). `event-data/values` and the plain stats endpoints
    ignore `pf_` filters, and a missing filter returns the site total. The
    service therefore asserts that every query carries its entity filter, and a
    contract test with two entities guards against leaks. `property-series` has
    no zero gap-fill, so the service fills empty days itself.
- Cache: Redis, key `traffic-stats:{entityType}:{entityId}:{window}`, TTL 1 h.
- UI: one shared island (`TrafficStatsCards.client.tsx`) mounted below the
  existing `entity_views` cards in every owner panel: accommodation
  (`AnalyticsSection.client.tsx`), venue, experience, and the partner panel from
  HOS-1063. Cards hide when `available: false`. Copy in es/en/pt.
- All four verticals ship together (OQ-7). **Correction (task planning,
  2026-11-14):** the code does not send `entity_id` today. `accommodation_viewed`
  and `contact_owner_*` carry `accommodation_id`; `EntityViewTracker` emits no
  analytics event for VENUE or EXPERIENCE (owner decision, HOS-734: only the
  `entity_views` beacon), and partner pages emit none either. So this phase must
  add a view event with `entity_id` for all four types and normalize the
  accommodation events. Venue, experience and partner have no contact events:
  their «Contactos» card is hidden in v1 and `contactFunnel` is `null` for them
  (OQ-7 addendum). See tasks T-005, T-016, T-030, T-031, T-044, T-045, T-051.

### 6.6 Removal

Part of the cut itself (OQ-2, direct cut), shipped in the same release that turns
Umami on: delete PostHog clients, env vars (registry, `env.ts`,
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
  completed). «Contactos» is shown for accommodation only; for venue,
  experience and partner it is absent, never a zero (OQ-7 addendum).
- Window selector shared with the existing cards.
- When Umami is unavailable, the new cards are not rendered; no error banner.
- Empty state (listing with no traffic): the cards show «Todavía no hay datos».

## 9. Acceptance criteria

- AC-1 Staging and prod Umami instances run in Coolify, are backed up, and a
  restore was tested once (runbook entry).
- AC-2 With `HOSPEDA_UMAMI_*` set, every server call site in §5.2 produces in
  Umami the same event name and properties it produced in PostHog. Verified by
  adapter unit tests (payload per catalog event) and observed on Umami staging
  before the cut; there is no prod count comparison (OQ-2).
- AC-3 With Umami unreachable, no api request fails or slows by more than the
  adapter's timeout budget; errors are logged once per flush.
- AC-4 A unit test fails if any catalog event exceeds Umami's limits.
- AC-5 Web before consent: pageviews and anonymous events reach Umami; no
  `identify`. After consent: `identify` with the user's id runs once per document,
  and again whenever the person properties change, as soon as the tracker is
  present and only while it holds no cache token (OQ-5, revised 2026-11-17).
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
- AC-11 In the 48 h after the cut reaches prod, Umami prod shows pageviews and
  at least the server events that occurred in that window; any gap is filed
  before the prod smoke is signed.
- AC-12 On staging, a real browser pageview followed by a request-scoped action
  (e.g. publish or contact) produces a server event with the same `session_id`
  as the pageview, and its referrer/country match. Checked twice: anonymous
  (no consent, logged out), and with consent and a logged-in user. In the second
  run the browser (after its identify) and the server events of that user share
  one per-user `session_id` (`uuid(…, id)`), distinct from the anonymous
  pageview's session. Then a second account on the same device does NOT land in
  the first user's session. Events from crons and webhooks carry the synthetic
  identity and no Distinct ID.

## 10. Risks

- R-1 **Server-side event attribution.** Umami derives sessions from IP +
  User-Agent; every server event comes from the api's IP. Without care, all
  server events land in one session and skew visitor counts. Measured in T-0: a
  Distinct ID splits the session, while the visitor's IP + User-Agent joins it.
  Mitigation (decided 2026-11-15, revised 2026-11-17, owner, after staging
  smoke: claimed fingerprint session leaked across accounts): request-scoped
  events forward the visitor's IP + User-Agent; with a logged-in user they also
  carry the user id as Distinct ID, and the browser identifies BEFORE holding a
  cache token, so both land in `uuid(…, id)`. Anonymous visitors and the
  synthetic identity send no Distinct ID (§6.2). Residual risk:
  the join depends on the tracker and the api seeing the same client IP (both
  behind Cloudflare). A mismatch only loses the join, not the event. AC-12
  verifies it.
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
  events occur. Mitigated by AC-10 (sign from Umami).
- R-7 **Silent event loss after a direct cut.** An adapter bug drops events
  until someone notices, with no PostHog to fall back on. Accepted because
  traffic is still low (OQ-2). Mitigated by AC-2 (staging first) and AC-11
  (48 h prod watch).

## 11. Open questions — all RESOLVED (owner, 2026-11-14)

### OQ-1 · Source of truth for owner numbers — RESOLVED: hybrid

`entity_views` stays the source of the view/click counts already promised
(HOS-734, HOS-1063). Umami adds referrers, countries, devices and the contact
funnel. The HOS-734 precedent stands; no new ADR for this point.

*Rejected:* Umami only — would retire `entity_views`, need an ADR superseding
HOS-734, and lose ad-blocked views in owner numbers.

### OQ-2 · Coexistence or direct cut — RESOLVED: direct cut (revised 2026-11-14)

One release turns Umami on and removes PostHog. No fan-out client, no
coexistence window. Reason (owner): Hospeda has almost no traffic yet, so a ±5%
count comparison over weeks would measure noise, PostHog history is discarded
anyway (OQ-3), and HOS-1878's smokes can be signed from Umami (AC-10).
Correctness is proven on staging (AC-2) and watched for 48 h in prod (AC-11);
the residual risk is R-7.

*Rejected:* dual-write for 2–4 weeks. It was the first decision earlier the same
day and was reversed by the owner before implementation started.

### OQ-3 · PostHog history — RESOLVED: discard

Nothing is exported or archived. When T-6 runs, the PostHog project is simply
abandoned. Consequence: trends before the Umami start date are not available
anywhere; billing questions about that period are answered from Hospeda's DB.

*Rejected:* exporting dashboard snapshots; keeping PostHog read-only for N months.

### OQ-4 · First-party serving — RESOLVED: same-origin path behind Cloudflare

Reuses the proven `/api/relay/*` pattern. Exact path and tracker script name are
settled in the T-0 spike.

*Rejected:* a `stats.` subdomain.

### OQ-5 · Distinct ID scope — RESOLVED (revised 2026-11-17)

Distinct ID is always Hospeda's internal user id, never an email. Web: only after
cookie consent, and **before** the tracker holds a cache token (§6.3). Admin: the
staff user id. Server events: the user id as Distinct ID (`payload.id`) AND in
`data.user_id` when the event has a real user; no Distinct ID for anonymous and
system events. Logged-in traffic (web + server) lives in a per-user
`uuid(…, id)` session; anonymous traffic lives in the fingerprint session, which
is never claimed (§5.5, §6.2, R-1).

*Revised (2026-11-15) because:* the T-0 spike measured that Umami hashes the
Distinct ID into the session id. A server event carrying it opens a separate
session per user unless the browser is in the same session.

*Revised (2026-11-16, owner) because:* a second measurement
(`docs/analytics/umami-spike.md` §2) showed that an identify carrying the
tracker's cache token claims the anonymous session, so the identify waited for
the pageview's answer and server events carried no Distinct ID.

*Revised (2026-11-17, owner, after staging smoke: claimed fingerprint session
leaked across accounts):* once a user claims the fingerprint session, every later
visitor on the same device/IP (account switch, shared device, support acting as
another user) keeps landing in it, attributed to the first user, until Umami
rotates its salt; a sign-out reload cannot undo it. Option 1 was chosen: the
identify must not claim the anonymous session, and the server sends the user id
as Distinct ID so both halves meet in `uuid(…, id)`. Trade-off: pageviews before
the login do not join the post-login session.

Revoking consent after an identify still reloads the page (the tracker cannot
forget its in-memory id) and no new identity is sent. The earlier accepted
residual risk (anonymous hits staying linked to a claimed session) no longer
applies, because no fingerprint session is ever claimed.

### OQ-6 · Umami database — RESOLVED: its own Postgres container

Fully isolated from the Hospeda database server. Costs one more container to back
up and upgrade (R-5).

*Rejected:* a separate database on the existing Postgres server.

### OQ-7 · v1 scope of owner stats — RESOLVED: all four cards, all four verticals

Cards: «De dónde vienen», «Países», «Dispositivos», «Contactos». Verticals:
accommodation, venue, experience and partner, together in T-5.

**Addendum (owner, 2026-11-14, during task planning):** venue, experience and
partner have no contact events today, and none are invented in this spec. Their
«Contactos» card is hidden in v1 (`contactFunnel: null`); the other three cards
ship for all four verticals. Defining contact events for them is follow-up work.

*Rejected:* defining new contact events for those three verticals inside this
migration.

## 12. Implementation notes

Phases (each its own PR to `staging`, title `[HOS-2119] …`):

- **T-0 Spike** — Umami on local Docker + staging Coolify; validate R-1 (server
  attribution), OQ-4 (first-party path), API key auth and the per-`entity_id`
  filters needed by §6.5 for all four entity types. Output: a short note in
  `docs/` with the relay path and the answer to R-1.
- **T-1 Infra** — staging + prod instances, backups, env vars (AC-1).
- **T-2 Adapter** — `providers/umami-*`, Umami-only client, limits guard,
  visitor attribution for request-scoped events (AC-2–4, AC-12).
- **T-3 Web/admin** — tracker, consent, CSP (AC-5).
- **T-4 Dashboards** — `scripts/umami`, docs, close HOS-1887 (AC-6).
- **T-5 Owner stats** — service, route, schema, cache, UI, i18n (AC-7, AC-8).
- **T-6 Removal** — PostHog code, env vars, worker, scripts, docs, ADR (AC-9,
  AC-10).

The cut (OQ-2): T-2, T-3 and T-6 all land on `staging` before the next
`staging` → `main` promotion, and T-1's prod instance is up before it, so prod
switches from PostHog to Umami in one release with no mixed state. T-4 and T-5
can follow in later releases.

Smoke: `status-needs-smoke-staging` on T-1, T-3 and T-5; `status-needs-smoke-prod`
on the cut release (AC-11).

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
