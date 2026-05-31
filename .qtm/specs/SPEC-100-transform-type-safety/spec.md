---
spec-id: SPEC-100
title: API Transform Pipeline Type Safety
type: refactor
complexity: high
status: draft
created: 2026-05-07T00:00:00.000Z
effort_estimate_hours: 20-32
tags: [web, typescript, type-safety, refactor, transforms, schemas]
origin: Deferred from SPEC-099 Phase 8 (S-10)
spike_reference: apps/web/.claude/baseline/S-10-spike.md
---

# SPEC-100: API Transform Pipeline Type Safety

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Tighten the type contract of the API → UI transform layer in `apps/web` so that
`Record<string, unknown>` casts are removed from every consumer of the transform functions in
`apps/web/src/lib/api/transforms.ts`. Replace untyped `item` parameters with the corresponding
canonical `*Public` / `*ListItem` / `*Detail` types from `@repo/schemas`, propagate the typing
through every consumer (~24 files), and resolve any real shape mismatches that surface.

**Motivation:**

The current pattern is **type-laundering**: typed API responses (`AccommodationPublic`,
`DestinationPublic`, etc.) are widened with `as Record<string, unknown>` at every consumer site
before being passed to transforms. Inside the transforms, properties are accessed as if the data
were typed — but TypeScript cannot validate any of it, because the cast erased the shape.

This means:
- API rename / removal of a field is silently accepted at compile time and explodes at runtime.
- Refactors of `*Public` schemas in `@repo/schemas` cannot be safely performed without manual
  search-and-replace through `apps/web`, because the type system has no knowledge of which
  fields are actually consumed.
- The 49 cast occurrences (5 home + 24 external + ~20 sibling helpers) act as a single
  cross-cutting unsafe boundary. Removing it locally without removing it everywhere is
  net-negative — we'd just relocate `as Record<…>` to `as AccommodationPublic` at the call sites.

**Origin:** This work was identified during SPEC-099 (Home Audit Remediation) as Phase 8 task
S-10. The spike (T-099) documented in
`apps/web/.claude/baseline/S-10-spike.md` measured the blast radius at ~24 external files
(well above the 5-file threshold the home-audit spec set for in-scope cleanup), so the work was
deferred to this spec.

**Success Criteria:**

- Zero `as Record<string, unknown>` casts in `apps/web/src/components/sections/`,
  `apps/web/src/components/shared/cards/`, `apps/web/src/hooks/`, and the listing/detail pages
  under `apps/web/src/pages/[lang]/{alojamientos,destinos,eventos,publicaciones}/`.
- Zero `as unknown as Record<string, unknown>` chains anywhere outside test fixtures.
- Every transform in `apps/web/src/lib/api/transforms.ts` accepts a typed parameter from
  `@repo/schemas` (or a clearly named local projection type if list endpoints expose narrower
  shapes than the full Public schema).
- TypeScript strict mode `pnpm typecheck` passes with no `any` regressions.
- Existing transform unit tests still pass; new type-only tests added per Phase 5.
- No visual regression on listing/detail pages (verified by smoke screenshots at 4 viewports
  per page family).
- CI green: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

### 2. Target Audience

