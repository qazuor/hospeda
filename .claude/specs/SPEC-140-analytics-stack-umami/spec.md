---
spec-id: SPEC-140
title: Self-hosted Analytics Stack (Umami)
type: feat
complexity: medium
status: draft
created: 2026-05-16T05:00:00Z
effort_estimate_hours: 3-5
tags: [analytics, infra, coolify, web, monitoring]
extracted_from: 2026-05-16 staging console audit (broken CF Web Analytics beacon)
---

# SPEC-140: Self-hosted Analytics Stack (Umami)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Replace the broken Cloudflare Web Analytics auto-inject with a self-hosted Umami instance at `analytics.hospeda.com.ar`, and wire `apps/web` to send pageview events to it. Keep Cloudflare server-side macro analytics (free, available in CF dashboard, no script needed). Sentry continues to own error monitoring.

**Why now:** Staging console audit on 2026-05-16 surfaced that Cloudflare's auto-injected `beacon.min.js` is failing in production AND staging with CORS + SRI hash mismatch errors. CF is serving an empty/broken bundle while the HTML carries the hash of a different file — the script is unusable as-is. We currently have NO working client-side analytics (no pageview counts, no referrers, no device breakdowns), only CF's server-side request totals. We need a privacy-friendly, no-cookie-banner stack we control end-to-end.

**Why Umami:**
- Cloudflare Web Analytics (dashboard-only, post-disable): too limited — no funnels, no custom events, no per-page breakdowns beyond top N.
- GA4: requires GDPR/cookie banner, sends user data to Google, fingerprinting concerns.
- Plausible Cloud: paid (~$9/mo entry tier), otherwise an excellent fit.
- PostHog: overkill at this stage (product analytics, session replay, feature flags) — adds operational and storage burden we don't need yet.
- Umami: free, open source, privacy-first (no cookies, no fingerprinting, no PII, no GDPR banner needed), trivial to self-host, fits our existing Coolify + VPS stack, and the team already operates Coolify-hosted services.

**Scope:** Three cohesive pieces — (a) disable broken CF auto-inject, (b) deploy Umami in Coolify under `analytics.hospeda.com.ar`, (c) integrate the tracking script in `apps/web` only, gated behind env vars and environment.

### 2. Out of Scope

- Custom event tracking (signup completion, listing views, contact form submits, newsletter submits) — defer to a Phase 2 follow-up spec AFTER baseline pageview tracking is verified working.
- PostHog or any product-analytics layer.
- Analytics on `apps/admin` (internal tool — no need).
- Migration of historical analytics data (we have none worth migrating).
- Custom dashboards / scheduled reports — use Umami's built-in dashboard.
- Funnel definitions — covered by future Phase 2 once events exist.

### 3. Approach

Phased so the analytics pipeline is end-to-end working before tracking code is shipped.

**Phase 0 — Disable Cloudflare Web Analytics auto-inject**

1. Log into Cloudflare dashboard (`dash.cloudflare.com`) → zone `hospeda.com.ar` → Analytics & Logs → Web Analytics.
2. Disable "Automatic Setup" for `hospeda.com.ar` (and `staging.*` if listed). This stops CF from injecting the broken `beacon.min.js` script tag into every HTML response at the edge.
3. Keep the zone-level analytics (traffic, requests, bandwidth) — those are server-side and have nothing to do with the beacon.
4. Verify in staging that the `<script>` tag pointing to `static.cloudflareinsights.com/beacon.min.js` no longer appears in the rendered HTML and that the console error is gone.

**Phase 1 — DNS for analytics subdomain**

5. Add an `A` record in Cloudflare DNS: `analytics.hospeda.com.ar` → `216.238.103.219` (VPS IP). Proxied: ON (orange cloud) so Cloudflare fronts the cert handshake, OR OFF (gray cloud) if Coolify is managing the Let's Encrypt cert directly — pick gray cloud for simplicity, matches how other Coolify-fronted subdomains (`coolify.hospeda.com.ar`, `staging.hospeda.com.ar`) are set up today.

**Phase 2 — Decide DB strategy (4a vs 4b)**

- **Option 4a — Dedicated Postgres container** `hospeda-umami-db` in the same Coolify project, deployed alongside the Umami app. Pros: full isolation from app-prod data, can be backed up / restored independently, no risk of Umami load impacting app DB. Cons: one more container to manage + back up. **Recommended.**
- **Option 4b — Coolify managed Postgres service** (Coolify > Resources > Add new > Database > PostgreSQL). Pros: Coolify manages backups + connection string + version updates for you. Cons: still a separate DB instance, slightly more opinionated about how it's wired in.
- **NOT recommended:** sharing the existing `hospeda-postgres-prod` DB via a schema. Analytics writes are high-volume (one row per pageview), and any Umami migration or version bump would touch shared infra. Keep them separate.

