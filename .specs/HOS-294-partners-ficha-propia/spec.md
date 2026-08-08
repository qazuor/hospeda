---
title: Partners — retire the filtered directory, give each gold partner its own page at /partners/<slug>/
linear: HOS-294
statusSource: linear
created: 2026-08-08
type: feature
areas:
  - web
  - api
  - db
related:
  - HOS-278
  - HOS-172
  - HOS-377
smokeGates:
  # Cloudflare tag purge, sitemap generation and the 404 on the retired URL are
  # only observable against the real VPS + edge.
  - status-needs-smoke-staging
  # The `bronze` enum retirement is a destructive migration over live rows, and
  # an indexed URL disappears from production.
  - status-needs-smoke-prod
---

# Partners — retire the filtered directory, give each gold partner its own page

## 1. Summary

Delete the public partner directory (`/{lang}/partners/`, a filtered grid of large
cards) and replace it with one page per partner at `/{lang}/partners/<slug>/`, granted
only to the `gold` tier. `silver` keeps carousel presence on the home page and nothing
else. The page is what separates the two paid plans; the plan catalog already sells it
(`PARTNER_GOLD_PLAN.description` in `packages/billing/src/config/plans.config.ts`
already reads "carousel presence plus a dedicated /partners/<slug>/ page").

The URL is keyed by `slug`, never by UUID.

## 2. Problem

Partner is a **paid** product. A grayscale logo in a home-page marquee is not something
an organization pays a monthly subscription for, so the two commercial tiers introduced
by HOS-278 D4 (`partner-silver`, `partner-gold`) had no visible difference in the
product. The gold page is the concrete thing being bought.

The page that existed before (`/{lang}/partners/`) was the opposite of what is wanted:
a directory with type/tier filters, large hero images, long descriptions and pagination
— it presented partners as browsable catalog content rather than as allies. The owner
retired it on 2026-07-24 and it does not come back in any form.

## 3. Goals

- **G-1** — Delete the filtered directory: page, card component, transform, tests, its
  i18n keys, and its query-parameter surface on the public API.
- **G-2** — Ship `/{lang}/partners/<slug>/` for gold partners: logo, name, description,
  contact info and social networks.
- **G-3** — Make tier the gate: gold gets a page, silver does not, and a silver logo in
  the carousel resolves to the partner's own site instead of dead-ending.
- **G-4** — Make the page's indexability a single predicate shared by the page and the
  sitemap, so the sitemap can never advertise a URL the page then serves `noindex`.
- **G-5** — Retire the `bronze` tier, which has no plan, no price and no product
  meaning since HOS-278 D4.

## 4. Non-goals

- **NG-1** — No public index of partners. See D-2; the threshold for revisiting is
  written there so a future reader does not re-derive it.
- **NG-2** — No "aliados" entry in the site navigation. `config/navigation.ts:287-288`
  already documents that this drawer is deliberately absent (HOS-131 owns it).
- **NG-3** — No change to the alliance-lead → approval → provisioning pipeline
  (HOS-278). See R-1 for the one place where that pipeline's shape hurts this feature.
- **NG-4** — No mention log / diffusion history. That is HOS-377.
- **NG-5** — No removal of `subscriptionStatus` / `lifecycleState` from the public
  partner payload. Pre-existing, not introduced here; tracked as a follow-up (§12).

## 5. Current baseline

### 5.1 The directory (to be deleted)

| File | What it is |
|---|---|
| `apps/web/src/pages/[lang]/partners/index.astro` | the directory page (189 lines): SSR list, `FilterSidebar`, `Pagination`, `ItemListJsonLd`, `Breadcrumbs` |
| `apps/web/src/components/partner/PartnerCard.astro` | the card (211 lines): logo, type badge, **tier badge**, clamped description |
| `apps/web/src/data/types.ts:1247` | `PartnerCardData` |
| `apps/web/src/lib/api/transforms.ts:2715` | `toPartnerCardProps` |
| `apps/web/test/pages/partners.index.test.ts` | its test |
| `apps/web/test/components/PartnerCard.test.ts` | its test |
| `packages/i18n/src/locales/{es,en,pt}/partners.json` | `listing.*`, `types.*`, `tiers.*` |

