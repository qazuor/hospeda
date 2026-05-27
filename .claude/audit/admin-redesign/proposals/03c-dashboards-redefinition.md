---
proposal: dashboards-redefinition
status: DRAFT (in active discussion)
version: 0.1
date-started: 2026-05-26
last-updated: 2026-05-26
supersedes-partially: 03-dashboards.md (v0.3) — per-role widget sets
depends-on: 01-information-architecture.md, 02-config-schema.md, 03-dashboards.md (v0.3), 03b-endpoint-verification.md
related: SPEC-155 (admin-dashboards-v1)
scope: Revised per-role dashboard definitions agreed during the 2026-05-26 review session. UNLIKE 03 v0.3, this revision DOES include new backend where the owner chose to add it.
---

# Per-Role Dashboards — Redefinition (2026-05-26 review)

> **Why this doc exists**: `03-dashboards.md` (v0.3) locked a V1 scope of "widgets that consume EXISTING endpoints only — no new backend". In the 2026-05-26 review session the owner revised the per-role dashboards and explicitly chose to **include new backend** for selected widgets. This document captures the revised, agreed definitions. The original `03` v0.3 is preserved for its endpoint-verification history and its "no new backend" baseline.

> **Status of this review**: HOST ✅ defined · EDITOR ✅ defined · ADMIN ✅ defined · SUPER_ADMIN ✅ defined.

> **Scope change flag**: This revision breaks SPEC-155's original "V1 builds no backend" premise. How this maps to specs (update SPEC-155 vs. extract backend work into separate specs) is an OPEN planning decision to be resolved once all four dashboards are defined.

## Legend

- 🟢 **backend ready** — consumes an endpoint/data that exists today.
- 🟡 **backend ready, no DB change** — data exists but needs a new aggregation + route.
- 🔴 **new backend** — needs new infrastructure (table/tracking) and/or an architectural decision.

---

## HOST — "Mi negocio"

Layout: **7 cards**. Cards group related data; a single card may render multiple data points.

| Card | Contents | Backend |
|------|----------|:---:|
| **A — Mis alojamientos** | Count of own listings + "Borradores sin publicar" (DRAFT accommodations) with a link to publish | 🟢 |
| **B — Mi plan** | Unified: subscription status + next charge + plan usage (X/limit accommodations, warn at 80%) | 🟢 |
| **C — Consultas** | Grouped: pending-inquiry count (large KPI) + top-5 list with a per-item "Responder" button | 🟢 |
| **D — Estado de mi alojamiento** | "Mejorá tu alojamiento" dynamic completeness checklist (missing: photos, description, amenities, price, location, contact) | 🟢 |
| **E — Reseñas** | Latest reviews received, read-only list | 🟢 |
| **F — Mi perfil** | "Salud del perfil de host": account + contact data completeness | 🟢 |
| **G — Estadísticas** | Favorites (per-accommodation breakdown) · Response rate (% answered + avg time) · Views (unique + total, 7/30d) · Average rating · Total reviews | 🟡/🔴 mixed |

### Card-by-card detail

**A — Mis alojamientos** 🟢
- Own listings count: `GET /api/v1/admin/accommodations?ownerId={uid}&pageSize=1` → pagination total.
- Unpublished drafts: `GET /api/v1/admin/accommodations?ownerId={uid}&status=DRAFT` → count + short list with publish link.

