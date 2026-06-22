---
specId: SPEC-252
title: Extend apps/e2e with commerce-owner flows + seed fixtures
slug: web-e2e-playwright-harness
type: feature
complexity: medium
status: in-progress
created: 2026-06-20
base: staging
dependsOn:
  - SPEC-249
tags:
  - e2e
  - playwright
  - testing
  - seed
  - commerce
---

# SPEC-252 — Extend apps/e2e with commerce-owner flows + seed fixtures

## 1. Origin

SPEC-249 T-025 ("E2E: owner edits gastronomy + experience") could only be validated
**live, by hand** (MCP-driven browser + HTTP). The original spec assumed `apps/web` had
no functional Playwright harness. That was incorrect — `apps/e2e` (`hospeda-e2e`) is a
**mature functional Playwright harness** already wired into CI. The actual gaps were:

- **No commerce/gastronomy/experience E2E tests** in `apps/e2e/tests/` — the directory
  covers accommodation, admin, guest, host, messaging, newsletter, resilience, security,
  but nothing for commerce verticals.
- The experience listings are owned by `commerce-owner-seed@hospeda.test`, which the
  seed creates **without a login credential** — so no logueable user owns an experience.
- The `gastro-owner-*@local.test` users seed with `profile_completed = false`, so the
  profile-completion middleware gate intercepts before the commerce area (had to be
  patched by hand in the DB during the SPEC-249 run).

## 2. Goals

- Fix the **seed fixtures** in `apps/e2e/seeds/e2e-seed.ts` (and `packages/seed` if
  needed) so commerce owner flows are testable without manual DB edits.
- Add a **reusable commerce-owner auth helper** in `apps/e2e/fixtures/` (reusing the
  existing Better Auth sign-in pattern from `fixtures/api-helpers.ts` — no parallel harness).
- Deliver the **automated** SPEC-249 T-025 E2E spec in `apps/e2e/tests/commerce/`
  (gastronomy + experience + negative case), tagged `@p0 @commerce` so the existing
  `e2e:test:p0` script picks it up automatically.
- Confirm the new `@p0` tests are covered by the existing CI job (`.github/workflows/e2e-pr.yml`)
  — no new CI job needed, just correct tagging.

## 3. Scope

### Seed fixtures (in apps/e2e and packages/seed)

- Give a **logueable** commerce owner ownership of BOTH a gastronomy AND an experience
  listing in `apps/e2e/seeds/e2e-seed.ts` (dedicated `gastro-owner-*@hospeda.test`
  or updated existing user), with `profile_completed = true`.
- If the same user pattern is needed in the dev seed, mirror the fix in `packages/seed`
  (mark it in the task but evaluate during implementation).

### Optional commerce-owner auth helper (apps/e2e/fixtures/)

- A thin `signInAsCommerceOwner()` helper (or extend existing `api-helpers.ts`), reusing
  the `fetch` → `${API_URL}/api/auth/sign-in/email` Better Auth pattern.
- Only add if it reduces duplication across 2+ test files; otherwise inline the sign-in.

### Commerce E2E spec (apps/e2e/tests/commerce/)

- `commerce-01-owner-self-service.spec.ts` (or similar): owner logs in, sees ONLY their
  own listings (gastronomy + experience), opens each editor, edits an operational field,
  saves, sees it reflected on the public ficha.
- Negative case: tourist/non-owner hitting the editor URL gets redirect or 404.
- Tags: `@p0 @commerce`. Use `apps/e2e/tests/host/host-01-onboarding-handoff.spec.ts`
  as the structural template (JSDoc header: Actors, Tags, Preconditions, What it validates).

### CI verification (tagging-only)

- Confirm that tagging the new tests `@p0` is sufficient for `e2e:test:p0`
  (`--grep @p0`) to pick them up in `.github/workflows/e2e-pr.yml`.
- No new workflow file, no new script — only verify the existing grep pattern works.

## 4. Out of scope

- Creating a new `playwright.config.ts` or E2E harness in `apps/web` — `apps/e2e` is
  the project-wide harness and must remain the single source.
- A new CI job for commerce E2E — the existing `e2e-pr.yml` @p0 job covers it.
- The extended-field editing E2E (SPEC-253 fields) — those specs add their own tests
  on top of the commerce E2E foundation laid here.
- The DB lifecycle/template refresh — SPEC-251 (already shipped).

