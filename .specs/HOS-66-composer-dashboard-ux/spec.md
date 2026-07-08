---
title: Social Posts — Composer + Dashboard UX
linear: HOS-66
statusSource: linear
created: 2026-07-02
type: feature
areas:
  - content
  - web
  - api
---

# Social Posts — Composer + Dashboard UX

> Sub-spec of [HOS-13](https://linear.app/hospeda-beta/issue/HOS-13) (Social Posts
> Module Overhaul), split "297c" per the discovery phase. See
> `.specs/HOS-13-social-posts-module-overhaul/spec.md` OQ-3/OQ-5/OQ-6/OQ-7/OQ-8 and
> G-4/G-5/G-7/G-8/G-9/G-10/G-11 for the full research + functional design that
> produced this scope.

## 1. Summary

The largest sub-spec: GPT batch draft creation UX, campaign/batch auto-detection,
dashboard analytics improvements, composer multi-select UI, an icon consistency
audit, a public-data enrichment endpoint, and a lightweight marketing hub landing
page unifying social + newsletter navigation.

## 2. Problem

- The GPT can only submit one draft per call with no way to associate a run of
  drafts with a named campaign/batch without manual admin follow-up.
- The dashboard lacks date-range filtering, per-platform breakdown, and thumbnails.
- The composer has no multi-platform selection affordance.
- Several social admin components use inline SVGs / direct phosphor imports
  instead of `@repo/icons`.
- There's no way to enrich a draft with live public Hospeda data.
- Social and newsletter have no shared entry point in the admin despite already
  being nav-grouped under one "Marketing" sidebar section (SPEC-254).

## 3. Goals

