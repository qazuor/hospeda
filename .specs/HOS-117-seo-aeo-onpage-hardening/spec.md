---
title: "SEO/AEO on-page hardening: credibility bugs, demo-content exclusion, rendering strategy, CWV & content i18n"
linear: HOS-117
statusSource: linear
type: improvement
areas: [web, content, db]
created: 2026-07-09
---

# SEO/AEO on-page hardening

> **Framing note (read first).** The technical SEO/AEO **infrastructure** of
> `apps/web` is already mature. Per-entity SSR JSON-LD, host-aware `robots.txt`,
> dynamic `sitemap`, canonical/hreflang/OG meta, filter-facet canonicals,
> `llms.txt`, and programmatic landings **all exist and work today** (see
> "Existing infrastructure — DO NOT re-implement" below). An external audit
> claimed this was missing; that claim was **verified false** in code on
> 2026-07-09. This spec is NOT "add SEO to the web app". It is a set of
> **surgical fixes** to concrete credibility bugs, demo-content leakage, JSON-LD
> coverage gaps, plus two owner-added workstreams (content i18n, rendering/CWV
> strategy). Nobody should re-build the JSON-LD / robots / sitemap layers.

## Part 1: Functional Specification

### Overview & Goals

**Goal.** Close the concrete on-page SEO/AEO (Answer-Engine-Optimization) gaps
that hurt Hospeda's credibility with crawlers, LLM fetchers, and search engines,
without re-inventing the mature infrastructure already in place. Fix the bugs
that make the site look broken or empty to a machine that does not run
JavaScript, keep the current 100%-demo production content out of the index until
real content exists, close JSON-LD coverage holes with CI enforcement, and
(owner-added) define a measured rendering/CWV strategy and a plan to make entity
content multilingual for real.

**Motivation.**

- **Credibility bugs**: crawlers and LLM fetchers (which do not scroll or run JS)
  currently receive `0+` for every homepage stat counter, index ~15 empty
  destination pages, and see demo authors ("Admin User", `admin@hospeda.com`) and
  mad-libs accommodation names as if they were real content. Each of these makes
  the site look broken or fake to a machine.
- **Coverage gap**: gastronomy and experience detail pages emit their primary
  entity JSON-LD but omit `BreadcrumbJsonLd`, and the CI guard only checks 4 of 6
  entities — so the gap can silently grow.
- **Owner-added scope**: content is only translated at the UI level (entity
  `name`/`description`/`faqs` are Spanish on `/en/` and `/pt/`), and there is no
  measured rendering strategy for Core Web Vitals. Both were folded into this spec.

**Success metrics (all measurable / automatable).**

| # | Metric | How measured |
|---|--------|--------------|
| M-1 | **0** homepage stat counters render `0+` in raw SSR HTML (pre-hydration) | Integration test on rendered HTML string of the counters; view-source check |
| M-2 | **0** empty destinations (`accCount==0 && eventsCount==0 && attractions==0`) are indexable | They emit `noindex,follow` and are absent from `sitemap-dynamic.xml` — asserted by test |
| M-3 | **6/6** public detail entities emit `BreadcrumbJsonLd`, enforced by CI | `json-ld-coverage.test.ts` `DETAIL_PAGES` extended to 6 entities and green |
| M-4 | **0** demo/seed content indexable while prod is 100% demo (per OQ-4 decision) | Chosen exclusion mechanism asserted by test (noindex meta and/or sitemap absence) |
| M-5 | **0** SSR↔hydration islands that *reveal* (vs animate) critical data | Audit checklist completed; regression test per offending island |
| M-6 | FAQ coverage of published accommodations raised from **52% → target TBD** (OQ) | Seed-data assertion / count query |
| M-7 | CWV (LCP/CLS/INP) **measured before and after** any Wave 4 change | PostHog web-vitals / Lighthouse run recorded in the spec's Linear issue |

**Target users / beneficiaries.**

- **Search-engine crawlers** (Googlebot, Bingbot) — accurate, non-broken HTML.
- **LLM fetchers** (GPTBot, ClaudeBot, PerplexityBot — already allow-listed in
  `robots.txt`) — citable, correct facts, no `0+`, no demo authors.
- **Real end users** — unchanged UX; animations and interactivity preserved via
  progressive enhancement.
- **The business** — a site that does not look broken/fake to machines, and a
  clean baseline for when real host content arrives.

### Existing infrastructure — DO NOT re-implement

These are confirmed present in code (2026-07-09). Reuse them; do not rebuild.

