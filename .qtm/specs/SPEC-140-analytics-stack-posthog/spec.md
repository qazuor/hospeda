---
spec-id: SPEC-140
title: PostHog Cloud Analytics Stack (web + admin)
type: feat
complexity: medium
status: draft
created: 2026-05-16T05:00:00Z
rewrittenAt: 2026-05-17T23:50:00Z
effort_estimate_hours: 4-6
tags: [analytics, posthog, web, admin, monitoring, privacy]
discovered_during: 2026-05-16 staging console audit (broken CF Web Analytics beacon)
rewrite_reason: Switched from self-hosted Umami to PostHog Cloud free tier after user decision 2026-05-17. Expanded scope to admin app + custom events from day one.
---

# SPEC-140: PostHog Cloud Analytics Stack (web + admin)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Replace the broken Cloudflare Web Analytics auto-inject with **PostHog Cloud (US region, free tier)** as the unified analytics layer for BOTH `apps/web` (public site) and `apps/admin` (internal dashboard), across `staging` and `prod` environments. Four separate PostHog projects (one per app x env combination) under a single PostHog organization. Auto-capture enabled by default plus a small set of explicit business events. Session recordings OFF at launch. Cookies + cookieless fallback gated through the existing `cookie-consent` infrastructure in web, and a new equivalent in admin.

**Why now:** Staging console audit on 2026-05-16 surfaced that Cloudflare's auto-injected `beacon.min.js` was failing in production AND staging with CORS + SRI hash mismatch errors. Independent code audit on 2026-05-17 confirmed that there is currently NO client-side analytics script in `apps/web/src/layouts/BaseLayout.astro` — CF Web Analytics is broken at the CF edge AND the code-side reverse (SPEC-046 T-013) appears to have never landed or was reverted. We have ONLY CF's server-side macro request totals today. We need a privacy-friendly stack that we control, with clear separation between web/admin and staging/prod.

**Why PostHog Cloud over Umami self-hosted (the original SPEC-140 tool choice):**

| Decision criterion | PostHog Cloud | Umami self-hosted |
|---|---|---|
| Cost | $0 (1M events/mo free tier — Hospeda far below) | $0 (server resources only) |
| VPS RAM cost | 0 MB | ~150-300 MB + Postgres |
| Operational burden | None (managed) | Container + DB + cert + backups |
| Custom events | yes built-in | yes built-in |
| Funnels / retention | yes built-in | no (Umami v2 roadmap) |
| Web Vitals | yes native | no (need separate tool) |
| Session recordings | yes (5k/mo free, OFF at launch) | no |
| Public dashboards | yes | yes |
| Multi-site per org | yes unlimited projects | yes |
| Data residency | US (acceptable for Hospeda AR/LATAM) | VPS in Sao Paulo (better) |
| Cookieless fallback | yes configurable | yes default |
| Time-to-first-event | ~30 min (signup + SDK install) | ~3-4 hrs (Coolify deploy + DB + cert) |

User chose PostHog Cloud on 2026-05-17 after evaluating both. Data-residency trade-off (US vs VPS) is acceptable given (a) no PII collected in cookieless mode, (b) PostHog is SOC 2 + GDPR-DPA available, (c) zero ops burden frees time for the actual product.

**Scope:** Five cohesive pieces — (a) PostHog Cloud account + 4 projects setup (manual user action), (b) PostHog SDK integration in `apps/web` Astro/React stack with consent gating, (c) PostHog SDK integration in `apps/admin` TanStack Start stack with NEW consent banner, (d) CSP updates in `apps/web` middleware to allow PostHog domains, (e) ~6-10 explicit business events instrumented as examples (signup, booking initiation, search, newsletter, admin login, admin entity-create) to validate the wiring end-to-end.

### 2. Out of Scope

- Self-hosted PostHog (deliberately chose Cloud).
- Session recordings — OFF at launch (privacy + bandwidth + legal review burden). Can be enabled in PostHog UI later without code changes.
- Feature flags — PostHog supports them but not needed for Hospeda today.
- A/B testing / experiments — same.
- Data export pipelines to a warehouse (BigQuery, Snowflake) — not needed at this scale.
- Custom PostHog dashboards / saved insights — to be created in PostHog UI after data starts flowing (no code).
- Removing Sentry — Sentry stays for error monitoring. PostHog covers product analytics. They coexist; both gated on the same `analytics: true` consent flag.
- Migration of historical analytics — none worth migrating.
- Server-side event tracking from `apps/api` — client-side first. Server-side can be added later in a separate spec if needed.
- Disabling CF Web Analytics in the Cloudflare dashboard — that is a MANUAL user action documented here but not enforced by code (CF dashboard is outside the repo).