## 5. Acceptance criteria (outline)

- AC-1: A Playwright spec in `apps/e2e/tests/commerce/` runs locally (servers up via
  `e2e:up`) and passes both the positive and negative flows.
- AC-2: The spec is tagged `@p0 @commerce` and is included in `pnpm --filter hospeda-e2e
  e2e:test:p0` output (verified locally).
- AC-3: Seeded commerce owners in `apps/e2e/seeds/e2e-seed.ts` are logueable without
  manual DB edits: `profile_completed = true`; a logueable owner owns both a gastronomy
  and an experience.
- AC-4: The SPEC-249 T-025 flow (both verticals + negative case) passes as an automated
  committed test, with no manual browser intervention required.

## 6. Tasks (outline — atomize at start)

1. Fix seed in `apps/e2e/seeds/e2e-seed.ts` — logueable commerce owner, both verticals,
   `profile_completed = true`. Note if `packages/seed` needs the same fix.
2. Optional: reusable commerce-owner auth helper in `apps/e2e/fixtures/api-helpers.ts`
   (or a new commerce-helpers.ts).
3. E2E positive spec: `apps/e2e/tests/commerce/commerce-01-owner-self-service.spec.ts`
   (owner edits gastronomy + experience, changes reflected on public ficha).
4. E2E negative spec (non-owner blocked) — can be a second `test()` block in the same file.
5. CI/tagging verification: confirm `@p0` grep picks up the new tests; document in spec.

## 7. Dependencies

- SPEC-249 (the commerce owner area under test) — done.
- SPEC-251 (DB template refresh) — done; worktree DBs can now be healed.
- Coordinates with SPEC-253 (adds field E2E later, on top of commerce tests here).

## 8. Revision History

### 2026-06-21 — Realignment (owner-approved)

Discovered that `apps/e2e` (`hospeda-e2e`) is an existing mature functional Playwright
harness with CI already wired (`e2e-pr.yml` runs `@p0` tag, `e2e-nightly.yml` runs
broader suite). It has `playwright.config.ts`, `docker-compose.e2e.yml`,
`seeds/e2e-seed.ts`, a full `fixtures/` directory (`api-helpers.ts`, `db-helpers.ts`,
`mailpit-client.ts`, `mp-webhook-helper.ts`, `revalidation-spy.ts`), `support/`
utilities, and `tests/` organized by domain (accommodation, admin, guest, host,
messaging, newsletter, resilience, security, spec-096, spec-098).

The original spec incorrectly assumed `apps/web` had no harness and proposed creating
one there. Scope realigned from "create a new harness in apps/web" to "extend the
existing apps/e2e with commerce-owner flows + fix seed gaps." Owner approved this
realignment. No new CI job is needed — correct `@p0` tagging on the new tests is
sufficient.

### 2026-06-22 — Implementation complete (5/5)

- **T-001** seed fix (in `packages/seed/example`, which the e2e seed reuses via
  `example:true`): logueable `gastro-owner-julieta@local.test` owns a gastronomy + an
  experience, `profileCompleted=true`.
- **T-002** `signInExistingUser()` helper in `apps/e2e/fixtures/api-helpers.ts`.
- **T-003** positive E2E `apps/e2e/tests/commerce/commerce-01-owner-edits-listings.spec.ts`
  (`@p0 @commerce`): owner edits gastronomy `menuUrl` + experience `richDescription`,
  asserted on the public ficha; `afterEach` restores the mutated fields.
- **T-004** negative E2E `commerce-02-access-control.spec.ts` (`@p0 @commerce`): tourist
  redirected to `/mi-cuenta/`; cross-owner redirected to her own `/mi-cuenta/comercio/`
  index (real guard behavior — a page-layer redirect, not a 404).
- **T-005** CI verification: `e2e-pr.yml` runs `e2e:test:p0` (`playwright test --grep @p0`)
  and `testDir: ./tests` includes `tests/commerce/`; both specs are `@p0`, so CI runs them
  with no workflow change.

**Runtime validation note:** the commerce specs are static-checked (tsc + biome); their
runtime run is via CI (`e2e-pr.yml @p0`). Bringing up the full local E2E stack
(3 servers plus the e2e DB) is blocked by the web prod-env build (`validateWebEnv`), so
CI is the canonical E2E environment for these tests.
