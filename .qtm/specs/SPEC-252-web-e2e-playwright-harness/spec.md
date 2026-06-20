---
specId: SPEC-252
title: Web functional E2E (Playwright) harness + login fixtures + CI
slug: web-e2e-playwright-harness
type: feature
complexity: medium
status: draft
created: 2026-06-20
base: staging
dependsOn:
  - SPEC-249
tags:
  - web
  - e2e
  - playwright
  - testing
  - ci
  - seed
---

# SPEC-252 — Web functional E2E (Playwright) harness + CI

## 1. Origin

SPEC-249 T-025 ("E2E: owner edits gastronomy + experience") could only be validated
**live, by hand** (MCP-driven browser + HTTP), because the web app has **no functional
Playwright harness**: only a visual-snapshot config (`playwright-visual.config.ts`)
exists — there is no functional `playwright.config.ts`, no login helper, no session
fixtures, and no CI wiring for functional E2E. Two seed gaps also blocked the run:

- The experience listings are owned by `commerce-owner-seed@hospeda.test`, which the
  seed creates **without a login credential** — so no logueable user owns an experience.
- The `gastro-owner-*@local.test` users seed with `profile_completed = false`, so the
  profile-completion middleware gate intercepts before the commerce area (had to be
  patched by hand in the DB during the SPEC-249 run).

## 2. Goals

- Stand up a **functional Playwright E2E harness** for `apps/web`: config, a reusable
  login helper (UI sign-in or session injection), and shared fixtures.
- Wire functional E2E into **CI** (separate from the visual job).
- Fix the **seed fixtures** so commerce owner flows are testable without manual DB edits.
- Deliver the **automated** SPEC-249 T-025 E2E (gastronomy + experience) as the first
  real spec on the new harness.

## 3. Scope

### Harness

- `playwright.config.ts` (functional) with project(s) pointing at the dev web server.
- Login helper: `loginAs(email, password)` (UI) and/or programmatic session seeding.
- Fixtures/utilities (base URL, locale, auth state reuse).
- CI job that runs functional E2E against an ephemeral app + DB.

### Seed fixtures (the SPEC-249 follow-ups)

- Give a **logueable** commerce owner ownership of BOTH a gastronomy AND an experience
  (or create a dedicated `gastro-owner-*` that owns one of each), so AC-1/AC-2 cover
  both verticals.
- Seed commerce owners with `profile_completed = true` (and any other fields needed) so
  the profile-completion gate does not block dev/E2E (or document the intended
  new-owner gate order: change-password → complete-profile → comercio).

### First E2E spec (SPEC-249 T-025, automated)

- Owner logs in, sees ONLY their own listings (gastronomy + experience), opens each
  editor, edits an operational field, saves, sees it on the public ficha.
- Negative: a tourist/non-owner cannot reach the area or another owner's listing
  (redirect / 404).

## 4. Out of scope

- The extended-field editing E2E (SPEC-250 fields) — those specs add their own E2E on
  top of this harness.
- The DB lifecycle/template refresh — SPEC-251.

## 5. Acceptance criteria (outline)

- AC-1: A functional Playwright spec runs locally (servers up) and in CI.
- AC-2: A `loginAs` helper authenticates a seeded user reliably.
- AC-3: Seeded commerce owners are usable end-to-end without manual DB edits (profile
  complete; a logueable owner owns both verticals).
- AC-4: The SPEC-249 T-025 flow (both verticals + negative case) passes as an automated
  committed test.

## 6. Tasks (outline — atomize at start)

1. Functional `playwright.config.ts` + base fixtures.
2. `loginAs` helper (UI sign-in and/or session injection).
3. Seed fixes: logueable owner with gastronomy + experience; `profile_completed=true`.
4. SPEC-249 T-025 E2E spec (gastronomy + experience + negative).
5. CI job for functional E2E.

## 7. Dependencies

- SPEC-249 (the commerce owner area under test) — done.
- Coordinates with SPEC-251 (correct local DB) and SPEC-250 (adds field E2E later).