| Capability | Location |
|---|---|
| Per-entity SSR JSON-LD components | `LodgingBusinessJsonLd` (`alojamientos/[slug].astro:479`), `EventJsonLd`+`BreadcrumbJsonLd` (`eventos/[slug].astro:163,180`), `PlaceJsonLd`+`BreadcrumbJsonLd`+`FAQPageJsonLd` (`destinos/[...path].astro:435,444,446`), `ArticleJsonLd`+`BreadcrumbJsonLd` (`publicaciones/[slug].astro:306,319`), `RestaurantJsonLd` (`gastronomia/[slug].astro:194`), `TouristAttractionJsonLd` (`experiencias/[slug].astro:179`), `WebSiteJsonLd`+`OrganizationJsonLd` (`[lang]/index.astro:183-184`) |
| JSON-LD wrapper (escapes `<>&`) | `apps/web/src/components/seo/JsonLd.astro` |
| JSON-LD CI guard | `apps/web/test/integration/json-ld-coverage.test.ts` (`DETAIL_PAGES` L26-58 — **only 4 entities**) |
| Meta/OG/canonical/hreflang | `apps/web/src/components/seo/SEOHead.astro` (title/desc/canonical L120-131, OG/twitter L133-160, hreflang L71-87,162-166) via 8 layouts |
| Dynamic OG image | `apps/web/src/lib/og-template.ts` + `/api/og` |
| Host-aware `robots.txt` (web) | `apps/web/src/pages/robots.txt.ts` (`prerender=false` L28; Disallow:/ on `HOSPEDA_NOINDEX_HOSTS`; IA-bot allowlist L47-56) |
| `robots.txt` (API domain, separate) | `apps/api/src/routes/robots.ts` (Disallow-all — correct for API; **do not conflate with web**) |
| Dynamic sitemap | `@astrojs/sitemap` (`astro.config.mjs:146-178`) + `apps/web/src/pages/sitemap-dynamic.xml.ts` (SSR, `prerender=false` L25; 6 entity types × 3 locales + hreflang L185-193; **destinations unfiltered for thin content** L303-306) |
| Rendering baseline | `astro.config.mjs:65` `output:'server'` (SSR), `@astrojs/node` standalone, `trailingSlash:'always'` L66 |
| Filter-facet canonicals | `apps/web/src/lib/seo/promoted-facet-canonical.ts`; `/busqueda/` is noindex (`busqueda/index.astro:41`) |
| LLM-agent digest | `apps/web/src/pages/llms.txt.ts` (host-aware, noindex on staging) |
| Programmatic landings | `alojamientos/tipo/[type]/index.astro`, `/comodidades/[slug]/`, `/caracteristicas/[slug]/` (CollectionPage+ItemList+BreadcrumbList JSON-LD) |
| i18n text resolver (exists, underused) | `apps/web/src/lib/resolve-i18n-text.ts:51-74` (only fed by amenity/feature catalog today, SPEC-172) |
| Featured/thin `noindex` prop (exists, unused by destinations) | `apps/web/src/layouts/DetailLayout.astro:44` (`noindex` → `noindex,follow` via SEOHead) |

### User Stories & Acceptance Criteria