`toPartnerData` (`transforms.ts:2762`) is NOT in this table — it feeds the home
carousel and stays.

### 5.2 Inbound links to the directory: none

A sweep of `apps/web/src` finds exactly two references, both self-referential:

- `pages/[lang]/partners/index.astro:61` — the page building its own `baseUrl`.
- `components/partner/PartnerCard.astro:22` — the card's fallback href, pointing back at
  the directory when the partner has no `websiteUrl`.

Not in the nav, not in the footer, not in any breadcrumb outside its own page, no URL in
any i18n string. The admin panel's `/partners/*` routes
(`apps/admin/src/features/partners/config/partners.config.ts:73,110`) are the admin
app's own URL space and are unrelated.

The single external reference is the sitemap:
`apps/web/src/lib/seo/static-sitemap-pages.ts:62` (`/partners/`, `monthly`, `0.6`).

### 5.3 The home carousel (stays)

`components/sections/PartnersSection.astro:52-83` already renders two shapes per logo:
an `<a target="_blank" rel="noopener noreferrer">` when `partner.url` is set, and a
plain `<div>` when it is not. The "logo that leads nowhere" case is therefore already
handled — what is missing is `rel="sponsored nofollow"` and the gold branch.

Data comes from `partnerApi.list({ pageSize: 20 })` (`pages/[lang]/index.astro:94`),
mapped by `toPartnerData`, filtered to items that have a `logoUrl`.

### 5.4 API surface

One public endpoint: `GET /api/v1/public/partners`
(`apps/api/src/routes/partners/public/index.ts`). Its query schema
(`PartnerSearchHttpSchema`, `partner.http.schema.ts:20-25`) accepts `q`, `type`, `tier`,
`subscriptionStatus` — the directory's filter surface. Both `PartnerSearchHttpSchema`
and `PartnerPublicSchema` are consumed by this route and nothing else in the monorepo.

There is **no** `GET /public/partners/{slug}`. `PartnerModel.findBySlug`
(`partner.model.ts:188`) exists with no public route exposing it.

Public visibility is already enforced at the model layer:
`findByFilters` and `countActivePartners` (`partner.model.ts:74-81`, `152-156`) both
require `lifecycleState = 'ACTIVE' AND subscription_status = 'active'` and
`deleted_at IS NULL`. `PartnerService._executeSearch` re-forces `lifecycleState`.

Two defects observed while inventorying, both pre-existing:

- `subscriptionStatus` is accepted as a query param and silently discarded —
  `findByFilters` never reads it.
- The route's `options.cacheTTL: 300` is consumed by nothing. `cacheTTL` is declared in
  `apps/api/src/utils/route-factory.ts:31` and read nowhere.

`/api/v1/public/partners` appears in none of the three lists in
`apps/api/src/middlewares/cache.constants.ts`.

### 5.5 Tiers and plans

`PartnerTierEnum` (`packages/schemas/src/enums/partner-tier.enum.ts`) has three values:
`bronze`, `silver`, `gold`. The column is a Postgres enum (`PartnerTierPgEnum`,
`partner.dbschema.ts:29`), indexed by `partners_tier_idx`.

`ALL_PARTNER_PLANS` (`plans.config.ts:659`) has three plans — `partner-listing`
(legacy, deliberately kept ACTIVE because a live row may still point its `plan_id` at
it), `partner-silver`, `partner-gold`. **There is no bronze plan.** Two seed fixtures
still carry `tier: "bronze"` (`003-partner-panaderia-la-espiga.json`,
`005-partner-ong-amigos-del-rio-uruguay.json`).

`tier` is written by the admin at provisioning time
(`alliance-lead.partner-provisioning.ts:32-38`, documented there as a commercial
decision), not by the payment. Tier and paid plan can diverge.

## 6. Decisions

Recorded here because each one closes an open question the issue posed.

### D-1 — A silver logo links to the partner's own site (OQ-1)

In the carousel, `websiteUrl` is rendered as
`<a href target="_blank" rel="sponsored nofollow noopener">`. With no `websiteUrl`, the
logo renders unlinked — the shape the component already produces.

