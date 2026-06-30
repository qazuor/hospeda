---
specId: SPEC-306
title: SEO/AEO Landing-Page Strategy for Filter Facets
type: research
complexity: medium
status: draft
created: 2026-06-30
tags: [seo, aeo, ia, listings, facets, strategy, discovery]
---

# SPEC-306 — SEO/AEO Landing-Page Strategy for Filter Facets

> Decide, ONCE and explicitly, which filter facets (event category, accommodation
> type, destination, amenities, …) deserve to be **first-class, indexable
> SEO/AEO landing pages** and which should stay **ephemeral query-param filters**
> (noindex). Produce the URL / canonical / IA / structured-data rules that every
> listing follows. **Research-only — no implementation.** Concrete builds become
> child specs.

## 1. Summary

Hospeda's listings expose facet filters in two incompatible ways, decided ad-hoc
at different times:

- **Dedicated routes** — `/{lang}/eventos/categoria/{slug}/`,
  `/{lang}/alojamientos/tipo/{type}/`, `/alojamientos/caracteristicas/{slug}/`,
  `/alojamientos/comodidades/{slug}/`, etc. These are separate pages with their own
  canonical URL — but today they are `noindex`, have **no sidebar**, and **drop all
  other active filters**. So they pay the cost of a separate page (lost context,
  duplicate content) while getting **zero** of the SEO benefit (they are noindex).
- **Query params** on the main listing — `?category=`, `?when=`, `?types=`,
  `?amenities=`, … via the FilterSidebar / chips. These preserve context and combine
  freely, and are the project's canonical interactive-filter mechanism.

This is the **worst of both worlds**: the path pages are duplicate content that an
engineer must keep in sync, yet they are noindex so they are pure UX degradation.

This spec does NOT pick "paths everywhere" or "query everywhere". It defines the
**decision rule**: which facet values are genuine *landing pages* (topical entry
points worth indexing — "alojamientos tipo cabaña en Concepción", "eventos de
música en el Litoral") and which are just *filters* (ephemeral, combinable,
noindex). Then it specifies the URL, canonical, breadcrumb, and structured-data
contract so the answer is consistent across every listing.

## 2. Background — why now

This spec was split out of **U7** (the events-filter UX work) as the explicit
"do it right later" half of a hybrid decision:

- The quick fix shipped in `fix/events-category-filter` (PR #1910): event category
  chips now filter in place via `/eventos/?category=ENUM`, and the standalone
  `/eventos/categoria/{slug}/` routes were **retired to 301 redirects**. That
  unblocked the UX inconsistency without committing to an SEO direction.
- The accommodations listing still carries the same antipattern (type badges →
  `/alojamientos/tipo/{type}/`, which IS indexable today — inconsistent with events
  now).
- The owner's intent (recorded during the U7 discussion) is that category / type /
  destination landing pages are **genuinely valuable SEO/AEO assets** for a regional
  tourism marketplace, but doing them well is bigger than a NOSPEC fix — hence this
  research spec.

> AEO note: answer-engines / LLMs cite stable, descriptive, canonical URLs. A small
> set of well-structured topical landings (with clear headings + structured data)
> is more citable than a combinatorial sprawl of `?a=1&b=2` permutations.

## 3. The core decision rule (to be validated, not assumed)

Working hypothesis for the research to confirm or refute:

1. **Single-facet, high-intent values → indexable PATH landing.** A facet value that
   maps to a real search query ("hoteles en Colón", "eventos de música") gets a
   clean canonical path, is indexable, and — critically — must be a **first-class
   page**: the full listing UI (sidebar + the same query-param filters for
   refinement), not a degraded stub.
2. **Combinations & ephemeral state → QUERY params, noindex/canonicalized.**
   `?category=X&when=week&sort=…` stays on the main listing, `noindex,follow`, and
   `rel=canonical` to the base (or to the relevant single-facet landing) to avoid
   crawl-budget waste and duplicate content. Nested path segments
   (`/type/[t]/cuando/[w]`) are explicitly rejected — combinatorial explosion.
3. **One canonical per indexable concept.** Never let both `/categoria/musica/` and
   `?category=music` be indexable. Pick one; canonical the other to it.

## 4. Facet inventory (input to the decision)

For each facet, the research must record: cardinality, search intent / volume signal,
whether it's combinable, current implementation, and the recommended bucket
(landing vs filter).

| Facet | Surfaces | Today | Candidate bucket |
|---|---|---|---|
| Event category | `/eventos/` chips | query param (post-U7); old path → 301 | TBD (landing?) |
| Accommodation type | `/alojamientos/` badges | indexable path `/tipo/[type]/` | TBD |
| Accommodation amenities | sidebar + `/comodidades/[slug]/` | noindex path + query | TBD (likely filter) |
| Accommodation features | sidebar + `/caracteristicas/[slug]/` | noindex path + query | TBD (likely filter) |
| Destination (as a facet of listings) | `/destinos/[slug]/...` | path (already first-class) | landing (confirm) |
| Post category / tag | `/publicaciones/categoria|etiqueta/` | path | TBD |
| Price / date / sort | sidebar / chips | query | filter (never a landing) |

## 5. Open questions (discovery)

- **OQ-1 (central):** Which facet values cross the bar from "filter" to "indexable
  landing"? Define a concrete, checkable criterion (cardinality cap + intent signal),
  not a vibe.
- **OQ-2:** For an indexable single-facet landing, is the canonical the PATH
  (`/eventos/categoria/musica/`) or the query (`/eventos/?category=MUSIC`)? Pick one
  globally and justify it (path recommended for stability/citeability).
- **OQ-3:** How are combinations canonicalized — to the base listing, or to the
  "primary" single facet? What gets `noindex` vs `canonical`?
- **OQ-4:** Reconcile with U7: the event `/categoria/` routes are now 301 redirects.
  If the answer is "category IS a landing", the spec must un-retire them as
  first-class pages (and align accommodations `/tipo/` the same way). Define the
  migration.
- **OQ-5:** Structured data per landing (ItemList, BreadcrumbList, CollectionPage?)
  and `<title>`/meta/H1 templates per facet, in all 3 locales.
- **OQ-6:** Sitemap policy — which facet landings enter the sitemap; how to cap.
- **OQ-7:** Hreflang / locale handling for facet landings across es/en/pt.

## 6. Scope & non-goals

**In scope (research deliverables):**
- The decision rule + the per-facet recommendation table (§4 filled in).
- The URL / canonical / noindex / sitemap / structured-data / metadata contract.
- A migration plan that reconciles the post-U7 state (events redirected,
  accommodations still pathed) into the chosen model.
- A breakdown into child implementation specs (one per facet family, or one shared
  "first-class facet landing" infra spec + per-facet adopters).

**Out of scope:** any implementation. No routes, components, or schema changes ship
under this spec — it produces the strategy doc + child-spec list only.

## 7. Deliverables

1. This `spec.md`, evolved through discovery into a decided strategy (with §4 filled
   and §5 OQs resolved + recorded in a Revision History).
2. A child-spec plan (titles + one-line scope each), to be allocated when the owner
   prioritizes implementation.

## 8. Dependencies / related

- **U7** (`fix/events-category-filter`, PR #1910) — the quick fix this spec is the
  "do-it-right" follow-up to. Event `/categoria/` routes are currently 301 redirects;
  this spec decides their final fate.
- Same antipattern lives in **accommodations** (`/tipo/[type]/`) — must be reconciled.
- Touches the `facet-noindex` test invariant (`apps/web/test/components/seo/facet-noindex.test.ts`)
  — any facet promoted to indexable must move from FACET_PAGES to MAIN/landing.
