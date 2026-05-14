---
spec-id: SPEC-111
title: Astro server islands runtime crash — manifest.serverIslandMap.get is not a function
type: fix
complexity: medium
status: draft
created: 2026-05-14T01:35:00Z
effort_estimate_hours: 3-8
tags: [astro, web, server-islands, build, runtime, investigation, upstream-bug]
extracted_from: SPEC-103 T-026 cross-browser smoke (2026-05-13)
priority: high (mobile UX broken on web — MobileMenuIsland 500, all server islands affected)
---

# SPEC-111: Astro Server Islands Runtime Fix

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Resolve the runtime crash in Hospeda's web app (`apps/web`) where Astro server islands (`server:defer` directive) throw `TypeError: manifest.serverIslandMap?.get is not a function` on every request, returning HTTP 500 to the browser and breaking interactive UX (mobile menu primarily, possibly other islands).

**Why now:** Affects every visit to hospeda.com.ar staging (and would affect prod once web migrates to `apps/web` from the landing). Server islands are core to Hospeda's architecture (auth-aware fragments on prerendered pages: FavoriteButton, UserNav, MobileMenuIsland, etc.). Without server islands working, mobile navigation is broken and any island-based feature breaks the same way.

**Why a new spec (not T-026):** T-026 was "validate home page across browsers + viewports" — a smoke test. The bug surfaced during the smoke deserves its own investigation + fix lifecycle. Estimated 3-8h depending on whether the fix is a straightforward Astro upgrade or requires upstream patches.

**Audience:** Solo developer (qazuor). Investigation can be paused; fix may need staged rollout (staging → soak → prod).

---

### 2. Out of Scope

- Replacing server islands with full client-side hydration (would lose the architectural benefit of fast static pages with auth-aware fragments).
- Migrating away from Astro Node adapter to a different runtime.
- Rewriting Hospeda's island components.
- Disabling Sentry on web permanently (Sentry is NOT the cause — confirmed during investigation 2026-05-13: bug persists with Sentry disabled).

---

### 3. Investigation Approach

#### Phase 0 — Confirm bug scope + reproduction baseline

- Confirm bug persists on staging WITHOUT Sentry (already confirmed 2026-05-13, container `l79vjf3a4czno31xuh24rb68-012123368881`, started 01:26:41 UTC).
- Reproduce locally with `pnpm dev` AND `pnpm build && pnpm start`. The Astro PR #16048 search result suggested the bug surfaces in dev with prerender environment; check both modes.
- Catalog which islands fail. MobileMenuIsland confirmed. Need to enumerate all `server:defer` usages in apps/web.

**Output:** Reproduction notes + island inventory.

#### Phase 1 — Identify the fix path

Three candidate paths (try in order):

**(a) Astro version bump** — most likely fix.
- Current: `astro@5.18.0`.
- Astro PR #16048 (Matthew Phillips, `Fix server island crash in dev when prerender environment caches stale manifest`) addresses a similar error in dev. Other related issues may exist for prod.
- Try `pnpm update astro@latest -F apps/web`. Verify what version installs. Run local dev + build + smoke server island endpoint.

**(b) @astrojs/node adapter bump**.
- Current: `@astrojs/node@9.4.0`.
- If Astro upgrade alone doesn't fix it, check if a newer adapter handles serverIslandMap serialization differently.

**(c) Output mode adjustment**.
- Current: `output: 'server'` + adapter standalone. Verify this combo is the recommended one for server islands per Astro docs.
- If Astro intends server:defer to work only with specific output modes / adapters, adjust accordingly.

#### Phase 2 — Apply fix + test locally

- Make the chosen change (likely Astro version bump).
- Run full local validation: `pnpm dev`, hit a page with server island, confirm 200; `pnpm build && pnpm start`, hit same page, confirm 200.
- Check for regressions: typecheck, lint, full test suite.

**Output:** working local reproduction → 200 on server island endpoint, no regressions.

#### Phase 3 — Deploy to staging + soak

- PR to staging.
- Deploy to hospeda-web-staging.
- Validate browser-side: MobileMenuIsland, any other islands, no 500s in DevTools network tab.
- Restore PUBLIC_SENTRY_DSN to web-staging (was disabled during investigation as red herring); verify with Sentry still enabled.
- Soak for 24-72h. Monitor logs for any regression of serverIslandMap or unrelated breakage.

#### Phase 4 — Deploy to prod

- After staging soak, PR staging → main.
- Verify hospeda-web-prod also gets the fix (rebuilds with new Astro).
- Smoke prod-tier islands.

#### Phase 5 — Cleanup secondary findings