`rel="sponsored nofollow"` means the outbound link carries no SEO cost. The carousel is
the eleventh section of the home page, below the fold, rendered grayscale at 0.65
opacity: a credibility strip, not a funnel step, so the traffic it leaks is marginal.
Gold keeps the larger benefit — an internal, indexable page.

A gold logo links to its own `/{lang}/partners/<slug>/` instead, as an ordinary internal
link (no `rel`, no `target`).

### D-2 — No public index (OQ-2)

The gold page is reachable from the home carousel and from `sitemap-dynamic.xml`. This
matches `/autores/<slug>/` (HOS-375), which likewise has detail pages and no index.

With two gold partners in the seed and an empty table in production (HOS-172), an index
page today is thin content, and "minimal index" is one review cycle away from becoming
the directory again.

**Threshold for revisiting**: at least 8 simultaneously active gold+silver partners, and
an owner decision that the index earns its own URL. Below that, the answer is no.

### D-3 — The gold page is indexable via a shared predicate (OQ-3)

A single predicate — modeled on `evaluateAuthorIndexability`
(`apps/web/src/lib/seo/author-indexable.ts`), which the author page and the dynamic
sitemap already share for exactly this reason — decides both whether the page sends
`noindex` and whether the sitemap emits the URL. `sitemap-dynamic.xml.ts:461-468`
records the failure it prevents: *"the sitemap advertising a URL the page then serves as
noindex"*.

Gold partner URLs are emitted into `sitemap-dynamic.xml`, not the static sitemap: they
are DB-driven.

### D-3b — A partner that stops qualifying returns 410 Gone

**Assumption, not an explicit owner decision** — flagged so it can be overridden. It
follows the established repo pattern: `alojamientos/[slug].astro:141` propagates 410 for
soft-deleted entities *"so crawlers/LLM fetchers deindex"*, and six detail pages already
do this. A gold partner that is downgraded, revoked or unpaid had a real, indexed page
that is deliberately gone — which is the case 410 models.

"Previously qualified" is **not** read from any history, because nothing stores it. The
rule is decidable from the current row alone:

| Row state | Response |
|---|---|
| `tier = gold`, ACTIVE, `active` | 200 |
| `tier = gold`, failing visibility | **410** — it is a published page that went away |
| `tier != gold` | **404** — this URL was never served |

A gold partner downgraded to silver therefore 404s rather than 410s. That is a
deliberate simplification, not an oversight: recovering the 410 would mean storing a
"was published" flag, and the URL leaves the sitemap either way. If the deindex latency
of a downgrade ever matters, the cheap fix is a `publishedAt` stamp, not history
reconstruction.

### D-4 — The old `/{lang}/partners/` URL returns 404 (OQ-3)

The directory folder is deleted outright; the middleware's 404 rewrite serves the custom
404 page. Line 62 of `static-sitemap-pages.ts` is removed in the same change.

Deliberate consequence: deindexing is slower than a 410 would make it, and there is no
explicit "gone" signal. Accepted for a page with zero inbound internal links.

**Trap**: `test/lib/seo/static-sitemap-pages.guard.test.ts` walks `src/pages/[lang]` and
fails when a parameter-free page is classified in neither list — but it does **not**
detect a `STATIC_SITEMAP_PAGES` entry whose page was deleted. Removing the folder
without removing line 62 leaves the sitemap advertising a 404 and CI stays green. AC-11
covers this.

### D-5 — API: trim the params, add the detail route, keep the payload additive (OQ-4)

- `PartnerSearchHttpSchema` loses `q`, `type`, `tier`, `subscriptionStatus`, keeping only
  the pagination fields from `BaseHttpSearchSchema`. Safe: the schema has exactly one
  consumer, the public route, and its only caller after G-1 is the carousel, which sends
  `pageSize` alone.
- New `GET /api/v1/public/partners/{slug}`, backed by the existing
  `PartnerModel.findBySlug`, returning 404 for a slug that does not resolve and for a
  partner that fails the D-6 gate.
- `PartnerPublicSchema` grows **additively** with `contactInfo` and `socialNetworks`
  (per `packages/schemas/docs/guides/schema-compat-policy.md` — additive only). No field
  is removed.
