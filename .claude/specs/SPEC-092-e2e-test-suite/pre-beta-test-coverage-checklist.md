# Pre-Beta Test Coverage Checklist

> **Companion document to**: `spec.md` (formal e2e test suite spec for `apps/e2e`)
> **Status**: draft — prioritized (P0 / P1 / post-beta)
> **Scope**: catalog of every feature, dimension, and end-to-end journey that must be covered before opening Hospeda to beta testers.
> **Created**: 2026-04-27
> **Last update**: 2026-04-27 — prioritization pass
> **Total items**: 101 across 20 categories (61 P0, 34 P1, 6 post-beta)

This file is a **coverage map**, not an execution plan. Each item describes WHAT to test and WHO is involved. Steps and acceptance criteria will be expanded in a second pass for items prioritized as P0.

**Priority legend**:

- **P0** — must be covered before opening beta. Failure touches money, security, privacy, or the core flow of the three actors (host publishes, tourist searches, host pays).
- **P1** — important but tolerable if documented or manually mitigated during beta.
- **post-beta** — nice-to-have, hardening, or scenarios the beta cohort doesn't stress (low volume).

---

## Format

Each item:

```text
N: title
users: [actor types involved]
prioridad: P0 | P1 | post-beta
categoria: type of functionality
apps: [apps involved]
testing: [test type — e2e / manual / semi-manual / automated / integration]
descripcion: brief description and implications
```