- Restore PUBLIC_SENTRY_DSN on web-staging (operator action, value from Sentry dashboard).
- Fix PUBLIC_SENTRY_RELEASE placeholder issue (task #23 in SPEC-103 session tracker): currently `${SOURCE_COMMIT}` literal. Either wire SOURCE_COMMIT as a Coolify build arg, OR compute SHA in CI/CD and pass as Sentry release at build time.

---

### 4. Tasks (expand during investigation)

| Task | Title | Phase | Status |
|---|---|---|---|
| T-111-01 | Reproduce locally (dev + build modes) + enumerate affected islands | 0 | pending |
| T-111-02 | Phase 1: try Astro version bump as primary fix | 1 | pending |
| T-111-03 | Phase 1 fallback: @astrojs/node adapter bump | 1 | pending, blocked by T-111-02 outcome |
| T-111-04 | Apply working fix + run local test suite | 2 | pending, blocked by T-111-02 or T-111-03 |
| T-111-05 | PR + deploy to staging + browser validate | 3 | pending, blocked by T-111-04 |
| T-111-06 | Restore PUBLIC_SENTRY_DSN on web-staging | 3 | pending, blocked by T-111-05 |
| T-111-07 | Soak 24-72h on staging | 3 | pending, blocked by T-111-06 |
| T-111-08 | Promote to main + verify prod-tier | 4 | pending, blocked by T-111-07 |
| T-111-09 | Fix PUBLIC_SENTRY_RELEASE placeholder substitution | 5 | pending |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Astro 5.20+ has breaking changes that affect Hospeda code | Read CHANGELOG; check release notes for breaking changes; have rollback plan (pnpm downgrade + redeploy) |
| Astro upgrade pulls dep upgrades that break Vite/React build | Run full local build + test suite before deploying |
| The fix is NOT in any released Astro version (only in unreleased main) | Pin to a Git commit OR file an upstream issue and wait OR apply a patch via `patch-package` |
| Restoring Sentry brings back a different bug | Test on staging WITH Sentry before promoting to main |
| Mobile menu broken in prod-tier during fix window | hospeda-web-prod currently serves the landing (`apps/landing/`), not `apps/web/`. The web only runs on staging. So prod is unaffected until SPEC-103 T-087 cutover. Acceptable risk window |

---

### 6. Acceptance Criteria

- [ ] All Astro server islands return 200 on `apps/web` (no 500 from `/_server-islands/*` endpoints)
- [ ] MobileMenuIsland renders and interacts correctly across browsers (Chrome, Firefox, Safari, mobile emulation)
- [ ] No `serverIslandMap?.get` errors in web container logs over a 7-day window post-fix
- [ ] PUBLIC_SENTRY_DSN restored to web-staging; Sentry events flow to dashboard
- [ ] PUBLIC_SENTRY_RELEASE properly populated with commit SHA (not literal `${SOURCE_COMMIT}`)
- [ ] Astro version upgrade committed via PR; staging soak passed; main merged

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-026 (cross-browser smoke, 2026-05-13). Engram entries:
- `bug/web-server-islands-broken` — full bug context + root cause analysis
- Web Search: Astro PR #16048 (related dev-mode fix)

### Initial diagnostic timeline (2026-05-13 ~01:00-01:35 UTC)

1. T-026 Playwright smoke against `https://staging.hospeda.com.ar/es/` revealed 500 on `/_server-islands/MobileMenuIsland/`.
2. Container logs showed `TypeError: manifest.serverIslandMap?.get is not a function` at `apps/web/dist/server/chunks/middleware_NeQFZ5GU.mjs:646`.
3. Stack trace included `@sentry/astro@10.40.0` middleware → initial hypothesis was Sentry compat.
4. Mitigation: `hops env-delete web PUBLIC_SENTRY_DSN --target=staging` + redeploy → Sentry excluded from build (verified via `ls dist/server/chunks/ | grep sentry` = empty).
5. Hypothesis INVALIDATED: error persists without Sentry. Container started 01:26:41 UTC, error logged at 01:31:53 UTC.
6. Conclusion: Astro 5.18.0 + Node adapter standalone has a bug in serverIslandMap construction at runtime.

### Versions current at time of discovery

- `astro@5.18.0`
- `@astrojs/node@9.5.5`
- `@sentry/astro@10.40.0` (ruled out as cause)
- `@astrojs/react@4.2.1`
- `@astrojs/sitemap@3.7.0`

### Cross-spec dependencies

- SPEC-103 T-026 — smoke that surfaced the bug (closed positive: home renders OK except for the islands)
- SPEC-103 T-087 — landing → web cutover at public launch (currently web only runs on staging, so prod is buffered from this bug until cutover)

### When to start

Recommended: **before SPEC-103 T-087 (web cutover at public launch)**. Pre-launch traffic on web is staging-only (internal), low impact. Post-launch web becomes public-facing — mobile menu is critical UX. Block T-087 on SPEC-111 completion.
