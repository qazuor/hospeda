# HOS-2119: Migrate product analytics from PostHog to self-hosted Umami, and surface Umami stats to listing owners

## Progress: 57/76 tasks (75%)

**Average Complexity:** 2.5/3 (max 3)
**Critical Path:** T-001 -> T-003 -> T-004 -> T-006 -> T-020 -> T-034 -> T-035 -> T-058 -> T-060 -> T-062 -> T-067 -> T-068 -> T-069 -> T-070 (14 steps)
**Parallel Tracks:** 8 tracks

Tracks (can run in parallel):

- A Adapter (analytics + api): T-016 -> T-017 | T-018 -> T-019 -> T-071 | T-021 -> T-022/T-023/T-024 -> T-072 -> T-025 -> T-026 -> T-073 (AC-12)
- B Web: T-027 -> T-030/T-031/T-032/T-033; T-028 -> T-029
- C Admin: T-034 -> T-035
- D Infra / ops (owner): T-003 -> T-004, T-008, T-010; T-007 -> T-009; env T-011 -> T-012 -> T-013 -> T-014/T-015
- E Dashboards: T-037 -> T-038 -> T-039/T-040 -> T-041 -> T-042/T-043
- F Owner stats: T-044/T-050 -> T-045 -> T-046/T-047 -> T-048 -> T-049 -> T-052..T-054 -> T-056; T-028 -> T-074 -> T-056
- G Removal: T-057/T-058/T-059 -> T-060 -> T-061/T-062; T-063; T-064; T-065 -> T-066 -> T-067
- H Cut: T-068 -> T-069 -> T-070

## Cut rules (OQ-2 direct cut, no dual-write)

- T-2 (adapter + call-site swaps: T-016..T-026), T-3 (web/admin: T-027..T-036) and T-6 (removal: T-057..T-067) must ALL be on `staging` before the next staging -> main promotion.
- T-1's prod instance, websites, relay and Coolify env vars (T-007, T-009, T-015) must exist before that promotion.
- T-068 is the checkpoint that enforces this. T-4 (dashboards) and T-5 (owner stats) may ship in later releases.
- Tasks tagged `owner-action` are done by the human owner (Coolify, Cloudflare, hops, smokes) or need explicit owner approval. Redeploys ALWAYS need explicit owner approval.

## Open items flagged for the coordinator

- Spec 6.5 says view trackers and contact events already send `entity_id`. Planning found they do not: `accommodation_viewed` and `contact_owner_*` carry `accommodation_id`, venue/experience view trackers emit no analytics event, and no contact events were located for venue/experience/partner. T-005 verifies; T-016 and T-030/T-031 fix it; Owner decision (2026-11-14): no contact events are added for venue/experience/partner; their «Contactos» card is hidden in v1 (`contactFunnel: null`, T-044/T-045/T-051).
- RESOLVED by T-005: partner ownership does not fit `resolveListingAccess`; T-048 uses enforceUserGate + view_basic_stats like the existing owner-stats routes, and T-049 uses partner.ownerUserId with no entitlement gate.
- Replan 2026-11-15 (owner decision R-1 option 3): server events never send a Distinct ID; request-scoped events forward the visitor IP/UA (T-071, T-072, verified on staging by T-073 / AC-12). Per-listing referrers/countries/devices use pageview tags (T-074). Revised descriptions: T-016, T-017, T-018, T-019, T-045, T-046, T-048, T-049.
- `AnalyticsSection.client.tsx` is host-level, not per listing (T-052).
- Task count exceeds the agent default of 15; the task-from-spec skill sets no maximum and the coordinator asked for complexity <= 3.

---

### Setup Phase

- [x] **T-001** (complexity: 3) - T-0 Spike: run Umami locally in Docker and validate API-key auth, /api/batch ingestion and boards/reports API
  - Tags: t0-spike, devops, api
  - Spike (no production code). Goal: remove the unknowns the adapter (T-2), dashboards (T-4) and owner ...
  - Blocked by: none
  - Blocks: T-002, T-003, T-005, T-037

