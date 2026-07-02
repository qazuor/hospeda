---
title: Fix remaining A11y Sweep baseline debt (light-mode color-contrast + heading-order)
linear: HOS-63
statusSource: linear
created: 2026-07-02
type: bugfix
areas:
  - web
---

# Fix remaining A11y Sweep baseline debt (light-mode color-contrast + heading-order)

## Overview

Follow-up of HOS-3 (ex SPEC-308). After the 2026-07-02 baseline shrink (PR #1999),
`apps/web/scripts/a11y-sweep/a11y-baseline.json` still carries 27 accepted
rule-instances across 2 rule categories. HOS-3 closed with this debt explicitly
deferred (accepted/baselined, not fixed) rather than blocking that spec's
closeout — this spec owns clearing the rest of the baseline.

## Current state (captured 2026-07-02, run 28576640568)

| Rule | Impact | Instances | Pattern |
|---|---|---|---|
| `color-contrast` | serious | 19 | **Light mode only** (0 dark-mode hits) — near-uniform across almost every route (Home, all List pages, all Detail pages, About/FAQ/Contact/Pricing, EN/PT homes). Strongly suggests ONE shared light-mode token or component, not per-page markup. |
| `heading-order` | moderate | 8 | Both light + dark, scoped to exactly 4 templates: Destinations List/Detail, Accommodation Detail, Post Detail. |

Full per-page/theme breakdown is in the committed `apps/web/scripts/a11y-sweep/a11y-baseline.json`.

## Scope

| # | Change | Notes |
|---|--------|-------|
| A | Find and fix the shared light-mode token/component causing the 19 `color-contrast` hits | Audit `packages/design-tokens` light theme text/surface pairs first (mirrors how the HOS-3 dark-mode fix found its root cause) before touching per-page markup. |
| B | Fix `heading-order` in the 4 affected templates | Destinations List/Detail, Accommodation Detail, Post Detail — likely a skipped heading level in a shared card/section layout reused by these 4. |
| C | Re-run the sweep + shrink the baseline after each batch | Use a real `workflow_dispatch` run with `update_baseline=true`, not local seeding — HOS-3 found local worktree seeding unreliable due to intermittent Cloudinary upload failures for detail-route example data. Baseline must only ever shrink. |

**Goal**: baseline reaches empty (0 rule-instances, all pages/themes `[]`).

## Out of scope

- The A11y Sweep workflow/gate mechanism itself (HOS-3/SPEC-294, already shipped).
- Any new baseline debt introduced by unrelated specs after this issue is scoped — track separately if found.

## Tasks (to be atomized at implementation time)

| Task | Title |
|---|---|
| T-1 | Diagnose and fix the shared light-mode `color-contrast` source (A) |
| T-2 | Fix `heading-order` in the 4 affected templates (B) |
| T-3 | Re-run sweep via CI dispatch, shrink baseline, verify it reaches empty (C) |

## Related specs / issues

- Follows HOS-3 (ex SPEC-308, Done, PR #1956 + #1999)
- Follows SPEC-294 (A11y Sweep CI repair, shipped, PR #1914)