### 3. Approach

Phased so that we validate the pipeline end-to-end on staging before prod ships.

**Phase 0 — PostHog Cloud account + projects (manual user action, before any code lands)**

1. Sign up at `https://us.posthog.com` with team email. Region: **US Cloud** (decided 2026-05-17).
2. Create organization `Hospeda`.
3. Create 4 projects with these exact names (matters for CSP + env wiring):
   - `hospeda-web-prod` -> site URL: `https://hospeda.com.ar`
   - `hospeda-web-staging` -> site URL: `https://staging.hospeda.com.ar`
   - `hospeda-admin-prod` -> site URL: `https://admin.hospeda.com.ar`
   - `hospeda-admin-staging` -> site URL: `https://admin-staging.hospeda.com.ar` (or actual staging admin URL — verify)
4. For each project, capture the **Project API Key** (starts with `phc_...`) and the **API Host** (default `https://us.i.posthog.com`).
5. Store all 4 keys in 1Password under "Hospeda / PostHog project keys".
6. In each project Settings -> Autocapture: confirm autocapture is ENABLED by default. Confirm session recordings are OFF.

**Phase 1 — Env var registration in `packages/config` + per-app Zod**

7. Register 2 new env vars per app (web, admin) in `packages/config/src/env-registry.hospeda.ts`:
   - Web client-side (Astro `PUBLIC_*` prefix):
     - `PUBLIC_POSTHOG_KEY` — string, optional, client-exposed, secret in registry (project key is public-by-design but treat as semi-secret for hygiene), `apps: ['web']`
     - `PUBLIC_POSTHOG_HOST` — string, optional, client-exposed, default `https://us.i.posthog.com`, `apps: ['web']`
   - Admin client-side (TanStack Start uses `VITE_*` prefix):
     - `VITE_POSTHOG_KEY` — string, optional, client-exposed, `apps: ['admin']`
     - `VITE_POSTHOG_HOST` — string, optional, client-exposed, default `https://us.i.posthog.com`, `apps: ['admin']`
8. Add Zod validation entries in `apps/web/src/lib/env.ts` and `apps/admin/src/env.ts` (or current admin env loader).
9. Update `apps/web/.env.example` and `apps/admin/.env.example` with safe placeholders + comment block explaining how to obtain values + that per-environment values come from Coolify, not committed.

**Phase 2 — Web SDK integration (`apps/web`)**

10. Install `posthog-js` in `apps/web/package.json` as a runtime dependency. Verify the version supports Astro's bundler.
11. Create `apps/web/src/lib/analytics/posthog-client.ts` — single source of truth for PostHog init:
    - Exports `initPostHog({ consent })` that:
      - Returns early if `PUBLIC_POSTHOG_KEY` is unset (local dev).
      - Returns early if `import.meta.env.MODE === 'development'` (no dev pollution).
      - Initializes `posthog.init()` with: `api_host`, `person_profiles: 'identified_only'`, `capture_pageview: true`, `autocapture: true`, `disable_session_recording: true`, `persistence: consent.analytics ? 'localStorage+cookie' : 'memory'`, `disable_persistence: false`, `respect_dnt: true`.
      - Exposes a `setConsent(newConsent)` re-init helper for when the user updates consent.
    - Exports a thin `trackEvent(name, props?)` wrapper that no-ops if PostHog isn't initialized.
12. Create `apps/web/src/lib/analytics/events.ts` — typed event catalog (avoids typos + makes the event list discoverable):
    ```ts
    export const WebEvents = {
      AccommodationSearched: 'accommodation_searched',      // search bar submit
      AccommodationViewed:   'accommodation_viewed',         // detail page load
      SignupCompleted:       'signup_completed',             // post-better-auth signup
      BookingInitiated:      'booking_initiated',            // contact-host CTA
      NewsletterSubscribed:  'newsletter_subscribed',        // footer newsletter form
    } as const;
    ```