- [x] **T-002** (complexity: 3) - T-0 Spike: validate server-event session attribution (R-1) and batch limits against local Umami
  - Tags: t0-spike, api
  - Spike answering R-1 from the spec: every server event comes from the api's IP, so without care all s...
  - Blocked by: T-001
  - Blocks: T-006, T-018

- [x] **T-003** (complexity: 3) - T-0/T-1 Bring up the staging Umami instance and its own Postgres container in Coolify (owner action)
  - Tags: t0-spike, t1-infra, devops, owner-action
  - OWNER ACTION: Coolify is operated by the human owner (<https://coolify.hospeda.com.ar>). Agents prepar...
  - Blocked by: T-001
  - Blocks: T-004, T-008, T-010

- [x] **T-004** (complexity: 3) - T-0 Decide and validate the same-origin relay path for the tracker and ingestion behind Cloudflare (OQ-4, owner action)
  - Tags: t0-spike, devops, owner-action, web, admin
  - OWNER ACTION (Cloudflare). Reuse the /api/relay/* pattern conceptually, but build it so that deletin...
  - Blocked by: T-003
  - Blocks: T-006, T-009, T-028, T-036

- [x] **T-005** (complexity: 3) - T-0 Spike: validate per-entity_id filtering for all four entity types and locate owner-access paths
  - Tags: t0-spike, api, web
  - Spike. KNOWN GAP found while planning (verify, do not assume): packages/analytics/src/catalog.ts eve...
  - Blocked by: T-001
  - Blocks: T-006, T-016, T-046, T-048

- [x] **T-006** (complexity: 2) - T-0 Write the spike note with the relay path, R-1 answer and per-entity filter contract
  - Tags: t0-spike, docs
  - Create docs/analytics/umami-spike.md (spec 12 requires a short note in docs/). Sections: relay path ...
  - Blocked by: T-002, T-004, T-005
  - Blocks: T-007, T-020

- [ ] **T-007** (complexity: 3) - T-1 Provision the production Umami instance and its own Postgres container in Coolify (owner action)
  - Tags: t1-infra, devops, owner-action
  - OWNER ACTION. Same as T-003 for production. Hard requirement from the spec cut (OQ-2): this instance...
  - Blocked by: T-006
  - Blocks: T-009, T-010

- [x] **T-008** (complexity: 2) - T-1 Create the staging websites (hospeda-web, hospeda-admin), read-only Umami user and API key (owner action)
  - Tags: t1-infra, devops, owner-action
  - OWNER ACTION. Output: staging website IDs (web, admin) for HOSPEDA_UMAMI_WEBSITE_ID_WEB/ADMIN and PU...
  - Blocked by: T-003
  - Blocks: T-014, T-043

- [ ] **T-009** (complexity: 2) - T-1 Create the production websites, read-only user, API key and the relay path on prod origins (owner action)
  - Tags: t1-infra, devops, owner-action
  - OWNER ACTION. Production counterpart of T-008 plus the production relay (OQ-4). The relay must not d...
  - Blocked by: T-007, T-004
  - Blocks: T-015, T-043, T-068

- [ ] **T-010** (complexity: 3) - T-1 Add both Umami Postgres containers to the hops backup routine and document a tested restore (owner action)
  - Tags: t1-infra, devops, owner-action, docs
  - OWNER ACTION for the VPS part (hops runs on the VPS); the runbook file is a normal docs change. AC-1...
  - Blocked by: T-003, T-007
  - Blocks: none

- [x] **T-011** (complexity: 3) - T-1 Register HOSPEDA_UMAMI_* server env vars (registry, api Zod schema, .env.example, docs)
  - Tags: t1-infra, config, api, release-env-var-change
  - Follow the repo rule for new env vars (registry + Zod + .env.example + docs + Coolify). Label releas...
  - Blocked by: none
  - Blocks: T-012, T-014, T-015, T-021, T-046

- [x] **T-012** (complexity: 3) - T-1 Register PUBLIC_UMAMI_* web client env vars (registry, web Zod schema, .env.example, Dockerfile build args, turbo)
  - Tags: t1-infra, config, web, release-env-var-change
  - Same env-var rule as T-011 for the web client. Blocked by T-011 only to avoid conflicting edits to t...
  - Blocked by: T-011
  - Blocks: T-013, T-014, T-015, T-027, T-028

- [x] **T-013** (complexity: 3) - T-1 Register VITE_UMAMI_* admin client env vars (registry, admin Zod schema, .env.example, Dockerfile, turbo)
  - Tags: t1-infra, config, admin, release-env-var-change
  - Same as T-012 for admin (VITE_ prefix). Blocked by T-012 because both edit env-registry.client.ts, t...
  - Blocked by: T-012
  - Blocks: T-014, T-015, T-034

- [x] **T-014** (complexity: 1) - T-1 Set the UMAMI env vars in Coolify for staging (owner action, no redeploy without approval)
  - Tags: t1-infra, devops, owner-action, config
  - OWNER ACTION. Repo rule: after the registry/Zod/.env.example work, the agent stops and tells the own...
  - Blocked by: T-008, T-011, T-012, T-013
  - Blocks: T-026, T-036, T-056

- [ ] **T-015** (complexity: 1) - T-1 Set the UMAMI env vars in Coolify for production (owner action, before the cut)
  - Tags: t1-infra, devops, owner-action, config
  - OWNER ACTION. Production counterpart of T-014; one of the preconditions in the cut-readiness checkpo...
  - Blocked by: T-009, T-011, T-012, T-013
  - Blocks: T-068

### Core Phase

- [x] **T-016** (complexity: 3) - T-2 Add entity_id/entity_type to view and contact events and a generic entity_viewed event in the catalog
  - Tags: t2-adapter, t5-owner-stats, analytics
  - Closes the gap found in T-005 so the owner stats filter (by event data entity_id, spec 6.5) has data...
  - Blocked by: T-005
  - Blocks: T-017, T-030, T-031, T-039, T-065

- [x] **T-017** (complexity: 2) - T-2 Add the Umami limits guard test for every catalog event (AC-4)
  - Tags: t2-adapter, analytics, testing
  - Test-first guard. File: packages/analytics/test/umami-limits.test.ts. Uses real limits confirmed in ...
  - Blocked by: T-016
  - Blocks: none

- [x] **T-018** (complexity: 3) - T-2 Implement the Umami payload mapper (event to batch item) with a per-catalog-event parity test
  - Tags: t2-adapter, analytics
  - Pure function, RO-RO, JSDoc, no network. Files: packages/analytics/src/providers/umami-payload.ts, p...
  - Blocked by: T-002
  - Blocks: T-019

- [x] **T-019** (complexity: 3) - T-2 Implement the Umami server client (queue, batch flush, timeout, User-Agent, never throws)
  - Tags: t2-adapter, analytics, api
  - Files: packages/analytics/src/providers/umami-server.ts, packages/analytics/src/index.ts, packages/a...
  - Blocked by: T-018
  - Blocks: T-021

- [x] **T-020** (complexity: 2) - T-2 Implement the Umami browser provider wrapper over window.umami
  - Tags: t2-adapter, analytics, web, admin
  - Files: packages/analytics/src/providers/umami-browser.ts, packages/analytics/src/index.ts, packages/...
  - Blocked by: T-006
  - Blocks: T-027, T-034

- [x] **T-021** (complexity: 3) - T-2 Create apps/api analytics-client.ts (Umami-only, replaces lib/posthog.ts API)
  - Tags: t2-adapter, api
  - Files: apps/api/src/lib/analytics-client.ts, apps/api/test/lib/analytics-client.test.ts. Tests: no-o...
  - Blocked by: T-019, T-011
  - Blocks: T-022, T-023, T-024

- [x] **T-027** (complexity: 3) - T-3 Create the web Umami client (trackEvent, consent-gated identify, resetUser) replacing posthog-client
  - Tags: t3-web-admin, web
  - Read apps/web/src/lib/analytics/posthog-client.ts (290 lines) first and port the consent logic, not ...
  - Blocked by: T-020, T-012
  - Blocks: T-030, T-031, T-032, T-033

- [x] **T-034** (complexity: 3) - T-3 Create the admin Umami client, initialize it in __root.tsx and adapt the CSP nonce handling
  - Tags: t3-web-admin, admin
  - Port apps/admin/src/lib/analytics/posthog-client.ts (205 lines). Admin identifies only the staff use...
  - Blocked by: T-020, T-013
  - Blocks: T-035

- [x] **T-037** (complexity: 3) - T-4 Create scripts/umami/client.ts (API client with idempotent upsert helpers)
  - Tags: t4-dashboards, scripts
  - Files: scripts/umami/client.ts, scripts/umami/client.test.ts (locate which vitest project picks up s...
  - Blocked by: T-001
  - Blocks: T-038

- [x] **T-038** (complexity: 3) - T-4 Port the insight builders to Umami report definitions (scripts/umami/definitions.ts)
  - Tags: t4-dashboards, scripts
  - Files: scripts/umami/definitions.ts, scripts/umami/definitions.test.ts. Tests: funnel builder produc...
  - Blocked by: T-037
  - Blocks: T-039, T-040

- [x] **T-039** (complexity: 3) - T-4 Define dashboards 00 Resumen, 01 Adquisicion and 02 Descubrimiento for Umami
  - Tags: t4-dashboards, scripts
  - File: scripts/umami/data-a.ts (part 1; part 2 is data-b.ts from T-040). Tests: scripts/umami/data-a....
  - Blocked by: T-038, T-016
  - Blocks: T-041, T-042

- [x] **T-040** (complexity: 3) - T-4 Define dashboards 03 Owners, 04 Suscripciones and 05 Calidad plus the nine funnels for Umami
  - Tags: t4-dashboards, scripts
  - Files: scripts/umami/data-b.ts and scripts/umami/data-b.test.ts. Tests: all 9 funnels present with v...
  - Blocked by: T-038
  - Blocks: T-041, T-042

- [x] **T-044** (complexity: 2) - T-5 Add ListingTrafficStatsResponseSchema to @repo/schemas
  - Tags: t5-owner-stats, schemas
  - Zod is the source of truth for types. Tests: valid payload parses, available:false with empty arrays...
  - Blocked by: none
  - Blocks: T-045, T-051

- [x] **T-045** (complexity: 3) - T-5 Implement ListingTrafficStatsService in service-core with injected stats-client and cache ports
  - Tags: t5-owner-stats, service-core
  - Files: packages/service-core/src/services/listing-traffic-stats/listing-traffic-stats.service.ts, po...
  - Blocked by: T-044
  - Blocks: T-046, T-047, T-048

- [x] **T-046** (complexity: 3) - T-5 Implement apps/api UmamiStatsClient (native fetch, API key, 3s timeout)
  - Tags: t5-owner-stats, api
  - Files: apps/api/src/lib/umami-stats-client.ts, apps/api/test/lib/umami-stats-client.test.ts. Tests w...
  - Blocked by: T-045, T-005, T-011
  - Blocks: T-048

- [x] **T-047** (complexity: 2) - T-5 Implement the Redis traffic-stats cache adapter (TTL 1h)
  - Tags: t5-owner-stats, api
  - Files: apps/api/src/utils/traffic-stats-cache.ts, apps/api/test/utils/traffic-stats-cache.test.ts. T...
  - Blocked by: T-045
  - Blocks: T-048

- [x] **T-050** (complexity: 2) - T-5 Add owner-stats card copy in es, en and pt
  - Tags: t5-owner-stats, i18n
  - Files: packages/i18n/src/locales/es/listing.json, en/listing.json, pt/listing.json, apps/web/src/lib...
  - Blocked by: none
  - Blocks: T-051

- [x] **T-071** (complexity: 3) - T-2 Add optional visitor context to ServerAnalyticsClient.capture and a getVisitorContext helper in apps/api [NEW]
  - Tags: t2-adapter, api, analytics
  - Extend ServerAnalyticsClient.capture in packages/analytics with optional `visitor: { ip: string; use...
  - Blocked by: T-018, T-019
  - Blocks: T-072

### Integration Phase

- [x] **T-022** (complexity: 3) - T-2 Swap api lib call sites to analytics-client (auth, signup analytics, facts, ai-observability, shutdown)
  - Tags: t2-adapter, api
  - Mechanical import swap; behavior unchanged (same event names, properties and distinctIds, api-server...
  - Blocked by: T-021
  - Blocks: T-025, T-059

- [x] **T-023** (complexity: 3) - T-2 Swap api route call sites to analytics-client (publish, import-from-url, host-onboarding start)
  - Tags: t2-adapter, api
  - Mechanical swap, no behavior change. Tests: the listed integration tests still assert the captured a...
  - Blocked by: T-021
  - Blocks: T-025, T-059

- [x] **T-024** (complexity: 3) - T-2 Swap api conversation and AI chat call sites to analytics-client
  - Tags: t2-adapter, api
  - Mechanical swap, no behavior change; contact_owner_* events keep their properties (plus entity_id on...
  - Blocked by: T-021
  - Blocks: T-025, T-059

- [x] **T-028** (complexity: 3) - T-3 Create UmamiScript.astro and swap it into BaseLayout and StandaloneLayout
  - Tags: t3-web-admin, web
  - Files: apps/web/src/components/analytics/UmamiScript.astro, apps/web/src/layouts/BaseLayout.astro, a...
  - Blocked by: T-004, T-012
  - Blocks: T-029, T-036, T-057

- [x] **T-029** (complexity: 3) - T-3 Update web CSP for Umami (remove PostHog hosts/hashes, allow the relay script origin)
  - Tags: t3-web-admin, web, security
  - CSP errors are silent in prod, so this is test-led. Tests: apps/web/test/integration/csp-hash-emissi...
  - Blocked by: T-028
  - Blocks: T-036, T-057, T-063

- [x] **T-030** (complexity: 3) - T-3 Swap the web view trackers to Umami and emit entity_viewed with entity_id for every vertical
  - Tags: t3-web-admin, t5-owner-stats, web
  - Tests: each tracker fires the expected event once per mount with entity_id equal to the listing id (...
  - Blocked by: T-016, T-027
  - Blocks: T-036, T-057

- [x] **T-031** (complexity: 3) - T-3 Swap web accommodation islands to Umami (ContactHost, ReviewSidebarCard, useSearchChat) with entity_id on contact events
  - Tags: t3-web-admin, web
  - Mechanical import swap plus the entity_id addition for the contact funnel. Tests: existing assertion...
  - Blocked by: T-016, T-027
  - Blocks: T-036, T-057

- [x] **T-032** (complexity: 3) - T-3 Swap web auth/contribution/onboarding islands to Umami (SignUp, ContributionBanner, ContributionForm, CreatePropertyMiniForm)
  - Tags: t3-web-admin, web
  - Mechanical import swap, same events and properties. Tests: vi.mock paths moved to umami-client; whol...
  - Blocked by: T-027
  - Blocks: T-036, T-057

- [x] **T-033** (complexity: 3) - T-3 Swap web navigation/search/favorites/newsletter islands to Umami (NewsletterForm, SearchBar, FavoriteButton, UserMenu)
  - Tags: t3-web-admin, web
  - Mechanical import swap; UserMenu keeps identify/resetUser behind consent (logic lives in T-027). Tes...
  - Blocked by: T-027
  - Blocks: T-036, T-057

- [x] **T-035** (complexity: 3) - T-3 Swap admin consumers to the Umami client (auth-context identify, tour, whats-new)
  - Tags: t3-web-admin, admin
  - Mechanical swap. Tests: all listed suites updated to the new module path with the same assertions; a...
  - Blocked by: T-034
  - Blocks: T-036, T-058

- [x] **T-041** (complexity: 3) - T-4 Create the idempotent scripts/umami/setup.ts runner and the umami:setup package script (AC-6)
  - Tags: t4-dashboards, scripts
  - Files: scripts/umami/setup.ts, scripts/umami/setup.test.ts, package.json (scripts block). Tests (AC-...
  - Blocked by: T-039, T-040
  - Blocks: T-043, T-064

- [ ] **T-043** (complexity: 2) - T-4 Run umami:setup on staging and prod and close HOS-1887 as superseded (owner action)
  - Tags: t4-dashboards, owner-action, devops
  - OWNER ACTION. T-4 may ship in a later release than the cut (spec 12). Not a precondition of the cut....
  - Blocked by: T-041, T-008, T-009
  - Blocks: none

- [x] **T-048** (complexity: 3) - T-5 Add GET /api/v1/protected/views/:entityType/:entityId/traffic-stats for accommodation, venue and experience
  - Tags: t5-owner-stats, api
  - Files: apps/api/src/routes/views/protected/traffic-stats.ts, index.ts, apps/api/test/routes/views/pr...
  - Blocked by: T-045, T-046, T-047, T-005
  - Blocks: T-049, T-052, T-053

- [x] **T-049** (complexity: 3) - T-5 Add PARTNER ownership to the traffic-stats route
  - Tags: t5-owner-stats, api
  - The spec lists PARTNER among the four owner-facing types, but resolveListingAccess covers listing ve...
  - Blocked by: T-048
  - Blocks: T-054, T-055

- [x] **T-051** (complexity: 3) - T-5 Create the web traffic-stats client and the shared TrafficStatsCards island
  - Tags: t5-owner-stats, web
  - Spec path is components/analytics/TrafficStatsCards.client.tsx, but listing owner components live in...
  - Blocked by: T-044, T-050
  - Blocks: T-052, T-053, T-054

- [x] **T-052** (complexity: 2) - T-5 Mount TrafficStatsCards in the accommodation owner panel
  - Tags: t5-owner-stats, web
  - Which accommodation id to pass depends on how AnalyticsSection aggregates owned accommodations today...
  - Blocked by: T-051, T-048
  - Blocks: T-056

- [x] **T-053** (complexity: 2) - T-5 Mount TrafficStatsCards in the venue and experience owner panel (mi-cuenta/comercio)
  - Tags: t5-owner-stats, web
  - Same hide-on-unavailable rule. Tests: venue and experience rows each request traffic-stats with the ...
  - Blocked by: T-051, T-048
  - Blocks: T-056

- [x] **T-054** (complexity: 3) - T-5 Mount TrafficStatsCards in the partner panel (mi-cuenta/aliados)
  - Tags: t5-owner-stats, web
  - Partner stats semantics are sensitive (HOS-1063: 'medicion' vs 'constancia'). Only render when the p...
  - Blocked by: T-051, T-049
  - Blocks: T-056

- [x] **T-072** (complexity: 3) - T-2 Pass visitor context from request-scoped server call sites [NEW]
  - Tags: t2-adapter, api
  - After the call-site swaps (T-023, T-024) and the auth/signup swap (T-022), pass getVisitorContext(c)...
  - Blocked by: T-022, T-023, T-024, T-071
  - Blocks: T-025, T-073

- [x] **T-074** (complexity: 2) - T-5 Tag listing detail pageviews with the entity id (Umami data-tag) [NEW]
  - Tags: t5-owner-stats, t3-web-admin, web
  - On the public detail pages of accommodation, venue (comer-y-salir), experience and partner, render t...
  - Blocked by: T-028
  - Blocks: T-056

- [x] **T-075** (complexity: 3) - T-5 Split internal navigation from direct traffic in owner stats (catalog event + adapter + service) [NEW]
  - Owner decision 2026-11-16 (option 2): "Desde Hospeda" separate from "Directo"; metrics/expanded?type=event gives distinct visitors
  - Blocked by: T-048
  - Blocks: T-076, T-051

- [x] **T-076** (complexity: 3) - T-5 Listing detail pages emit the internal-entry event when arriving from a same-origin page [NEW]
  - umami.track function form with explicit tag; must include an emission test (G20 will not catch a missing emitter)
  - Blocked by: T-075, T-074
  - Blocks: T-056

### Testing Phase

- [x] **T-025** (complexity: 3) - T-2 Add an api-level parity test: every server call site emits the same event name and properties via the Umami client
  - Tags: t2-adapter, testing, api
  - AC-2 unit/integration part: payload per catalog event reaching the Umami batch endpoint, with the re...
  - Blocked by: T-022, T-023, T-024
  - Blocks: T-026

- [ ] **T-026** (complexity: 2) - T-2 Observe server events in Umami staging (AC-2) after the owner deploys staging
  - Tags: t2-adapter, smoke-staging, owner-action
  - OWNER ACTION / smoke (label status-needs-smoke-staging). There is no prod count comparison (OQ-2); c...
  - Blocked by: T-025, T-014
  - Blocks: T-068

- [ ] **T-036** (complexity: 2) - T-3 Smoke web and admin tracking on staging (AC-5): pageviews, anonymous events, consent identify
  - Tags: t3-web-admin, smoke-staging, owner-action
  - OWNER ACTION / smoke (status-needs-smoke-staging). Checklist-driven manual run on <https://staging.ho>...
  - Blocked by: T-004, T-014, T-028, T-029, T-030, T-031, T-032, T-033, T-035
  - Blocks: T-056, T-068

- [ ] **T-056** (complexity: 2) - T-5 Smoke owner stats on staging for the four verticals including Umami down (AC-7, AC-8)
  - Tags: t5-owner-stats, smoke-staging, owner-action
  - OWNER ACTION / smoke (status-needs-smoke-staging). T-5 may ship in a release after the cut. Redeploy...
  - Blocked by: T-052, T-053, T-054, T-014, T-036
  - Blocks: none

- [ ] **T-068** (complexity: 1) - CUT READINESS checkpoint: confirm T-2, T-3, T-6 are on staging and the prod Umami is ready before promoting to main
  - Tags: cut-readiness, owner-action, devops
  - OWNER ACTION / decision checkpoint, no code. OQ-2 direct cut: there is no coexistence window, so pro...
  - Blocked by: T-067, T-015, T-026, T-036, T-009
  - Blocks: T-069

- [ ] **T-069** (complexity: 2) - Post-cut: sign HOS-1878 AC-P4/AC-P5 from Umami and watch prod for 48 hours (AC-10, AC-11)
  - Tags: cut-readiness, smoke-prod, owner-action
  - OWNER ACTION / smoke (status-needs-smoke-prod, release-level). Use the smoke flow for sign-offs; the...
  - Blocked by: T-068
  - Blocks: T-070

- [ ] **T-073** (complexity: 2) - AC-12 Verify on staging that request-scoped server events join the browser session [NEW]
  - Tags: t2-adapter, smoke-staging, cut-readiness, owner-action
  - Smoke on Umami staging after the owner deploys staging (AC-12): with a real browser, open a listing ...
  - Blocked by: T-026, T-030, T-072
  - Blocks: T-068

### Docs Phase

- [x] **T-042** (complexity: 2) - T-4 Write docs/analytics/umami-dashboards.md including the PostHog-to-Umami gap list
  - Tags: t4-dashboards, docs
  - Docs only: docs/analytics/umami-dashboards.md. Source of truth for gaps is the GAPS constant from T-...
  - Blocked by: T-039, T-040
  - Blocks: T-065

- [x] **T-055** (complexity: 1) - T-5 Document the traffic-stats route in the API docs
  - Tags: t5-owner-stats, docs, api
  - Docs only: apps/api/docs/route-architecture.md. No tests....
  - Blocked by: T-049
  - Blocks: none

- [x] **T-065** (complexity: 3) - T-6 Rewrite docs/analytics for Umami and delete the PostHog docs
  - Tags: t6-removal, docs
  - Docs plus one guard data file. Tests: pnpm check:guards (venue-retired-word guard) and the docs vali...
  - Blocked by: T-016, T-042
  - Blocks: T-066, T-067

- [x] **T-066** (complexity: 3) - T-6 Update guides and ADRs and add the ADR 'Umami over PostHog'
  - Tags: t6-removal, docs
  - Docs only. The ADR records: owner decision 12/11/2026, direct cut (OQ-2), history discarded (OQ-3), ...
  - Blocked by: T-065
  - Blocks: T-067

### Cleanup Phase

- [ ] **T-057** (complexity: 2) - T-6 Remove web PostHog code (PostHogScript, snippet, posthog-client, their tests, stale comments)
  - Tags: t6-removal, web
  - Cut-critical: must land on staging before the next staging to main promotion. Tests: apps/web typech...
  - Blocked by: T-028, T-029, T-030, T-031, T-032, T-033
  - Blocks: T-060, T-063

- [ ] **T-058** (complexity: 2) - T-6 Remove admin PostHog client and references
  - Tags: t6-removal, admin
  - Cut-critical. Tests: admin targeted suites for touched files (router.csp-nonce, router.preload-stale...
  - Blocked by: T-035
  - Blocks: T-060

- [x] **T-059** (complexity: 2) - T-6 Remove the api PostHog client (lib/posthog.ts) and remaining references
  - Tags: t6-removal, api
  - Cut-critical. posthog-node dependency removal is in T-061 (package.json edits batched there). Tests:...
  - Blocked by: T-022, T-023, T-024
  - Blocks: T-060

- [ ] **T-060** (complexity: 3) - T-6 Remove PostHog env vars (registry, generated JSON, snapshots, app Zod schemas, .env.example)
  - Tags: t6-removal, config, release-env-var-change
  - Cut-critical. Tests: pnpm env:check:registry-style suites (env-registry.test.ts, env-registry-json.g...
  - Blocked by: T-057, T-058, T-059
  - Blocks: T-061, T-062, T-067

- [ ] **T-061** (complexity: 3) - T-6 Remove PostHog from Dockerfiles, turbo.json, build scripts, guards and package dependencies
  - Tags: t6-removal, config, devops
  - Cut-critical. Tests: dockerfile-build-args.test.ts, `bash scripts/check-dockerfile-build-env-in-turb...
  - Blocked by: T-060
  - Blocks: T-067

- [ ] **T-062** (complexity: 2) - T-6 Remove PostHog from CI workflows
  - Tags: t6-removal, devops, ci
  - Cut-critical. Tests: workflow YAML lint via the repo's actionlint/validate-docs if present; `rg -i p...
  - Blocked by: T-060
  - Blocks: T-067

- [ ] **T-063** (complexity: 2) - T-6 Delete infra/cloudflare/posthog-proxy and its references
  - Tags: t6-removal, devops
  - Cut-critical (the spec deletes the worker in the same cut). Tests: workspace config still resolves (...
  - Blocked by: T-029, T-057
  - Blocks: T-067

- [x] **T-064** (complexity: 2) - T-6 Delete scripts/posthog and the posthog:setup script
  - Tags: t6-removal, scripts
  - Safe only after scripts/umami/setup.ts exists (T-041). Tests: scripts/client-tools tests for the run...
  - Blocked by: T-041
  - Blocks: T-067

- [ ] **T-067** (complexity: 2) - T-6 Verify AC-9: no PostHog left outside historical docs and check:guards is green
  - Tags: t6-removal, testing
  - Final cleanup gate for T-6 (AC-9). Also reconcile specs-prioritization.csv if it mentions PostHog on...
  - Blocked by: T-060, T-061, T-062, T-063, T-064, T-065, T-066
  - Blocks: T-068

- [ ] **T-070** (complexity: 1) - Post-cut: remove the deployed PostHog Cloudflare worker and abandon the PostHog project (owner action)
  - Tags: t6-removal, devops, owner-action
  - OWNER ACTION, only after the prod 48h watch (T-069) shows Umami healthy; earlier removal would kill ...
  - Blocked by: T-069
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-011, T-044, T-050
Level 1: T-002, T-003, T-005, T-012, T-037, T-045, T-051
Level 2: T-004, T-008, T-013, T-016, T-018, T-038, T-046, T-047
Level 3: T-006, T-014, T-017, T-019, T-028, T-039, T-040, T-048
Level 4: T-007, T-020, T-021, T-029, T-041, T-042, T-049, T-052, T-053
Level 5: T-009, T-010, T-022, T-023, T-024, T-027, T-034, T-054, T-055, T-064, T-065
Level 6: T-015, T-025, T-030, T-031, T-032, T-033, T-035, T-043, T-059, T-066
Level 7: T-026, T-036, T-057, T-058
Level 8: T-056, T-060, T-063
Level 9: T-061, T-062
Level 10: T-067
Level 11: T-068
Level 12: T-069
Level 13: T-070

## Suggested Start

Begin with **T-001** (complexity: 3), the local Umami spike: no dependencies and it unblocks T-002, T-003, T-005 and T-037. T-011, T-044 and T-050 (env registry, schema, i18n copy) have no dependencies either and can run in parallel with the spike.