> **Reading convention for Wave 0 criteria.** "crawler / LLM fetcher" = a client
> that fetches the raw HTML and **does not run JavaScript or scroll** (this is
> what Googlebot's initial fetch, GPTBot, ClaudeBot, PerplexityBot do). "real
> user" = a browser that hydrates islands and scrolls. Every Wave 0 criterion
> distinguishes the two: the fix must serve correct data to the no-JS client
> while preserving animation for the real user (progressive enhancement).

---

#### US-1: Homepage stat counters show real numbers to machines (Wave 0, P0)

**As a** crawler or LLM fetcher, **I want** the homepage statistics to contain
the real values in the initial HTML, **so that** I do not record or cite Hospeda
as having "0+" of everything.

Context: `AnimatedCounter.client.tsx:94` initializes `useState(0)` and only
animates to the real value via `IntersectionObserver` on scroll after
hydration. It is a `client:visible` React island, so the SSR HTML emits `0+` for
all 5 counters in `StatsSection`. The real value already reaches the server
(`statsApi.getPlatformStats()` → `index.astro:76-85` → `StatsSection.astro:71-80`).
A working precedent for the fix pattern exists at `home-guards.ts:41-50` (applied
to the hero social-proof block, not to `StatsSection`).

**Acceptance Criteria:**

- **Given** the homepage is rendered server-side (no JS, no scroll), **When** the
  raw HTML of `StatsSection` is inspected, **Then** each of the 5 counters
  contains its real final value as static text (e.g. `104+`), never `0` or `0+`.
- **Given** a real user with JS loads the homepage and scrolls the counters into
  view, **When** the island hydrates, **Then** the counter animates from a
  starting value up to the same final value already present in the SSR HTML
  (animation is visual only; it never *reveals* a value the HTML lacked).
- **Given** a user with `prefers-reduced-motion: reduce`, **When** the counter is
  in view, **Then** it shows the final value with no animation (existing behavior
  at `AnimatedCounter.client.tsx:114-118` preserved).
- **Given** `statsApi.getPlatformStats()` fails or returns 0 for a metric, **When**
  the section renders, **Then** the SSR output degrades gracefully per the
  existing `home-guards` pattern (the counter/section is hidden or shows a safe
  fallback, never a misleading `0+`).

---

#### US-2: No `client:*` island reveals critical data only after hydration (Wave 0, P0)

**As a** crawler or LLM fetcher, **I want** every island's SSR HTML to already
contain the critical data it displays, **so that** I never see a placeholder
where a price, availability, badge, or count should be.

This generalizes the counter fix into a project principle: *the SSR render of an
island emits the final datum; hydration only animates or adds interactivity — it
must never be the first place a value appears.*

**Acceptance Criteria:**

- **Given** the codebase, **When** the audit task enumerates every `client:*`
  island that displays critical content (prices, availability, badges, counts,
  ratings), **Then** a checklist is produced marking each as compliant or
  offending, with file+line.
- **Given** an island flagged as offending, **When** it is fixed, **Then** its raw
  SSR HTML contains the final value and a regression test asserts that (no JS
  execution) the value is present in the rendered string.
- **Given** the audit finds only the counter, **When** the audit is filed, **Then**
  the principle is still documented (in `apps/web/CLAUDE.md` SEO/animations
  section) so future islands follow it.

---

#### US-3: Empty destinations are not indexed and not in the sitemap (Wave 0, P0)

**As a** search engine, **I want** destination pages with no accommodations,
events, or attractions to be excluded from the index and sitemap, **so that** I
do not rank or crawl thin, empty pages that hurt site quality.

Context: 26 seed destinations vs 11 cities with accommodations → ~15 (58%) are
empty but indexed and in the sitemap. `DetailLayout.astro:44` has a `noindex`
prop that `destinos/[...path].astro` (~L424) never passes.
`sitemap-dynamic.xml.ts:303-306` emits destinations with no thin-content filter.

**Acceptance Criteria:**

- **Given** a destination where `accCount === 0 && eventsCount === 0 &&
  attractions.length === 0`, **When** its detail page renders, **Then**
  `destinos/[...path].astro` passes `noindex={true}` to `DetailLayout`, and the
  page emits `<meta name="robots" content="noindex,follow">`.
- **Given** the same empty destination, **When** `sitemap-dynamic.xml.ts`
  generates, **Then** that destination's URL (all 3 locales) is absent from the
  sitemap.
- **Given** a destination with at least one accommodation OR event OR attraction,
  **When** its page renders, **Then** it is indexable (no `noindex`) and present
  in the sitemap — unchanged from today.
- **Given** the emptiness thresholds, **When** they are defined, **Then** the
  exact predicate (`accCount === 0 && eventsCount === 0 && attractions.length ===
  0`) is used identically in both the page and the sitemap builder (single source
  of the rule, no divergence).

---

#### US-4: Every public detail entity emits BreadcrumbJsonLd, enforced by CI (Wave 0, P0)

**As a** search engine / LLM, **I want** breadcrumb structured data on all detail
pages, **so that** navigation context is machine-readable everywhere, uniformly.

Context: `gastronomia/[slug].astro` and `experiencias/[slug].astro` import only
`RestaurantJsonLd` / `TouristAttractionJsonLd`, no `BreadcrumbJsonLd`. The CI
guard `json-ld-coverage.test.ts` `DETAIL_PAGES` covers only 4 entities — which is
the root cause the gap went unnoticed.

**Acceptance Criteria:**

- **Given** `gastronomia/[slug].astro`, **When** it renders, **Then** it emits
  `BreadcrumbJsonLd` following the pattern at `alojamientos/[slug].astro:497`.
- **Given** `experiencias/[slug].astro`, **When** it renders, **Then** it emits
  `BreadcrumbJsonLd` following the same pattern.
- **Given** `json-ld-coverage.test.ts`, **When** the suite runs, **Then** its
  `DETAIL_PAGES` list covers all 6 detail entities (accommodation, event,
  destination, post, gastronomy, experience), and fails if any drops its
  `BreadcrumbJsonLd` or primary entity JSON-LD.

---

#### US-5: Demo/seed content is kept out of the public index while prod is 100% demo (Wave 1, P1)

**As** the platform owner, **I want** the entirely-demo production content kept
out of the public search index until real host content exists, **so that**
Hospeda is not indexed and cited with fake authors, mad-libs names, and demo
data.

Owner decision (2026-07-09): production today is 100% seed/demo, no real hosts.
Concrete residue: author "Admin User" / `admin@hospeda.com`
(`packages/seed/src/data/user/required/admin-user.json:96-99`) is public on 5/18
posts with a link to `/publicaciones/autor/admin-user/`
(`PostDetailHeader.astro:141-148`); mad-libs accommodation names ("Refugio
Maravilloso", "Nido Tranquilo") are ACTIVE/PUBLIC/APPROVED and indexable (104
files under `packages/seed/src/data/accommodation/{city}/*.json`). No
`isSeed`/`noIndex` flag exists on `packages/seed/src/schemas/accommodation.schema.json`.

**Acceptance Criteria (mechanism decided in OQ-1 / OQ-4):**

- **Given** the chosen exclusion mechanism (coarse env/host gate now, or granular
  per-entity flag), **When** any demo/seed public page renders in production,
  **Then** it is excluded from indexing per the decision — either `noindex,follow`
  meta and/or absence from the sitemap (OQ-4 decides whether it is full-site
  `noindex` or selective).
- **Given** the coarse mechanism is chosen, **When** it is implemented, **Then** it
  is a single env/host gate (all-or-nothing) with a documented, low-effort path to
  degrade to granular when real content starts mixing in.
- **Given** the granular mechanism is chosen, **When** it is implemented, **Then**
  entities carry an `isSeed`/`noIndex` flag (see Data Model Changes) that drives
  both the `noindex` meta and sitemap exclusion, and seed data sets it.
- **Given** either mechanism, **When** real content is later published, **Then**
  real content is indexable without a code change to the exclusion logic (only the
  flag/gate value changes) — verified by a test toggling the flag/env.

---

#### US-6: Wider, higher-quality FAQ coverage for LLM citability (Wave 2, P2)

**As** an LLM answering a traveler's question, **I want** accommodations to carry
useful FAQ content, **so that** Hospeda is a more citable source.

Context: 52% of accommodations have FAQs (avg 1.19). The zero-JS
`FaqAccordion.astro` (`<details>`) and `FAQPageJsonLd` already render them.

**Acceptance Criteria:**

- **Given** the FAQ coverage target (OQ — owner to set the number), **When** seed
  data is updated, **Then** the share of published accommodations with ≥1 FAQ
  meets the target, asserted by a seed-data count.
- **Given** an accommodation with FAQs, **When** its page renders, **Then**
  `FAQPageJsonLd` is emitted (unchanged) and the FAQ content is real (no
  placeholder / lorem).
- **Given** the FAQ additions are seed DATA that already lives in prod, **When**
  they are added, **Then** the seed **dual-write rule** is honored (baseline +
  numbered data-migration) — see Data Model Changes.

---

#### US-7: Programmatic landings stay non-duplicate as they scale (Wave 2, P2)

**As** a search engine, **I want** each programmatic landing to have unique
value, **so that** I do not treat them as near-duplicate doorway pages.

**Acceptance Criteria:**

- **Given** the existing landings (`tipo/[type]`, `comodidades/[slug]`,
  `caracteristicas/[slug]`), **When** they are reviewed, **Then** each has (or gets
  a documented plan for) unique intro prose, not just a filtered list.
- **Given** a proposal to add a geo×type dimension (e.g. `/destino/cabañas/`),
  **When** it is evaluated, **Then** the spec records go/no-go with the
  duplicate-content risk and the unique-prose requirement per landing.

---

#### US-8: Internal SEO docs match current typed-component reality (Wave 2, P2)

**As** a developer, **I want** `apps/web/docs/seo/json-ld-audit.md` to describe
the current typed-component pattern, **so that** I do not follow the obsolete
pre-SPEC-157 inline-object pattern.

**Acceptance Criteria:**

- **Given** `apps/web/docs/seo/json-ld-audit.md`, **When** it is updated, **Then**
  it describes the typed JSON-LD components (not inline objects) and lists all 6
  entities + their components.
- **Given** the doc, **When** a reader follows it, **Then** it points to
  `json-ld-coverage.test.ts` as the enforced contract.

---

#### US-9: Entity content is genuinely multilingual (Wave 3, P2 — likely sub-spec)

**As** an English/Portuguese-speaking traveler or an LLM answering in those
languages, **I want** accommodation/destination `name`/`description`/`faqs` in
my language, **so that** the content is not Spanish-only on `/en/` and `/pt/`.

Context: only UI strings are translated. Entity text fields are Spanish on all
locales. `resolveI18nText` (`resolve-i18n-text.ts:51-74`) exists and works but is
only fed by the amenity/feature catalog (SPEC-172). `seo.ts:8-19` explicitly
notes "no per-locale SEO override field". This is large (schema migration + seed
dual-write + mass translation) and likely warrants its own sub-spec (OQ-2).

**Acceptance Criteria (contract; execution may move to a sub-spec):**

- **Given** an accommodation/destination text field migrated to `{es,en,pt}`
  shape, **When** a page renders in `en`/`pt`, **Then** `resolveI18nText` returns
  the localized value, falling back to `es` when a translation is absent.
- **Given** the migration, **When** it ships, **Then** it follows all three
  project migration carriles (structural via `db:generate`+`db:migrate`; extras if
  needed; seed **dual-write** for live data) — see Data Model Changes.
- **Given** localized entity content, **When** `SEOHead` and JSON-LD render,
  **Then** `title`/`description` and structured-data name/description use the
  locale value (closing the `seo.ts` "no per-locale override" gap).

---

#### US-10: Rendering strategy and Core Web Vitals decided by measurement (Wave 4, P2)

**As** the platform, **I want** the rendering strategy (prerender vs SSR+edge
cache vs pure SSR) and any CWV fix decided by measured numbers, **so that** we do
not "optimize" blindly or chase a myth.

**Anti-myth to document explicitly:** SSR vs prerender does **not** change
indexability — both serve complete HTML; the crawler cannot tell build-time from
request-time. Prerender only helps **CWV** (TTFB via CDN). The catalog is dynamic
→ full prerender does not apply. Correct hybrid: **prerender** truly-static pages
(legal/marketing), **SSR + edge cache/ISR** for the catalog (Hospeda already has
`scheduleRevalidationBatch` + Cloudflare revalidation), **pure SSR** for
account/checkout/search.

**Acceptance Criteria:**

- **Given** the page inventory, **When** the audit runs, **Then** each public page
  is classified as prerender-candidate / SSR+edge-cache / pure-SSR with a reason.
- **Given** the catalog pages, **When** edge caching is verified, **Then** the spec
  records whether Cloudflare actually caches the SSR responses (cache headers /
  hit ratio evidence).
- **Given** any proposed perf fix, **When** it is scheduled, **Then** it is
  **blocked on a before-measurement** of LCP/CLS/INP and re-measured after; no perf
  fix is committed without numbers (recorded on the Linear issue).

### UX Considerations

- **User flows**: no change to real-user flows. Homepage counters still animate;
  destination/detail pages render identically for humans. The only observable
  human-facing change is Wave 1 (demo content may become `noindex` — invisible to
  users, only affects crawlers) and Wave 3 (localized text on `/en/`,`/pt/`).
- **Edge cases**: destination with events but zero accommodations → indexable
  (not empty). Accommodation with 0 FAQs → still valid, just no `FAQPageJsonLd`.
  Stat metric legitimately 0 → hide, never render `0+`.
- **Error states**: stats API failure → section degrades via `home-guards`
  pattern; sitemap builder must tolerate a destination missing counts (treat
  unknown as non-empty to avoid accidentally hiding a real page — fail safe toward
  indexing real content, but this interacts with Wave 1: decide precedence in OQ-4).
- **Loading states**: counters may show a start value briefly for JS users
  (visual), but SSR HTML already has the final number.
- **Accessibility**: preserve `prefers-reduced-motion` handling; `<details>` FAQ
  stays keyboard-accessible; `noindex` has no a11y impact.

### Out of Scope

- **Off-page authority** (Google Search Console setup, backlink acquisition,
  domain age, long-tail editorial content). This is the real competitive gap vs
  Booking/Trivago/Turismo Entre Ríos, but it is **not fixable with code** — it is
  a marketing/content-ops effort. Documented as a follow-up, not implemented here.
- **Re-implementing existing infrastructure** (JSON-LD components, robots.txt,
  sitemap, OG images, hreflang, canonicals) — they exist and work.
- **Mass human translation labor** for Wave 3 content (the schema + plumbing is in
  scope; producing thousands of translated strings is a content-ops task, likely
  in the Wave 3 sub-spec).
- **New CWV performance fixes without measurement** (Wave 4 delivers the
  measurement + strategy; actual perf code fixes are gated on numbers and may spin
  out).

## Part 2: Technical Analysis

### Architecture

- **Pattern**: progressive enhancement (SSR emits final data; islands only
  animate/interact), single-source predicates (thin-content rule shared by page +
  sitemap), CI-enforced contracts (JSON-LD coverage), and measurement-gated perf.
- **Components touched**: `AnimatedCounter.client.tsx` / `StatsSection.astro`,
  `destinos/[...path].astro`, `sitemap-dynamic.xml.ts`, `gastronomia/[slug].astro`,
  `experiencias/[slug].astro`, `json-ld-coverage.test.ts`, seed data + schema
  (Waves 1/3), `resolve-i18n-text.ts` consumers (Wave 3), `astro.config.mjs` /
  page prerender flags (Wave 4), `apps/web/docs/seo/json-ld-audit.md`.
- **Integration points**: existing `home-guards.ts` (reuse for stats fallback),
  `DetailLayout.astro` `noindex` prop (reuse for empty destinations),
  `resolveI18nText` (reuse for Wave 3), `scheduleRevalidationBatch` + Cloudflare
  (Wave 4 edge cache verification).
- **Data flow (Wave 0 counter)**: `statsApi.getPlatformStats()` → `index.astro` →
  `StatsSection.astro` (already has real value) → render final value as static
  text → `AnimatedCounter` receives it as the SSR content and animates *from* a
  start value *to* the value already in the DOM.
- **Conventions**: all code/comments/identifiers in English; RO-RO for any new
  helper; Zod for any new runtime input; named exports only; `import type` for
  types; ≤500 lines/file. Astro components use `Props` interface with `readonly`.

### Data Model Changes

Only Waves 1 (if granular chosen) and 3 change the data model. Waves 0/2/4 are
code/content-only.

| Table/Schema | Change | Description |
|---|---|---|
| `accommodations` (+ seed schema `accommodation.schema.json`) | new (Wave 1, IF OQ-1 = granular) | `isSeed` / `noIndex` boolean flag driving `noindex` meta + sitemap exclusion |
| entity text fields (`name`,`description`,`faqs`) on accommodations/destinations | modify (Wave 3) | migrate from plain text to `{es,en,pt}` localized shape consumed by `resolveI18nText` |

**Migration carriles (project rule — CLAUDE.md).** Any of these that touches live
data must respect the three carriles and the **seed dual-write rule**:

1. **Structural** (new column, type change): `pnpm db:generate` + `pnpm db:migrate`
   (migration file committed; drift guard blocks CI otherwise).
2. **Extras** (Drizzle-invisible: CHECK constraints, special indexes): hand-written
   idempotent file in `packages/db/src/migrations/extras/`, re-applied by
   `pnpm db:apply-extras`.
3. **Seed data** (MANDATORY dual-write): editing a baseline fixture is NOT enough
   for data that already lives in staging/prod. The SAME PR must (a) edit the
   baseline JSON/TS so a fresh DB is correct AND (b) add a numbered data-migration
   via `pnpm db:seed:make <slug>` (`packages/seed/src/data-migrations/`, ledgered in
   `seed_migrations`, run by `pnpm db:seed:migrate`) so already-seeded envs get the
   same delta. A CI drift guard enforces this. Run order on a live env:
   `db:migrate` → `db:apply-extras` → `db:seed:migrate`.

**Migrations needed**: Wave 0 — no. Wave 1 — only if OQ-1 = granular (structural +
seed dual-write). Wave 2 FAQ additions — seed dual-write (data only, no schema).
Wave 3 — structural + seed dual-write (large; likely sub-spec per OQ-2).

### API Design

No new API endpoints. Wave 4 verifies (does not change) that catalog SSR responses
carry appropriate cache headers for Cloudflare edge caching; if a header change is
warranted it is an infra/config adjustment recorded on the Linear issue, not a new
route.

### Dependencies

**External packages:** none new. (Existing: `astro`, `@astrojs/node`,
`@astrojs/sitemap`, `@astrojs/react`.)

**Internal packages affected:**

- `apps/web` — the bulk of Waves 0/2/4.
- `@repo/db` — Waves 1 (granular)/3 schema + migrations.
- `@repo/schemas` — Wave 3 localized-field Zod shapes (source of truth for types).
- `packages/seed` — Waves 1/2/3 data + dual-write data-migrations.
- `@repo/i18n` — Wave 3 relies on `resolveI18nText` fallback behavior.

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Wave 0 counter fix breaks the animation for JS users | M | M | Progressive enhancement: SSR the final value as DOM text, animate *from* start *to* that value; test both raw HTML and hydrated behavior |
| Thin-content predicate diverges between page and sitemap | M | M | Extract the predicate to one shared helper; assert both call sites use it |
| Wave 1 coarse gate accidentally noindexes future real content | M | H | Design the gate so real content is indexable by flipping a flag/env, not editing logic; test the toggle (US-5 last criterion); OQ-4 decides scope |
| Seed change edits baseline only, never reaches live envs | M | H | Enforce dual-write (baseline + numbered data-migration); CI drift guard already blocks baseline-only edits |
| Wave 3 balloons the spec / blocks Wave 0-2 quick wins | H | M | Split Wave 3 to its own sub-spec (OQ-2); keep it P2 and behind the quick wins |
| Wave 4 perf "fixes" chase a myth (SSR vs prerender indexability) | M | M | Document the anti-myth; gate all perf work on before/after CWV measurement |
| JSON-LD gap regrows silently | L | M | Extend `json-ld-coverage.test.ts` to 6 entities (root-cause fix) |

### Performance Considerations

- **Expected load**: unchanged; these are on-page/render changes, not new traffic.
- **Bottlenecks**: Wave 4 explicitly measures LCP/CLS/INP; two client chunks
  already exceed 500 kB (accepted under BETA-78) — revisit only if measurement
  says so.
- **Optimization needs**: verify Cloudflare edge caching of catalog SSR
  (`scheduleRevalidationBatch` revalidation already exists); consider prerender for
  truly-static pages.
- **Monitoring**: record CWV via PostHog web-vitals / Lighthouse before and after,
  attach numbers to the Linear issue.

## Implementation Approach

> Ordered by priority: quick, high-credibility wins first (Wave 0), then the
> owner's P1 demo-exclusion, then P2 polish, then the two large owner-added
> workstreams (i18n, rendering), then testing + docs/cleanup. Each phase is a
> natural pause point.

### Phase 1: Setup & Audit

1. [ ] Enumerate every `client:*` island rendering critical content (prices,
       availability, badges, counts, ratings); produce the compliance checklist
       (US-2). Confirm the counter is the primary offender.
2. [ ] Confirm the exact thin-content predicate and the count fields available in
       `destinos/[...path].astro` and `sitemap-dynamic.xml.ts` (US-3).
3. [ ] Capture a baseline CWV measurement (LCP/CLS/INP) and a page inventory for
       Wave 4 classification (informs OQ-3).

### Phase 2: Wave 0 — credibility bugs (P0)

4. [ ] Fix stat counters: SSR the final value as static text; animate only
       visually via progressive enhancement, reusing the `home-guards.ts:41-50`
       pattern for the failure/zero case (US-1).
5. [ ] Fix flagged islands from the Phase-1 audit so SSR HTML carries the final
       value; document the "SSR emits final datum" principle in `apps/web/CLAUDE.md`
       (US-2).
6. [ ] Pass `noindex={true}` from `destinos/[...path].astro` to `DetailLayout` for
       empty destinations, and exclude them from `sitemap-dynamic.xml.ts` using the
       single shared predicate (US-3).
7. [ ] Add `BreadcrumbJsonLd` to `gastronomia/[slug].astro` and
       `experiencias/[slug].astro`; extend `json-ld-coverage.test.ts` `DETAIL_PAGES`
       to all 6 entities (US-4).

### Phase 3: Wave 1 — demo-content exclusion (P1)

8. [ ] Decide OQ-1/OQ-4 (coarse env/host gate vs granular flag; full-site vs
       selective noindex) — owner decision, present both options with tradeoffs.
9. [ ] Implement the chosen exclusion mechanism so all demo/seed public content is
       out of the index, with a documented path to degrade coarse→granular (US-5).
10. [ ] If granular: add `isSeed`/`noIndex` flag (structural migration + seed
        dual-write) and set it in seed data.

### Phase 4: Wave 2 — coverage & docs polish (P2)

11. [ ] Raise FAQ coverage of published accommodations to the OQ target via seed
        data + dual-write data-migration (US-6).
12. [ ] Review programmatic landings for unique prose; record go/no-go on a
        geo×type dimension with duplicate-content mitigation (US-7).
13. [ ] Update `apps/web/docs/seo/json-ld-audit.md` to the typed-component reality
        and point at the CI contract (US-8).

### Phase 5: Wave 3 — content i18n (P2, likely sub-spec)

14. [ ] Decide OQ-2 (split to sub-spec or keep here). If kept: migrate entity text
        fields to `{es,en,pt}` (structural migration + seed dual-write), wire
        `resolveI18nText` into the consumers, and close the `seo.ts` per-locale gap
        (US-9).

### Phase 6: Wave 4 — rendering strategy & CWV (P2, measurement-gated)

15. [ ] Classify each public page (prerender / SSR+edge-cache / pure-SSR) with
        reasons; document the SSR-vs-prerender anti-myth (US-10).
16. [ ] Verify Cloudflare edge caching of catalog SSR responses (headers / hit
        ratio); prerender truly-static pages if warranted.
17. [ ] For any perf fix, measure CWV before, apply, re-measure after; commit only
        with numbers on the Linear issue (OQ-3).

### Phase 7: Testing

18. [ ] Wave 0 raw-SSR-HTML tests (counters carry final value; empty destinations
        emit `noindex` + absent from sitemap; 6/6 BreadcrumbJsonLd) — asserting on
        the rendered HTML string, not on hydrated DOM.
19. [ ] Wave 1 exclusion test (toggle flag/env → real content indexable, demo not).
20. [ ] Wave 2 seed-coverage assertion; Wave 3 (if in scope) `resolveI18nText`
        fallback + localized SEO/JSON-LD tests.

### Phase 8: Docs & Cleanup

21. [ ] Finalize `apps/web/docs/seo/json-ld-audit.md`; document the off-page gap as
        a follow-up (Out of Scope); file `closeout.md`; record env vars / migrations
        / decisions on the Linear issue; apply any `status-needs-smoke-*` labels if
        Wave 1/4 require live verification.

## Open Questions

- **OQ-1 — seed exclusion mechanism (coarse vs granular).** Now, prod is 100%
  demo, so a coarse env/host gate (all-or-nothing) is the least effort. But it must
  degrade to granular (per-entity `isSeed`/`noIndex` flag) once real content mixes
  in. Present both in Phase 3 as an architecture decision with tradeoffs. *Owner
  decision.*
- **OQ-2 — split Wave 3 (content i18n) to its own sub-spec?** It is large (schema
  migration + seed dual-write + mass translation) and independent of the P0/P1
  quick wins. Recommendation: split. *Owner decision.*
- **OQ-3 — rendering strategy depends on CWV measurement.** No perf fix should be
  committed without before/after LCP/CLS/INP numbers. The measurement (Phase 1 + 6)
  drives the decision, not intuition.
- **OQ-4 — while prod is ~100% demo, noindex the near-entire site or only
  selectively exclude?** Interacts with OQ-1 and with the sitemap fail-safe
  (whether unknown-count destinations lean toward indexing). *Owner decision.*
- **OQ-6-target — FAQ coverage target (Wave 2).** Current 52% (avg 1.19). What is
  the target share / min FAQs per accommodation? *Owner input.*

## Internal Review Notes

**Strengthened items during authoring.**

- Made the counter fix a *general principle* (US-2), not a one-off, per the owner's
  request: SSR emits the final datum, hydration only animates/interacts.
- Tied the thin-content rule to a **single shared predicate** across page +
  sitemap to prevent divergence (a classic drift bug).
- Made the JSON-LD fix include the **root-cause CI fix** (4→6 entities), not just
  patching the two pages, so the gap cannot silently regrow.
- Every Wave 0 acceptance criterion is written against **raw SSR HTML** (no JS), so
  each can become an automatable test and the crawler/LLM-vs-real-user distinction
  is explicit.
- Wave 1/3 explicitly invoke the **three migration carriles + seed dual-write
  rule** so a junior does not silently ship a baseline-only change that never
  reaches live envs.

**Open questions for the owner.** OQ-1 (coarse vs granular exclusion), OQ-2 (split
Wave 3), OQ-4 (near-full-site noindex vs selective), OQ-6-target (FAQ target). OQ-3
is a process gate (measure before fixing), not really a decision.

**DO NOT re-implement.** The JSON-LD components, `robots.txt` (web + API are
deliberately different), `sitemap-dynamic.xml`, OG images, hreflang, canonicals,
filter-facet canonicals, `llms.txt`, and programmatic landings **already exist and
work** (verified in code 2026-07-09). An external audit claimed they were missing;
that was false. This spec is surgical hardening, not a greenfield SEO build. Any
implementer who finds themselves writing a new JSON-LD emitter or a new sitemap
should stop and re-read "Existing infrastructure — DO NOT re-implement".

**Out-of-scope reminder.** Off-page authority (GSC, backlinks, domain age,
editorial long-tail) is the real competitive gap vs Booking/Trivago/Turismo Entre
Ríos but is not a code deliverable — track it as a marketing/content-ops follow-up.
