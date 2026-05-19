---
spec-id: SPEC-135
title: Admin Mobile Responsive Remediation
type: feature
complexity: high
status: draft
created: 2026-05-16T01:30:00Z
effort_estimate_hours: 12-20
tags: [admin, responsive, mobile, ux]
parent: SPEC-134
priority: high (contains the only BLOCKER from the audit)
findings_addressed: [F-020, F-021, F-023, F-030]
findings_doc: ../SPEC-134-admin-audit-remediation/audit-baseline/findings.md
---

# SPEC-135: Admin Mobile Responsive Remediation

## 1. Overview

Fix the four mobile-responsive findings from SPEC-131. F-020 is a BLOCKER — every CREATE/EDIT page in the admin (~30 pages) is currently unusable on mobile because the shared FormShell renders sidebar + form as fixed-width side-by-side columns at all viewports.

## 2. Findings in scope

Refer to `../SPEC-134-admin-audit-remediation/audit-baseline/findings.md` for the full reproduce/evidence/suggested-fix detail of each. Summary:

| Finding | Severity | Affected | Cluster |
|---|---|---|---|
| F-020 | BLOCKER | ~30 CREATE+EDIT pages (FormShell) | Cluster 1 |
| F-021 | high | ~30 LIST pages (DataTable) | Cluster 2 |
| F-023 | high | Sub-tab pages (amenities, reviews, pricing, etc.) | standalone |
| F-030 | medium | `/access/users` mobile | Cluster 2 (subset) |

## 3. Implementation approach

### F-020 — FormShell mobile breakpoint (CRITICAL)

- Locate the FormShell layout component (likely `apps/admin/src/components/forms/FormShell.tsx` or similar; verify before touching).
- Change the grid from fixed two-column to: `grid-cols-1 lg:grid-cols-[280px_1fr]` (or equivalent Tailwind class).
- Below the `lg` breakpoint, sidebar becomes either: (a) a top accordion `<details>`, or (b) a horizontal scroll-tabs row showing section progress, or (c) hidden entirely (with the section navigation accessed via a "Pasos" button on mobile).
- Form fields take full width below `lg`.

**Recommended:** Option (a) accordion — keeps section navigation discoverable, doesn't require new UI patterns.

### F-021 — DataTable mobile column degradation

- Locate the shared DataTable component (likely `apps/admin/src/components/DataTable*` or `@/components/entity-list/DataTable`).
- Mobile breakpoint behavior options:
  - (1) Auto-toggle to the existing `Cuadrícula` (card grid) view that some entities already have.
  - (2) Add `overflow-x-auto` wrapper with sticky first column + visible scroll affordance (right-edge gradient shadow).
  - (3) Build a true "stacked card" mobile variant per entity.
- Truncated cells (badge text, etc.) should use ellipsis + tooltip with full text on tap-hold (mobile) or hover (desktop).

**Recommended:** Option (1) where the entity already has a card view defined; option (2) elsewhere as the universal fallback.

### F-023 — Sub-tab pages render entity context

- Locate the shared entity-sub-page layout (likely `EntityTabsLayout` or `EntityPageBase` from `apps/admin/src/components/entity-pages/`).
- Ensure breadcrumb + entity-name h1 render on ALL tabs, not only General/Edit. Likely a wrapper component is conditionally rendering the header only on certain routes — make it always render.

### F-030 — Users list mobile column priority

- In `apps/admin/src/features/access/config/users.columns.ts` (or wherever the users DataTable columns are defined), tag `nombreVisible` as `mobile: 'hidden'` and promote `email` + `rol` to `mobile: 'visible'`.
- This is a one-config-file change, no shared component impact.

## 4. Acceptance criteria

- [ ] Open `/accommodations/new` at 375×667 — single column, no overlap, every input clickable + readable
- [ ] Open `/accommodations/$id/edit` at 375×667 — same
- [ ] Same verification on `/destinations/new`, `/posts/new`, `/events/new`, `/access/users/new`, `/events/locations/new`, `/events/organizers/new`, `/content/accommodation-amenities/new` (sample 8 of the ~30 affected pages)
- [ ] Open `/accommodations` LIST at 375×667 — either card view OR table with horizontal scroll showing all columns (no silent column hiding)
- [ ] Same on `/access/users`, `/destinations`, `/events`, `/posts`, `/billing/plans`
- [ ] Open `/accommodations/$id/amenities` (or any entity sub-tab) — breadcrumb shows full path including entity name; h1 shows entity name + section
- [ ] `/access/users` at 375×667 shows distinct columns (not 2 identical name columns); email + role are visible
- [ ] Re-run audit script (see SPEC-134 §5) — F-020, F-021, F-023, F-030 no longer flagged

## 5. Out of scope

- F-022 (gallery routing) — handled in SPEC-137
- Other a11y findings on the same components (F-014 color-contrast on DataTable headers) — handled in SPEC-136
- Tablet (768px) viewport — original audit cut tablet from scope; if tablet behavior turns out broken too, file a follow-up

## 6. Risks

- DataTable changes can regress desktop layout if breakpoints are wrong. Smoke-check at 1280px after each PR.
- FormShell touch affects MANY pages. Test the full CREATE flow on 2-3 entities, not just the layout.
- Mobile tap-hover tooltips need touch-aware implementation (not just CSS `:hover`).