13. Wire `initPostHog` into `apps/web/src/layouts/BaseLayout.astro` (or a parallel `client:idle` React component) so it runs on every page load:
    - Read current consent via `getConsent()` from `src/lib/cookie-consent.ts`.
    - Pass it to `initPostHog`.
    - Subscribe to consent changes so PostHog re-inits when the banner is interacted with.
14. Add explicit `trackEvent(...)` calls at the 5 catalogued event sites (search bar, accommodation detail page, signup success handler, contact-host CTA, newsletter form). All call sites import names from `events.ts`.

**Phase 3 — Admin SDK integration (`apps/admin`) + NEW consent banner**

15. Install `posthog-js` in `apps/admin/package.json`. (PostHog has a `posthog-js/react` import for hooks/provider — use it.)
16. Port the cookie-consent infrastructure from web to admin:
    - Create `apps/admin/src/lib/cookie-consent.ts` mirroring `apps/web/src/lib/cookie-consent.ts` (same `ConsentState` shape, same cookie name `cookie-consent`, same Max-Age). Keep the shape IDENTICAL so a user logged into both web + admin sees a consistent experience.
    - Create `apps/admin/src/components/CookieConsentBanner.tsx` (React, Shadcn-styled to match admin UI). UX is simpler than web: it's an internal tool, staff already have an account, banner can be a one-time dismissible toast on first login.
    - Mount the banner in the root layout (`apps/admin/src/routes/__root.tsx` or current root) so it appears on first navigation if no consent cookie is set.
17. Create `apps/admin/src/lib/analytics/posthog-client.ts` — same pattern as web but using `VITE_*` env vars.
18. Create `apps/admin/src/lib/analytics/events.ts` — admin-specific event catalog:
    ```ts
    export const AdminEvents = {
      AdminLogin:        'admin_login',                // post-Better-Auth admin login
      EntityCreated:     'admin_entity_created',       // any entity create form success (carry entityType prop)
      EntityDeleted:     'admin_entity_deleted',       // any entity delete confirm success
      ReportGenerated:   'admin_report_generated',     // future-proofing; instrument 1 example today
    } as const;
    ```
19. Wire `PostHogProvider` from `posthog-js/react` into `__root.tsx` gated on consent.
20. Add explicit `trackEvent(...)` at 4 sites: login success, ONE entity-create handler (e.g. accommodation create), ONE entity-delete handler, and the metrics page load (as `ReportGenerated`).

**Phase 4 — CSP updates (`apps/web` only — admin has no CSP)**

21. Edit `apps/web/src/lib/middleware-helpers.ts` `buildCspHeader()`:
    - `script-src`: add `https://us.i.posthog.com` and `https://us-assets.i.posthog.com`.
    - `connect-src`: add same two domains (PostHog SDK posts events via XHR/fetch).
    - `img-src`: add `https://us.i.posthog.com` (PostHog ships a 1x1 pixel fallback in some cases).
    - Document each addition with an inline comment naming SPEC-140.
22. Update CSP unit tests in `apps/web/test/lib/middleware-helpers.test.ts` to assert PostHog domains are present in the 3 directives.
23. Manual smoke: load staging in browser with DevTools open, navigate 3-4 pages, verify ZERO CSP violations in the Report-Only console output for PostHog domains.

**Phase 5 — Coolify env vars + redeploy**

24. Set the 4 keys in Coolify via either:
    - **CLI** (preferred): `hops env-set web PUBLIC_POSTHOG_KEY phc_xxx --target=staging` then `--target=prod`; same for `PUBLIC_POSTHOG_HOST`; then admin equivalents with `VITE_POSTHOG_KEY`.
    - **UI**: `https://coolify.hospeda.com.ar` -> each app -> Environment Variables.
25. `hops redeploy web --target=staging`, then `--target=prod`. Same for admin.
26. After redeploy, open browser DevTools -> Network -> filter `posthog` -> verify events POST to `us.i.posthog.com/e/` with 200 responses.
27. In PostHog UI, open each project's "Live events" view -> verify events arrive within 30 seconds of triggering them.

**Phase 6 — Disable CF Web Analytics (manual user action, after PostHog verified)**

28. Once both staging + prod show PostHog events flowing, log into Cloudflare dashboard -> zone `hospeda.com.ar` -> Analytics & Logs -> Web Analytics -> disable "Automatic Setup".
29. Verify a fresh page load on staging no longer attempts `beacon.min.js` (Network tab should show no CF Analytics requests).

**Phase 7 — Documentation + acceptance**

