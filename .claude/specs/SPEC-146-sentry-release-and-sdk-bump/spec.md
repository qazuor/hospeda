---
spec-id: SPEC-146
title: Sentry release wiring + SDK version alignment
type: fix
complexity: low
status: draft
created: 2026-05-18T00:00:00Z
effort_estimate_hours: 0.5-1
tags: [sentry, monitoring, observability, web, admin]
discovered_during: 2026-05-18 staging Sentry health check after SPEC-140 verification
---

# SPEC-146: Sentry release wiring + SDK version alignment

> **Related beta feedback** (not a 1:1 match): [BETA-50](https://linear.app/hospeda-beta/issue/BETA-50) — "Verificar que los environments de Sentry estén configurados y reportando correctamente" (adjacent: SPEC-146 wires release SHA + SDK bump; environment verification overlaps in intent but is broader/operational). [BETA-66](https://linear.app/hospeda-beta/issue/BETA-66) — "Asegurar que los source maps funcionen correctamente en Sentry" (⚠️ source maps are **explicitly out of scope** of SPEC-146, see §2; linked only so triage knows this spec does NOT cover it).

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Three small but related tweaks to make the existing Sentry deployments produce useful, comparable data:

1. Wire `PUBLIC_SENTRY_RELEASE` (web) to the deployed git commit SHA so each web release is uniquely identified in Sentry instead of the literal fallback `'development'`.
2. Wire `VITE_SENTRY_RELEASE` (admin) to the same so admin issues stop landing in the empty-string release bucket.
3. Bump `@sentry/react` in `apps/admin` from `10.36.0` to align with `@sentry/astro@10.40.0` in `apps/web` — closes a trivial version drift between the two browser apps.

**Why now:** Post-SPEC-140 verification (2026-05-18) introspected the Sentry options on staging via Chrome DevTools and surfaced these three deferred items. They are low priority but free wins:

- Web today: `release: "development"` (literal fallback in `sentry.client.config.ts`). Every deploy groups under the same release label so regression-per-deploy analysis is impossible in the Sentry UI.
- Admin today: `release: ""` (literally empty — no fallback in admin config). All issues collapse into the "unknown" release bucket.
- Admin SDK is at `10.36.0` while web is at `10.40.0`. Trivial drift but worth aligning so dependabot / future bumps don't ping-pong between two minor versions.

**Scope:** Three cohesive small changes:
- **(a)** `apps/web` — confirm the existing `PUBLIC_SENTRY_RELEASE` env var is consumed by `sentry.client.config.ts` (it is, with the `'development'` fallback). The change is OPERATIONAL — set `PUBLIC_SENTRY_RELEASE` as a Docker build-arg in Coolify for both `hospeda-web-staging` and `hospeda-web-prod` pointing at the deploy's git SHA.
- **(b)** `apps/admin` — confirm the existing `VITE_SENTRY_RELEASE` env var is consumed by the admin Sentry config. Same Coolify wiring as web with the `VITE_` prefix.
- **(c)** `apps/admin/package.json` — bump `@sentry/react` to `^10.40.x` (whatever version matches `@sentry/astro` in `apps/web`).

### 2. Out of Scope

- API Sentry verification — the 2026-05-18 health check could not introspect the API SDK from a browser. Confirm in the Sentry UI that `hospeda-api` project has events flowing, but that is operational work, not code.
- Wiring an automated `HOSPEDA_COMMIT_SHA` build-arg in CI/CD — Coolify-side concern, captured in deployment docs. This spec only ensures the env vars are consumed correctly by the apps; the actual value injection is a Coolify configuration step the operator handles.
- Source maps upload pipeline (`SENTRY_AUTH_TOKEN` flow) — already wired, presumed working.
- Replay opt-out for cookieless mode — a separate consent-integration concern.
- Sentry Performance / Distributed tracing changes.
- Sentry alerts / dashboards configuration in the UI.

### 3. Approach

Phased so each step is independently committable + verifiable.

**Phase 1 — Code: confirm env-var consumption (web)**

1. Read `apps/web/sentry.client.config.ts` and confirm `release: import.meta.env.PUBLIC_SENTRY_RELEASE || 'development'` is the current pattern.
2. If the fallback is `'development'`, leave it (acceptable safety net for local dev). The fix lives in Coolify, not code.
3. If the fallback is empty string or missing, replace with `'development'` so local dev still groups predictably.

**Phase 2 — Code: confirm env-var consumption (admin)**

4. Locate the admin Sentry init file (`apps/admin/sentry.client.config.ts` or `src/instrumentation/sentry.ts` — check during implementation).
5. Confirm it reads `import.meta.env.VITE_SENTRY_RELEASE`. If the read is missing or the fallback is empty string, add the same `|| 'development'` fallback as web for parity.
6. If the env var declaration exists in `apps/admin/src/env.ts` `AdminEnvSchema` but isn't wired into the actual `Sentry.init(...)` call, wire it.

**Phase 3 — Code: SDK version alignment**

7. Update `apps/admin/package.json`: bump `@sentry/react` from the current `10.36.x` line to `10.40.x` (or whatever matches `@sentry/astro` in `apps/web/package.json` at the time of work).
8. Run `pnpm install` to regenerate the lockfile.
9. Run `pnpm typecheck` from the admin package — `@sentry/react` is a peer dep of TanStack-Start's instrumentation in places, so any breaking signature change will surface here.
10. Run admin's test suite to verify no regression (the existing 7 pre-existing failures from SPEC-140 days are expected — make sure no new ones appear).

**Phase 4 — Operational: Coolify env vars**

11. SSH to the VPS and run, for each web resource:
    ```bash
    hops env-set web PUBLIC_SENTRY_RELEASE "${HOSPEDA_COMMIT_SHA}" --target=staging
    hops env-set web PUBLIC_SENTRY_RELEASE "${HOSPEDA_COMMIT_SHA}" --target=prod
    ```
    (Or via Coolify UI: Environment Variables → add `PUBLIC_SENTRY_RELEASE`, value `${HOSPEDA_COMMIT_SHA}`, marked Build-time.)
12. Same for admin with `VITE_SENTRY_RELEASE`.
13. Trigger `hops redeploy web --target=staging` and `hops redeploy admin --target=staging`.

**Phase 5 — Verification**

14. Open `https://staging.hospeda.com.ar` with DevTools → evaluate `window.__SENTRY__[version].defaultCurrentScope._client.getOptions().release` → confirm value is a git SHA, not `'development'`.
15. Same on `https://staging-admin.hospeda.com.ar` → confirm value is a git SHA, not `''`.
16. In Sentry UI → `hospeda-web` project → Releases tab → confirm a new release with the SHA appears.
17. Same for `hospeda-admin`.
18. After staging soak (24h), repeat steps 11-17 for prod with `--target=prod`.

### 4. Reference info

- 2026-05-18 staging Sentry health check (engram topic `sentry/staging-health-2026-05-18`) — captured the current release values via Chrome DevTools introspection.
- Existing web config: `apps/web/sentry.client.config.ts` (release line ~16).
- Existing admin Sentry config: TBD, locate during Phase 2.
- Existing env-var declarations:
  - Web: `apps/web/src/env.ts` `serverEnvBaseSchema` already declares `PUBLIC_SENTRY_RELEASE: z.string().optional()`.
  - Admin: `apps/admin/src/env.ts` `AdminEnvSchema` already declares `VITE_SENTRY_RELEASE: z.string().optional()`.
- Operational CLI: `hops env-set <kind> KEY VALUE --target=<staging|prod>` (`scripts/server-tools/`).
- Sentry release docs: https://docs.sentry.io/product/releases/

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-146-01 | Read `apps/web/sentry.client.config.ts` and confirm `PUBLIC_SENTRY_RELEASE` consumption + fallback | 1 | pending |
| T-146-02 | Locate admin Sentry init file and confirm `VITE_SENTRY_RELEASE` consumption + add `'development'` fallback if missing | 2 | pending |
| T-146-03 | Bump `@sentry/react` in `apps/admin/package.json` to align with `@sentry/astro` in `apps/web` | 3 | pending |
| T-146-04 | Run `pnpm install` + `pnpm typecheck` + admin tests, confirm no NEW regressions vs baseline | 3 | pending |
| T-146-05 | Set `PUBLIC_SENTRY_RELEASE` on `hospeda-web-staging` via Coolify (build-time) + `hops redeploy` | 4 | pending |
| T-146-06 | Set `VITE_SENTRY_RELEASE` on `hospeda-admin-staging` via Coolify (build-time) + `hops redeploy` | 4 | pending |
| T-146-07 | Verify web staging: `window.__SENTRY__` shows release = git SHA; Sentry UI Releases tab lists the SHA | 5 | pending |
| T-146-08 | Verify admin staging: same checks against `hospeda-admin` Sentry project | 5 | pending |
| T-146-09 | After staging soak (24h): set vars on prod resources + redeploy + verify | 5 | pending |

### 6. Acceptance Criteria

- [ ] `apps/web/sentry.client.config.ts` consumes `PUBLIC_SENTRY_RELEASE` with a non-empty fallback (`'development'`).
- [ ] Admin Sentry init file consumes `VITE_SENTRY_RELEASE` with a non-empty fallback (`'development'`).
- [ ] `apps/admin/package.json` `@sentry/react` version aligned to `@sentry/astro` version in `apps/web/package.json` (same minor line at minimum).
- [ ] `pnpm typecheck` from admin runs without NEW errors compared to the pre-bump baseline.
- [ ] On `staging.hospeda.com.ar`, `window.__SENTRY__[version].defaultCurrentScope._client.getOptions().release` returns a git SHA (not `'development'`).
- [ ] On `staging-admin.hospeda.com.ar`, same check returns a git SHA (not `''`).
- [ ] Sentry UI → `hospeda-web` Releases tab lists at least one release with the staging SHA after redeploy.
- [ ] Sentry UI → `hospeda-admin` Releases tab same.
- [ ] After staging soak time: prod equivalents.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Coolify doesn't have `HOSPEDA_COMMIT_SHA` injected as an env var at build time | Confirm by inspecting an existing Dockerfile build-arg pattern (web + admin already do this for `VITE_SENTRY_ENVIRONMENT` per PR #1148 / `ae5ab9d69`). If absent, the value can fall back to a manual per-deploy string. Document as a follow-up if needed. |
| `@sentry/react` 10.40 introduces a breaking signature change | Phase 3 typecheck step catches it. If breaking, pin to 10.39.x or whichever minor matches both `@sentry/astro` and existing admin usage. |
| Source maps now stop matching the new release identifier | Existing build pipeline tags source maps with `release` from the same env var. If the env var changes, the matching is automatic. Verify by triggering an error and checking the Sentry stack trace is symbolicated after redeploy. |
| Release SHA collides with someone else's tag namespace in Sentry org | Git SHAs are unique per repo + per commit. Other Sentry projects in the same org would need a different SHA from a different repo — collision rate is effectively zero. |

---

## Part 2 — Implementation Notes

### Source

Discovered during the 2026-05-18 Chrome DevTools introspection of staging after SPEC-140 PR #1146 (analytics-stack-posthog) merged. Verification confirmed Sentry was emitting envelope POSTs correctly, but the `release` field surfaced two gaps:

- Web: literal `'development'` due to env var being unset in Coolify and the config falling back to a hard-coded default.
- Admin: literal `''` because the admin config either doesn't read the env var or has an empty-string fallback.

Plus a third nit: SDK version drift between `@sentry/astro@10.40.0` (web) and `@sentry/react@10.36.0` (admin).

### Why this is one spec, not three

Splitting into three specs would create overhead disproportionate to the work (each tweak is 1-2 lines + a Coolify config). Bundling them keeps the operational + code change atomic and the verification checklist easy to follow.

### Why not part of SPEC-140

SPEC-140's scope is product analytics (PostHog) integration; Sentry tweaks would muddle the spec's narrative and gate its closure on operational follow-ups that aren't its concern. SPEC-146 stays narrow and lets SPEC-140 finish cleanly.

### Decision log

- **2026-05-18** — User chose to bundle the three tweaks into one small spec rather than file three separate issues. Rationale: small enough that one PR carries it; large enough that engram + an index.json entry justify the discoverability.
- **2026-05-18** — Out of scope: API Sentry verification. Reason: server-side Sentry can't be introspected from a browser, and the user already needs to check Sentry UI manually. Adding it to this spec would conflate code work with operational verification.

### Cross-spec dependencies

- **SPEC-140** (closed for analytics scope, ongoing for admin PostHog) — established the Sentry consent gating via `cookie-consent` cookie. This spec assumes that integration stays as-is.
- **PR #1148 fix/sentry-staging-environment** (merged 2026-05-18) — wired `PUBLIC_SENTRY_ENVIRONMENT` and `VITE_SENTRY_ENVIRONMENT` correctly. This spec is the natural follow-up for `_RELEASE`.
- **SPEC-046** (CSP) — Sentry envelope POSTs already pass through CSP. No new directives needed.
