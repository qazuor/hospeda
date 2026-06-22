---
specId: SPEC-261
title: Stabilize commerce-owner E2E and promote back to @p0
slug: commerce-e2e-stabilization
type: chore
complexity: medium
status: draft
created: 2026-06-22
base: staging
dependsOn:
  - SPEC-252
tags:
  - e2e
  - playwright
  - testing
  - commerce
  - ci
  - dev-infra
---

# SPEC-261 — Stabilize commerce-owner E2E and promote back to @p0

## 1. Origin

SPEC-252 shipped the commerce-owner E2E specs in `apps/e2e/tests/commerce/`
(`commerce-01-owner-edits-listings.spec.ts`, `commerce-02-access-control.spec.ts`)
but they could **not** be made green in headless CI after 8 fix rounds, so they were
**deprioritized from `@p0` to `@p1`** (they run nightly but do not gate `e2e-pr`). PR #1751
merged with that documented debt. This spec pays it down.

## 2. Confirmed diagnosis (do not re-derive from scratch)

The commerce-01 save never fires its PATCH in headless CI. Confirmed via a
`page.waitForResponse()` timeout on the protected PATCH plus reading the component source:

- `apps/web/src/components/commerce/CommerceListingEditor.client.tsx` — `handleSubmit`
  returns early when `dirty.size === 0` (it PATCHes only the dirty field groups). The save
  button is `disabled={!canSave}` where `canSave = dirty.size > 0 && !isSaving`. `dirty` is
  populated by `markDirty(field)` called from each field's React `onChange`.
- In headless CI Chromium, **none** of the following tripped React 19's controlled-input
  change tracking, so `dirty` stayed empty and no PATCH fired:
  1. Playwright `fill()` (gastronomy `#ce-menuUrl` input).
  2. `pressSequentially()` (experience `#ce-richDescription` textarea).
  3. `click({ force: true })` on the save button.
  4. The native prototype value-setter
     (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v)`)
     plus dispatched bubbling `input` + `change` events — the canonical
     `@testing-library/user-event` technique.
- The **product is sound**: the save works when the form is genuinely dirty (verified by
  elimination), and the read-IDOR on the protected getById was already fixed in #1752.

The root blocker to fixing this is that the **full local E2E stack could not be brought up**
(the web prod-env build fails at `validateWebEnv`, so the 3-server `apps/e2e` harness never
started), which means there was no Playwright **trace / video / DOM snapshot** to see what
actually happens to the editor island when the test interacts with it. Iterating purely via
CI (~12 min/round, no trace) did not converge.

## 3. Goals

- Bring up the `apps/e2e` functional stack **locally** so the commerce specs can be run with
  a Playwright trace/video and debugged with real DOM/network evidence.
- Determine why the editor island's dirty-tracking is not tripped by Playwright interactions
  in headless mode (candidates: hydration timing not actually awaited; the island re-mounting;
  a controlled-input wrapper that needs focus/composition events; the value set on the wrong
  element; an Astro `client:load` vs `client:visible` nuance).
- Make `commerce-01` and `commerce-02` reliably green (with the existing `@p1` tags), then
  **promote them back to `@p0`** so they gate `e2e-pr`.

## 4. Scope

- Fix or document the **local E2E stack bring-up** for `apps/e2e` (the web prod-env build
  blocker) so contributors can run `e2e:up` + the commerce specs and get a trace. This may be
  a dev-env/runbook fix (provide the missing `PUBLIC_*` build env for the E2E web build) or a
  Playwright `webServer` config tweak to run the web in dev mode for E2E.
- Debug `commerce-01` (the save → PATCH dirty-tracking issue) with the local trace and apply
  the real fix in the test (or, if the investigation surfaces a genuine product/UX gap, raise
  it separately — the current evidence says the product is fine).
- Re-validate `commerce-02` (access-control) under the same fixed harness.
- Promote both specs `@p1 → @p0` and confirm `e2e-pr` runs and passes them.

## 5. Out of scope

- Any change to the commerce editor product behavior (unless the local trace reveals a real
  bug — then spin a separate fix).
- The SPEC-252 seed fixtures (already correct: julieta logueable owns both verticals,
  `e2e-tourist` USER exists, `profileCompleted=true`).

## 6. Acceptance criteria (outline)

- AC-1: The `apps/e2e` stack can be brought up locally (documented command sequence) and the
  commerce specs run with a Playwright trace.
- AC-2: `commerce-01` (edit both verticals → public ficha) passes reliably (≥3 consecutive
  local runs + green in CI).
- AC-3: `commerce-02` (tourist + cross-owner blocked) passes reliably.
- AC-4: Both specs are tagged `@p0` again and `e2e-pr`'s `e2e:test:p0` runs+passes them.

## 7. Tasks (outline — atomize at start)

1. Unblock the local `apps/e2e` stack bring-up (web prod-env build / Playwright webServer).
2. Run commerce-01 locally with a trace; root-cause the dirty-tracking / no-PATCH issue.
3. Apply the real fix to commerce-01 (and commerce-02 if needed).
4. Promote both specs `@p1 → @p0`; confirm e2e-pr green.
5. Docs: note the local E2E run procedure + the dirty-tracking gotcha.

## 8. Dependencies

- SPEC-252 (shipped the specs + seed; this stabilizes them). The `@p1` tags and the
  follow-up note live in `apps/e2e/tests/commerce/*.spec.ts` and SPEC-252's history.
