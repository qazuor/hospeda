# SPEC-091 Progress: MVP Blockers — Host Onboarding + Subscription Checkout

**Status**: pending (not started)
**Created**: 2026-04-21
**Re-atomized**: 2026-04-21
**Total tasks**: 25 (re-atomized from 15; all complexity <= 2.5)
**Completed**: 0 / 25

---

## Task Summary

| ID | Title | Phase | Feature | Status | Complexity |
|----|-------|-------|---------|--------|------------|
| T-001 | Add i18n keys for host onboarding namespace | setup | F1 | pending | 2 |
| T-002 | Add i18n keys for checkout result pages | setup | F2 | pending | 1 |
| T-003 | Implement HOST role auto-assignment hook logic | core | F1 | pending | 2 |
| T-004 | Write unit tests for HOST role auto-assignment hook | core | F1 | pending | 1.5 |
| T-005 | Create useAutosave hook | core | F1 | pending | 2.5 |
| T-006 | Create usePropertyForm hook | core | F1 | pending | 2 |
| T-007 | Create AccommodationImageUploader upload logic | core | F1 | pending | 2 |
| T-008 | Complete AccommodationImageUploader UI and tests | core | F1 | pending | 2 |
| T-009 | Create PropertyFormSection and PropertyForm shell (sections 1-4) | integration | F1 | pending | 2.5 |
| T-010 | Complete PropertyForm sections 5-8 and publish logic with tests | integration | F1 | pending | 2.5 |
| T-011 | Create /publicar landing page (SSG) | integration | F1 | pending | 1.5 |
| T-012 | Create /publicar/nueva SSR page | integration | F1 | pending | 2 |
| T-013 | Create PropertyCard component | integration | F1 | pending | 1.5 |
| T-014 | Create /mi-cuenta/propiedades listing page | integration | F1 | pending | 2 |
| T-015 | Create /mi-cuenta/propiedades/[id]/editar page | integration | F1 | pending | 2 |
| T-016 | Create PlanPurchaseButton.client.tsx island | integration | F2 | pending | 2 |
| T-017 | Write unit tests for PlanPurchaseButton | integration | F2 | pending | 1.5 |
| T-018 | Create checkout/success and checkout/pending pages | integration | F2 | pending | 2 |
| T-019 | Create checkout/failure page | integration | F2 | pending | 2 |
| T-020 | Wire PlanPurchaseButton into pricing page | integration | F2 | pending | 2 |
| T-021 | Write PropertyForm component tests (integration validation) | testing | F1 | pending | 2 |
| T-022 | Write host onboarding E2E tests | testing | F1 | pending | 2.5 |
| T-023 | Write checkout API integration tests | testing | F2 | pending | 2 |
| T-024 | Write checkout result page tests | testing | F2 | pending | 1.5 |
| T-025 | Write checkout smoke test runbook | testing | F2 | pending | 1 |

---

## Parallel Tracks

```
Track A — Feature 1 Backend (critical path start):
  T-001 → T-003 → T-004
  T-001 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-012 → T-022
                                                   → T-011 → T-022
                                                   → T-013 → T-014 → T-022
                                                   → T-015 → T-022
                                                   → T-021 → T-022

Track B — Feature 2 Frontend (parallel to Track A):
  T-002 → T-016 → T-017 → T-023 → T-024 → T-025
       → T-016 → T-020 → T-023
       → T-018 → T-023
       → T-019 → T-023

Merge point: none — the two features ship together but their tasks are independent
```

## Critical Path

**Feature 1 (longest chain — 10 tasks)**:

```
T-001 (2) → T-005 (2.5) → T-006 (2) → T-007 (2) → T-008 (2) → T-009 (2.5) → T-010 (2.5) → T-014+T-015 merge → T-022 (2.5)
```

Full sequential path via T-014:
```
T-001 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-013 → T-014 → T-015 → T-022
```
Total sequential complexity: **23** (11 tasks)

**Feature 2 (longest chain — 6 tasks)**:

