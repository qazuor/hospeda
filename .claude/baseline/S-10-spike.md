# S-10 Spike — Cast Cleanup Blast Radius

**Date:** 2026-05-07
**Task:** T-099
**Spec:** SPEC-099 Phase 8

## Goal

Determine whether the S-10 cleanup (retyping API transforms with `*Public`
schemas and dropping `Record<string, unknown>` casts) can proceed inside
SPEC-099, or must be split into a follow-up spec. Threshold: external blast
radius ≤5 files → proceed; >5 → defer.

## Transforms in scope

`apps/web/src/lib/api/transforms.ts` exports the following transform
functions, all of which currently accept `item: Record<string, unknown>`:

| Transform | Returns | Canonical input type |
|---|---|---|
| `toAccommodationCardProps` | `AccommodationCardData` | `AccommodationListItem` (or list-projection) |
| `toAccommodationDetailedProps` | `AccommodationDetailedCardData` | `AccommodationListItem` |
| `toAccommodationDetailPageProps` | `AccommodationDetailData` | `AccommodationDetail` |
| `toDestinationCardProps` | `DestinationCardData` | `DestinationListItem` |
| `toEventCardProps` | `EventCardData` | `EventListItem` |
| `toEventDetailProps` | `EventDetailData` | `EventDetail` |
| `toArticleCardProps` | `ArticleCardData` | `PostListItem` |
| `toTestimonialCardProps` | `ReviewCardData` | `Testimonial` (Public) |

`processEntityImages` and `deriveCityFields` are generic helpers — they
remain `Record<string, unknown>` either by signature (`<T extends Record<string, unknown>>`)
or by helper contract; out of S-10 scope.

## Consumer inventory

### Home sections (in scope, 5 files)

| File | Line | Cast |
|---|---|---|
| `apps/web/src/components/sections/FeaturedAccommodationsSection.astro` | 44 | `raw as Record<string, unknown>` |
| `apps/web/src/components/sections/DestinationsSection.astro` | 44 | `raw as Record<string, unknown>` |
| `apps/web/src/components/sections/NextEventsSection.astro` | 43 | `raw as Record<string, unknown>` |
| `apps/web/src/components/sections/LatestArticlesSection.astro` | 36 | `raw as Record<string, unknown>` |
| `apps/web/src/components/sections/TestimonialsSection.astro` | 35 | `raw as Record<string, unknown>` |

### External (out of scope of home audit)

Casts to `Record<string, unknown>` (or analogous) feeding the same transforms
or sibling helpers:

**Components / hooks (3):**
- `apps/web/src/components/destination/DestinationNearbySection.astro:29`
- `apps/web/src/components/shared/cards/DestinationCard.astro` (consumer of `toDestinationCardProps`)
- `apps/web/src/components/shared/cards/EventCard.astro`, `EventCardFeatured.astro`, `EventCardHorizontal.astro` (consumers)
- `apps/web/src/hooks/useViewportSearch.ts:81`

**Listing / detail pages (~21):**
- `apps/web/src/pages/[lang]/alojamientos/index.astro`
- `apps/web/src/pages/[lang]/alojamientos/[slug].astro`
- `apps/web/src/pages/[lang]/alojamientos/[slug]/fotos.astro`
- `apps/web/src/pages/[lang]/alojamientos/mapa.astro`
- `apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro`
- `apps/web/src/pages/[lang]/alojamientos/caracteristicas/[slug]/index.astro`
- `apps/web/src/pages/[lang]/alojamientos/comodidades/[slug]/index.astro`
- `apps/web/src/pages/[lang]/destinos/index.astro`
- `apps/web/src/pages/[lang]/destinos/[...path].astro`
- `apps/web/src/pages/[lang]/destinos/mapa.astro`
- `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro`
- `apps/web/src/pages/[lang]/destinos/[slug]/eventos/index.astro`
- `apps/web/src/pages/[lang]/destinos/atraccion/[slug]/index.astro`
- `apps/web/src/pages/[lang]/eventos/index.astro`
- `apps/web/src/pages/[lang]/eventos/[slug].astro`
- `apps/web/src/pages/[lang]/eventos/en/[slug]/index.astro`
- `apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro`
- `apps/web/src/pages/[lang]/publicaciones/index.astro`
- `apps/web/src/pages/[lang]/publicaciones/[slug].astro`
- `apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro`
- `apps/web/src/pages/[lang]/publicaciones/categoria/[category]/index.astro`
- `apps/web/src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro`

**Total external files affected: ~24** (well above the 5-file threshold).

Total cast occurrences across the source tree: 49 (`Record<string, unknown>`
in components/pages/hooks).

## Recommendation

**DEFER S-10 to a follow-up spec.**

Rationale:

1. **Blast radius >5 by ~5x.** The spec's explicit threshold is "if blast
   radius >5 external files, document recommendation to split into a separate
   spec." Touching ~24 external files is a cross-cutting refactor, not a
   home-audit closeout.
2. **Cascading type errors are likely.** The transforms currently accept any
   shape; consumers pass partial API responses, list-projection items, and
   pre-merged objects (e.g. `useViewportSearch` rewraps via `as unknown as
   Record<string, unknown>` to keep compile happy). Tightening to `*Public`
   will surface real shape mismatches that need per-call investigation.
3. **Out-of-scope risk to listing/detail pages.** Listing pages drive the
   bulk of the site's traffic. A typing refactor that touches all of them
   should land with its own QA cycle (visual diff + smoke), not under the
   home-audit umbrella.
4. **The 5 home casts are low-value in isolation.** Retyping only the home
   sections without the transforms themselves means adding `as
   AccommodationListItem` casts at the call site instead of `as Record<…>` —
   we'd be moving the lie one step, not removing it. The cleanup only pays
   off when transforms + ALL consumers are aligned together.

### Suggested follow-up spec

Title: "Type API transform pipeline end-to-end (drop `Record<string, unknown>` casts)"

Phases:
1. Inventory canonical `*Public` schemas in `@repo/schemas` for each transform input.
2. Tighten transform signatures one entity at a time (accommodation → destination → event → post → testimonial).
3. Update each consumer file in lock-step with its transform; resolve cascading type errors.
4. Remove the `as Record<string, unknown>` and `as unknown as Record<…>` casts.
5. Add a regression test that the transforms reject obviously-invalid inputs at compile time (type-only test).

## T-100 status

T-100 will NOT be applied under SPEC-099. Marked deferred in `state.json`
with a pointer to this spike.
