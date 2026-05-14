# SPEC-106: Docs CI Baseline Cleanup — Task Progress Dashboard

**Spec status:** in-progress
**Started:** 2026-05-14
**Branch:** `spec/SPEC-106-docs-broken-links-cleanup` (based off `origin/staging`)
**Total tasks:** 14
**Completed:** 5 / 14
**Broken links remaining:** 188 (was 365 at start; -66 web, -44 admin, -36 service-core, -31 api)

---

## Baseline (snapshot 2026-05-14)

- **365 broken internal links** (originally 299 on 2026-05-13; pre-launch beta tester docs added 66 in `apps/web/src/content/beta/`).
- **2 broken Documentation CI jobs:** Check Internal Links + Validate TypeScript Examples (hang).

---

## Execution Order

Ordered for risk-management first, then visible-progress.

| Step | Task | Phase | Why this order |
|-----:|------|-------|----------------|
| 1 | T-106-12 | phase0_technical_risk | The only task with unknown fix shape. Land first so the rest of the batches can drive Documentation CI fully green incrementally. |
| 2 | T-106-00 | phase1_link_cleanup | Largest batch (66, beta docs). NEW — not in original snapshot. Likely a single-pattern bulk fix (Astro route paths). |
| 3 | T-106-01 | phase1_link_cleanup | apps/admin/ (44). |
| 4 | T-106-02 | phase1_link_cleanup | packages/service-core/ (36). |
| 5 | T-106-03 | phase1_link_cleanup | apps/api/ (31). |
| 6 | T-106-04 | phase1_link_cleanup | packages/db/ (27). |
| 7 | T-106-05 | phase1_link_cleanup | docs/deployment/ (26). |
| 8 | T-106-06 | phase1_link_cleanup | packages/logger/ (19). |
| 9 | T-106-07 | phase1_link_cleanup | packages/schemas/ (15). |
| 10 | T-106-08 | phase1_link_cleanup | docs/runbooks/ (14). |
| 11 | T-106-09 | phase1_link_cleanup | packages/icons/ (13). |
| 12 | T-106-10 | phase1_link_cleanup | seed (9) + i18n (7) + docs/guides (7) bundled (23). |
| 13 | T-106-11 | phase1_link_cleanup | tail (~50, ≈14 small dirs). |
| 14 | T-106-13 | phase2_gate | Final verification + flip spec to `completed`. |

---

## Status Dashboard

| ID | Title | Status | Complexity |
|----|-------|--------|-----------:|
| T-106-12 | Fix validate-examples.ts hang | **completed** | 3 |
| T-106-00 | apps/web beta content (66) | **completed** | 2 |
| T-106-01 | apps/admin (44) | **completed** | 2 |
| T-106-02 | packages/service-core (36) | **completed** | 2 |
| T-106-03 | apps/api (31) | **completed** | 2 |
| T-106-04 | packages/db (27) | pending | 2 |
| T-106-05 | docs/deployment (26) | pending | 2 |
| T-106-06 | packages/logger (19) | pending | 1 |
| T-106-07 | packages/schemas (15) | pending | 1 |
| T-106-08 | docs/runbooks (14) | pending | 1 |
| T-106-09 | packages/icons (13) | pending | 1 |
| T-106-10 | seed + i18n + docs/guides (23) | pending | 2 |
| T-106-11 | tail dirs (~50) | pending | 2 |
| T-106-13 | Documentation CI phase gate | pending | 1 |

---

## Notes

- Each link-fix batch lands as its own PR targeting `staging` (per repo workflow). Per-task acceptance: the targeted directory contributes **0 broken links** to the next `pnpm docs:check-links` run.
- T-106-00 (NEW) is suspected to be a single-pattern bulk fix: beta tester docs use `(beta/foo/bar)` relative paths that should resolve to Astro routes. Investigate Astro content-collection routing before fixing 66 links one by one.
- After T-106-12 lands, every subsequent batch PR will already have validate-examples green — only check-links remains red per-batch and trends down to zero.
