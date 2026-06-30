---
spec-id: SPEC-308
title: Remediate the WCAG violations baselined by the A11y Sweep (SPEC-270 / SPEC-294 follow-up)
type: bugfix
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
model_fit: basic-to-medium
---

# SPEC-308 — Remediate the A11y Sweep baseline debt

> Follow-up of **SPEC-294** (which repaired the A11y Sweep CI workflow) and
> **SPEC-270** (web accessibility audit). When SPEC-294 got the sweep running
> green end-to-end for the first time, the axe-core pass surfaced **84 real WCAG
> violations** on the built public site (6 critical, 56 serious, plus
> moderate/minor). SPEC-294 deliberately did NOT fix them — it baselined them so
> the workflow gates on regressions — and escalated the debt here. This spec owns
> clearing that baseline.

## 1. Overview

### Goal

Drive the A11y Sweep baseline (`apps/web/scripts/a11y-sweep/a11y-baseline.json`)
toward **empty** by fixing the underlying WCAG violations on the built public
site, then shrinking the baseline accordingly so the sweep enforces a genuinely
clean bar.

### Context

The violations were captured by SPEC-294 on 2026-06-30 across 19 routes × 2
themes (light/dark). They are spread roughly evenly (~2 per page), which strongly
suggests they originate in **shared components** (header, footer, nav, cards,
theme toggle) rather than per-page markup — so a small number of component fixes
should clear a large share of the count.

## 2. Current violation inventory (axe-core, 2026-06-30)

Captured by the `a11y:sweep` run on the SPEC-294 branch (PR #1914). Counts are
rule-instances across all swept page+theme combinations:

| Rule | Impact | Count | Likely source |
|---|---|---|---|
| `color-contrast` | serious | 38 | Theme tokens / text-on-surface pairs, both light + dark |
| `heading-order` | moderate | 14 | Skipped heading levels in list/detail layouts |
| `aria-prohibited-attr` | serious | 10 | ARIA attribute on an element/role that disallows it |
| `nested-interactive` | serious | 8 | Interactive element nested inside another (e.g. button-in-link) |
| `aria-allowed-attr` | **critical** | 6 | ARIA attribute not allowed for the element's role |
| `empty-heading` | minor | 4 | Heading element with no accessible text |
| `aria-allowed-role` | minor | 4 | Role not allowed on the given element |

Total: **84** violations (6 critical, 56 serious, 14 moderate, 8 minor). The
authoritative per-page breakdown is the committed baseline file plus the
`a11y-sweep-report` artifact from a sweep run.

## 3. Scope

### A. Fix the violations, highest impact first

| # | Change | Notes |
|---|--------|-------|
| A1 | Fix the 6 **critical** `aria-allowed-attr` violations | Critical = highest priority; likely 1-2 shared components misusing an ARIA attribute. |
| A2 | Fix the serious cluster: `color-contrast` (38), `aria-prohibited-attr` (10), `nested-interactive` (8) | `color-contrast` is the bulk — audit the design-token text/surface pairs in both themes. `nested-interactive` is usually a single bad component pattern. |
| A3 | Fix the moderate/minor remainder: `heading-order` (14), `empty-heading` (4), `aria-allowed-role` (4) | Lower priority; can be a later slice. |

### B. Shrink the baseline as fixes land

| # | Change | Notes |
|---|--------|-------|
| B1 | After each batch of fixes, re-run the sweep (workflow_dispatch with `update_baseline`) and commit the shrunk `a11y-baseline.json` | The baseline must only ever shrink here; a growth is a regression and must be justified. |
| B2 | When the baseline reaches empty, consider promoting the A11y Sweep from advisory/baseline-gated to a hard required check (SPEC-294 B2) | Owner decision once the bar is clean. |

## 4. Out of scope

- The A11y Sweep **workflow** itself (triggers, env, baseline mechanism) — that
  is SPEC-294, already shipped.
- Admin-panel accessibility (the sweep targets the public web app only).
- New a11y features (skip links, reduced-motion, etc.) beyond fixing the
  flagged violations — track separately if desired.

## 5. User Stories

#### US-1 — Critical ARIA misuse is fixed (A1)

- **GIVEN** the 6 critical `aria-allowed-attr` violations
  **WHEN** the offending component(s) are corrected
  **THEN** a sweep run reports 0 critical violations and the baseline drops them.

#### US-2 — Contrast meets WCAG AA (A2)

- **GIVEN** the 38 `color-contrast` violations across both themes
  **WHEN** the design-token text/surface pairs are adjusted to ≥ 4.5:1 (or 3:1 for
  large text)
  **THEN** the sweep reports 0 `color-contrast` violations.

#### US-3 — The baseline only shrinks (B1)

- **GIVEN** a batch of a11y fixes
  **WHEN** the baseline is regenerated
  **THEN** it contains strictly fewer rule-instances than before, never more.

## 6. Tasks (to be atomized at implementation time)

| Task | Title | Fit |
|---|---|---|
| T-308-01 | A1: fix the 6 critical `aria-allowed-attr` violations | MEDIO |
| T-308-02 | A2: fix `color-contrast` (token audit, both themes) | MEDIO |
| T-308-03 | A2: fix `aria-prohibited-attr` + `nested-interactive` | MEDIO |
| T-308-04 | A3: fix `heading-order` + `empty-heading` + `aria-allowed-role` | BÁSICO |
| T-308-05 | B1: shrink the baseline after each batch; verify it only decreases | BÁSICO |
| T-308-06 | B2: decide on promoting the sweep to required once the baseline is empty | BÁSICO |

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `color-contrast` fixes change the visual design | Medium | Adjust tokens minimally to clear AA; involve the owner on any visible palette change. |
| A "fix" on one page re-breaks another via a shared component | Medium | The sweep is the guard — re-run after each batch; the baseline-shrink invariant catches regressions. |
| The 84 count is partly best-practice noise, not strict AA | Low | Triage per rule; the gate already keys on impact (critical/serious), not raw count. |

## 8. Notes

- Born from the SPEC-294 implementation (2026-06-30, PR #1914), which baselined
  the debt rather than fixing it (the CI-repair spec was explicitly scoped to the
  workflow, not the a11y fixes).
- The fastest path to a big count reduction is almost certainly the shared
  components — fix those first and re-measure before touching per-page markup.