```
T-002 (1) → T-016 (2) → T-017 (1.5) → T-023 (2) → T-024 (1.5) → T-025 (1)
```
Total sequential complexity: **9**

Feature 1 is the critical path for the entire spec.

---

## Re-atomization Summary (2026-04-21)

Original 15 tasks → 25 tasks. Tasks split:

| Original | Split Into | Reason |
|----------|-----------|--------|
| T-003 (c=3) | T-003 (c=2) + T-004 (c=1.5) | Implementation separated from tests |
| T-004 (c=4) | T-005 (c=2.5) + T-006 (c=2) | useAutosave hook separated from usePropertyForm hook |
| T-005 (c=3) | T-007 (c=2) + T-008 (c=2) | Upload logic separated from UI/tests |
| T-006 (c=4) | T-009 (c=2.5) + T-010 (c=2.5) | PropertyFormSection + sections 1-4 vs sections 5-8 + publish |
| T-007 (c=3) | T-011 (c=1.5) + T-012 (c=2) | /publicar SSG landing vs /publicar/nueva SSR page |
| T-008 (c=3) | T-013 (c=1.5) + T-014 (c=2) | PropertyCard component vs listing page |
| T-010 (c=3) | T-016 (c=2) + T-017 (c=1.5) | Component logic/UI separated from unit tests |
| T-014 (c=4) | T-021 (c=2) + T-022 (c=2.5) | Component integration tests vs E2E tests |
| T-015 (c=3) | T-023 (c=2) + T-024 (c=1.5) + T-025 (c=1) | API integration tests + result page tests + runbook |

Tasks kept as-is (complexity already <= 2.5):
- T-001 (c=2), T-002 (c=1), T-009-original→T-015 (c=2), T-011 (c=2), T-012 (c=2), T-013 (c=2)

**Max complexity in final set: 2.5** (T-005, T-009, T-010, T-022)

---

## Suggested Execution Order (first 5 tasks)

Start these in parallel on day 1:

1. **T-001** — i18n keys for host onboarding (unblocks all F1 tasks; ~1h)
2. **T-002** — i18n keys for checkout (unblocks all F2 tasks; ~30min)

Then immediately in parallel:

3. **T-003** — HOST role auto-assignment hook logic (backend, parallel to T-005)
4. **T-005** — `useAutosave` hook (critical path; start immediately after T-001)

Once T-003 done:

5. **T-004** — HOST role assignment unit tests

Once T-005 done:

6. **T-006** — `usePropertyForm` hook

While T-006 is in progress, also start:

7. **T-016** — `PlanPurchaseButton.client.tsx` (Feature 2, parallel to T-006)

---

## Discovery Notes

- No Cloudinary upload island exists in `apps/web/src/components/`. `AvatarUpload.client.tsx` in `account/` is the closest reference pattern. T-007/T-008 create the new uploader from scratch.
- The `_afterCreate` hook in `AccommodationService` already exists but does NOT assign HOST role. T-003 must add role assignment to `_afterUpdate` (triggered on PUBLISHED transition), not `_afterCreate`.
- No `/mi-cuenta/propiedades` page exists yet (only `editar/`, `favoritos/`, `resenas/`, `suscripcion/` sub-pages exist).
- `/publicar` and `/publicar/nueva` pages do not exist.
- Checkout result pages (`success`, `pending`, `failure`) under `/suscriptores/checkout/` do not exist.
- Webhook handler: per spec preamble, already verified complete — no tasks needed.
- Checkout endpoint: per spec preamble, already verified at `POST /checkout` registered in `apps/api/src/routes/billing/index.ts:115` — verify exact protected path before implementing T-016.

---

## Phase Distribution

| Phase | Tasks | Feature |
|-------|-------|---------|
| setup | T-001, T-002 | F1, F2 |
| core | T-003, T-004, T-005, T-006, T-007, T-008 | F1 |
| integration | T-009, T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-017, T-018, T-019, T-020 | F1, F2 |
| testing | T-021, T-022, T-023, T-024, T-025 | F1, F2 |