30. Add `apps/web/docs/analytics.md` documenting: PostHog setup, consent flow, event catalog, how to add new events, how to find data in PostHog UI.
31. Add `apps/admin/docs/analytics.md` with the admin equivalent.
32. Update `apps/web/CLAUDE.md` and `apps/admin/CLAUDE.md` to mention PostHog in the "Key Dependencies" / "Architecture" sections.
33. Run acceptance criteria checklist below.

### 4. Reference info

- PostHog docs: `https://posthog.com/docs/getting-started/install` (JS SDK install reference).
- PostHog Astro guide: `https://posthog.com/docs/libraries/astro` (official integration pattern with client:idle island).
- PostHog React SDK: `https://posthog.com/docs/libraries/react` (PostHogProvider + hooks).
- PostHog consent mode: `https://posthog.com/docs/privacy/gdpr-compliance#how-to-implement-consent` (cookieless fallback pattern).
- PostHog free tier limits: `https://posthog.com/pricing` (1M events/mo, 5k recordings/mo — but recordings stay OFF).
- Existing web cookie consent: `apps/web/src/lib/cookie-consent.ts` (`ConsentState.analytics: boolean` is the gate).
- Web CSP source: `apps/web/src/lib/middleware-helpers.ts` (`buildCspHeader()`).
- Web middleware: `apps/web/src/middleware.ts` (currently emits `Content-Security-Policy-Report-Only`).
- Existing Sentry integration (parallel pattern): `PUBLIC_SENTRY_DSN` env var — wired similarly, gated on the same `analytics` consent flag.
- Operational CLI on VPS: `hops env-set <kind> KEY VALUE --target=<staging|prod>`. See `scripts/server-tools/`.

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-140-01 | Sign up PostHog Cloud US, create org `Hospeda`, create 4 projects (web-prod, web-staging, admin-prod, admin-staging), capture all 4 API keys to 1Password | 0 | pending |
| T-140-02 | Verify autocapture ON + session recordings OFF in all 4 PostHog projects | 0 | pending |
| T-140-03 | Register `PUBLIC_POSTHOG_KEY` + `PUBLIC_POSTHOG_HOST` in `packages/config/src/env-registry.hospeda.ts` with `apps: ['web']` | 1 | pending |
| T-140-04 | Register `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` in same registry with `apps: ['admin']` | 1 | pending |
| T-140-05 | Add Zod validation for both web vars in `apps/web/src/lib/env.ts`; update `apps/web/.env.example` | 1 | pending |
| T-140-06 | Add Zod validation for both admin vars in `apps/admin/src/env.ts`; update `apps/admin/.env.example` | 1 | pending |
| T-140-07 | Install `posthog-js` in `apps/web/package.json` | 2 | pending |
| T-140-08 | Create `apps/web/src/lib/analytics/posthog-client.ts` with `initPostHog`, `setConsent`, `trackEvent` (consent-gated, cookieless fallback, dev-mode guard) | 2 | pending |
| T-140-09 | Create `apps/web/src/lib/analytics/events.ts` typed event catalog (5 events) | 2 | pending |
| T-140-10 | Wire `initPostHog` into `BaseLayout.astro` (or `client:idle` island) reading consent from `cookie-consent.ts`; subscribe to consent changes | 2 | pending |
| T-140-11 | Instrument 5 `trackEvent(...)` call sites in `apps/web` (search submit, accommodation detail load, signup success, contact-host CTA, newsletter subscribe) | 2 | pending |
| T-140-12 | Add unit tests for `posthog-client.ts` (init early-returns, consent gating, cookieless fallback) | 2 | pending |
| T-140-13 | Install `posthog-js` in `apps/admin/package.json` | 3 | pending |
| T-140-14 | Create `apps/admin/src/lib/cookie-consent.ts` mirroring web shape (same cookie name, same `ConsentState`) | 3 | pending |
| T-140-15 | Create `apps/admin/src/components/CookieConsentBanner.tsx` (Shadcn-styled, one-time on first login) | 3 | pending |
| T-140-16 | Mount banner in `apps/admin/src/routes/__root.tsx`; verify it appears only when consent cookie absent | 3 | pending |
| T-140-17 | Create `apps/admin/src/lib/analytics/posthog-client.ts` with same pattern as web (using `VITE_*` env vars) | 3 | pending |
| T-140-18 | Create `apps/admin/src/lib/analytics/events.ts` typed event catalog (4 events) | 3 | pending |
| T-140-19 | Wire `PostHogProvider` from `posthog-js/react` into `__root.tsx` gated on consent | 3 | pending |
| T-140-20 | Instrument 4 `trackEvent(...)` call sites in admin (login success, accommodation create, accommodation delete, metrics page load) | 3 | pending |
| T-140-21 | Add unit tests for admin `posthog-client.ts` + `cookie-consent.ts` parity with web | 3 | pending |
| T-140-22 | Edit `apps/web/src/lib/middleware-helpers.ts` `buildCspHeader()`: add `us.i.posthog.com` + `us-assets.i.posthog.com` to `script-src`, `connect-src`, `img-src` with SPEC-140 inline comment | 4 | pending |
| T-140-23 | Update CSP tests in `apps/web/test/lib/middleware-helpers.test.ts` to assert PostHog domains present in all 3 directives | 4 | pending |
| T-140-24 | Set 4 Coolify env vars across staging + prod for web and admin via `hops env-set` or UI; verify no var left registered-but-unset | 5 | pending |
| T-140-25 | `hops redeploy web --target=staging` then verify in browser DevTools that PostHog events POST to `us.i.posthog.com/e/` with HTTP 200 | 5 | pending |
| T-140-26 | Verify staging events arrive in PostHog UI "Live events" view within 30s for both web-staging + admin-staging projects | 5 | pending |
| T-140-27 | `hops redeploy web --target=prod` + admin equivalents; repeat verification on prod | 5 | pending |
| T-140-28 | Manual: log into Cloudflare dashboard, disable Web Analytics Automatic Setup for zone `hospeda.com.ar` | 6 | pending |
| T-140-29 | Verify fresh staging page load no longer fetches `beacon.min.js` (Network tab clean) | 6 | pending |
| T-140-30 | Write `apps/web/docs/analytics.md` (setup, consent flow, event catalog, add-new-event guide, where to find data in PostHog UI) | 7 | pending |
| T-140-31 | Write `apps/admin/docs/analytics.md` (admin equivalent) | 7 | pending |
| T-140-32 | Update `apps/web/CLAUDE.md` + `apps/admin/CLAUDE.md` mentioning PostHog in Key Dependencies | 7 | pending |
| T-140-33 | Final acceptance run: verify all checkbox items in Section 6 pass; create dashboard templates in PostHog UI for each project (manual, not code) | 7 | pending |