- **G-4 — Batch GPT draft creation.** Resolved design (HOS-13 OQ-5): chained
  single-draft `POST /api/v1/ai/social/drafts` calls, NOT a bulk array endpoint.
  The operator declares intent in the GPT conversation ("vamos a hacer un batch de
  Lanzamiento 2026"); each subsequent draft in that session carries the
  batch/campaign name explicitly.
- **G-5 — Campaign/batch auto-detection.** Resolved design (HOS-13 OQ-6), two
  flows, both required for v1:
  1. Explicit-name resolution: backend resolves the campaign/batch by slug on
     draft submission — match → associate, no match → create. Before creating, the
     GPT must fuzzy-check the active list for a near-duplicate name (e.g.
     "Lanzamiento 2026" vs. "Lanzamiento 26") and ask the operator to confirm
     "use existing" vs. "create new" — never silently create a likely-duplicate.
  2. Implicit fallback (no explicit name given): the GPT catalog endpoint
     (`/api/v1/ai/social/catalog`) must be extended to expose the list of
     **active** campaigns and batches (name, slug, description, date window) —
     today it only returns a single `default_campaign_slug`/`default_batch_slug`.
     The GPT reasons semantically over that list against the draft content:
     confident → propose association; unsure → ask, offering the list; no match /
     declined → draft ships unassociated. Matching logic is LLM-side reasoning, not
     backend keyword/hashtag heuristics.
  Campaigns (`social_campaigns`, thematic/ongoing, e.g. "Institucional Hospeda")
  and batches (`social_content_batches`, time-boxed sprint, e.g. "Hospeda Launch
  2026-06") remain two distinct concepts — same table shape, different semantics,
  no schema merge.
- **G-7 — Dashboard improvements.** Date-range picker on
  `/api/v1/admin/social/dashboard` KPIs, per-platform breakdown chart, thumbnail
  column on the posts list table.
- **G-8 (UI side) — Platform multi-select in composer.** Selecting N platforms
  creates N `social_post_targets` rows on save (API side ships in SPEC-297b/HOS-65),
  sharing the base caption by default with a "customize for this platform"
  affordance that sets that target's `captionOverride` — the schema already
  supports this (SPEC-254), zero data-model work here.
  > **⚠ 2026-07-06 — MOVED TO [HOS-98](https://linear.app/hospeda-beta/issue/HOS-98).**
  > The "zero data-model work / API side ships in HOS-65" premise proved false: (Gap 1)
  > no admin-tier create-post endpoint exists (only the GPT api-key route
  > `/api/v1/ai/social/drafts`, which HOS-65 deliberately left admin-inaccessible), and
  > (Gap 2) per-target overrides have no HTTP write path. G-8 (T-013..T-016) + both
  > backend gaps + the architecture decision now live in HOS-98. See `tasks/TODOs.md`
  > header for detail.
- **G-9 — Icon audit.** Replace inline SVG / direct phosphor imports across social
  admin components with `@repo/icons` references. Pure consumer change, no
  `@repo/icons` package changes.
- **G-10 — Public Hospeda data pull.** Resolved (HOS-13 OQ-7): a new server-side
  aggregation endpoint that pulls/aggregates multiple public-data sources into one
  call shaped for draft enrichment — NOT the GPT calling `/api/v1/public/*`
  piecemeal via its own Action chain. Centralizes the logic of which public data
  feeds a draft.
- **G-11 (downsized) — Newsletter hub landing page.** Owner decided OQ-3 = nav
  unification only (level a). The admin "Marketing" sidebar already groups
  `/social/*` and `/newsletter/*` (SPEC-254) — only the shared `/marketing` landing
  page linking both sections is missing. Levels (b)/(c)/(d) (shared
  audience/campaign entity, full composer unification) are explicitly deferred
  indefinitely, not scoped here.

## 4. Non-goals

- NG-1: A bulk/array draft-creation endpoint — explicitly rejected by the
  resolved G-4 design (chained calls fit the real workflow).
- NG-2: Backend heuristic matching (hashtag/keyword scanning) for campaign/batch
  detection — G-5's implicit fallback is LLM-reasoning-driven, not backend-coded
  heuristics.
- NG-3: Merging `social_campaigns`/`social_content_batches` into one table — owner
  confirmed they stay distinct.
- NG-4: Shared audience/subscriber lists, shared campaign entities, or composer
  unification with newsletter (OQ-3 levels b/c/d) — deferred indefinitely.
- NG-5: A full marketing analytics/BI platform — G-7's dashboard improvements are
  additive to the existing KPI dashboard, not a new analytics product.

## 5. Current baseline

- `packages/db/src/schemas/social/social_campaigns.dbschema.ts` and
  `social_content_batches.dbschema.ts` — structurally identical tables, differ
  only in semantic intent (see doc comments in each file).
- `packages/db/src/schemas/social/social_posts.dbschema.ts` — `campaignId`,
  `batchId`, `batchPosition` columns already exist on the post itself.
- `packages/db/src/schemas/social/social_post_targets.dbschema.ts` —
  `captionOverride`/`hashtagsOverrideText`/`footerOverride` already exist,
  nullable, null = inherit from parent post.
- `apps/api/src/routes/ai/social/catalog.ts` — currently returns single
  `default_campaign_slug`/`default_batch_slug`/`max_hashtags_*` values, no active
  list.
- `apps/admin/src/config/ia/sidebars.ts` — "Marketing" sidebar already groups
  `/social/*` + `/newsletter/*` nav (SPEC-254); no shared landing page route
  exists yet (`apps/admin/src/routes/_authed/social/index.tsx` is a
  social-pipeline-only dashboard; newsletter has no `index.tsx`).
- Zero code coupling today between social and newsletter schemas/services
  (verified via repo-wide grep).

## 6. Proposed design

Design each goal independently during implementation (this spec bundles UX-layer
work across several features, not one cohesive technical design):

- G-4/G-5: extend the catalog endpoint response shape to include
  `activeCampaigns: {name, slug, description, startsAt, endsAt}[]` and
  `activeBatches: {...same shape}[]`; extend draft ingestion to accept optional
  `campaignSlug`/`batchSlug` and resolve-or-create by slug (idempotent).
- G-7: extend the dashboard endpoint/response with date-range query params and a
  per-platform breakdown aggregation; add a thumbnail column reading from
  `social_post_media`.
- G-8: composer multi-select component + per-target caption override UI (toggle
  "customize for this platform" per selected platform).
- G-9: audit pass across `apps/admin/src/routes/_authed/social/` components,
  swap icon imports.
- G-10: new endpoint design TBD at implementation time — needs to define which
  public entities are relevant (accommodations, destinations, recent posts) and
  how the composer surfaces "pull data" as an action.
- G-11: new `/marketing` index route in admin linking to `/social` and
  `/newsletter` sections.

## 7. Data model / contracts

- Catalog endpoint response schema extension (additive, non-breaking).
- Draft ingestion request schema extension: optional `campaignSlug`/`batchSlug`
  string fields (additive, non-breaking per the schema-compat policy referenced in
  HOS-13 R-5).
- Dashboard endpoint: new optional query params (`dateFrom`, `dateTo`), extended
  response shape for per-platform breakdown.
- No new tables; no migrations expected for this sub-spec (G-10's new endpoint may
  need a new lightweight cache table if data-pull performance requires it — decide
  at design time).

## 8. UX / UI behavior

- Composer: multi-platform checkbox/pill selector → N target rows created; each
  selected platform shows an optional "customize caption" expand/collapse.
- Dashboard: date-range picker control, per-platform breakdown chart (reuse
  existing charting library per `dataviz` conventions), thumbnail column in the
  posts table.
- `/marketing` landing page: simple hub linking to Social and Newsletter sections,
  consistent with existing admin layout patterns.

## 9. Acceptance criteria

- AC-1: Operator can declare a batch by name in a GPT conversation and have
  subsequent drafts in that session auto-associate to it, including creation of a
  new batch row when the name doesn't yet exist.
- AC-2: GPT detects a near-duplicate batch/campaign name and asks for
  confirmation instead of silently creating a duplicate (verified with a
  deliberately similar test name).
- AC-3: A draft submitted without an explicit batch/campaign reference triggers
  the implicit-fallback flow when at least one active campaign/batch exists and
  the content plausibly matches.
- AC-4: Dashboard shows correct KPI numbers for a selected date range and
  per-platform breakdown that sums to the total.
- AC-5: Selecting 3 platforms in the composer and saving creates exactly 3
  `social_post_targets` rows.
- AC-6: No inline SVG or direct `phosphor-react`/`@phosphor-icons` imports remain
  in `apps/admin/src/routes/_authed/social/` after the audit (CI-checkable via
  grep if a lint rule doesn't already cover it).
- AC-7: `/marketing` route renders and links correctly to both `/social` and
  `/newsletter` sections.

## 10. Risks

- R-1: G-10's public-data endpoint could become a scope creep magnet ("just pull
  a bit more data") — scope it tightly to what the composer actually needs for
  draft enrichment, not a general-purpose public API aggregator.
- R-2: G-5's fuzzy-duplicate detection depends on GPT prompt quality — needs
  explicit prompt engineering and testing with realistic near-duplicate names, not
  just the happy path.

## 11. Open questions

- None blocking — G-10's exact entity scope (which public data feeds a draft) is
  an implementation-time design decision, not a spec-blocking one.

## 12. Implementation notes

This spec depends on SPEC-297b (HOS-65) shipping the API-side multi-target
creation contract before G-8's UI work can fully land — sequence accordingly or
coordinate a shared contract early.

## 13. Linear

Canonical tracking:
HOS-66
