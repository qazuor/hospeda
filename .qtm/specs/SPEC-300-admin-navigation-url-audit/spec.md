---
specId: SPEC-300
title: Admin Navigation & URL Coverage Audit
type: chore
complexity: medium
status: draft
created: 2026-06-27
tags: [admin, navigation, ux, audit, routing]
---

# SPEC-300 — Admin Navigation & URL Coverage Audit

> Verify every registered admin route is reachable from some UI link; add the missing
> ones, remove or retire dead routes, and reorganize menus/sidebars into a coherent IA.

## 1. Summary

The admin panel (`apps/admin`, TanStack Start) has grown route-by-route across many specs.
Navigation config lives in a well-structured single source of truth — 12 sidebar objects in
`apps/admin/src/config/ia/sidebars.ts` and 11 section objects in
`apps/admin/src/config/ia/sections.ts` — but the sidebar config and the actual file-based
route tree have never been cross-validated as a set. Preliminary enumeration (see section 4)
already surfaced several whole route groups with zero sidebar coverage. This spec delivers
a verified coverage matrix, fills confirmed gaps, prunes dead entries, and produces a
reorganized sidebar/section IA.

Goals stated here are **provisional**. The first deliverable is the complete audit matrix;
additions/removals/reordering decisions follow from what it reveals.

## 2. Background

### 2.1 Route system

TanStack Router uses file-based routing under `apps/admin/src/routes/`. The authenticated
subtree lives entirely under `_authed/`. Enumeration of that subtree (excluding
`-components/`, `__tests__/`, and `.lazy.` duplicates) yields **~167 route files** across
roughly **20 top-level path segments**: `accommodations`, `access`, `account`, `ai`,
`analytics`, `billing`, `comments`, `content`, `conversations`, `destinations`, `events`,
`experiences`, `gastronomies`, `me`, `newsletter`, `partners`, `platform`, `posts`,
`social`, `sponsor`, `sponsors`, `tags`, and more.

### 2.2 Navigation source of truth

Navigation is driven by two files that together form the IA config:

- `apps/admin/src/config/ia/sidebars.ts` — 12 sidebar objects (`inicioSidebar`,
  `catalogoSidebar`, `editorialSidebar`, `marketingSidebar`, `comunidadSidebar`,
  `comercialSidebar`, `plataformaSidebar`, `analisisSidebar`, `miCuentaSidebar`,
  `misAlojamientosSidebar`, `consultasSidebar`, `miFacturacionSidebar`). Each item
  is a typed `link | group | separator` with `route`, `permissions`, and optional
  `onMissing: 'hide'` gate.
- `apps/admin/src/config/ia/sections.ts` — 11 section objects that map a top-level nav
  entry to a `defaultRoute` and a `sidebar` reference.

Supporting files: `apps/admin/src/lib/nav/permission-visibility.ts` (permission filter),
`apps/admin/src/hooks/use-visible-sidebar-items.ts` (render-time visibility), and
`apps/admin/src/lib/breadcrumb-labels.ts` (breadcrumb text by route).

### 2.3 Known gaps (pre-audit sample)

A quick cross-check of the route tree against sidebar `link.route` values already reveals
these uncovered route groups — none of them are detail/edit pages that are legitimately
deep-link-only:

| Route prefix | Status in sidebars | Note |
|--------------|--------------------|------|
| `/comments` | Not linked anywhere | Index + detail routes exist |
| `/billing/addon-catalog` | Not linked | `/billing/addons` IS linked; catalog is separate |
| `/ai/usage` | Not linked | 4 AI routes are linked; usage is missing |
| `/platform/feature-flags/` | Not linked | Full CRUD section exists (4 routes) |
| `/sponsor/` | Not linked | 4 routes: index, analytics, invoices, sponsorships |

Additionally, `/platform/ops/webhooks` appears in **both** `comercialSidebar` (under
"Billing ops") and `plataformaSidebar` (implicitly — listed in `plataformaSidebar` items).
This duplication warrants a placement decision.

