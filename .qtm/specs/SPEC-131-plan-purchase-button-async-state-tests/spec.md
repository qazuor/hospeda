---
spec-id: SPEC-131
title: PlanPurchaseButton async-state tests broken post Astro 6 bump
type: fix
complexity: medium
status: draft
created: 2026-05-15T18:30:00Z
effort_estimate_hours: 2-6
tags: [web, tests, react-19, astro-6, vitest, follow-up, spec-111]
extracted_from: SPEC-111 T-111-04 validation
parent: SPEC-193
---

# SPEC-131: Fix PlanPurchaseButton async-state tests

## Coordination (SPEC-193)

As a child of SPEC-193 "Billing Go-Live Readiness — Master", this spec is fully self-contained: it has no coupling to the billing backend, state-machine, catalog, or lifecycle changes owned by the other children. It can be executed at any point in the SPEC-193 sequence without waiting for or blocking any other child spec.

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Re-enable the 13 currently-skipped tests in `apps/web/test/components/billing/PlanPurchaseButton.test.tsx` that broke as a side-effect of the Astro 6 bump in SPEC-111.

**Why now:** The tests cover critical billing flow logic (loading state, checkout success, double-submit prevention, POST payload integrity). Skipping them removes coverage from a money-handling code path.

**Why a separate spec:** SPEC-111 fixed the original server-islands crash. The bump introduced a transitive test regression that was workaround-mitigated for 32 of the 45 broken tests via `@vitejs/plugin-react@4` override + vitest config rewrite. The remaining 13 are an async-state timing edge case that needs dedicated investigation.

**Audience:** Solo developer (qazuor) or a contributor familiar with React 19 + Vitest + jsdom internals.

---

### 2. Out of Scope

- Reverting the Astro 6 bump — Astro 6 is the correct landing-state per SPEC-111.
- Re-fixing the other 32 React component tests already passing via the workaround.
- Refactoring PlanPurchaseButton component logic (the production behavior is correct; only the test harness is broken).
- Fixing the 6 PRE-EXISTING test failures unrelated to SPEC-111 (transforms, CategoryTiles, FavoriteButton ×2, ListingMapFavoriteButton ×2) — separate cleanup task if desired.

---

### 3. Symptom & Reproduction

After applying the SPEC-111 bump + workaround:

1. `cd apps/web && pnpm exec vitest run test/components/billing/PlanPurchaseButton.test.tsx`
2. 13 of 23 tests fail with the same pattern: post-`await user.click(button)` the assertion `expect(button).toBeDisabled()` (or `aria-busy="true"`, processing-text presence, etc.) sees the INITIAL state, not the loading state.

Sample failure:

```
Received element is not disabled:
  <button aria-busy="false" aria-disabled="false" aria-label="Contratar — $ 1.200" ...>
```

The `setLoading(true)` call in `handleClick` (PlanPurchaseButton.client.tsx:204) is not propagating to the DOM by the time the test assertion runs.

Pre-bump (Astro 5.18.0, @astrojs/react 4.2.1, @vitejs/plugin-react 4.x bundled): all 23 tests pass.

---

### 4. Investigation Approach

#### Phase 0 — Document precise failure mode

- Add console.log instrumentation inside `handleClick`: log on entry, after `setLoading(true)`, after `await fetch(...)`.
- Run failing test with --reporter=verbose. Confirm whether handleClick body runs at all.
- Compare React DevTools commit logs pre/post bump if feasible.

#### Phase 1 — Try candidate fixes

(a) **Switch `pool` to `threads` or `vmThreads`** in `apps/web/vitest.config.ts`. Cross-fork state isolation in `forks` may interact with React 19 in unexpected ways.

(b) **Try `@vitejs/plugin-react-oxc`** (the Rolldown-native variant from `@vitejs/plugin-react-oxc` package). Vitest config warning at run time recommends this swap for Vite 7+ projects.

(c) **Wrap test assertions in `waitFor`**. If timing is the only issue, `waitFor(() => expect(button).toBeDisabled())` would unblock, but it defeats the test intent (verifying SYNCHRONOUS state visibility post-click).

(d) **Bisect React 19 versions**. Try react@19.0.0, 19.2.0+. The `19.1.1` pin may have a regression specific to act/concurrent rendering.

(e) **Re-add `getViteConfig` for THIS file only via separate vitest project config**. Unclear if vitest supports per-file config overrides; investigate.

#### Phase 2 — Apply working fix

- Remove the `describe.skipIf(SPEC_131_PENDING)` wrapper from PlanPurchaseButton.test.tsx.
- Verify all 23 tests pass.
- Run full suite to ensure no regression elsewhere.

#### Phase 3 — Land

- PR to staging.
- Remove SPEC-131 from the indices' draft list, mark completed.

---

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-131-01 | Instrument handleClick + capture precise failure mode | 0 | pending |
| T-131-02 | Try `pool: threads` | 1 | pending |
| T-131-03 | Try `@vitejs/plugin-react-oxc` swap | 1 | pending |
| T-131-04 | Bisect React 19 patches if (02) and (03) fail | 1 | pending |
| T-131-05 | Apply working fix + remove skipIf | 2 | pending |
| T-131-06 | PR to staging | 3 | pending |

---

### 6. Acceptance Criteria

- [ ] All 23 tests in `apps/web/test/components/billing/PlanPurchaseButton.test.tsx` pass without the `skipIf(SPEC_131_PENDING)` wrapper.
- [ ] No regression in the other ~2400 web tests.
- [ ] No new pnpm.overrides or test-config hacks introduced (or: they ARE introduced but documented with comments + this spec link).
- [ ] PR merged to staging.

---

### 7. Risks

| Risk | Mitigation |
|---|---|
| Fix requires bumping React 19 → newer minor with potential breakage elsewhere | Bisect carefully; verify other React island tests still pass before adopting |
| pool: threads breaks tests that rely on isolated globals | Run full suite; revert if so |
| `@vitejs/plugin-react-oxc` has its own quirks (it's young) | Compare both options, pick the less invasive |

---

## Part 2 — Implementation Notes

### Source

Surfaced during SPEC-111 T-111-04 (post-bump test validation). The Astro 6 bump introduced 45+ test failures (all "Invalid hook call"). SPEC-111 workaround (pnpm.overrides plugin-react@4 + bypass `getViteConfig` + Astro virtual stubs) fixed 32 of those. The remaining 13 (this spec) are all in PlanPurchaseButton and are async-state-related, not Invalid hook call.

### Workaround in place

The 13 failing tests are wrapped in `describe.skipIf(SPEC_131_PENDING)` in `apps/web/test/components/billing/PlanPurchaseButton.test.tsx`. The `SPEC_131_PENDING` constant defaults to `true`. Setting it to `false` (manually) enables the tests for the fix work.

### Where to start

1. Read `spec/spec-111-astro-server-islands-fix/test-workaround` in engram for full bump context.
2. Read `apps/web/vitest.config.ts` — note the bypass of `getViteConfig`.
3. Read `apps/web/src/components/billing/PlanPurchaseButton.client.tsx` lines 184-238 — the `handleClick` async function.
4. Toggle `SPEC_131_PENDING` to false, re-run the test, observe failures.