**B — Mi plan** 🟢 (unifies former widgets #3 + #5 + #6)
- Source: `GET /api/v1/protected/billing/subscriptions?pageSize=1` (list-and-pick active) + `GET /api/v1/protected/billing/usage`.
- Shows: subscription status badge, next charge date, plan usage as fraction (accommodations used / limit), warning state at ≥80%.

**C — Consultas** 🟢 (groups former KPI #2 + list #4 into one card)
- Source: `GET /api/v1/admin/conversations?ownerId={uid}&conversationStatus=PENDING_OWNER`.
- KPI: pending count (`&pageSize=1`). List: top 5 (`&pageSize=5&sort=updated_at_desc`) each with a "Responder" action routing to `/consultas/{id}`.
- Empty state (positive): "¡Estás al día!".

**D — Estado de mi alojamiento** 🟢
- Dynamic checklist computed client-side from the loaded accommodation object — no new backend.
- Checks for missing: photos, description, amenities, price, exact location, contact info.
- Multi-accommodation behavior: **RESOLVED (2026-05-26)** — accommodation **selector dropdown** at the top of the checklist; the host picks which listing to inspect.

**E — Reseñas** 🟢
- Latest reviews received, read-only. `REVIEW_VIEW_OWN` permission exists.

**F — Mi perfil** 🟢
- "Salud del perfil de host" completeness checklist over the host's own account + contact data (loaded user/host object).

**G — Estadísticas** (mixed backend)
- **Average rating** 🟢 — `averageRating` already persisted on the accommodation.
- **Total reviews** 🟢 — `reviewsCount` already persisted.
- **Favorites — per-accommodation breakdown** 🟢 LOW backend — list of each accommodation with its bookmark count. `UserBookmarkService.countBookmarksForEntity()` already exists; a public count endpoint exists. **Missing**: a PROTECTED route scoped to the host (iterates the host's listings). DB unchanged.
- **Response rate — % answered + avg time** 🟡 MEDIUM backend — **no DB change**. `conversations` already carries denormalized `firstGuestMessageAt`, `firstOwnerReplyAt`, `guestMessageCount`, `ownerMessageCount`; `messages.senderType` ∈ {GUEST, OWNER, SYSTEM}. **Missing**: aggregation service + route. % answered derived from `ownerMessageCount`; avg time from `firstGuestMessageAt`→`firstOwnerReplyAt`.
- **Views — unique + total, 7/30d** 🔴 HIGH backend — PostHog fires `accommodation_viewed` client-side (`AccommodationViewTracker.client.tsx`) but NOTHING is persisted in our DB. **Missing**: full pipeline. **OPEN architectural decision** (deferred to spec tech-analysis): own DB table + server-side tracking vs. query the PostHog API server-side. Showing unique + total adds dedup-aggregation work either way.

### New backend introduced by HOST (for planning)

| Piece | Effort | What's needed | DB change? |
|-------|:------:|---------------|:---:|
| Favorites count (protected, scoped, per-accommodation) | 🟢 LOW | New protected route over existing `countBookmarksForEntity()` | No |
| Response rate aggregation | 🟡 MEDIUM | New aggregation service + route | No |
| Accommodation views (unique + total) | 🔴 HIGH | New tracking/storage OR PostHog API integration + aggregation + route | TBD (decision pending) |

### Product decisions taken (2026-05-26)

| Widget | Decision |
|--------|----------|
| Plan (B) | Unify plan status + usage into one card |
| Consultas (C) | Show KPI + list grouped in one card |
| Favorites (G) | Per-accommodation breakdown (not a single total) |
| Response rate (G) | Show BOTH: % answered + average response time |
| Views (G) | Count BOTH: unique visitors + total visits |

### Open questions (HOST)

- **HOST-Q1** ✅ RESOLVED (2026-05-26): multi-accommodation checklist → accommodation selector dropdown.
- **HOST-Q2**: Views architecture — own tracking table vs. PostHog API. Resolve in spec tech-analysis.

---

## EDITOR — "La redacción"

EDITOR scope (verified in `packages/seed/src/required/rolePermissions.seed.ts:598`): the role manages **Posts, Events, Tags/Post-tags, Media, Bookmarks** — and NOTHING else (no Accommodations, Destinations, Attractions, and originally no Newsletter). The newsletter widgets inherited from `03` v0.3 required a permission decision (resolved below).

Layout: **8 cards**.

| Card | Contents | Backend |
|------|----------|:---:|
| **A — Posts** | Posts published this month + Pending drafts (count) + Recent drafts (top-5 list) | 🟢 |
| **B — Eventos** | Upcoming events (count) + Upcoming events (list) + Featured upcoming events (list) | 🟢 |
| **C — Suscriptores Newsletter** | Active subscribers + Subscribers by content preference (OFFERS/EVENTS/GUIDES/PRODUCT_NEWS). Open rate → deferred to phase 2. | 🟢/🟡 |
| **D — Campañas Newsletter** | Scheduled campaigns | 🟢 |
| **E — Estadísticas blog** | Post status distribution + Most popular posts (by engagement) + Total published + Posts per month (trend) + Views per post | 🟢/🟡/🔴 |
| **F — Estadísticas eventos** | Total events + Views per event | 🟢/🔴 |
| **G — Salud** | Posts: missing featured image / missing tags / missing SEO. Events: missing featured image / missing location / missing organizer / missing extended description. | 🟢 |
| **H — Comentarios** | Recent comments on posts/events to moderate | 🟡 |

### Newsletter access decision (2026-05-26)

The owner asked: can editors create/edit/view newsletter but NOT send (send stays with admin)? **Yes — trivially**, because the permission set is already granular (`packages/schemas/src/enums/permission.enum.ts:642`):

- `NEWSLETTER_CAMPAIGN_VIEW` — view campaigns + deliveries
- `NEWSLETTER_CAMPAIGN_WRITE` — create/edit/delete draft campaigns
- `NEWSLETTER_CAMPAIGN_SEND` — dispatch (test send, real send, cancellation)
- `NEWSLETTER_SUBSCRIBER_VIEW` — list subscribers

**Decision**: grant EDITOR `NEWSLETTER_CAMPAIGN_VIEW` + `NEWSLETTER_CAMPAIGN_WRITE` + `NEWSLETTER_SUBSCRIBER_VIEW`. Do NOT grant `NEWSLETTER_CAMPAIGN_SEND` — sending/cancelling stays admin-only. This realizes the "editor drafts, admin sends" model with the existing permission system. Implementation = add those 3 permissions to the EDITOR row in the seed.

### Card detail

**A — Posts** 🟢
- Published this month: `posts?status=ACTIVE&createdAfter={month-start}&pageSize=1`.
- Pending drafts (count): `posts?status=DRAFT&pageSize=1`.
- Recent drafts (list): `posts?status=DRAFT&pageSize=5&sort=updated_at_desc`.

**B — Eventos** 🟢
- Upcoming count: `events?startDateAfter={now}&pageSize=1`.
- Upcoming list: `events?startDateAfter={now}&pageSize=5&sort=start_date_asc`.
- Featured upcoming list: `events?isFeatured=true&startDateAfter={now}&pageSize=5`.

**C — Suscriptores Newsletter** (needs newsletter perms above)
- Active subscribers 🟢 — `newsletter/subscribers?status=active&pageSize=1`.
- By content preference 🟡 — count subscribers per preference flag (OFFERS/EVENTS/GUIDES/PRODUCT_NEWS). Data exists in `newsletter_subscribers.preferences` (JSONB, all-true default); needs an aggregation over the JSONB. **No DB change**. NOTE: the 4 real content types are OFFERS/EVENTS/GUIDES/PRODUCT_NEWS — there is no "accommodation" content type.
- Open rate → **phase 2** (no opens stored; see below).

**D — Campañas Newsletter** 🟢 (needs newsletter perms)
- Scheduled campaigns: `newsletter/campaigns?status=scheduled&pageSize=3`.

**E — Estadísticas blog**
- Status distribution 🟢 — count posts grouped by status (PUBLISHED/DRAFT/ARCHIVED).
- Most popular posts 🟢 — top posts by engagement; `likes`/`comments`/`shares` counters already on the post. (Unblocks what `03` v0.3 had dropped as "uncertain".)
- Total published 🟢 — `posts?status=ACTIVE&pageSize=1`.
- Posts per month (trend) 🟡 — `createdAt` exists; needs a date-grouped aggregation. No DB change.
- Views per post 🔴 — needs the cross-entity view tracking (see decision below).

**F — Estadísticas eventos**
- Total events 🟢 — `events?pageSize=1`.
- Views per event 🔴 — cross-entity view tracking (see below).

**G — Salud** 🟢 (all computable from the loaded object)
- Posts: missing featured image, missing tags, missing SEO metadata.
- Events: missing featured image, missing `locationId`, missing `organizerId`, missing extended `description` (only `summary` is required).
- NOTE: "events without a date" was requested but is IMPOSSIBLE — `EventDateSchema.start` is required (`event.date.schema.ts`). Dropped.

**H — Comentarios** 🟡
- Recent comments to moderate. `comments` counter + `POST_COMMENT_CREATE`/`EVENT_COMMENT_CREATE` perms exist; the listing endpoint must be verified/built.

### New backend introduced by EDITOR (for planning)

| Piece | Effort | What's needed | DB change? |
|-------|:------:|---------------|:---:|
| Grant newsletter perms to EDITOR (VIEW+WRITE campaign, SUBSCRIBER_VIEW; NOT SEND) | 🟢 LOW | Seed change on EDITOR role | No |
| Subscribers-by-preference aggregation | 🟡 MEDIUM | Aggregation over `preferences` JSONB + route | No |
| Posts-per-month trend aggregation | 🟡 MEDIUM | Date-grouped aggregation + route | No |
| Recent comments listing | 🟡 MEDIUM | Verify/build comment listing endpoint | No |
| Campaign open rate | 🔴 PHASE 2 | Email-open tracking (pixel) — not stored today | TBD |
| Views per post + per event | 🔴 PHASE 2 | Cross-entity view tracking (shared with HOST accommodation views) | TBD |

### Product decisions taken (2026-05-26)

| Topic | Decision |
|-------|----------|
| Newsletter in EDITOR | Keep cards C+D; grant view/write + subscriber-view, NOT send (admin-only) |
| Open rate | Phase 2 (no backend today); card C ships with active subscribers + preference breakdown |
| Subscribers card | Add "by content preference" breakdown (4 real types, not "accommodation") |
| Salud card | Include ALL valid computable items (posts ×3, events ×4); drop "events without date" (impossible) |
| Views (post + event) | Use the single cross-entity view tracking (see global decision) |

### Open questions (EDITOR)

- **EDITOR-Q1**: "Recent comments" (card H) — confirm whether a comment-listing endpoint exists or must be built.

---

## Global decision — cross-entity view tracking

Three widgets across two roles want "views" with no backing data: HOST accommodation views, EDITOR post views, EDITOR event views. PostHog tracks these client-side but nothing is persisted in our DB.

**Decision (2026-05-26)**: do NOT build per-entity view tracking three times. Define a SINGLE cross-entity view-tracking mechanism (accommodation + post + event) once, in the spec tech-analysis. Architectural choice (own DB table + server-side capture vs. PostHog API server-side) is deferred to that tech-analysis. All three view widgets depend on this one piece and are PHASE 2.

## ADMIN + SUPER_ADMIN

**Model**: a shared BASE dashboard for both roles + an extra section visible only to SUPER_ADMIN. (Resolves the `adminDashboard`/`superAdminDashboard` stub split → one base config + super-only widgets gated by permission with `onMissing: 'hide'`.)

### Permission delta (why some widgets are super-only)

SUPER_ADMIN has +43 permissions over ADMIN (`packages/seed/src/required/rolePermissions.seed.ts`: ADMIN 155, SUPER_ADMIN 198). Pattern: **ADMIN monitors/approves; SUPER_ADMIN overrides, destroys, and configures the system.** Super-only includes `AUDIT_LOG_VIEW`, `SECURITY_LOG_VIEW`, `USER_IMPERSONATE`, all hard-deletes, `BILLING_FORCE_REFUND`/`OVERRIDE_LIMITS`, force-publish, `USER_LOCK/UNLOCK`, `SETTINGS_EDIT`, `SYSTEM_MAINTENANCE_MODE`.

### Two decisions taken (2026-05-26)

1. **Audit/Security (Card H) → SUPER-only.** Those widgets need `AUDIT_LOG_VIEW` / `SECURITY_LOG_VIEW`, which ADMIN does not have. They live in the super-only section.
2. **Billing (Card I) → SUPER-only, AND remove the permission from ADMIN.** Billing widgets only need `BILLING_METRICS_VIEW`/`SUBSCRIPTION_VIEW_ALL`, which ADMIN currently HAS. Decision: make billing super-only by **revoking `BILLING_METRICS_VIEW` + `SUBSCRIPTION_VIEW_ALL` from the ADMIN role**. ⚠️ **Scope implication**: this is a role-model change — ADMIN stops seeing the WHOLE billing section of the panel, not just the dashboard card. Must be executed deliberately in implementation (seed change + verify no admin billing route breaks).

### BASE dashboard (ADMIN + SUPER_ADMIN)

| Card | Contents | Backend |
|------|----------|:---:|
| **A — Estadísticas de entidades** | 6 content KPIs: accommodations, destinations, events, posts, attractions, users | 🟢 |
| **B — Alojamientos** | Latest published accommodations (list) | 🟢 |
| **C — Editorial** | Featured upcoming events (#10) + recent drafts + draft events + posts this month | 🟢 |
| **D — Crons** | Cron job list + enabled/total · failed/last-run | 🟢 / 🔴 |
| **E — Estado del sistema** | System health (db/redis/api) · maintenance-mode status | 🟢 / 🟡 |
| **F — Pendiente de moderación** | Pending-moderation queue (4 entities) · reviews pending moderation | 🟡 |
| **G — Usuarios** | Users by role · new users (trend) | 🟡 |

### SUPER_ADMIN-only section

| Card | Contents | Backend |
|------|----------|:---:|
| **H — Audit Logs** | Admin actions audit log · security log · Sentry errors (24h) | 🟡 / 🔴 / 🔴 |
| **I — Estadísticas de billing** | Active subscriptions (#7) + MRR (#8) + monthly revenue 12m (#9) + ARPU/churn/subscription breakdown | 🟢 |

### Card detail

**A — Estadísticas de entidades** 🟢 — the 6 KPIs already wired in today's `useDashboardStats()`. V1 just migrates them to the new renderer (`*?pageSize=1` → total per entity).

**B — Alojamientos** 🟢 — latest published: `accommodations?sort=published_desc&pageSize=5`.

**C — Editorial** 🟢 — CONFIRMED set (2026-05-26): featured upcoming events (`events?isFeatured=true&startDateAfter={now}&pageSize=5`) + recent drafts (`posts?status=DRAFT&sort=updated_at_desc`) + draft events (`events?status=DRAFT`) + posts this month (`posts?status=ACTIVE&createdAfter={month-start}`). (ADMIN has `POST_VIEW_ALL`+`EVENT_VIEW_ALL`.)

**D — Crons**
- List + enabled/total 🟢 — `cron-admin` list + trigger endpoint.
- Failed / last-run 🔴 — the job list exists but per-run RESULT is NOT persisted. Needs new backend (run-history storage).

**E — Estado del sistema**
- Health 🟢 — `health/db/live/ready` endpoints.
- Maintenance-mode status 🟡 — `SYSTEM_MAINTENANCE_MODE` permission exists; must confirm the flag is readable to display it.

**F — Pendiente de moderación** 🟡
- Pending queue across accommodations/destinations/posts/events — `moderationState=PENDING` indexed, but NO unified count endpoint (today = 4 separate queries). Needs an aggregator route.
- Reviews pending moderation 🟡 — moderation-state filters exist; no dedicated count endpoint.

**G — Usuarios** 🟡
- By role — no count-by-role endpoint yet.
- New users (trend) — `createdAt` exists; needs date-grouped aggregation. No DB change.

**H — Audit Logs (SUPER-only)**
- Admin actions audit log 🟡 — logging infra exists (`audit-logger.ts`, `AuditEventType`) but logger-only; needs a queryable admin endpoint. Permission `AUDIT_LOG_VIEW`.
- Security log 🔴 — same gap; `SECURITY_LOG_VIEW`.
- Sentry errors (24h) 🔴 — Sentry is write-only (capture); not queryable from our backend. Needs a Sentry-API integration/proxy.

**I — Estadísticas de billing (SUPER-only)** 🟢
- Active subscriptions, MRR, revenue 12m (chart), ARPU, churn, subscription breakdown — all exposed by `billing/admin/metrics`. Requires the billing permissions, which (per decision #2) become SUPER-only.

### New backend introduced by ADMIN/SUPER (for planning)

| Piece | Effort | What's needed | DB change? |
|-------|:------:|---------------|:---:|
| Revoke billing perms from ADMIN | 🟢 LOW (but wide blast radius) | Seed change + verify admin billing routes/UI | No |
| Unified moderation-pending count | 🟡 MEDIUM | Aggregator endpoint over 4 entities | No |
| Reviews-pending count | 🟡 MEDIUM | Count endpoint | No |
| Users by role + registration trend | 🟡 MEDIUM | Count-by-role + date-grouped aggregation | No |
| Maintenance-mode readable flag | 🟡 LOW-MEDIUM | Confirm/expose a readable flag | TBD |
| Cron run-history (failed/last-run) | 🔴 HIGH | Persist per-run results + endpoint | Yes (new table) |
| Admin audit-log query endpoint | 🔴 HIGH | Queryable store + endpoint (infra is logger-only today) | Likely |
| Security-log query endpoint | 🔴 HIGH | Same as audit | Likely |
| Sentry error-count integration | 🔴 HIGH | Sentry-API proxy (Sentry not queryable from our backend) | No (external) |
| Admin sponsorships analytics | 🔴 HIGH | New admin aggregation endpoint | No |

### Product decisions taken (2026-05-26)

| Topic | Decision |
|-------|----------|
| ADMIN vs SUPER model | Shared base + super-only extra section (not two full dashboards, not fully identical) |
| Card H (audit/security) | SUPER-only (permission-gated) |
| Card I (billing) | SUPER-only + REVOKE billing perms from ADMIN (role-model change, wide blast radius) |
| Card A (6 KPIs) | Keep as-is; migrate from existing `useDashboardStats()` |

### Open questions (ADMIN/SUPER)

- **ADMIN-Q1** ✅ RESOLVED (2026-05-26): Card C (Editorial) = featured upcoming events + recent drafts + draft events + posts this month (full set).
- **ADMIN-Q2** (technical, for implementation): Revoking billing perms from ADMIN — verify no admin billing route/page assumes ADMIN access before shipping the seed change.

---

## Session decisions log

| Date | Decision |
|------|----------|
| 2026-05-26 | Review the 4 already-defined dashboards (HOST/EDITOR/ADMIN/SUPER_ADMIN); SPONSOR + CLIENT_MANAGER deferred (still `enabled: false`, no dashboard) |
| 2026-05-26 | Mode = DEFINITION ONLY — no code in this session |
| 2026-05-26 | HOST redefined from 6 flat widgets to 7 grouped cards (A–G) |
| 2026-05-26 | HOST scope expanded to INCLUDE new backend (favorites scoped route, response-rate aggregation, accommodation views) — breaks SPEC-155 "no new backend" premise; spec-mapping decision deferred |
| 2026-05-26 | EDITOR scope confirmed = Posts + Events only; the `03` v0.3 newsletter widgets were outside its permissions |
| 2026-05-26 | EDITOR gets newsletter view/write + subscriber-view (NOT send) — "editor drafts, admin sends"; possible because permissions are already granular |
| 2026-05-26 | EDITOR redefined into 8 cards (Posts, Eventos, Suscriptores NL, Campañas NL, Estadísticas blog, Estadísticas eventos, Salud, Comentarios) |
| 2026-05-26 | EDITOR open rate → phase 2; subscribers card adds content-preference breakdown (OFFERS/EVENTS/GUIDES/PRODUCT_NEWS) |
| 2026-05-26 | "Events without a date" widget dropped — impossible (EventDateSchema.start is required) |
| 2026-05-26 | GLOBAL: single cross-entity view-tracking piece (accommodation + post + event), designed once in tech-analysis; all 3 view widgets are phase 2 |
| 2026-05-26 | ADMIN/SUPER model = shared base (cards A–G) + SUPER-only section (cards H–I) |
| 2026-05-26 | Audit log + security log + Sentry → SUPER-only (permission-gated) |
| 2026-05-26 | Billing → SUPER-only AND revoke BILLING_METRICS_VIEW + SUBSCRIPTION_VIEW_ALL from ADMIN (role-model change; ADMIN loses the whole billing section, not just the card) |
| 2026-05-26 | ALL 4 dashboards now defined (HOST, EDITOR, ADMIN, SUPER_ADMIN). SPONSOR + CLIENT_MANAGER still deferred. Next: decide how this maps to specs (update SPEC-155 vs. extract backend specs) |