Detail pages (`$id.tsx`), edit pages (`$id_.edit.tsx`), and sub-tab pages
(`$id_.something.tsx`) are expected to have no direct sidebar link and are reachable via
the entity list or the entity view page. They are **not** gaps.

## 3. Goals (provisional — refined after audit matrix)

- **G-1** Produce a complete **route-vs-nav coverage matrix**: every `_authed/` route file
  mapped to its reachability path (sidebar link / parent entity view / breadcrumb only /
  unreachable) and its permission gates.
- **G-2** Add sidebar links for every confirmed-missing navigable route (those that are
  list/dashboard/tool pages, not detail/edit sub-tabs).
- **G-3** Remove or retire sidebar entries that point at non-existent or permanently
  dead routes.
- **G-4** Resolve the `/platform/ops/webhooks` duplication; assign it to exactly one
  section.
- **G-5** Reorganize sidebar groups and section order into a coherent IA that matches the
  current product surface (OQ-2 gates the specific grouping).
- **G-6** Optionally: add a CI assertion that every navigable list/tool route has at least
  one sidebar link, so the gap cannot silently regrow (OQ-3 gates this).

## 4. Non-Goals

- Changes to route file structure (adding or removing route files). This spec only
  touches nav config and UI link surface.
- Redesigning page content, layouts, or component internals.
- Changing permission assignments on routes — only sidebar permission gates (which mirror
  the route's own guards).
- Building new admin features — gaps discovered may spawn separate specs; this spec only
  adds links to existing pages.

## 5. First Steps — Discovery Plan

Implementation starts with the audit, not with fixes. **Phase 1 is read-only.**

### 5.1 Build the coverage matrix (Task 1 — the audit itself)

For every `.tsx` route file under `apps/admin/src/routes/_authed/` (excluding
`-components/`, `__tests__/`, `.lazy.`):

1. Derive the URL it resolves to (file path → TanStack Router URL pattern).
2. Classify it: `index` / `detail` / `edit` / `sub-tab` / `standalone`.
3. Search all 12 sidebar objects for a `link.route` matching that URL.
4. If no direct link: check whether the route is reachable via a parent detail page
   (e.g. `/accommodations/$id/gallery` is reachable from `/accommodations/$id`).
5. If still unreachable: flag as a **gap candidate**.
6. Record the permission(s) that gate the route (from the sidebar entry or the
   route's own `beforeLoad` guard).

Output: a markdown table (route | type | nav-linked-by | permission | reachable) committed
to `.qtm/specs/SPEC-300-admin-navigation-url-audit/audit-matrix.md`. This table is the
Phase 1 deliverable and the input for all subsequent decisions.

### 5.2 Gap triage (Task 2 — after matrix)

For each gap candidate: decide whether it needs a new sidebar link, a breadcrumb-only path
from a parent, or should be marked "intentionally unreachable" (e.g. dev tools). Owner
sign-off required before any sidebar changes are made.

### 5.3 IA reorganization proposal (Task 3 — concurrent or after triage)

Propose a revised sidebar structure: group order within each sidebar, section order in the
top nav, and whether any routes belong in a different section than they currently live in.
Produce a proposal document for owner review before implementing.

### 5.4 Implementation (Task 4)

- Edit `apps/admin/src/config/ia/sidebars.ts` and/or `sections.ts` for confirmed additions,
  removals, and reorderings approved in Task 3.
- Update `apps/admin/src/lib/breadcrumb-labels.ts` if new route labels are needed.
- If OQ-3 resolves to YES: add a Vitest test (e.g. in
  `apps/admin/src/config/ia/__tests__/nav-coverage.test.ts`) that reads the route tree and
  asserts every non-detail route has at least one sidebar link.

## 6. Technical Constraints

- **File-based routing**: route structure is derived from file paths; do NOT move or rename
  route files as part of this spec.
- **Single config source**: ALL nav changes go through `sidebars.ts` / `sections.ts`. No
  hardcoded `<Link>` entries scattered in layout components.
- **Permission parity**: a sidebar link's `permissions` must match the permission(s) already
  gating the target route's `beforeLoad`. No new permissions are introduced here.
- **English URLs**: all admin URL slugs are English (convention established in project
  memory). No Spanish URL paths.
- **No redirect shims**: do not add redirect routes as a workaround for IA changes
  (project rule: no redirect shims pre-beta).
- **`onMissing: 'hide'`**: SUPER_ADMIN-only items must use this flag so they disappear
  completely for lower roles rather than rendering disabled.

## 7. Risks

- **R-1** The matrix may surface more gaps than the pre-audit sample suggests. If the
  gap count is large, Phase 1 becomes a significant task in itself and the IA
  reorganization may need to be deferred to a follow-up spec.
- **R-2** Some routes may have been intentionally left unlisted (e.g. the `/sponsor/`
  section may be a HOST-facing self-service section that was built but not yet surfaced —
  surfacing it prematurely could expose incomplete features).
- **R-3** Reorganizing section/sidebar order may invalidate existing onboarding tour
  steps defined in `apps/admin/src/config/ia/tours.ts`. The tour config must be audited
  alongside the nav config.
- **R-4** A CI nav-coverage test (OQ-3) requires a stable mapping from file path to URL,
  which TanStack Router generates in `routeTree.gen.ts`. If the generator format changes,
  the test breaks. A simpler approach (parse route filenames directly) may be more durable.

## 8. Open Questions

- **OQ-1** — The `/sponsor/` routes (4 files: index, analytics, invoices, sponsorships)
  appear to be a self-service sponsor dashboard, distinct from the `/sponsors/` admin CRUD.
  Are these routes intended to be surfaced now, or held until a sponsor self-serve feature
  is formally spec'd? **Owner decision needed before Task 2.**
- **OQ-2** — Desired IA grouping for reorganization: should the 11 sections stay as-is
  and only their sidebar contents change, or is a section-level restructure on the table
  too (e.g. merging `editorial` + `marketing`, splitting `plataforma`)? **Owner input
  needed before Task 3.**
- **OQ-3** — Should a Vitest test assert nav coverage so the gap cannot silently regrow?
  If YES, the test must tolerate legitimate "no direct link" routes (detail, edit, sub-tab).
  A pragmatic approach: maintain an explicit allowlist of "intentionally unlisted" routes
  in the test file. **Decision: add the test (recommended) or skip it?**
- **OQ-4** — `/platform/ops/webhooks` duplication: keep it in `comercialSidebar` (it is
  a billing-ops tool), in `plataformaSidebar` (it is an infrastructure ops tool), or in
  both (intentional cross-listing)? **Owner decision needed.**
- **OQ-5** — The `comments` route group (`/comments`, `/comments/$commentId`) has no
  sidebar entry. Comments exist as a feature (SPEC-165). Should comments moderation get
  its own entry in `comunidadSidebar` or in a new moderation group in `catalogoSidebar`?
- **OQ-6** — `apps/admin/src/routes/dev/icon-comparison.tsx` is a dev-only tool with no
  sidebar link. Should it remain reachable only by direct URL, or be removed entirely?

## 9. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-300). Discovery-first approach: Phase 1
  delivers the audit matrix before any nav changes are made. Pre-audit enumeration
  identified 5 confirmed gap candidates (`/comments`, `/billing/addon-catalog`,
  `/ai/usage`, `/platform/feature-flags/`, `/sponsor/`) and one duplication
  (`/platform/ops/webhooks`). Six open questions deferred to owner/tech-analysis;
  OQ-1 (sponsor routes) and OQ-2 (section restructure scope) are the blockers before
  Tasks 2 and 3 can start.