- Developers contributing to `apps/web` listing and detail pages who currently rely on
  the type system catching API-shape changes (it doesn't, today).
- Future schema maintainers in `@repo/schemas` who need confidence that consumers will
  fail at compile time when they rename or remove fields.
- Reviewers who today have to manually cross-reference every `as Record<string, unknown>`
  against the actual API response shape during code review.

### 3. Out of Scope

- **Generic helpers** in `apps/web/src/lib/api/transforms.ts` that take
  `<T extends Record<string, unknown>>` (e.g. `processEntityImages`, `deriveCityFields`).
  Those are intentionally generic and remain untyped at the helper level. We type only the
  **public-facing transform functions** that are called by consumers.
- **Test fixtures** that intentionally create partial / malformed shapes for negative-path
  testing. These can keep their casts.
- **API response schemas in `@repo/schemas`**. We consume what's there. Schema changes are
  out of scope unless a real shape mismatch is discovered (Phase 4).
- **Admin app** (`apps/admin`) transforms. Those use TanStack Query types directly and don't
  share this pattern.
- **The `useViewportSearch` hook's data-shape contract**. It re-wraps via
  `as unknown as Record<string, unknown>` because it merges multiple sources at runtime.
  We tighten as far as possible but if the merge truly requires widening, we keep ONE
  documented cast there with a clear comment explaining why.

### 4. Inventory (from SPEC-099 spike)

#### 4.1 Transforms in scope (8)

| Transform | Returns | Canonical input type |
|---|---|---|
| `toAccommodationCardProps` | `AccommodationCardData` | `AccommodationListItem` |
| `toAccommodationDetailedProps` | `AccommodationDetailedCardData` | `AccommodationListItem` |
| `toAccommodationDetailPageProps` | `AccommodationDetailData` | `AccommodationDetail` |
| `toDestinationCardProps` | `DestinationCardData` | `DestinationListItem` |
| `toEventCardProps` | `EventCardData` | `EventListItem` |
| `toEventDetailProps` | `EventDetailData` | `EventDetail` |
| `toArticleCardProps` | `ArticleCardData` | `PostListItem` |
| `toTestimonialCardProps` | `ReviewCardData` | `Testimonial` (Public) |

#### 4.2 Consumer inventory (~24 external files + 5 home)

**Home sections (already inventoried in SPEC-099, no changes there)** — 5 files.

**External components / hooks (4-6 files):**
- `apps/web/src/components/destination/DestinationNearbySection.astro`
- `apps/web/src/components/shared/cards/DestinationCard.astro`
- `apps/web/src/components/shared/cards/EventCard.astro`
- `apps/web/src/components/shared/cards/EventCardFeatured.astro`
- `apps/web/src/components/shared/cards/EventCardHorizontal.astro`
- `apps/web/src/hooks/useViewportSearch.ts`

**Listing / detail pages (~21):**
- Accommodations: `index`, `[slug]`, `[slug]/fotos`, `mapa`, `tipo/[type]`, `caracteristicas/[slug]`, `comodidades/[slug]` (7)
- Destinations: `index`, `[...path]`, `mapa`, `[slug]/alojamientos`, `[slug]/eventos`, `atraccion/[slug]` (6)
- Events: `index`, `[slug]`, `en/[slug]`, `categoria/[category]` (4)
- Posts: `index`, `[slug]`, `autor/[slug]`, `categoria/[category]`, `etiqueta/[tag]` (5)

**Total**: 5 home + ~24 external = ~29 files. **49 cast occurrences** across the tree.

### 5. Phased Implementation Plan

The work is naturally grouped per **entity type** so that each PR can be reviewed and merged
independently. Each entity phase is end-to-end: transform signature + ALL its consumers updated
together. This avoids the partial-cleanup trap identified in the spike.

#### **Phase 0 — Pre-flight (0.5 day)**

- Create worktree + branch.
- Capture baseline screenshots of the 21 listing/detail pages at 1280×800 (light theme) for visual regression diff.
- Capture baseline `pnpm typecheck` output (should be clean already; baseline confirms no preexisting errors).
- Confirm `*Public` / `*ListItem` / `*Detail` types are exported from `@repo/schemas` for each entity. If any are missing, file a follow-up.

#### **Phase 1 — Accommodations (3-5 days)**

End-to-end retyping of the accommodation transform pipeline. Largest blast radius (~7 listing/detail pages + home + cards).

Tasks:
1. Type `toAccommodationCardProps` parameter as `AccommodationListItem`.
2. Type `toAccommodationDetailedProps` parameter as `AccommodationListItem`.
3. Type `toAccommodationDetailPageProps` parameter as `AccommodationDetail`.
4. Update home `FeaturedAccommodationsSection.astro` — drop the cast.
5. Update each accommodation listing page — drop cast.
6. Update each accommodation detail page — drop cast.
7. Update `AccommodationCard.astro` (and any sibling card variants).
8. Resolve cascading type errors: real field-shape mismatches will surface. Each one is either
   (a) a wrong consumer expectation → fix the consumer, or (b) a real schema gap → file a
   `@repo/schemas` ticket and use a temporary intersection type with a TODO.

#### **Phase 2 — Destinations (2-3 days)**

Same pattern. Files:
- `toDestinationCardProps`
- Home `DestinationsSection.astro` + `DestinationsIsland.client.tsx`
- 6 destinations pages
- `DestinationCard.astro`
- `DestinationNearbySection.astro`

#### **Phase 3 — Events (2-3 days)**

- `toEventCardProps`
- `toEventDetailProps`
- Home `NextEventsSection.astro`
- 4 events pages
- 3 event card variants (`EventCard`, `EventCardFeatured`, `EventCardHorizontal`)

#### **Phase 4 — Posts/Articles (1-2 days)**

- `toArticleCardProps`
- Home `LatestArticlesSection.astro`
- 5 posts pages

#### **Phase 5 — Testimonials + hooks (1 day)**

- `toTestimonialCardProps`
- Home `TestimonialsSection.astro`
- `useViewportSearch.ts` — investigate whether the runtime merge truly needs widening; if yes,
  keep ONE documented cast with explicit comment + JSDoc.

#### **Phase 6 — Type-only regression test (0.5 day)**

Add `apps/web/test/lib/api/transforms.types.test.ts` (or similar) using TypeScript's
`@ts-expect-error` pragma to lock in the contract:

```ts
// @ts-expect-error — passing untyped Record should fail at compile time
toAccommodationCardProps({ item: {} as Record<string, unknown> });

// Should compile cleanly
toAccommodationCardProps({ item: validAccommodationListItem });
```

This makes the typing non-regressible.

#### **Phase 7 — Sweep + cleanup (0.5 day)**

- `rg "as Record<string, unknown>" apps/web/src --type ts --type astro` should return zero
  results outside test fixtures.
- `rg "as unknown as Record" apps/web/src` should return zero or only the documented `useViewportSearch` exception.
- Visual smoke: re-screenshot the 21 listing/detail pages, diff against Phase 0 baseline.

### 6. Acceptance Criteria

1. All 8 transforms accept typed parameters from `@repo/schemas`.
2. All ~29 consumer files (5 home + 24 external) drop the `as Record<string, unknown>` cast.
3. Total `as Record<string, unknown>` count in `apps/web/src/` drops from 49 to ≤1
   (the documented `useViewportSearch` exception, if needed).
4. `pnpm typecheck` clean. No new `any` types introduced.
5. Existing transform unit tests pass; new type-only test (Phase 6) passes.
6. Visual smoke screenshots of 21 listing/detail pages show zero regressions vs Phase 0 baseline.
7. CI green: `pnpm lint`, `pnpm test`, `pnpm typecheck`.
8. Each entity phase landed as its own atomic PR (5 PRs total + Phase 6 + Phase 7 = 7 PRs OR 1 large PR with 7 commit clusters — pick based on review-bandwidth tradeoff).

### 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cascading type errors are larger than estimated; phase blows past day budget. | Per-entity phasing isolates risk. If accommodations explodes, pause and reassess before starting destinations. |
| `*Public` types in `@repo/schemas` don't match what list endpoints actually return (e.g. listing returns a narrower projection than the full Public schema). | Use intersection types or define local `*ListProjection` types in `apps/web/src/types/` that mirror the actual response shape. Document each one. |
| `useViewportSearch` hook merge logic genuinely cannot be typed end-to-end. | Phase 5 explicitly accepts ONE documented cast there, with a JSDoc explaining why. This is the only allowed exception. |
| Real bugs surface during typing (consumer accessing a field that doesn't exist on the schema). | Treat each as a P1 fix during the phase. Most likely candidates: optional fields treated as required, list endpoints lacking detail-only fields. |
| Schema changes in `@repo/schemas` while this work is in flight. | Coordinate with schema maintainers; rebase frequently; do NOT modify `@repo/schemas` from this spec unless a gap is found and approved. |
| Visual regression at the consumer level if the new typed shape forces a property rename. | Phase 0 baseline screenshots + Phase 7 diff catches it. |
| Reviewers overwhelmed by 24-file PR. | Recommend 5 PRs per-entity (one per Phase 1-5). Each is digestible. |

### 8. Deferred / Follow-up Items (not in scope for SPEC-100)

1. Generic helpers in `transforms.ts` (`processEntityImages`, `deriveCityFields`) staying generic — no change.
2. Admin app (`apps/admin`) transforms — separate concern, separate spec if needed.
3. API route handlers in `apps/api` — outside the web app scope.
4. Drizzle schema → Zod schema generation in `@repo/schemas` (a known follow-up unrelated to this work).
5. Replacing remaining `as unknown as` casts elsewhere in `apps/web` (search, billing, auth flows). This spec is **only** about the API transform pipeline.

---

## Part 2 — Technical Notes

### Estimating the per-entity work

The accommodations phase will likely surface the most issues because:
- It has the largest schema (most fields).
- Both list and detail variants exist (3 transforms).
- It feeds the most pages (7 listing/detail + home + cards).

Destinations is medium (one transform, ~7 consumers).
Events is medium (two transforms, ~8 consumers).
Posts is small (one transform, ~6 consumers).
Testimonials is the smallest (one transform, 1 consumer).

### Why per-entity phasing instead of per-file

Per-file phasing would mean updating, e.g., `FeaturedAccommodationsSection.astro` first, then
moving to `DestinationsSection.astro`. But the **transform signature change is the
cross-cutting move** — once we tighten `toAccommodationCardProps` to take
`AccommodationListItem`, every accommodation consumer breaks at once. Splitting them into
separate PRs would mean either (a) keeping a temporary `Record<string, unknown> | AccommodationListItem`
union signature during the transition (ugly) or (b) a single megaPR.

Per-entity phasing lets each transform's signature change land with all its consumers updated
in the same PR, no transitional types needed.

### Suggested branch + worktree

When ready to start:

```bash
git worktree add ../hospeda-transform-types -b refactor/transform-type-safety
cd ../hospeda-transform-types
```

Update `metadata.json` `branch` and `worktree` fields when the work begins.

### Cross-references

- Spike doc: `apps/web/.claude/baseline/S-10-spike.md`
- Origin spec: `.claude/specs/SPEC-099-home-audit-remediation/spec.md` (Phase 8 deferred)
- Schemas package: `packages/schemas/src/`
- Transform module: `apps/web/src/lib/api/transforms.ts`