Journey items (#96-101) include extra `implicancias` and `validaciones` blocks because they cross categories.

---

## A. Authentication and session

### 1: Signup with email/password + verification

- **users**: `[GUEST → USER]`
- **prioridad**: `P0`
- **categoria**: auth
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: account signup, email reception via Resend, click on activation link, account becomes active. Implies Better Auth + transactional email pipeline working.

### 2: Signin happy path + invalid credentials

- **users**: `[USER, HOST, ADMIN]`
- **prioridad**: `P0`
- **categoria**: auth
- **apps**: `[web, admin]`
- **testing**: `[e2e + semi-manual]`
- **descripcion**: valid login returns session; wrong password returns generic error without leaking whether the email exists (anti-enumeration).

### 3: Password reset flow

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: auth
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: request reset, receive email, set new password, login works, reset token invalidated after single use.

### 4: Logout and session expiration

- **users**: `[USER, HOST, ADMIN]`
- **prioridad**: `P0`
- **categoria**: auth
- **apps**: `[web, admin]`
- **testing**: `[semi-manual]`
- **descripcion**: logout invalidates session cookie; session expires by TTL; cookie flags Secure/HttpOnly/SameSite correct.

### 5: Cross-app session

- **users**: `[HOST, ADMIN]`
- **prioridad**: `P1`
- **categoria**: auth
- **apps**: `[web, admin]`
- **testing**: `[manual]`
- **descripcion**: an admin user logs into the admin panel and visits the web — does it share the session? What happens with cross-domain cookies?

### 6: Account deletion / GDPR

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: auth + lifecycle
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: delete account soft-deletes user, decide policy on orphan accommodations (cascade vs preserve), anonymize reviews. Legal implication.

---

## B. Authorization and permissions

### 7: IDOR on protected accommodations

- **users**: `[HOST_A, HOST_B]`
- **prioridad**: `P0`
- **categoria**: security/authz
- **apps**: `[api, web]`
- **testing**: `[e2e + automated]`
- **descripcion**: HOST_B attempts to edit HOST_A's accommodation via direct PATCH to API. Must return 403, not 404. Same pattern on bookmarks, reviews, conversations.

### 8: Privilege escalation via mass assignment

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: security/authz
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: USER sends `role: ADMIN` or `lifecycleState: ACTIVE` in their own update; must be silently dropped or rejected. Verify Zod strip or explicit allowlist.

### 9: Access to admin endpoints without permission

- **users**: `[USER, HOST]`
- **prioridad**: `P0`
- **categoria**: security/authz
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: USER calls `/api/v1/admin/*`; must return 403. Coverage by representative PermissionEnum (ACCOMMODATION_VIEW_ALL, USER_DELETE, BILLING_REFUND, etc.).

### 10: Web app never calls admin endpoints

- **users**: `[—]`
- **prioridad**: `P1`
- **categoria**: arch boundary
- **apps**: `[web]`
- **testing**: `[automated/grep CI]`
- **descripcion**: guarantee that `apps/web/src/lib/api/` does not reference `/admin/` routes. Documented exception: `/api/v1/public/auth/me`.

---

## C. Host onboarding (SPEC-091)

### 11: End-to-end publication of a new accommodation

- **users**: `[USER → HOST]`
- **prioridad**: `P0`
- **categoria**: lifecycle/onboarding
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: full flow `/publicar` → 8-section form → publication → HOST role assigned → `lifecycleState=ACTIVE`. BBT item 8.

### 12: Autosave and draft persistence

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: onboarding
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: close tab mid-form, reopen, see "Continue draft" banner with intact data. Test after 24h.

### 13: Per-section form validations

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: forms
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: required fields per section (name, description, minimum photos, price, location). Errors readable in Spanish.

### 14: Photo upload to Cloudinary

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: upload
- **apps**: `[web]`
- **testing**: `[e2e + manual]`
- **descripcion**: 5 photos, see immediate thumbnails, delete one, reorder. Validate type (jpg/png/webp), max size, rate limit (SPEC-079).

### 15: Editing an already published property

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: lifecycle
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: price change from `/mi-cuenta/propiedades/[id]/editar`, verify PATCH, refresh of detail page (ISR).

### 16: Unpublish / republish / archive

- **users**: `[HOST]`
- **prioridad**: `P1`
- **categoria**: lifecycle
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: `lifecycleState` transitions (ACTIVE ↔ INACTIVE ↔ ARCHIVED). Verify public visibility in each state.

---

## D. Public browsing (tourist)

### 17: Home page rendering + ISR

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: content/perf
- **apps**: `[web]`
- **testing**: `[e2e + perf]`
- **descripcion**: home loads with featured items, correct cards, LCP < 2.5s, ISR refreshes after admin edits.

### 18: Accommodation listings with filters

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: search
- **apps**: `[web, api]`
- **testing**: `[e2e]`
- **descripcion**: `/alojamientos` with destination/type/price/amenity filters, sorting, pagination. Verify invalid filters don't crash (SPEC-088).

### 19: Accommodation detail page

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: content
- **apps**: `[web]`
- **testing**: `[manual + e2e]`
- **descripcion**: gallery, description, map, amenities, reviews, "other properties from this host" (SPEC-089), nearby events, JSON-LD, breadcrumbs. DoD item 7.

### 20: Full-text search and by destination

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: search
- **apps**: `[web, api]`
- **testing**: `[e2e]`
- **descripcion**: navbar search box, autocomplete, results page, no-match cases.

### 21: Browse by destination (hierarchy)

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: content/destinations
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: navigate `/destinos/argentina/litoral/entre-rios/concepcion-del-uruguay`, correct breadcrumb, filtered listings.

### 22: Events by destination and upcoming

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: content/events
- **apps**: `[web, api]`
- **testing**: `[e2e]`
- **descripcion**: SPEC-089 Track B — `/destinos/[slug]/eventos`, upcoming events page, event detail page.

### 23: Blog/Posts

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: content
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: listings, detail, related posts, by category, by destination.

---

## E. User account (web)

### 24: Bookmarks

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: feature
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: add/remove favorites on accommodations, events, posts, destinations. List in `/mi-cuenta/favoritos`. Sync across devices.

### 25: Reviews / comments

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: feature
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: leave review on visited accommodation, validate rating 1-5, admin moderation before publication (if applicable).

### 26: Guest-owner messaging (SPEC-085)

- **users**: `[GUEST/USER + HOST]`
- **prioridad**: `P0`
- **categoria**: messaging
- **apps**: `[web]`
- **testing**: `[e2e + manual]`
- **descripcion**: GUEST clicks "Contact host" on accommodation, conversation opens, host receives email, host replies from `/mi-cuenta/conversaciones`, mailer back to guest.

### 27: Conversations — states and permissions

- **users**: `[GUEST, HOST]`
- **prioridad**: `P0`
- **categoria**: messaging/lifecycle
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: OPEN/CLOSED states, permissions (only participants read), SYSTEM message on close, no leak of foreign conversations.

---

## F. Billing — tourist becoming HOST

### 28: Plan selection + MP checkout

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: billing
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: `/suscriptores/planes` → selection → MP checkout → charge → activation. DoD item 9 (5 MP scenarios).

### 29: MP webhook — idempotency + HMAC

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: billing/security
- **apps**: `[api]`
- **testing**: `[automated + manual]`
- **descripcion**: webhook replay 3x with same event_id results in 1 row in `billing_webhook_events`. HMAC mismatch rejects with 401. DoD item 9 scenario 4.

### 30: Automatic renewal

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: billing/cron
- **apps**: `[api]`
- **testing**: `[manual stage]`
- **descripcion**: subscription renews on expiration, webhook activates, no feature downtime. Requires date simulation or clock injection.

### 31: Cancellation + refund

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: billing
- **apps**: `[web, admin]`
- **testing**: `[manual]`
- **descripcion**: host cancels from `/mi-cuenta/suscripcion`, retains access until end of paid period. Admin issues refund from MP, webhook processes, audit log persists. BBT item 10.

### 32: Addon purchase

- **users**: `[HOST]`
- **prioridad**: `P1`
- **categoria**: billing
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: buy addon (e.g. featured listing), entitlement becomes active, expires on correct date, compensating event if revocation fails.

### 33: Promo codes

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: billing
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: apply valid code, discount reflected, expired/used rejects, repeat attempts not exploitable.

---

## G. Admin panel — content moderation

### 34: Paginated admin accommodations listing

- **users**: `[ADMIN]`
- **prioridad**: `P0`
- **categoria**: admin
- **apps**: `[admin]`
- **testing**: `[e2e]`
- **descripcion**: filters (status, ownerId, destination, search), pagination, sorting. SPEC-049.

### 35: Approve/reject pending accommodation

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: lifecycle/moderation
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: pending queue → review → ACTIVE/REJECTED, host notification via mailer.

### 36: Soft delete + restore

- **users**: `[ADMIN]`
- **prioridad**: `P0`
- **categoria**: lifecycle
- **apps**: `[admin, api]`
- **testing**: `[e2e]`
- **descripcion**: soft-delete sets `deletedAt`, hidden from public listings but visible in admin with `includeDeleted=true`. Restore brings it back.

### 37: Hard delete

- **users**: `[SUPER_ADMIN]`
- **prioridad**: `P1`
- **categoria**: lifecycle
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: permanent deletion, M2M cascade (amenities, bookmarks, reviews). Mandatory confirmation.

### 38: Batch operations

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: admin
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: select multiple, bulk archive/delete, atomic transaction.

---

## H. Admin panel — user and billing management

### 39: User management — list, search, role assign

- **users**: `[ADMIN]`
- **prioridad**: `P0`
- **categoria**: admin
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: list with filters, assign HOST/ADMIN role, suspend/unsuspend, view activity.

### 40: Billing dashboard admin

- **users**: `[ADMIN]`
- **prioridad**: `P0`
- **categoria**: billing/admin
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: subscriptions list, customer add-ons, metrics (system usage, approaching limits), cron jobs status. Pages already verified but re-test E2E.

### 41: Sponsorships and promo codes admin

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: admin
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: CRUD of sponsorships, levels, packages, promo codes with active/expired filters.

### 42: Exchange rates admin

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: admin/billing
- **apps**: `[admin, api]`
- **testing**: `[manual]`
- **descripcion**: view/edit ARS/USD/EUR/BRL rates, manual refresh, fallback if external source goes down.

---

## I. Crons and background processes

### 43: Addon expiration cron

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: cron/billing
- **apps**: `[api]`
- **testing**: `[manual + automated]`
- **descripcion**: addon expiring today is deactivated on next cron run, entitlement removed, audit log persists.

### 44: Conversation cleanup cron (SPEC-085)

- **users**: `[—]`
- **prioridad**: `P1`
- **categoria**: cron/messaging
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: conversations inactive for X days are closed or archived per policy.

### 45: Host onboarding reminder cron

- **users**: `[USER in draft]`
- **prioridad**: `P1`
- **categoria**: cron
- **apps**: `[api]`
- **testing**: `[manual]`
- **descripcion**: users with incomplete drafts receive email reminder after N days.

### 46: Cron secret protection

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security/cron
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: cron endpoint requires valid `HOSPEDA_CRON_SECRET`; without it 401, doesn't expose which crons exist.

---

## J. Cross-cutting security

### 47: SQL injection on filters

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security/injection
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: `?search='; DROP TABLE--` doesn't crash, correct parameterization. SPEC-026 already covered, re-validate on new endpoints (SPEC-089).

### 48: LIKE wildcard injection

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security/injection
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: search with literal `%` and `_` doesn't expand wildcards (uses `safeIlike`). CI grep already enforces; verify at runtime.

### 49: Reflected and stored XSS

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: security/injection
- **apps**: `[web, admin]`
- **testing**: `[manual + automated]`
- **descripcion**: description fields, names, reviews — `<script>` payload sanitized at render. CSP blocks inline scripts (SPEC-042).

### 50: CSP enforcement

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security
- **apps**: `[web, admin]`
- **testing**: `[automated]`
- **descripcion**: correct CSP headers, reporting endpoint capturing violations in Sentry, no `unsafe-inline`/`unsafe-eval` in prod. SPEC-042-GAPS.

### 51: Rate limit on public endpoints

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security/perf
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: 200 req/min burst against `/api/v1/public/accommodations` returns 429. Memory + Redis backends. SPEC-079.

### 52: Brute force login

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: security/auth
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: 5+ failed attempts trigger rate limit / captcha / temporary lockout.

### 53: Path traversal in uploads

- **users**: `[HOST]`
- **prioridad**: `P1`
- **categoria**: security
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: filename `../../etc/passwd` or null doesn't escape storage scope; Cloudinary handles itself but validate.

### 54: CSRF on protected mutations

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: security
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: POST without CSRF token (or with another user's token) rejected. Better Auth includes protection, validate.

---

## K. Performance and observability

### 55: LCP / Core Web Vitals

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: perf
- **apps**: `[web]`
- **testing**: `[automated]`
- **descripcion**: Lighthouse on home, listings, detail under threshold mobile. Images lazy-loaded + Cloudinary responsive.

### 56: Pagination with large datasets

- **users**: `[GUEST]`
- **prioridad**: `post-beta`
- **categoria**: perf
- **apps**: `[api]`
- **testing**: `[automated with seed +1000 rows]`
- **descripcion**: page=50 over 1000-entry dataset responds < 500ms, no N+1.

### 57: ISR cache hit/miss

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: perf/cache
- **apps**: `[web]`
- **testing**: `[manual + log inspection]`
- **descripcion**: SPEC-034 — verify revalidation after admin edit, hit ratio in production.

### 58: Sentry capturing errors

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: observability
- **apps**: `[web, admin, api]`
- **testing**: `[manual]`
- **descripcion**: synthetic error fires Sentry event with `release` tag, source maps resolved, user/route context. DoD item 4.

### 59: Metrics and health checks

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: observability
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: `/health` returns 200 when DB ok, 503 if DB down. `/metrics` exposes request counts/latencies.

---

## L. i18n and SEO

### 60: Language switch es/en/pt

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: i18n
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: persistent language change (cookie/URL), translated content, fallback to `es` if locale doesn't exist.

### 61: URL routing with locales

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: i18n/seo
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: `/es/alojamientos` vs `/en/accommodations` (if applicable), hreflang tags, correct canonical, sitemap per locale.

### 62: SEO meta tags + structured data

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: seo
- **apps**: `[web]`
- **testing**: `[automated]`
- **descripcion**: each page has `<title>`, `meta description`, og:image, valid JSON-LD (LodgingBusiness, Event, BlogPosting). Google validator.

### 63: Sitemap.xml and robots.txt

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: seo
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: sitemap includes all indexable pages, excludes drafts/deleted, robots.txt blocks `/admin/`, `/api/`.

---

## M. Transactional email

### 64: Signup email verification

- **users**: `[USER]`
- **prioridad**: `P0`
- **categoria**: email/auth
- **apps**: `[api]`
- **testing**: `[manual]`
- **descripcion**: email received in real inbox (not spam), link works, deep link to app correct.

### 65: SPEC-085 messaging mailers

- **users**: `[GUEST, HOST]`
- **prioridad**: `P0`
- **categoria**: email/messaging
- **apps**: `[api]`
- **testing**: `[manual]`
- **descripcion**: notification to host on new message, notification to guest on reply, opt-out works, templates in es/en/pt.

### 66: Billing mailers

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: email/billing
- **apps**: `[api]`
- **testing**: `[manual]`
- **descripcion**: payment confirmation, renewal reminder, refund issued. Templates and links correct.

---

## N. Edge cases and resilience

### 67: Access to soft-deleted resource

- **users**: `[GUEST, USER]`
- **prioridad**: `P0`
- **categoria**: lifecycle
- **apps**: `[web]`
- **testing**: `[e2e]`
- **descripcion**: visit `/alojamientos/{slug}` of a deleted one → graceful 404. Bookmark to deleted one disabled in user listing.

### 68: Concurrent edit (host edits while admin edits)

- **users**: `[HOST, ADMIN]`
- **prioridad**: `P1`
- **categoria**: concurrency
- **apps**: `[admin, web]`
- **testing**: `[manual]`
- **descripcion**: two tabs editing same property — last-wins / optimistic lock / merge. Define policy and validate.

### 69: Network failure mid-form

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: resilience
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: drop connection during publish form autosave → retry, no data loss, user-facing message.

### 70: DB transaction rollback

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: data integrity
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: SPEC-059/SPEC-064 — error mid-multi-table operation reverts everything, no inconsistent state (e.g. addon created without entitlement).

---

## O. Accessibility (WCAG 2.1 AA)

### 71: Full keyboard navigation

- **users**: `[GUEST, USER, HOST]`
- **prioridad**: `P1`
- **categoria**: a11y
- **apps**: `[web, admin]`
- **testing**: `[manual + axe-core automated]`
- **descripcion**: Tab/Shift+Tab traverses entire app without losing focus, focus ring visible on all interactives, escape closes modals, Enter activates buttons. Focus traps only inside modals.

### 72: Screen readers

- **users**: `[USER]`
- **prioridad**: `post-beta`
- **categoria**: a11y
- **apps**: `[web, admin]`
- **testing**: `[manual with NVDA/VoiceOver]`
- **descripcion**: forms announce labels and errors, listings announce count, images with descriptive alt (not decorative), icons with `aria-label`, correct landmarks (`<nav>`, `<main>`, `<aside>`).

### 73: Color contrast

- **users**: `[—]`
- **prioridad**: `P1`
- **categoria**: a11y
- **apps**: `[web, admin]`
- **testing**: `[automated axe-core]`
- **descripcion**: minimum 4.5:1 ratio for normal text and 3:1 for large/UI. Verify in hover/disabled/error states which often break.

### 74: Accessible forms

- **users**: `[USER, HOST]`
- **prioridad**: `P1`
- **categoria**: a11y
- **apps**: `[web, admin]`
- **testing**: `[manual]`
- **descripcion**: each input with associated `<label>`, errors with `aria-describedby`, required marked with aria-required, validation not by color only (also text/icon).

### 75: Reduced motion

- **users**: `[—]`
- **prioridad**: `post-beta`
- **categoria**: a11y
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: with `prefers-reduced-motion: reduce`, carousels, transitions and animations are disabled or fast-forwarded.

---

## P. Browser and device matrix

### 76: Mobile iOS Safari

- **users**: `[GUEST, USER]`
- **prioridad**: `P0`
- **categoria**: compat
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: bulk of tourist traffic comes from mobile. Safari iOS often breaks with `vh`, scroll restoration, Cloudinary picture srcset, sticky headers. Test accommodation publication from mobile (complex form).

### 77: Mobile Android Chrome

- **users**: `[GUEST, HOST]`
- **prioridad**: `P0`
- **categoria**: compat
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: same as 76 but greater viewport variance. Test photo upload with native camera.

### 78: Desktop Chrome/Firefox/Safari

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: compat
- **apps**: `[admin]`
- **testing**: `[manual]`
- **descripcion**: admin panel with large tables, drag-and-drop, side panels. Safari often breaks complex grid layouts.

### 79: Large screens (>1920px)

- **users**: `[—]`
- **prioridad**: `post-beta`
- **categoria**: compat
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: container max-widths, no content lost in infinite margins, hero/images not pixelated at 4K.

---

## Q. Operations, deploy and configuration

### 80: Vercel deploy — preview vs prod

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: devops
- **apps**: `[web, admin, api]`
- **testing**: `[manual]`
- **descripcion**: each PR generates preview with preview DB, prod only from main, correct env vars per scope (Preview/Production), rollback in one click.

### 81: Complete environment variables

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: config
- **apps**: `[api, web, admin]`
- **testing**: `[automated]`
- **descripcion**: `pnpm env:check` validates against `@repo/config` registry. Missing in prod aborts startup instead of failing at runtime. Verify Resend, MP, Cloudinary, Sentry, Better Auth, Redis URL.

### 82: Migration apply on clean DB

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: db/devops
- **apps**: `[api]`
- **testing**: `[manual]`
- **descripcion**: `pnpm db:fresh-dev` + `apply-postgres-extras.sh` leaves DB in identical state to prod. Triggers, mat views, JSONB constraints applied. Re-running script is idempotent.

### 83: DB backup and restore

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: ops/disaster recovery
- **apps**: `[—]`
- **testing**: `[manual]`
- **descripcion**: pg_dump from staging, restore to new DB, verify integrity (table counts, sample queries). Document runbook with timings. Frequency and retention.

### 84: Deploy rollback

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: devops
- **apps**: `[web, admin, api]`
- **testing**: `[manual]`
- **descripcion**: new deploy breaks → Vercel rollback to previous deploy, DB compatible (forward-only migrations — verify no compat broken). Target time < 5min.

### 85: Healthcheck and readiness

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: ops
- **apps**: `[api]`
- **testing**: `[automated]`
- **descripcion**: Vercel respects `/health`, doesn't route traffic until ready. DB pool warm-up.

### 86: Structured logs and correct level

- **users**: `[—]`
- **prioridad**: `P1`
- **categoria**: observability
- **apps**: `[api]`
- **testing**: `[manual log inspection]`
- **descripcion**: `@repo/logger` JSON with timestamp, level, requestId, userId. No stray `console.log`. No secrets nor PII in logs.

---

## R. Audit, compliance and privacy

### 87: Audit log completeness

- **users**: `[ADMIN]`
- **prioridad**: `P1`
- **categoria**: compliance
- **apps**: `[api, admin]`
- **testing**: `[manual + automated]`
- **descripcion**: EVERY sensitive action is logged: refunds, role changes, hard-deletes, plan changes, addon revocations, manually closed conversations. Audit log immutable, queryable from admin panel.

### 88: GDPR — right of access

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: compliance
- **apps**: `[—]`
- **testing**: `[manual]`
- **descripcion**: user can request export of their personal data (account, accommodations, reviews, conversations, payments). Document process even if manual via email during beta.

### 89: GDPR — right to be forgotten

- **users**: `[USER]`
- **prioridad**: `P1`
- **categoria**: compliance/lifecycle
- **apps**: `[web, api]`
- **testing**: `[manual]`
- **descripcion**: account deletion anonymizes reviews ("Anonymous user"), conversations (keep messages, anonymize author), accommodations transferred or archived. Legally required data (billing) preserved with justification.

### 90: Cookie consent

- **users**: `[GUEST]`
- **prioridad**: `P0`
- **categoria**: compliance
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: banner on first visit, granular opt-in (necessary / analytics / marketing), preferences persist. No Sentry/analytics until consent.

### 91: Privacy policy and terms

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: compliance/content
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: pages `/legal/privacidad`, `/legal/terminos`, `/legal/cookies` exist, current, accessible from footer, translated, last-update date visible.

### 92: PII in URLs / referrers

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: privacy
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: no email, token or private ID exposed in query params. Reset tokens in path single-use. Headers `Referrer-Policy: strict-origin-when-cross-origin`.

---

## S. Seed data and integrity

### 93: Seed runs cleanly on fresh DB

- **users**: `[—]`
- **prioridad**: `P0`
- **categoria**: data
- **apps**: `[—]`
- **testing**: `[automated]`
- **descripcion**: `pnpm db:fresh-dev` → complete seed without errors, SPEC-095 manifest (104 accommodations + 6 events + destination hierarchy) consistent, all FKs valid.

### 94: Seed data makes visual sense

- **users**: `[GUEST]`
- **prioridad**: `P1`
- **categoria**: data/qa
- **apps**: `[web]`
- **testing**: `[manual]`
- **descripcion**: browse the web with seed data — realistic descriptions, no broken photos, coherent prices, events on future dates. If a beta host visits the home before we have real content, it shouldn't look like a "demo".

### 95: Seed idempotency

- **users**: `[—]`
- **prioridad**: `post-beta`
- **categoria**: data
- **apps**: `[—]`
- **testing**: `[automated]`
- **descripcion**: running seed twice doesn't duplicate rows nor break constraints. Useful for partial refreshes.

---

## T. End-to-end journeys

These are full flows that cross categories and are the real test that the system works as a product, not as a sum of features.

### 96: Journey "Host discovers Hospeda and publishes" (the beta star)

- **users**: `[GUEST → USER → HOST]`
- **prioridad**: `P0`
- **categoria**: journey/end-to-end
- **apps**: `[web, api, admin]`
- **testing**: `[manual end-to-end + perf + SEO]`
- **descripcion**: A cabin owner in Concepción del Uruguay searches Google for "publicar mi alojamiento argentina" or similar. The journey must work end-to-end without assistance.

**Implicancias críticas**:

- (a) Google Search → Hospeda appears in results (SEO + indexing + existing content). Validate with `site:hospeda.com.ar` and real queries.
- (b) Click → host landing with clear CTA `/publicar`. LCP < 2.5s mobile.
- (c) Reads value prop, sees examples, decides → click "Publicar mi alojamiento" → if not logged in, inline signup (no friction of "register first").
- (d) Email verification via Resend (real, not in spam).
- (e) 8-section form — completable in one 30-40min sitting. Autosave works if paused.
- (f) Uploads 8-10 photos from mobile. Cloudinary processes, thumbnails immediate. Rate limit doesn't block normal use.
- (g) Click "Publish" → trial activates automatically (no card requested), HOST role assigned, accommodation `lifecycleState=ACTIVE`.
- (h) Redirect to detail page of their property → sees it public, confirms JSON-LD/SEO is correct, shares link with a friend.
- (i) Returns to `/mi-cuenta/propiedades`, edits price, adds extra photo — changes visible in < 60s via ISR.
- (j) A tourist (same session, different browser) searches `/alojamientos` filtering by destination → new property appears in top results or coherently sorted by relevance.

**Validaciones cruzadas**:

- Welcome email + "accommodation published successfully" email received.
- Audit log: `created_user`, `created_accommodation`, `role_assigned` events.
- Sentry: 0 errors during the full journey.
- Metrics: total time < 60min for unassisted user.

### 97: Journey "Host trial → pays → renews → buys addon → cancels"

- **users**: `[HOST]`
- **prioridad**: `P0`
- **categoria**: journey/billing
- **apps**: `[web, api]`
- **testing**: `[manual stage with MP sandbox]`
- **descripcion**: Full billing lifecycle of a real host across several months (simulated).

**Implicancias**:

- (a) Day 1: HOST published in free trial (~30 days).
- (b) Day 25: receives "trial expires in 5 days" email (mailer + cron).
- (c) Day 28: enters `/suscriptores/planes`, compares, picks plan → MP checkout → card → APRO.
- (d) MP webhook confirms → subscription becomes ACTIVE → confirmation email → billing entitlement activates premium features.
- (e) Day 30: trial expires, NO degradation because already paid. If hadn't paid, property would go INACTIVE (validate explicit policy).
- (f) Month 2: subscription auto-renews. If card fails → retry, user email, grace period.
- (g) Month 3: HOST buys "Featured listing 30 days" addon. Webhook processes, entitlement_addon active, property appears featured in search.
- (h) Month 4: addon expires (expiration cron), entitlement revoked, property no longer featured. If revocation fails → compensating event `ADDON_REVOCATION_FAILED` queued.
- (i) Month 5: HOST cancels subscription from `/mi-cuenta/suscripcion`. Retains access until end of paid period. Not charged next month.
- (j) Month 6: subscription expires, property goes INACTIVE but DATA preserved. HOST can reactivate with one click.

**Validaciones críticas**:

- Audit log: each transition logged (`TRIAL_STARTED`, `SUBSCRIPTION_CREATED`, `ADDON_PURCHASED`, `ADDON_EXPIRED`, `SUBSCRIPTION_CANCELED`, etc.).
- MP webhook idempotent: replay doesn't double-charge.
- Refund from MP dashboard → compensating event in hospeda → entitlements revoked.

### 98: Journey "Tourist member has real benefits"

- **users**: `[USER with membership]`
- **prioridad**: `post-beta`
- **categoria**: journey/entitlements
- **apps**: `[web, api]`
- **testing**: `[manual + automated]`
- **descripcion**: If we sell tourist benefits (membership, consumer-side premium plan), validate they're really enabled in the UI.

**Implicancias**:

- (a) USER signs up, buys tourist membership (if flow exists).
- (b) Login → web recognizes their tier → shows premium badges/UI (better prices, highlighted host contact, unlimited bookmarks, etc.).
- (c) Premium filters in `/alojamientos` (e.g. "verified only", "with member discount") visible and applicable.
- (d) Detail page shows explicit benefit (e.g. "10% discount applied for your membership").
- (e) Host contact via SPEC-085: member guest has priority / differentiated mailers / templates with badge.
- (f) If membership expires, benefits deactivate in < 5min, UI returns to normal state without breaking.

**Note**: if the tourist membership model is not yet implemented, this journey applies when it exists. Even so, define TODAY what a concrete benefit should be, not a generic one.

**Validaciones**:

- Consumer-side entitlements exposed consistently: API returns `viewerEntitlements`, web uses them to condition UI.
- Without entitlement: no benefit visible (no premium UI leak).

### 99: Journey "Tourist searches, expresses interest, contacts host, returns"

- **users**: `[GUEST → USER → guest_in_conversation]`
- **prioridad**: `P0`
- **categoria**: journey/booking inquiry
- **apps**: `[web, api]`
- **testing**: `[manual]`
- **descripcion**: The typical path of a tourist who discovers a property and wants to go.

**Implicancias**:

- (a) GUEST arrives via Google to `/alojamientos/cabana-x` (SEO + JSON-LD).
- (b) Interested, marks bookmark — login required → minimal signup flow.
- (c) Returns to property, click "Contact host" → form opens SPEC-085 conversation.
- (d) Host receives email with message preview, direct link to conversation.
- (e) Host replies → guest receives email → enters and replies.
- (f) After 5 messages they exchange availability, guest decides to go.
- (g) Conversation closed manually or auto-closed by inactivity (cron). SYSTEM message marks the close.
- (h) 3 months later, guest returns to Hospeda — `/mi-cuenta/conversaciones` lists archived conversation with history. Their bookmarks persist.
- (i) Reopens conversation or starts new one with same host.

**Validaciones**:

- Permissions: only participants see the conversation. Another USER who knows the ID fails.
- Mailers in receiver's language (es/en/pt per `user.preferredLocale`).
- Bookmark resists soft-delete of accommodation with "no longer available" UX.
- No email leak between guest and host (conversation is the only channel).

### 100: Journey "Admin's typical operations day"

- **users**: `[ADMIN]`
- **prioridad**: `P0`
- **categoria**: journey/admin
- **apps**: `[admin, api]`
- **testing**: `[manual]`
- **descripcion**: An admin enters the panel, handles the day, leaves. Validate the admin panel is operable without entering DB or Vercel.

**Implicancias**:

- (a) Admin login with 2FA (if implemented, otherwise mark as gap).
- (b) Dashboard shows: pending moderation count, day's payments, addons expiring today, reported conversations, recent Sentry errors.
- (c) Moderates a pending accommodation → approves → host receives email.
- (d) Receives complaint from host about addon that didn't activate → enters `/admin/billing/addons/{id}` → sees compensating event in queue → manual re-trigger → entitlement activates.
- (e) Manual refund to disgruntled host → searches subscription → click "refund" → confirms from MP dashboard → audit log persists.
- (f) Reassigns role HOST → USER for suspicious account → suspends.
- (g) Exports CSV of active subscriptions for monthly report.
- (h) Logout — session ends cleanly.

**Validaciones**:

- Each admin action logged with `actorId`, `targetId`, `action`, `metadata`.
- Granular permissions: a non-financial ADMIN CANNOT issue refunds (PermissionEnum). Test with restricted admin account.
- UX: no flow requires opening DB or Vercel logs.

### 101: Journey "Failure recovery — something breaks in prod"

- **users**: `[HOST, ADMIN]`
- **prioridad**: `P0`
- **categoria**: journey/incident
- **apps**: `[web, api]`
- **testing**: `[manual + chaos]`
- **descripcion**: Test that when something fails, the system degrades with dignity and recovers.

**Implicancias**:

- (a) MP webhook drops 5min → MP retries → system processes on return, no double-charge.
- (b) Cloudinary slow → upload waits and retries → if fails 3 times, clear message to host with "try again" CTA.
- (c) Redis down → rate limiter falls back to memory backend or fail-open → log warn, doesn't break legitimate requests. SPEC-079 fail-open.
- (d) DB read replica lag → home shows cached content, "refreshing" banner if > 30s.
- (e) Sentry rate-limit → critical errors keep being captured, samples discarded.
- (f) Email provider (Resend) down → mailers queued with retry, host eventually receives notification, no silent loss.
- (g) Vercel prod deploy fails → automatic/manual rollback to previous deploy, documented runbook.

**Validaciones**:

- Each failure mode has a user-facing message, no white screen nor exposed stack trace.
- Sentry groups errors correctly (not one event per request).
- Audit log captures failed attempts where appropriate (`failed_payment`, `failed_email_send`).

---

## Priority summary

| Priority | Count | % | Focus |
|----------|------:|---:|-------|
| **P0** | **61** | 60% | Must validate / cover before opening beta |
| P1 | 34 | 34% | Tolerable if documented during beta |
| post-beta | 6 | 6% | Deferred without guilt |

### P0 items grouped by category

| Category | P0 IDs | Count |
|----------|--------|------:|
| A. Auth & session | 1, 2, 3, 4 | 4 |
| B. Authorization | 7, 8, 9 | 3 |
| C. Host onboarding | 11, 12, 13, 14, 15 | 5 |
| D. Public browsing | 17, 18, 19, 21 | 4 |
| E. User account | 26, 27 | 2 |
| F. Billing | 28, 29, 30, 31 | 4 |
| G. Admin moderation | 34, 36 | 2 |
| H. Admin user/billing | 39, 40 | 2 |
| I. Crons | 43, 46 | 2 |
| J. Cross-cutting security | 47, 48, 49, 50, 51, 52, 54 | 7 |
| K. Performance/observability | 58, 59 | 2 |
| L. i18n & SEO | 62, 63 | 2 |
| M. Transactional email | 64, 65, 66 | 3 |
| N. Edge cases | 67, 70 | 2 |
| O. Accessibility | — | 0 |
| P. Browser matrix | 76, 77 | 2 |
| Q. Operations | 80, 81, 82, 83, 84, 85 | 6 |
| R. Audit/compliance | 90, 91, 92 | 3 |
| S. Seed data | 93 | 1 |
| T. Journeys | 96, 97, 99, 100, 101 | 5 |
| **Total** | | **61** |

### Recommended attack plan for the 61 P0 items

The P0 set splits naturally into three workstreams by execution mode:

1. **Already implemented — validate only** (~30 items): A1-A4, B7-B9, C13-C14, D17-D19, D21, E26-E27, F28-F29, F31, G34, G36, H39-H40, I43, I46, J47-J52, J54, K58-K59, L62-L63, M64-M66, N67, N70, Q81-Q82, Q85, R92, S93. Mostly automated tests in `apps/e2e` (per `spec.md`) plus integration test extensions.
2. **Requires additional work** (~15 items): C11 (E2E full publish), C12 (autosave robustness), C15 (ISR refresh confirmation), F30 (renewal with date injection), Q80 (preview-vs-prod env validation), Q83 (DB backup runbook), Q84 (rollback runbook), R90 (cookie consent banner if missing), R91 (legal pages if missing).
3. **Owner-only manual walkthroughs** (~16 items): P76-P77 (mobile devices), T96-T101 (real-account journeys with MP sandbox and live email).

## Next steps

- **Steps + acceptance criteria**: expand only the 61 P0 items with concrete steps and pass/fail criteria. The P1 set keeps brief descriptions until a P1 escalation is justified.
- **Test type assignment**: tag each P0 with `owner-manual`, `auto-runnable-CI`, or `agent-runnable` so workstreams can be scheduled.
- **Cross-link to SPEC-092 spec.md**: map P0 items to formal test specs in `apps/e2e` once that package exists.
- **Cross-link to BBT items 8-10**: journeys T96-T97 partially overlap with `BEFORE_BETA_TESTING.md` items 8 (host onboarding smoke test) and 9 (MP staging runbook).

This file is the source of truth for the coverage map. Updates here precede any work in `apps/e2e`.