### 6. Acceptance Criteria

- [ ] 4 PostHog projects exist under org `Hospeda` (web-prod, web-staging, admin-prod, admin-staging) with autocapture ON, recordings OFF.
- [ ] All 4 project API keys stored in 1Password under "Hospeda / PostHog project keys".
- [ ] `PUBLIC_POSTHOG_KEY` + `PUBLIC_POSTHOG_HOST` registered in env registry with `apps: ['web']`; `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` with `apps: ['admin']`.
- [ ] `apps/web/.env.example` + `apps/admin/.env.example` document the new vars with safe placeholders.
- [ ] `apps/web/src/lib/analytics/posthog-client.ts` exists and gates init on (a) env var present, (b) NOT in dev mode, (c) consent state read from `cookie-consent.ts`.
- [ ] `apps/admin/src/lib/cookie-consent.ts` exists with identical `ConsentState` shape and cookie name as web.
- [ ] `apps/admin/src/components/CookieConsentBanner.tsx` appears on first admin navigation when no consent cookie is set; does NOT appear after consent is recorded.
- [ ] Web event catalog (5 events) and admin event catalog (4 events) exist as `as const` objects in `lib/analytics/events.ts`.
- [ ] At least 5 explicit `trackEvent(...)` call sites instrumented in web; at least 4 in admin.
- [ ] CSP `Content-Security-Policy-Report-Only` header on web HTML responses includes `us.i.posthog.com` and `us-assets.i.posthog.com` in `script-src`, `connect-src`, and `img-src`.
- [ ] CSP unit tests pass and explicitly assert the PostHog domains are present.
- [ ] No new console errors in browser DevTools on staging or prod after rollout.
- [ ] Navigating to any page on `staging.hospeda.com.ar` produces a pageview event visible in PostHog `hospeda-web-staging` Live events within 30 seconds.
- [ ] Same verification on `hospeda.com.ar` after prod rollout.
- [ ] Admin navigation on staging + prod surfaces pageviews in the corresponding admin PostHog projects.
- [ ] Each of the 9 explicit events fires correctly when triggered (manual smoke).
- [ ] Cloudflare Web Analytics Auto-Setup disabled for zone `hospeda.com.ar`; `beacon.min.js` no longer fetched.
- [ ] `apps/web/docs/analytics.md` + `apps/admin/docs/analytics.md` written and linked from respective CLAUDE.md files.
- [ ] No env var left registered-but-unset in Coolify for web-staging, web-prod, admin-staging, admin-prod.
- [ ] Cookieless fallback works: with `analytics: false` consent, PostHog still receives a pageview but uses in-memory persistence (no `ph_*` cookies set in browser).

