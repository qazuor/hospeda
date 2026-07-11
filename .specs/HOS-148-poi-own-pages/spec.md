---
title: Own Pages for Featured POIs
linear: HOS-148
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
---

# Own Pages for Featured POIs

## 1. Summary

Render a dedicated, SSR, SEO-optimized page for individual points of interest, but only for the subset flagged as featured via the admin-editable `hasOwnPage` boolean — not for the full catalog.

## 2. Problem

Some POIs (landmarks, standout attractions) deserve their own indexable page with rich content, JSON-LD, and breadcrumbs. But with ~914 POIs total and most of them thin (one-liner descriptions, no coordinates, unverified), giving every POI its own page would flood the site with low-value pages and hurt SEO — a documented risk (HOS-117).

## 3. Goals

- G-1: Render an own page only for POIs with `hasOwnPage = true` (admin-toggled, HOS-144).
- G-2: Include SSR, JSON-LD structured data, and breadcrumbs consistent with the rest of the site's SEO/AEO conventions.
- G-3: Start conservatively — only HIGH-priority + `verified` + rich-description POIs should be eligible/indexed at launch.

## 4. Non-goals

- NG-1: No own page for unverified, low-priority, or coordinate-less POIs at launch, even if manually flagged — the initial eligible set is curated deliberately narrow.
- NG-2: No bulk auto-generation of pages for all 914 POIs.
- NG-3: No editorial/CMS-style rich content blocks beyond the existing multilang name/description/address/keywords fields (no new content model in this spec).

## 5. Current baseline

`hasOwnPage` is a new boolean column on `points_of_interest` (HOS-142's model v2), defaulting to `false`, editable from the admin UI (HOS-144). POIs currently have no dedicated detail page on web — they only appear embedded in destination-page sections. The site's existing SEO/AEO infrastructure (JSON-LD, robots, sitemap, hreflang, SSR, `llms.txt`) is already mature per HOS-117's audit; the risk here is content thinness, not missing plumbing. HOS-117 explicitly names this feature's thin-content risk: ~900 largely thin POIs could sink SEO if indexed indiscriminately.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 3).
- Eligibility gate for indexing (noindex vs full index) likely layered on top of `hasOwnPage`, not replacing it — e.g. `hasOwnPage AND verified AND priority = HIGH` for the indexable subset at launch, expandable later.

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 3).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 3).
- 404/redirect behavior needed for a POI that has `hasOwnPage` toggled off after having been indexed.

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 3).

## 10. Risks

> TODO: detailed at implementation time (Phase 3).
- R-1 (carried from HOS-117): indiscriminate indexing of thin/unverified POI pages could dilute site-wide SEO quality. Mitigation direction: HIGH + verified + rich-description gate at launch, not full `hasOwnPage` set.

## 11. Open questions

- OQ-1: Is `hasOwnPage` alone the page-exists gate, with a separate index/noindex gate for search-engine visibility, or is eligibility computed as one combined condition?
- OQ-2: What counts as "rich description" quantitatively (character/word threshold) for the launch eligibility gate?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 3).

## 13. Linear

Canonical tracking:
HOS-148

Depends on: HOS-142 (POI catalog import/seed, including `hasOwnPage` column), HOS-144 (admin UI to toggle `hasOwnPage`). Related risk: HOS-117 (SEO/AEO thin-content hardening).