- `/api/v1/public/partners` is added to `PUBLIC_CACHE_ENDPOINTS`
  (`apps/api/src/middlewares/cache.constants.ts`).

### D-6 — The gate is tier + visibility, and `bronze` is retired (OQ-6)

A partner has a page when **all three** hold:

```
tier === PartnerTierEnum.GOLD
lifecycleState === ACTIVE
subscriptionStatus === 'active'
```

The last two are the filters the model already applies to every public read, so the gate
adds exactly one condition to an existing invariant and fails closed.

`bronze` is retired in this spec: existing rows migrate to `silver` (the nearest tier
that still exists, and the one that grants no page), and the value is removed from
`PartnerTierEnum` and from the Postgres enum.

A partner whose `plan_id` still points at the legacy `partner-listing` plan is gated by
its `tier` like any other row — the gate never reads `plan_id`.

### D-7 — Directory pieces are deleted, not recycled (OQ-5)

`PartnerCard.astro`, `PartnerCardData` and `toPartnerCardProps` are deleted. The page
gets its own `toPartnerDetailProps`. Recycling them would carry the directory's model —
tier badge, `isFeatured`, three-line clamped description — into the thing meant to
replace it.

i18n: `partners.types.*` is kept (the page shows "Comercio" / "ONG" / "Institución");
`partners.listing.*` and `partners.tiers.*` are deleted in all three locales. **The tier
is never rendered publicly** — it is internal commercial state, and printing "Gold" on a
page only gold partners have is meaningless.

## 7. Data model / contracts

### 7.1 Migrations

Three carriles are involved. Run order on a live environment is
`db:migrate` → `db:apply-extras` → `db:seed:migrate`.

1. **Structural** (`packages/db/src/migrations/`, via `pnpm db:generate`) — remove
   `bronze` from the `partner_tier` Postgres enum. Postgres has no `ALTER TYPE ... DROP
   VALUE`: the migration must create a new type, `ALTER TABLE ... ALTER COLUMN ... TYPE
   ... USING`, drop the old type, and recreate `partners_tier_idx` if the rewrite drops
   it. **The data migration in step 3 must land first in wall-clock order** — the type
   cannot drop a value any row still holds.
2. **Seed data** (`packages/seed/src/data-migrations/`, via `pnpm db:seed:make`) — two
   numbered modules: one updating live `partners` rows from `bronze` to `silver`, one
   inserting the `partner` row into `revalidation_config`.
3. **Seed baseline** — the dual-write rule (root `CLAUDE.md`, HOS-25) applies to both:
   `packages/seed/src/data/partner/003-*.json` and `005-*.json` change `tier` to
   `silver`, and `packages/seed/src/data/revalidationConfig/001-revalidation-config-defaults.json`
   gains a `partner` entry. Editing only the baseline is the silent bug the drift guard
   (`scripts/check-seed-dual-write.sh`) exists to catch.

### 7.2 Endpoints

| Method | Path | Change |
|---|---|---|
| GET | `/api/v1/public/partners` | params trimmed to pagination |
| GET | `/api/v1/public/partners/{slug}` | **new** — single gold partner, 404 otherwise |
| GET | `/api/v1/protected/partners/mine` | unchanged |
| * | `/api/v1/admin/partners/*` | unchanged (10 routes) |

### 7.3 Cache tags

`packages/cache-tags/src/vocabulary.ts` gains `partner` in
`CACHE_TAG_ENTITY_PREFIXES` and **no** entry in `CACHE_TAG_COLLECTIONS` — there is no
page that lists partners, which is exactly the documented rationale for `attraction` and
`pointOfInterest` being absent from that map (`vocabulary.ts:62-75`). Inventing
`list-partner` would add vocabulary nothing emits and nothing purges.

A partner write must purge its own entity tag **and** `CACHE_TAG_HOME`: the carousel
lives on the home page, so a logo, name or `websiteUrl` change is a change to the home
page's rendered output.

## 8. UX / UI behavior

### 8.1 The page

One column, no hero image, no gallery. Logo, name, organization type, description,
contact info, social links. It is a business card, not a listing.

