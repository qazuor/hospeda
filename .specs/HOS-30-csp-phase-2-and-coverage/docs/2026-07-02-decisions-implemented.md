# HOS-30 — 2026-07-02 (continued): decisions made and implemented

Follow-up to `2026-07-02-premise-corrections.md`, same day. That session
surfaced two decisions needing user sign-off before continuing. Both were
made and implemented in this continuation.

## Decision 1 (item 1 — home CSP header): option B, adopt SSR+Cloudflare-cache

Chosen over option A (migrate to Astro native `security.csp`) and option C
(proxy-layer fix). Rationale discussed with the user: home already does two
lightweight, cacheable API calls at render time (`destinationsApi.list`,
`statsApi.getPlatformStats`), and the app already has a proven pattern for
exactly this shape of route — `/es/alojamientos/`, `/es/destinos/`,
`/es/eventos/`, `/es/publicaciones/` are all SSR with Cloudflare edge
caching (confirmed `/es/alojamientos/index.astro` is annotated
`@rendering SSR + ISR 24h`), purged via `/api/revalidate` when data changes.
Adopting the same pattern for home means most requests still hit the
Cloudflare edge cache — perceived latency close to today's static file —
and only the occasional cache-miss (post-deploy, post-purge) pays the real
cost of one SSR render + two API calls.

**Caveat flagged to the user and still open**: this repo has no visibility
into the exact Cloudflare cache-rule configuration (TTL, whether it matches
home automatically by path pattern or needs an explicit rule added in the
Cloudflare dashboard) — that lives in infra, not in code. Worth confirming
after this deploys to staging.

**Implementation**:

- Removed `export const prerender = true` and the now-unused
  `getStaticPaths` export from `apps/web/src/pages/[lang]/index.astro`.
  Home now goes through the exact same SSR code path as every other
  non-prerendered route — no middleware or CSP-builder changes needed.
- Updated the file's header doc comment to reflect SSR + Cloudflare cache
  rendering and note why (HOS-30 2.C).
- Verified locally: production build (`pnpm build`) + standalone Node
  server (`node dist/server/entry.mjs`) with placeholder env vars for the
  production-only-required fields (`PUBLIC_SENTRY_DSN`, `PUBLIC_POSTHOG_KEY`,
  `HOSPEDA_REVALIDATION_SECRET`). `curl -I http://localhost:4399/es/` now
  returns `content-security-policy-report-only` with the full directive set,
  and critically **no** `Last-Modified`/`ETag` headers (the static-file
  fingerprints that previously proved the bug). Confirmed the response body
  carries a stamped `nonce="..."` on inline tags — the nonce-injection
  branch now runs for home too (it used to be skipped for prerendered
  pages). Sanity-checked `/es/alojamientos/` (still correct) and
  `/es/nosotros/` (still prerendered, still no header — out of scope,
  unaffected by this change, matches expectation).
- Added a regression guard to `csp-middleware.test.ts` (new describe block
  `pages/[lang]/index.astro (home) — stays off the prerendered path`)
  asserting the home page source never re-declares `prerender = true` or
  `getStaticPaths`. Updated the file's top docstring and the stale
  `frame-src` test comment (previously referenced the now-cancelled T-012).
  13/13 tests pass. `astro check --minimumSeverity error`: 0 errors.
- T-005 (verify on staging) intentionally left `in_progress`, not
  `completed` — the actual acceptance criterion is a **staging** curl, and
  this branch has not been deployed yet. Re-run
  `curl -I https://staging.hospeda.com.ar/es/` once this PR is on staging.
- **Not done**: other prerendered routes (`nosotros`, `legal/*`,
  `preguntas-frecuentes`, `contacto`, `colaborar/*`, `suscriptores/propietarios`,
  `beneficios`, `guest/messages/verify-expired`) have the exact same
  underlying bug (never emit the CSP header) — they were out of scope for
  2.C (home-only) and were not touched. Worth a follow-up spec if the
  Phase 2 enforce flip (2.D) is ever meant to cover them too — option A
  (native `security.csp`) is the general fix for all of them at once.

## Decision 2 (item 2 — MercadoPago CSP allowlist): descope

Chosen over keeping T-012–T-014 as a preemptive allowlist. Rationale: the
current integration is confirmed Checkout Pro (redirect), no evidence a
Checkout Bricks migration is planned, and a preemptive allowlist would be
attack-surface with no current consumer and no test that could prove it's
actually needed.

**Implementation** (task tracking only, no code changes — there was nothing
to build):

- T-012, T-013, T-014 → `cancelled` in `tasks/state.json`, each with a note
  pointing at this decision.
- T-011 note updated to record the decision.
- T-010 (crawl) and T-015 (verify) descriptions narrowed from "MP Brick
  load" to "MercadoPago redirect page" — both still needed, both still
  blocked on T-006 (staging session), scope is now just: confirm the
  pre-redirect checkout page renders with zero CSP console errors.
- Updated the stale `frame-src` test comment in `csp-middleware.test.ts`
  (previously said "will be updated in T-012 for MP Brick").

## What's still actually blocking HOS-30

**T-006 (staging authenticated session) is the one real remaining
blocker.** It gates:

- 2.A entirely (T-007–T-010, the authenticated crawl)
- 2.B's verification step (T-015, now much lighter than originally scoped)
- 2.D transitively (T-016 → T-017 → T-020 → T-021 all sit behind the crawl)

This agent has no path to seed or identify a staging test account — it has
local-worktree DB access only, not staging DB/VPS access. Needs a human
with `hops` VPS access or Coolify DB console to either run the staging
equivalent of `pnpm db:seed:ready-user` or hand off an existing HOST-role
staging account (with an accommodation + active subscription) and a session
cookie.

T-023 (Sentry `beforeSend` filter) remains not implementable as scoped —
unchanged from the previous session, it needs a Sentry dashboard setting,
not app code. Optional (2.E) either way.
