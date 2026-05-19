---
spec-id: SPEC-136
title: Admin A11y Compliance (WCAG 2.1 AA)
type: feature
complexity: high
status: draft
created: 2026-05-16T01:30:00Z
effort_estimate_hours: 10-16
tags: [admin, accessibility, wcag, a11y]
parent: SPEC-134
priority: high
findings_addressed: [F-003, F-004, F-011, F-013, F-014, F-015, F-016, F-017, F-018, F-019]
findings_doc: ../SPEC-134-admin-audit-remediation/audit-baseline/findings.md
---

# SPEC-136: Admin A11y Compliance (WCAG 2.1 AA)

## 1. Overview

The SPEC-131 audit's axe-core sweep ran across 105 pages and surfaced **13 unique a11y rules** violated, totalling 312 violations. Most violations trace back to ~6 shared components. This spec lands the fixes per cluster so the post-fix audit shows 0 critical + 0 serious violations.

## 2. Findings in scope (grouped by root cause)

Refer to `../SPEC-134-admin-audit-remediation/audit-baseline/findings.md` for full reproduce/evidence/fix-shape per finding.

### Cluster A — Root layout / head metadata (F-003 + F-013)

| Finding | Severity | Pages affected | Issue |
|---|---|---|---|
| F-003 | high | 105 | `<title>` element missing on every page |
| F-013 | medium | 105 | `<html lang="en">` hardcoded for ES-default app |

**Fix**: `apps/admin/src/routes/__root.tsx` — wire `<title>` via TanStack Start's `head` API with per-route overrides; set `<html lang>` from current locale.

### Cluster B — Tabs component (F-011)

| Finding | Severity | Pages affected | Issue |
|---|---|---|---|
| F-011 | critical (a11y) | 25 | `role="tablist"` + `role="tab"` parent-child relationship broken by intermediate wrapper |

**Fix**: Restructure the shared Tabs component so `role="tab"` items are direct children of the `role="tablist"` element. Move scroll-wrapper styling outside the tablist (the wrapper can have no role and wrap the tablist instead of vice-versa).

### Cluster C — DataTable sort header (F-014)

| Finding | Severity | Pages affected | Issue |
|---|---|---|---|
| F-014 | high | 54 | Sort-toggle button text color fails 4.5:1 WCAG AA contrast |

**Fix**: Bump the header button text color from `text-muted-foreground` (or whichever low-contrast token) to `text-foreground` in the DataTable header component.

### Cluster D — Form-control accessible names (F-015, F-016, F-017)

| Finding | Severity | Pages affected | Issue |
|---|---|---|---|
| F-015 | critical (a11y) | 2 | Radix combobox without aria-label |
| F-016 | critical (a11y) | 5 | Native `<select>` filter without label |
| F-017 | high | 22 | `role="progressbar"` element without aria-label |

**Fix**: Per-widget. Identify the 2 specific combobox use sites + the 5 filter `<select>` use sites + the progressbar component (likely shared) and add `aria-label` (i18n-ed). For the progressbar, prefer accepting it as a required prop on the component itself so future usages can't forget it.

### Cluster E — Heading hierarchy (F-018, F-019, F-004)

| Finding | Severity | Pages affected | Issue |
|---|---|---|---|
| F-018 | medium | 38 | Page has no `<h1>` element |
| F-019 | low | 20 | `<h1>` element exists but is empty |
| F-004 | medium | 4 | Heading levels skip (h1 → h3 without h2) |

**Fix**: Identify the entity-page header component used by VIEW/EDIT pages — it likely renders the entity name in a `<div>` with heading-like styling. Promote to `<h1>`. For empty h1: render only when data is loaded OR show a skeleton placeholder text. For heading-order on `/dashboard`: promote section headings (`Tráfico`, `Actividad reciente`) from h3 to h2.

## 3. Acceptance criteria

- [ ] axe-aggregate post-fix shows 0 critical impact violations across all 105 pages
- [ ] axe-aggregate post-fix shows 0 serious impact violations across all 105 pages (or documented exceptions for accepted noise)
- [ ] `document-title` rule passes on all pages (each has a unique title)
- [ ] `<html lang>` returns "es" by default, "en" / "pt" when user locale is set accordingly
- [ ] Manual screen-reader spot-check on 3 pages (`/dashboard`, `/access/users`, `/accommodations/$id`): page title, tablist navigation, and form filters announce correctly
- [ ] Tabs component: `aria-required-children` + `aria-required-parent` axe rules pass on `/access/users/$id`
- [ ] Re-run audit script (see SPEC-134 §5) — F-003, F-011, F-013, F-014, F-015, F-016, F-017, F-018 no longer flagged

## 4. Out of scope

- F-019 (empty h1) follow-up: if it turns out to be load-timing noise, document as accepted; if real, include in this spec
- Color contrast on icons / decorative elements (axe doesn't flag those at AA, but if visual audit raises them in re-run, file follow-up)
- Manual keyboard navigation pass — explicitly skipped from the audit per 2026-05-15 decision; can be re-added as SPEC-138 if needed
- **Badge / muted-text contrast follow-up (added 2026-05-16 during post-fix verification)**: the re-run sweep flagged 47 nodes across 8 pages with `color-contrast` failures on `bg-muted text-muted-foreground` badges (e.g. "Sistema", "Otro", "Tradiciones" tag types), `text-muted-foreground text-xs` form helpers ("0/4 campos completos"), and destructive-color buttons on muted-tinted backgrounds (`bg-destructive/5 text-destructive`). These are global design-token contrast issues, NOT the F-014 DataTable sort-header issue this spec targets, and changing them touches the shared design language. **Filed as follow-up** — recommend a dedicated SPEC for design-token contrast across `@repo/tailwind-config` so the change is auditable, applied uniformly, and reviewed by design before merge. The 47 nodes do not block SPEC-136 acceptance since they were present in the SPEC-131 baseline and are not in the named findings (F-003..F-019).

## 5. Risks

- TanStack Start head API may have quirks with SSR + route-tree generated routes. Verify titles appear on initial SSR response, not just after client hydration.
- Bumping sort-header text color may visually clash with the rest of the table — coordinate with SPEC-135 (which also touches DataTable for mobile).
- Promoting decorative divs to h1 can change screen-reader behavior in unexpected ways. Test with VoiceOver / NVDA on 2-3 pages before merging.
