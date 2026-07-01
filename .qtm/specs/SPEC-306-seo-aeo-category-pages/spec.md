---
specId: SPEC-306
title: SEO/AEO Landing-Page Strategy for Filter Facets
type: research
complexity: medium
status: completed
created: 2026-06-30
decided: 2026-06-30
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

> Cardinalities and current-state facts below were verified directly against the
> route source (`apps/web/src/pages/[lang]/...`), the `facet-noindex.test.ts`
> invariant, and `sitemap-dynamic.xml.ts` on 2026-06-30 (staging HEAD `eaecf06f5`).

| Facet | Surfaces | Cardinality | Today | **Decision** |
|---|---|---|---|---|
| Event category | `/eventos/` chips + `/categoria/[slug]/` | 9 (enum) | query param (post-U7); old path → 301 redirect | **LANDING** (path, first-class) |
| Accommodation type | `/alojamientos/` badges + `/tipo/[type]/` | 13 (enum) | indexable path but noindex + degraded stub (no sidebar) | **LANDING** (path, first-class) |
| Accommodation amenities | sidebar + `/comodidades/[slug]/` | dynamic (DB, unbounded) | noindex path + query | **FILTER** (stays noindex) |
| Accommodation features | sidebar + `/caracteristicas/[slug]/` | dynamic (DB, unbounded) | noindex path + query | **FILTER** (stays noindex) |
| Destination (as a facet of listings) | `/destinos/[slug]/...` | dynamic (DB) | path, already first-class (Place+Breadcrumb+FAQ JSON-LD, sitemap 0.8) | **LANDING** (confirmed, no change) |
| Post category | `/publicaciones/categoria/[slug]/` | 18 (enum) | noindex path | **FILTER** (cardinality too high, not a primary search-intent term — stays noindex) |
| Post tag | `/publicaciones/etiqueta/[slug]/` | dynamic (DB, unbounded) | noindex path | **FILTER** (stays noindex) |
| Post author | `/publicaciones/autor/[slug]/` | dynamic (DB, unbounded) | noindex path | **FILTER** (stays noindex) — *not in the original facet list above; found during discovery, same treatment as tags* |
| Price / date / sort | sidebar / chips | n/a | query | **FILTER** (never a landing) |

## 5. Open questions (discovery) — RESOLVED

- **OQ-1 (central) — DECIDED.** A facet value crosses from "filter" to "indexable
  landing" when ALL three hold:
  1. **Bounded cardinality** — a static enum, not an unbounded DB-generated table.
  2. **Primary search intent** — the value is something a person would search on its
     own, combined with a place ("cabañas en Colón", "eventos de música"), not just
     a modifier of another concept.
  3. **Not a secondary modifier** — it's the main axis of the query, not a refinement
     someone adds after already picking something else (amenities/features refine
     "which cabin", they aren't themselves the search).

  Applying it: **event category** and **accommodation type** cross the bar (bounded
  enums, primary intent). **Post category**, despite being a bounded enum (18
  values), does NOT — 18 is high relative to event/type, and "publicaciones de
  gastronomía" is not how people search (blog-category browsing is secondary
  navigation, not a landing-worthy query). Amenities, features, post tags, and post
  author are all unbounded DB tables and/or modifiers — they stay filters
  regardless of the other two conditions.

- **OQ-2 — DECIDED.** Canonical form for an indexable single-facet landing is the
  **PATH** (`/eventos/categoria/musica/`), not the query. Matches the destination
  pattern already in production and the AEO citeability rationale in §2 (answer
  engines cite stable, descriptive URLs over query-string permutations).

- **OQ-3 — DECIDED.** Any URL carrying 2+ active facet params (e.g.
  `?category=music&when=week`) canonicalizes to the **base listing** (`/eventos/`),
  regardless of which facets are active, and is served `noindex,follow`. No
  "primary facet wins" logic — simpler, and avoids an ambiguous tie-break when two+
  promoted facets are active simultaneously (e.g. a future case with both category
  and a second promoted facet). A single active facet param when a matching
  landing exists (e.g. `?category=music` alone) redirects/canonicalizes to that
  landing's path, consistent with OQ-2.

- **OQ-4 — DECIDED.** Both promoted facets are rebuilt as first-class pages —
  Reverts the U7 301 for events (§2) and upgrades accommodations `/tipo/` from its
  current noindex-degraded-stub. Both facet families get: the full listing UI
  (sidebar + the same combinable query-param filters for further refinement within
  the landing), indexable meta, structured data per OQ-5, and a sitemap entry per
  OQ-6. This is a deliberate reversal of the U7 quick-fix — U7 explicitly deferred
  the SEO direction to this spec, not a permanent decision. Execution happens in
  child specs (§7), not here.