All copy goes through `t()`. No new client namespace is needed — the page is a plain
Astro page with no island, so `CLIENT_I18N_KEY_PREFIXES`
(`apps/web/src/lib/i18n-client-namespaces.ts:57`) is not involved. **If** an island is
later added to this page, its key prefix must be registered there or the browser renders
raw keys in production while dev looks fine (the dev server ships the whole dictionary).

The page must be **actor-blind**: it renders identical HTML for an anonymous visitor and
a signed-in one, since it is edge-cacheable. No session read in the frontmatter, no
personalized fragment.

### 8.2 The carousel

| Tier | Href | Attributes |
|---|---|---|
| gold | `/{lang}/partners/<slug>/` | none (internal link) |
| silver, `websiteUrl` set | `websiteUrl` | `target="_blank" rel="sponsored nofollow noopener"` |
| silver, no `websiteUrl` | — | unlinked `<div>` (current behavior) |

### 8.3 Downgrade gold → silver

The already-indexed page starts returning **410 Gone** (D-3b), the URL leaves
`sitemap-dynamic.xml` on its next generation because the shared predicate now returns
false, and the carousel logo switches to the silver shape. A cache purge for that
partner's tag plus `home` is required, or the edge keeps serving the page after the
downgrade.

## 9. Acceptance criteria

#### AC-1 — a gold partner has a page

- **Given** an active partner with `tier = gold`, `lifecycleState = ACTIVE` and
  `subscriptionStatus = 'active'`
- **When** a visitor requests `/es/partners/<slug>/`
- **Then** the response is 200 and its SSR HTML contains the partner's name, logo,
  description, contact info and social links, and does **not** contain the tier.

#### AC-2 — a silver partner has no page

- **Given** an active partner with `tier = silver`
- **When** a visitor requests `/es/partners/<slug>/`
- **Then** the response is 404.

#### AC-3 — the gate fails closed on visibility

- **Given** a partner with `tier = gold` but `subscriptionStatus != 'active'` or
  `lifecycleState != ACTIVE`
- **When** a visitor requests its page
- **Then** the response is 410 and the URL is absent from `sitemap-dynamic.xml`.

#### AC-3b — a non-gold slug is a 404, not a 410

- **Given** a partner with `tier = silver` (whatever its visibility state)
- **When** a visitor requests its page
- **Then** the response is 404.

#### AC-4 — the page is never addressable by UUID

- **Given** a gold partner's UUID
- **When** a visitor requests `/es/partners/<uuid>/`
- **Then** the response is 404 (no UUID route exists).

#### AC-5 — the carousel resolves each tier correctly

- **Given** a home page rendering one gold and one silver partner, both with `websiteUrl`
- **When** the SSR HTML is inspected
- **Then** the gold logo links to `/es/partners/<slug>/` with no `rel` and no `target`,
  and the silver logo links to its `websiteUrl` with `rel="sponsored nofollow noopener"`
  and `target="_blank"`.

#### AC-6 — a partner with no website is not a broken link

- **Given** a silver partner with `websiteUrl = null`
- **When** the home page renders
- **Then** its logo renders inside a non-anchor element and no empty `href` is emitted.

#### AC-7 — sitemap and page agree, by construction

- **Given** the set of partners in the database
- **When** `sitemap-dynamic.xml` is generated
- **Then** every partner URL it emits is served 200 + indexable, and no partner URL it
  omits is served indexable — both sides deriving from the same exported predicate.
  A test must assert the two call the same function, not merely that they agree today.

#### AC-8 — the directory is gone

- **Given** the merged branch
- **When** `apps/web/src` is searched
- **Then** `pages/[lang]/partners/index.astro`, `components/partner/PartnerCard.astro`,
  `PartnerCardData`, `toPartnerCardProps` and the `partners.listing.*` / `partners.tiers.*`
  i18n keys no longer exist in any of the three locales.

#### AC-9 — the directory is gone from the API too

- **Given** the public partner list endpoint
- **When** it is called with `?q=x&type=ngo&tier=gold&subscriptionStatus=active`
- **Then** none of those parameters affects the result set.

#### AC-10 — the old URL 404s

- **Given** the merged branch
- **When** `/es/partners/` is requested
- **Then** the response is 404 and renders the custom 404 page.