Pick 4a for first deploy. Migration to 4b later (or vice versa) is a dump-and-restore — non-blocking.

**Phase 3 — Deploy Umami in Coolify**

6. In Coolify → project containing the rest of Hospeda → Add new resource → Application → Docker image.
7. Image: `ghcr.io/umami-software/umami:postgresql-latest`.
8. Domain: `analytics.hospeda.com.ar` (Coolify auto-provisions Let's Encrypt cert via Traefik labels once DNS resolves).
9. Required env vars on the Umami container:
   - `DATABASE_URL=postgresql://umami:<password>@hospeda-umami-db:5432/umami` (Coolify resolves the container hostname internally).
   - `DATABASE_TYPE=postgresql`
   - `APP_SECRET=<32-byte random string>` (used to sign Umami session tokens — generate via `openssl rand -hex 32` and store in 1Password).
   - `DISABLE_TELEMETRY=1` (don't phone home).
10. Health check: Coolify default HTTP check against `/` (Umami responds 200 on the login page even without auth).
11. On first start, Umami auto-creates the `umami` user with default credentials `admin / umami`. **Immediately log in and rotate the password** — store the new password in 1Password under "Hospeda / Umami admin".

**Phase 4 — Create site entries in Umami**

12. Log into `https://analytics.hospeda.com.ar` with the rotated credentials.
13. Add Website → name `hospeda-web-prod`, domain `hospeda.com.ar`. Note the generated Website ID (UUID).
14. Add Website → name `hospeda-web-staging`, domain `staging.hospeda.com.ar`. Note the generated Website ID.
15. Store both IDs in 1Password under "Hospeda / Umami site IDs".

**Phase 5 — Integrate tracking in apps/web**

16. Register two new env vars in `packages/config/src/env-registry.hospeda.ts`:
    - `PUBLIC_UMAMI_WEBSITE_ID` (client-exposed, type `string`, optional). Per-environment value (staging ID for staging, prod ID for prod, unset locally).
    - `PUBLIC_UMAMI_SCRIPT_URL` (client-exposed, type `string`, optional, default `https://analytics.hospeda.com.ar/script.js`). Allows pointing tracking at a different Umami instance for QA without code changes.
17. Add Zod entries in `apps/web/src/lib/env.ts` (or equivalent web env loader) for both vars.
18. Update `apps/web/.env.example` with safe placeholders + comments explaining when to fill them in.
19. In the base Astro layout (e.g. `apps/web/src/layouts/BaseLayout.astro`), conditionally render the tracking script only when `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID` is set AND `import.meta.env.MODE !== 'development'`:
    ```astro
    {import.meta.env.PUBLIC_UMAMI_WEBSITE_ID && import.meta.env.MODE !== 'development' && (
      <script
        defer
        src={import.meta.env.PUBLIC_UMAMI_SCRIPT_URL ?? 'https://analytics.hospeda.com.ar/script.js'}
        data-website-id={import.meta.env.PUBLIC_UMAMI_WEBSITE_ID}
      />
    )}
    ```
20. Skip `apps/admin` entirely — no tracking script, no env vars wired there.

**Phase 6 — Set Coolify env vars + redeploy web**

21. Set `PUBLIC_UMAMI_WEBSITE_ID` in `hospeda-web-staging` (staging Website ID) and `hospeda-web-prod` (prod Website ID) via either the Coolify UI or `hops env-set web PUBLIC_UMAMI_WEBSITE_ID <id>`.
22. `hops redeploy web` for both environments (or use the Coolify UI redeploy button).
23. Verify in browser DevTools → Network that `script.js` loads from `analytics.hospeda.com.ar` with HTTP 200 on staging.
24. Verify in Umami dashboard that pageviews start arriving for `hospeda-web-staging` after a few navigations.
25. Repeat verification on prod once staging is green.

### 4. Reference info

- Umami docs: `https://umami.is/docs/install` (Docker install + env var reference). No need to fetch — Coolify abstracts most of the orchestration. The doc is the source of truth for env var names.
- Umami GitHub: `https://github.com/umami-software/umami` (latest releases, `postgresql-latest` is the tracked tag).
- Coolify deploy pattern: same as existing `hospeda-api-prod`, `hospeda-web-prod`, `hospeda-admin-prod` apps — image + domain + env vars + auto-provisioned Traefik route + Let's Encrypt cert.
- Existing Coolify host: `https://coolify.hospeda.com.ar`.
- VPS IP: `216.238.103.219` (São Paulo, Vultr).
- Operational CLI on VPS: `hops` (for env management + redeploys + log tailing). See `scripts/server-tools/` in repo.
- Privacy posture: Umami does NOT set cookies, does NOT fingerprint visitors, does NOT collect IPs in identifiable form (hashed daily salt). No GDPR / LGPD consent banner required. Document this in `apps/web/docs/` when shipping (out of scope here, follow-up doc task).

### 5. Tasks

| Task | Title | Status |
|---|---|---|
| T-140-01 | Disable Cloudflare Web Analytics auto-inject for `hospeda.com.ar` zone via CF dashboard | pending |
| T-140-02 | Verify in staging + prod that the broken `beacon.min.js` script no longer appears in rendered HTML and the console CORS/SRI error is gone | pending |
| T-140-03 | Add `A` record `analytics.hospeda.com.ar` → `216.238.103.219` in Cloudflare DNS (gray cloud / un-proxied) | pending |
| T-140-04 | Deploy dedicated Postgres container `hospeda-umami-db` in Coolify (Option 4a) | pending |
| T-140-05 | Deploy Umami app in Coolify from `ghcr.io/umami-software/umami:postgresql-latest` with domain `analytics.hospeda.com.ar` and required env vars (`DATABASE_URL`, `DATABASE_TYPE`, `APP_SECRET`, `DISABLE_TELEMETRY`) | pending |
| T-140-06 | Verify Coolify auto-provisions Let's Encrypt cert and `https://analytics.hospeda.com.ar` resolves to the Umami login page | pending |
| T-140-07 | Log into Umami, rotate default admin password, store in 1Password under "Hospeda / Umami admin" | pending |
| T-140-08 | Create two Umami websites: `hospeda-web-prod` (`hospeda.com.ar`) and `hospeda-web-staging` (`staging.hospeda.com.ar`); store Website IDs in 1Password | pending |
| T-140-09 | Register `PUBLIC_UMAMI_WEBSITE_ID` and `PUBLIC_UMAMI_SCRIPT_URL` in `packages/config/src/env-registry.hospeda.ts` with `apps: ['web']` | pending |
| T-140-10 | Add Zod validation for both vars in `apps/web/src/lib/env.ts` (or current env loader) and update `apps/web/.env.example` | pending |
| T-140-11 | Inject Umami script tag conditionally in `apps/web/src/layouts/BaseLayout.astro` (gated on `PUBLIC_UMAMI_WEBSITE_ID` + non-development mode) | pending |
| T-140-12 | Set `PUBLIC_UMAMI_WEBSITE_ID` in Coolify for `hospeda-web-staging` and `hospeda-web-prod` via `hops env-set` or UI | pending |
| T-140-13 | Redeploy web staging; verify `script.js` loads from `analytics.hospeda.com.ar` and pageviews arrive in Umami dashboard | pending |
| T-140-14 | Promote to web prod; verify pageviews arrive in the prod Umami site | pending |

### 6. Acceptance Criteria

- [ ] Cloudflare Web Analytics auto-inject is disabled for `hospeda.com.ar`; `beacon.min.js` no longer appears in HTML responses.
- [ ] `analytics.hospeda.com.ar` resolves over HTTPS with a valid Let's Encrypt cert and shows the Umami login page.
- [ ] Default Umami admin password has been rotated and the new password stored in 1Password.
- [ ] Two Umami websites exist (`hospeda-web-prod`, `hospeda-web-staging`) with Website IDs recorded in 1Password.
- [ ] `PUBLIC_UMAMI_WEBSITE_ID` and `PUBLIC_UMAMI_SCRIPT_URL` are registered in the env registry with `apps: ['web']`.
- [ ] `apps/web/.env.example` documents both new env vars.
- [ ] Production web build only injects the Umami `<script>` tag when `PUBLIC_UMAMI_WEBSITE_ID` is set; local `pnpm dev` does NOT inject it.
- [ ] Navigating to any page on staging produces a pageview event visible in the Umami staging dashboard within 60 seconds.
- [ ] Same verification holds for prod after promotion.
- [ ] No new console errors introduced by the Umami script in browser DevTools on staging + prod.
- [ ] No new env vars left "registered but unset" on Coolify for `hospeda-web-staging` or `hospeda-web-prod`.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Coolify cert provisioning fails for `analytics.hospeda.com.ar` because DNS hasn't propagated when the app is first deployed | Wait for `dig analytics.hospeda.com.ar` to return the VPS IP from a third-party resolver (e.g. `1.1.1.1`) BEFORE creating the Coolify app. Coolify retries Let's Encrypt automatically, but the first failure can take 5-10 min to retry. |
| Umami default `admin / umami` credentials left in place after deploy | T-140-07 is mandatory and gated behind acceptance criteria — verify with a "wrong password" attempt against the default creds at the end of the phase. |
| `hospeda-umami-db` shares the VPS Postgres process count and could collide with `hospeda-postgres-prod` connection pool | Both run in separate containers — separate connection pools. Monitor `pg_stat_activity` on the host after first week of traffic; if memory pressure shows up, lower Umami's `max_connections` (default 100 is too high for analytics workload — 20 is plenty). |
| Tracking script blocked by ad blockers / privacy extensions | Expected and acceptable. Umami's appeal is privacy-first; users who block trackers as a class will block this too. CF macro analytics (request counts) backstops the total-traffic view regardless. |
| Adding the tracking script regresses LCP / FCP on web | Script is `defer`-loaded, ~2 KB gzipped, fired after parse. Should be invisible to Core Web Vitals. Run Lighthouse on staging post-deploy as a sanity check. |
| Umami DB grows unbounded over time | Umami stores raw pageviews. At Hospeda's traffic scale (low-thousands/day) this is negligible for years. Revisit in a year if DB > 5 GB. |
| Backup of `hospeda-umami-db` not configured day one | Acceptable — analytics history is recoverable (it's pageviews, not money). Add to Phase 17.x backup followups (R2 + GPG) post-launch. |
| Env var `PUBLIC_UMAMI_WEBSITE_ID` left unset in Coolify after registry change | Project rule: registry entry + Coolify value must land in the same change. T-140-12 enforces this; the orchestrator must STOP after registry edit and confirm Coolify value is set before merging. |

---

## Part 2 — Implementation Notes

### Source

Discovered during 2026-05-16 staging console audit. The CF Web Analytics auto-inject has been broken for at least several deploys — the `beacon.min.js` URL returns a payload whose SRI hash does not match the integrity attribute injected into the HTML, AND the CORS headers Cloudflare adds to the beacon response don't match what's expected for cross-origin script loads. Net result: every page load on every Hospeda environment under `hospeda.com.ar` has a red console error and zero analytics events make it back to CF. The fix at CF-side is to stop injecting it; the replacement is Umami.

### Why this is one spec, not three

The three pieces of work (disable CF, deploy Umami, wire `apps/web`) are coupled. Disabling CF without Umami in place means we have zero analytics for the gap; deploying Umami without wiring web means the infra runs idle; wiring web without Umami means the script tag 404s. All three land in the same change window or none of them do.

### DB strategy decision (unilateral recommendation)

Recommended **Option 4a (dedicated `hospeda-umami-db` container)** over Option 4b (Coolify managed Postgres service). Rationale:

- 4a is symmetric with how the existing `hospeda-postgres-prod` is deployed (raw container in Coolify), so the team's mental model is consistent.
- 4b adds a Coolify abstraction layer that the team hasn't used yet for other DBs — first usage shouldn't be on a new-stack deploy.
- 4a's backup workflow can later be added to the existing `hops db-backup-now` tooling with a flag like `--target=umami`.
- Migration 4a → 4b later is a single `pg_dump` + restore — cheap.

**Flag for user review:** If the team prefers to invest in 4b as a path toward Coolify-managed DBs across the stack, swap Option 4a for 4b in Phase 2. No other tasks change.

### Env var naming decision (unilateral)

Chose `PUBLIC_UMAMI_WEBSITE_ID` (single ID per environment) rather than `PUBLIC_UMAMI_WEBSITE_ID_STAGING` + `PUBLIC_UMAMI_WEBSITE_ID_PROD` because Coolify already gives us per-environment env vars natively — duplicating the environment into the var name fights the platform. Same reasoning for `PUBLIC_UMAMI_SCRIPT_URL` (could differ per environment if we ever run a QA Umami instance).

### What apps/admin gets

Nothing. Admin is an internal tool used only by staff, analytics there would be noise. If we later want admin-side observability for staff workflows, that's a different need (probably PostHog session replay or similar) and belongs in a different spec.

### Cross-spec dependencies

- **SPEC-111** (closed) — established Sentry observability for `apps/web`. Umami is the analytics counterpart; both run side-by-side without overlap.
- **Phase 2 follow-up (not yet a spec)** — custom event tracking: signup completion, listing views, contact form, newsletter submits. Once baseline pageview tracking from this spec is verified working, open a new spec to wire `umami.track('event-name', { props })` calls at the relevant points in `apps/web`. Estimated 2-3 hours.
- **Future doc task (not yet a spec)** — privacy policy / data-collection page update once Umami is live, documenting that we use no-cookie analytics. Should land before any marketing push.