### 7. Risks

| Risk | Mitigation |
|---|---|
| PostHog SDK blocked by ad blockers (uBlock, Brave Shields) | Expected and acceptable. CF zone-level server metrics backstop the gross-traffic view. Document this in `analytics.md` so stakeholders set realistic expectations. |
| Adding PostHog regresses LCP / FCP on web | `posthog-js` is ~25KB gzipped, loaded via `client:idle` so it doesn't compete with above-the-fold render. Run Lighthouse on staging pre/post-rollout as sanity. |
| CSP violations break PostHog after switch from Report-Only to Enforcement (future change) | CSP is currently Report-Only — PostHog will keep working even if directives are wrong. T-140-22 + T-140-23 lock in the directives now so Phase 2 CSP enforcement (separate spec) inherits a known-good config. |
| Consent banner regression — users see banner every page after consent | T-140-21 includes parity tests with web's already-working consent. Cookie name + Max-Age must match (`cookie-consent`, 1 year). |
| PostHog free tier exceeded (1M events/mo) | Hospeda traffic is in the low thousands of pageviews/day. With autocapture ON, each pageview generates ~3-5 events (pageview + 1-2 clicks + occasional form interaction). Estimated 100-200k events/mo. Far below the 1M threshold. Set up PostHog billing alert at 80% usage as a tripwire. |
| 4 separate API keys leaked via committed `.env` | `.env.local` is gitignored. `.env.example` only has placeholders. Coolify holds real values. Standard pattern. |
| Cookieless fallback collects pseudo-PII via fingerprinting (legal exposure) | PostHog in `person_profiles: 'identified_only'` + `persistence: 'memory'` mode does NOT fingerprint — it just doesn't persist any identifier between sessions. Document this explicitly in `analytics.md`. |
| Admin staff confused by sudden cookie banner | T-140-15 banner copy must explain: "Admin uses internal analytics. By accepting you help us improve the admin tool. You can opt out and analytics will run anonymously." Coordinate copy with the team in PR review. |
| Disabling CF Web Analytics breaks an internal dashboard someone uses | Cross-check before T-140-28 — ask team channel "anyone using the CF Web Analytics dashboard for hospeda.com.ar?". Zone-level analytics (request counts, bandwidth) survive — only the beacon-based dashboard goes away. |
| PostHog Cloud goes down or has an outage during deploy | Init is `try`-safe — failure to reach PostHog must NOT block page render. The SDK handles this by default (events queue locally + retry), but T-140-08 tests must assert that the init returns without throwing when `api_host` is unreachable. |

---

## Part 2 — Implementation Notes

### Source

This spec was originally drafted on 2026-05-16 as `SPEC-140 Self-hosted Analytics Stack (Umami)` after a staging console audit surfaced that CF Web Analytics' `beacon.min.js` was failing in production AND staging with CORS + SRI hash mismatch errors. The original spec proposed deploying Umami in Coolify against a dedicated Postgres container.

On 2026-05-17, during a re-evaluation conversation, the user decided to switch the tool choice to PostHog Cloud (US free tier) for these reasons:

1. **Operational simplicity** — zero VPS resources, zero container, zero DB to back up.
2. **Feature breadth** — funnels, retention, Web Vitals, and session recordings (off but available) come bundled.
3. **Coverage of admin** — original Umami scope explicitly excluded admin; PostHog covers both web and admin under the same org with separate projects.
4. **Custom events from day one** — original Umami scope deferred events to a "Phase 2" follow-up spec; user wanted explicit business events instrumented as part of the initial rollout.

The Umami draft is preserved in git history (`git log --diff-filter=R --follow .qtm/specs/SPEC-140-*`). Same SPEC number is retained; the slug was renamed from `analytics-stack-umami` to `analytics-stack-posthog` in this revision.