#### AC-11 — the sitemap does not advertise the deleted page

- **Given** the merged branch
- **When** `/sitemap-static.xml` is generated
- **Then** it contains no `/partners/` entry, and `STATIC_SITEMAP_PAGES` no longer
  declares one.

#### AC-12 — bronze is gone

- **Given** a database seeded before this change with `bronze` partners
- **When** the migration chain runs
- **Then** no row holds `bronze`, `PartnerTierEnum` exports two values, the Postgres
  enum has two labels, and `partners_tier_idx` still exists.

#### AC-13 — the page is actor-blind

- **Given** the same gold partner page
- **When** it is requested anonymously and with a signed-in session
- **Then** the two HTML responses are byte-identical.

#### AC-14 — a partner write purges the right tags

- **Given** an admin updating a gold partner's logo
- **When** the revalidation service fires
- **Then** the purge carries that partner's entity tag and `home`, and no `list-partner`
  tag is emitted anywhere.

## 10. Risks

- **R-1 — every newly provisioned partner has `websiteUrl = null`, so D-1's silver link
  is empty on day one.** The lead form collects `website` as `required: false` **free
  text**, serialized into the `message` blob (`lib/forms/alliance-lead-message.ts:80-85`),
  and `provisionPartnerFromLead` (`alliance-lead.partner-provisioning.ts:193-210`) writes
  only slug, name, type, tier, lifecycle and owner. To populate it afterwards the partner
  submits through `PartnerOwnerContentSchema`, which routes it to `pendingWebsiteUrl` and
  **waits for admin approval** (`partner.service.ts:520-538`). Mitigated by AC-6, not
  solved. Making `website` a typed lead field is out of scope (NG-3) and belongs in a
  follow-up on HOS-278.
- **R-2 — the enum migration is destructive and ordered.** The data migration must be
  applied before the structural one, or the `ALTER TYPE` fails on live rows. On a fresh
  DB the order is irrelevant; on staging/prod it is not. `db:push` must never be used
  here.
- **R-3 — thin content.** Two gold pages, each carrying a logo and a short description,
  are close to what Google treats as thin. The shared predicate must include a minimum
  content condition (a non-empty description at least), or the pages get indexed and
  penalized as doorway-ish. This is the same judgment `isThinDestination` encodes for
  destinations.
- **R-4 — the sitemap keeps advertising `/partners/`** if line 62 is not removed. The
  guard does not catch it (D-4). AC-11 is the only thing standing between this and a
  404 in the sitemap.
- **R-5 — stale edge cache after a downgrade.** Without the purge in AC-14, a downgraded
  gold partner's page keeps being served from Cloudflare until the TTL expires.

## 11. Open questions

All five questions the Linear issue posed are resolved in §6 (D-1 … D-7), plus the
tier-gate question that surfaced during the baseline audit. One item stays explicitly
marked as an assumption rather than a decision:

- **OQ-A (D-3b)** — 410 vs 404 for a partner that stops qualifying. Written as 410 by
  analogy with the soft-delete precedent; not an explicit owner call. Cheap to flip.

## 12. Implementation notes

- **Follow-up, not this spec**: `PartnerPublicSchema` exposes `subscriptionStatus` and
  `lifecycleState` to anonymous callers. Both are constant by construction (the model
  filters on them), so they inform nothing and leak commercial state. Removing them is a
  breaking schema change under the additive-only policy and predates HOS-294 — file it
  as a separate `NOSPEC` item.
- **Follow-up, not this spec**: `options.cacheTTL` is declared in `route-factory.ts:31`
  and consumed nowhere. Every route setting it believes it is configuring caching and is
  not.
- The two tests deleted with the directory must be replaced, not merely removed: the
  page needs its own SSR-HTML assertions, and the carousel needs a per-tier href test
  (AC-5) — that branch is the whole product decision, and it is one `rel` attribute wide.
- `PartnerModel.findBySlug` returns any partner regardless of visibility. The gate belongs
  in the service or route layer, and its test must use a row that **exists** but fails the
  gate — a nonexistent slug 404s before the gate ever runs and proves nothing.

## 13. Linear

Canonical tracking:
HOS-294