- **OQ-5 — DECIDED.** Structured data for the new landings reuses the JSON-LD
  pattern already proven on `/destinos/`: **CollectionPage** (the landing itself,
  e.g. "Alojamientos tipo cabaña") + **ItemList** (the listing results) +
  **BreadcrumbList** (vertical → facet value). `<title>`/meta/H1 templates follow
  the existing per-facet i18n key convention (`@repo/i18n`), one template per
  facet family, parameterized by the enum value's display label, across es/en/pt.
  Concrete templates are a child-spec deliverable, not decided here.

- **OQ-6 — DECIDED.** All newly-indexable landings enter the sitemap: 9 event
  category + 13 accommodation type = 22 URLs, at the same priority band as the
  existing listing pages (~0.7, consistent with `sitemap-dynamic.xml.ts`'s current
  scheme). No cap needed at this volume. If a future facet is promoted from an
  unbounded source, that child spec must define its own cap — this spec does not
  pre-approve open-ended sitemap growth.

- **OQ-7 — DECIDED (inherited, not a fresh fork).** New landings get the same
  hreflang/locale treatment `sitemap-dynamic.xml.ts` already applies to every other
  indexed route (es/en/pt alternates + x-default, per SPEC-157 REQ-12) — no new
  policy needed, just extend the existing generator to include the 22 new URLs.

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

1. This `spec.md`, evolved through discovery into a decided strategy (§4 filled,
   §5 OQs resolved, recorded in the Revision History below). **Done.**
2. Child-spec plan (titles + one-line scope each). SPEC numbers are NOT allocated
   here — per project convention, allocation happens when the owner prioritizes
   implementation (see `~/.claude/CLAUDE.md` spec-allocation rule).

   1. **Facet-landing shared infra** — generalize the `SEOHead` canonical/robots
      logic and the destination-page JSON-LD components (CollectionPage,
      ItemList, BreadcrumbList) into a reusable "facet landing" contract (layout
      - structured-data helper + sitemap-entry helper) that both facet families
      below adopt, instead of each hand-rolling its own. Update
      `facet-noindex.test.ts`'s invariant to a positive "facet landings must have
      CollectionPage + Breadcrumb + sitemap entry" assertion for the promoted
      routes, keeping the existing noindex assertion for the ones that stay
      filters.
   2. **Event category first-class landing** — revert the U7 301
      (`/eventos/categoria/[category]/`) into a real page: full listing UI
      (sidebar + combinable query filters), indexable meta, structured data via
      the shared infra, i18n title/meta/H1 templates (es/en/pt), sitemap entry
      (9 URLs). Depends on child spec 1.
   3. **Accommodation type first-class landing** — upgrade
      `/alojamientos/tipo/[type]/` from its current noindex degraded stub to the
      same first-class treatment as event category (sidebar + filters,
      indexable, structured data, i18n templates, sitemap entry — 13 URLs).
      Depends on child spec 1.

## 8. Dependencies / related

- **U7** (`fix/events-category-filter`, PR #1910) — the quick fix this spec is the
  "do-it-right" follow-up to. Event `/categoria/` routes are currently 301 redirects;
  this spec decides their final fate.
- Same antipattern lives in **accommodations** (`/tipo/[type]/`) — must be reconciled.
- Touches the `facet-noindex` test invariant (`apps/web/test/components/seo/facet-noindex.test.ts`)
  — any facet promoted to indexable must move from FACET_PAGES to MAIN/landing.

## 9. Revision History

- **2026-06-30** — Discovery pass. Verified current state directly against staging
  HEAD (`eaecf06f5`): route source, `facet-noindex.test.ts`, `sitemap-dynamic.xml.ts`.
  Confirmed the events `/categoria/` 301 redirect (U7) is real and matches the
  spec's premise. Found an additional facet not in the original §4 table —
  `/publicaciones/autor/[slug]/` (post author) — added with the same "filter"
  treatment as tags. Resolved all 7 OQs with the owner (decisions recorded in §5):
  landing criterion (OQ-1), PATH canonical (OQ-2), base-listing canonicalization
  for combinations (OQ-3), full migration reverting U7 for both event category and
  accommodation type (OQ-4), CollectionPage+ItemList+Breadcrumb structured data
  (OQ-5), uncapped sitemap inclusion at current volume (OQ-6), inherited hreflang
  policy (OQ-7). Filled §4 with final bucket decisions. Wrote the 3-item child-spec
  plan (§7). Status flipped `draft` → `completed` — this spec's deliverables
  (decided strategy + child-spec plan) are both done; implementation is out of
  scope and lives in the child specs once allocated.