### Why this is one spec, not several

Splitting "infra" / "web wiring" / "admin wiring" / "CSP" / "remove CF" would create 5 specs with tight coupling — each one needs the previous one's output to verify. Bundling them lets us deploy a single PR per environment (staging then prod) and verify end-to-end without intermediate broken states.

The one exception: **Phase 0 (PostHog account setup) is manual user action** and cannot live in a PR. It's listed here for completeness and to enforce that it happens BEFORE any code lands (Tasks T-140-01 + T-140-02 must be done before T-140-03 starts).

### Why PostHog Cloud and not self-hosted PostHog

The user briefly considered self-hosted PostHog. Rejected because PostHog self-hosted requires Postgres + ClickHouse + Redis + Kafka — a stack roughly 10x heavier than Umami. The whole point of switching from Umami -> PostHog was to avoid VPS infra; self-hosted PostHog defeats that. PostHog Cloud free tier is generous enough (1M events/mo) that we won't approach it for years.

### Env var naming decision

Web uses `PUBLIC_POSTHOG_*` (Astro convention) and admin uses `VITE_POSTHOG_*` (Vite/TanStack Start convention). Both reference the same Hospeda PostHog org but distinct project keys. Per-environment values (staging vs prod) come from Coolify, not from var name — same pattern as existing `PUBLIC_API_URL`, `PUBLIC_SENTRY_DSN`, etc.

The PostHog project key (`phc_...`) is technically a client-exposed value (it's literally in the browser bundle for every visitor). PostHog treats it as a "public key". We still mark `secret: true` in the registry to keep it out of accidental logs / docs, but understand it's not a true secret.

### Consent integration decision

Web already has `cookie-consent.ts` with an `analytics: boolean` flag. PostHog gating reuses that flag exactly — same UI banner, same persistence (`cookie-consent` cookie), same Max-Age (1 year). Sentry already uses the same flag; PostHog joins it. Consent semantics:

| User choice | Sentry | PostHog | Notes |
|---|---|---|---|
| Accept analytics | ON, full | ON, full (cookies + cross-session) | Default opt-in user |
| Decline analytics | OFF | ON, cookieless (memory-only) | Cookieless fallback — single-session pageview tracking, no PII |
| No decision yet (cookie absent) | OFF | ON, cookieless | Treat as decline until they choose |
| Re-open banner + change choice | Re-init | Re-init | Both SDKs subscribe to consent-change events |

Admin gets a NEW consent banner (T-140-14 to T-140-16) because it doesn't have one today. The banner UI is simpler than web (one-time toast on first login) because the audience is internal staff and the legal exposure is lower (employment relationship implies broader consent, but we still respect the choice).

### What `apps/api` gets

Nothing client-side. Server-side event tracking from the API is a separate spec if needed later. The justification: most useful analytics for Hospeda happen at the user-interaction layer (clicks, form submits, page views), not in the API. Server-side is more relevant for measuring conversion rates after-the-fact (e.g., "X% of bookings completed end-to-end") — that's a separate analytical need.

### Cross-spec dependencies

- **SPEC-046** (CSP) — this spec extends `buildCspHeader()` with PostHog domains. The CSP is in Report-Only mode today; SPEC-046 Phase 2 (enforcement, future) will inherit the PostHog-aware directives.
- **SPEC-111** (closed) — established Sentry observability for `apps/web`. PostHog is the product-analytics counterpart; both gated on the same consent flag.
- **Future spec (not yet drafted)** — PostHog dashboards as code (export PostHog dashboard JSON, commit it). Today dashboards live in PostHog UI only.
- **Future spec (not yet drafted)** — Server-side event tracking from `apps/api` via PostHog Node SDK for funnel completion tracking. Defer until we feel the gap.

### Decision log

- **2026-05-16** — Original SPEC-140 drafted with Umami self-hosted.
- **2026-05-17** — User re-evaluated, chose PostHog Cloud US free tier. Confirmed cookies + cookieless fallback, autocapture ON, recordings OFF, web + admin both in scope, 4 separate projects under one org.
- **2026-05-17** — Confirmed CF Web Analytics is not currently in `apps/web/src` code (it was either reverted or never landed from SPEC-046 T-013). Phase 6 (disable in CF dashboard) remains as a manual action but no code rollback is required.
