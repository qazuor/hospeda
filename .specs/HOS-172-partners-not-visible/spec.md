---
title: Partners not visible — empty prod table + home carousel never renders
linear: HOS-172
statusSource: linear
created: 2026-07-15
type: fix
areas:
  - web
  - db
  - devops
---

# HOS-172 — Partners not visible — empty prod table + home carousel never renders

## 1. Summary

Nothing appears under the `/partners` public directory or the home page's
partners carousel, in prod or locally. This is **two independent bugs**, each
verified against the actual code and data:

- **Bug A**: `partners` is empty on prod because the 6 example fixtures were
  added as a seed *baseline* with no accompanying data-migration, so they never
  landed on the already-seeded prod DB.
- **Bug B**: the home page carousel (`PartnersSection.astro`) never fetches
  partner data at all — it always renders with an empty array, regardless of
  what's in the DB.

Fixing one does **not** fix the other. Both are in scope per the owner's
2026-07-15 decision (see §5).

## 2. Problem

Reported by the owner 2026-07-15: `hospeda.com.ar` shows no partners anywhere
— the home carousel section doesn't render, and `/partners` shows "0
resultados". The initial triage (recorded on the Linear issue) hypothesized a
lifecycle/subscription-status filter bug. That hypothesis is **disproven** —
see §5.1.

## 3. Goals

- G-1: Backfill the 6 example partner fixtures onto prod via a numbered seed
  data-migration (Bug A).
- G-2: Wire the home page to fetch and pass real partner data into
  `PartnersSection` (Bug B).
- G-3: Leave a clear, verifiable trail (SQL check) confirming the backfill
  landed correctly.

## 4. Non-goals

- NG-1: Fixing the systemic dual-write CI gap that let Bug A's fixtures ship
  without a migration — that is HOS-173 (referenced, not solved here).
- NG-2: The prod-DB cleanup (removing example data once real partners exist)
  — deferred to the owner's post-HOS-171 cleanup plan (§5).
- NG-3: Building `/admin/partners` CRUD, if it doesn't already exist — out of
  scope, not mentioned by either bug.
- NG-4: Fixing MercadoPago-on-staging (the root cause the owner flagged as the
  real first link in the chain) — that needs its own issue per the owner's
  comment, not part of this spec.

## 5. Current baseline

### 5.1 The filter hypothesis is disproven — do not re-investigate it

Verified directly, not taken on faith:

- The 6 fixtures (`packages/seed/src/data/partner/00{1..6}-partner-*.json`)
  each contain literal `"subscriptionStatus": "active"` and
  `"lifecycleState": "ACTIVE"` (verified by grep on all 6 files — every file
  has exactly these two values at lines 11/12).
- `PartnerModel.findByFilters` (`packages/db/src/models/partner/partner.model.ts:51-57`)
  filters on `eq(partners.lifecycleState, 'ACTIVE')` AND
  `eq(partners.subscriptionStatus, 'active')` when `includeInactive` is falsy
  — an exact match to the fixture values.
- `PartnerModel.countActivePartners` (`partner.model.ts:129-131`) uses the
  identical two `eq()` conditions.
- `PartnerService._executeSearch` (`packages/service-core/src/services/partner/partner.service.ts:179-193`)
  force-sets `lifecycleState = LifecycleStatusEnum.ACTIVE` on every
  public/protected search, consistent with the fixtures.
- `checkCanSearch` (`packages/service-core/src/services/partner/partner.permissions.ts:118-130`)
  grants `ACCESS_API_PUBLIC` actors access unconditionally — not a permission
  gate issue either.
- The PR #2181 casing fix (`'ACTIVE'`/`'active'` vs the wrong casing) is
  intact in the current code — no regression.

**Conclusion: code and data agree.** The filter is not the bug. Do not
re-open this line of investigation.

### 5.2 Bug A — `partners` table empty on prod

**Root cause**: `packages/seed/src/example/partners.seed.ts` (added in commit
`24ce27a5f`, "feat(seed): add example partner fixtures for public directory",
2026-07-08, present on `main`) reads 6 static fixtures from
`packages/seed/src/data/partner/*.json` via `createSeedFactory`, and is wired
into `runExampleSeeds()` at `packages/seed/src/example/index.ts:93`. This is
correctly cabled — the seed step itself is not broken.

The gap is that it shipped as a **baseline-only** change, with no matching
seed data-migration:
`ls packages/seed/src/data-migrations/` lists `0001`–`0014` (verified) and
none of them touch partners.

Per the project's dual-write rule (root `CLAUDE.md` → "Seed dual-write rule
(MANDATORY, HOS-25)"), a baseline change with no data-migration means: a
*fresh* DB build (`db:fresh`, `db:fresh-dev`) gets the 6 partners correctly,
but a DB that was already seeded before 2026-07-08 and is never reset — which
describes prod — never receives them. Prod's `partners` table is expected to
show 0 rows.

**A more precise correction to the Linear issue's framing of the systemic
cause**: the issue states the CI dual-write guard "excludes on purpose all
`example/**/*.json`". Checked directly against
`scripts/check-seed-dual-write.sh` (comment block, lines ~20–55): the guard
is actually an **allowlist** of specific `required`-seeder-consumed paths
(`data/{amenity,attraction,destination,exchangeRate,exchangeRateConfig,
feature,revalidationConfig,sponsorshipLevel,sponsorshipPackage,postTag,
pointOfInterest,poiCategory}/**`, `data/user/required/**`, `data/tag/
{internal,system}-*.json`, plus the billing config constants). `data/partner/**`
is not on that list, and — more importantly — the design explicitly scopes
out *anything loaded via an `example/*.seed.ts` orchestrator*, regardless of
which physical folder the JSON lives in (`partners.seed.ts` reads from
`src/data/partner/`, not `src/example/`, but is still wired through
`runExampleSeeds()`). The guard's own stated rationale (script comment,
~line 55) is that example data "is regenerated non-deterministically on every
full reseed... and does not need a live-env backfill" — an assumption that is
false for prod today, because prod is never reset. Net effect is the same as
the issue describes (this class of change ships with zero CI signal), but the
mechanism is "example-orchestrator fixtures are categorically excluded by
design", not a literal `example/**/*.json` path exclusion. See §9 cross-ref
to HOS-173.

**Local dev also shows 0 partners, but for an unrelated reason**: an
untouched local dev DB is simply *older* than partners entirely — it also
shows `points_of_interest = 0` and `seed_migrations = 0` (both features
postdate this DB). This is not a code bug; the fix is `pnpm db:fresh-dev`,
not a data-migration. Do not conflate this with the prod cause — the prod
fix targets a live DB that must NOT be reset.

### 5.3 Bug B — home carousel never renders

Independent of Bug A. Even with 6 rows in `partners`, the carousel stays
empty because the home page never asks for the data:

- `apps/web/src/pages/[lang]/index.astro:235` renders
  `<PartnersSection locale={locale} />` — no `partners` prop passed.
- `apps/web/src/components/sections/PartnersSection.astro`: `Props.partners`
  is `readonly PartnerData[]`, optional (line 20); destructured with default
  `[]` (line 23); the entire `<section>` is gated on
  `{partners.length > 0 && (...)}` (line 28). With no prop, this is always
  false.
- `partnerApi.list()` (`apps/web/src/lib/api/endpoints.ts:1680-1695`, calls
  `GET /api/v1/public/partners`) has exactly one caller in the whole `apps/web`
  tree: `apps/web/src/pages/[lang]/partners/index.astro:43` (verified via
  grep for `partnerApi\.` across `apps/web/src`). The home page never calls
  it.

**Shape mismatch worth flagging for the fix**: `PartnersSection`'s
`PartnerData` (`apps/web/src/data/types-ui.ts:198-213`) is a *different*
shape from the `/partners` listing page's `PartnerCardData` (built by
`toPartnerCardProps`, `apps/web/src/lib/api/transforms.ts:2268-2294`).
`PartnerData` needs `logoPath` (root-relative image path) and `aspectRatio`
(numeric, for CLS-safe layout — see its JSDoc, `types-ui.ts:205-212`, which
suggests "~3.5 for typical wide logos" as a default), neither of which
`toPartnerCardProps` produces (it maps to `logoUrl`, no aspect ratio). The
public `Partner`/`PartnerPublic` API shape does not carry image dimensions,
so a home-page transform needs an explicit default `aspectRatio` — this is a
design decision for implementation, not resolved by this spec (see §11
OQ-1).

## 6. Proposed design

### Bug A — data-migration backfill

Add a new numbered seed data-migration following the shape of
`packages/seed/src/data-migrations/0009-hos-113-points-of-interest.ts` (the
closest existing precedent: idempotent-by-slug catalog backfill reading the
same fixture JSON the baseline seed reads):

1. Scaffold via `pnpm db:seed:make partners-backfill` (or similar slug) →
   `packages/seed/src/data-migrations/0015-<slug>.ts`.
2. `meta.group: 'example'` (matches how `partners.seed.ts` is registered —
   under `runExampleSeeds()`, not a required seeder) and
   `meta.destructive: false` (pure insert-if-missing, nothing deleted or
   overwritten — same rationale 0009 documents).
3. `up(ctx)`: load the 6 fixture files from `packages/seed/src/data/partner/`
   via `loadJsonFiles` (same utility 0009 uses), reuse the existing
   `partnerNormalizer` logic from `partners.seed.ts` (or an equivalent
   inline normalization — strip `$schema`/`id`), and idempotently `create`
   each partner via `ctx.models.PartnerModel` gated on `findOne({ slug })`
   returning null (partners have a unique `slug`, per the model's
   `findBySlug` method).
4. Run `pnpm db:seed:migrate` against prod once the migration is written and
   reviewed.

### Bug B — wire the home page to real data

1. In `apps/web/src/pages/[lang]/index.astro`, call `partnerApi.list()`
   server-side (SSR, same pattern the other home sections that fetch data
   use directly in frontmatter — e.g. `FeaturedAccommodationsSection`'s
   caller — not `server:defer`, since `PartnersSection` is a static Astro
   component with no client interactivity, unlike the auth-dependent
   islands).
2. Add a new transform in `apps/web/src/lib/api/transforms.ts` (following the
   file's "one transform per entity/shape" convention — see
   `toPartnerCardProps` at line 2268 for the sibling pattern) that maps the
   API partner shape to `PartnerData` (`name`, `logoPath` from `logoUrl`,
   `url` from `websiteUrl`, `aspectRatio` — resolve OQ-1 before implementing
   this field).
3. Pass the mapped array as `<PartnersSection locale={locale} partners={...} />`.
4. On API failure, follow the established web convention: no hardcoded
   fallback (per `apps/web/CLAUDE.md`, only the pricing page gets a
   fallback) — an empty/failed fetch should degrade to `partners={[]}`,
   which is the section's own existing default and safely no-ops.

## 7. Data model / contracts

No schema changes. No new API endpoints — `GET /api/v1/public/partners` via
`partnerApi.list()` already exists and is exercised by `/partners`.

New file: `packages/seed/src/data-migrations/0015-<slug>.ts` (exact number
depends on what's pending at implementation time — check
`pnpm db:seed:migrate:status` first).

New function: one transform in `apps/web/src/lib/api/transforms.ts` (exact
name TBD at implementation, e.g. `toPartnerMarqueeData`).

## 8. UX / UI behavior

No visual redesign. Once both bugs are fixed:

- `/partners` shows the 6 example partners (already works once Bug A lands —
  the listing page's fetch/transform/render path is unaffected by Bug B).
- The home page's "Nuestros socios" marquee section renders with the same 6
  logos, respecting the section's existing grayscale/hover/reduced-motion
  behavior (unchanged, `PartnersSection.astro` styles are not touched by
  this fix).

## 9. Acceptance criteria

- **AC-1**: Given prod before the fix, when querying
  `SELECT slug, subscription_status, lifecycle_state, deleted_at FROM partners;`,
  then it returns 0 rows.
- **AC-2**: Given the data-migration has been applied to prod via
  `pnpm db:seed:migrate`, when running the same query, then it returns
  exactly 6 rows, one per fixture slug, each with
  `subscription_status = 'active'`, `lifecycle_state = 'ACTIVE'`,
  `deleted_at IS NULL`.
- **AC-3**: Given the data-migration has already run once, when it is run
  again, then it makes no changes and reports 0 created / 6 skipped
  (idempotent by slug, matching the 0009 precedent).
- **AC-4**: Given a fresh local DB (`pnpm db:fresh-dev`), when visiting
  `/es/partners/`, then the 6 example partners are listed (this already
  works today once the DB isn't stale — confirms Bug A's local-vs-prod
  distinction from §5.2).
- **AC-5**: Given the home page fix is deployed and `partners` has ≥1 row,
  when loading `/es/`, then the "Nuestros socios" section renders with real
  partner logos (not empty, not the pre-fix always-absent state).
- **AC-6**: Given `partnerApi.list()` fails or returns 0 items, when loading
  `/es/`, then the partners section simply does not render (existing
  `partners.length > 0` guard) — no error, no broken layout.
- **AC-7**: Bug A and Bug B are independently verifiable: reverting the
  home-page wiring (Bug B fix) must not empty `/partners`; not running the
  data-migration (Bug A fix pending) must not prevent the home page code
  change from compiling/rendering (it just renders with 0 partners until the
  backfill runs).

## 10. Risks

- **R-1 — Public indexability of fictional data.** The site is publicly
  reachable with no `noindex`. The 6 example partners are fictional
  organizations with realistic Concepción del Uruguay names, including
  "Universidad Tecnológica del Litoral" — close enough to the real UTN
  Facultad Regional Concepción del Uruguay to potentially confuse. The owner
  has explicitly decided to proceed (see below) with the understanding that
  this needs a search-index check at cleanup time — not a blocker for this
  spec, but must not be forgotten when the prod cleanup happens.
- **R-2 — This backfill is explicitly temporary.** Per the owner's plan
  (§5's context below), once HOS-171 ships, staging MP works, and prod gets
  cleaned, example data (including these 6 partners) stops belonging in
  prod. Whether the 6 rows this migration inserts get explicitly reverted at
  cleanup time, or simply left in place until crowded out by real partners,
  is an open product decision (see OQ-2) — not something this spec resolves.
  The migration itself does not need to be *reversible* to satisfy this
  spec (no `down()` mechanism exists in this migration system per the 0009
  precedent — migrations are forward-only, matching the schema-migration
  convention in `packages/db/CLAUDE.md`); if cleanup wants to remove these
  rows it will do so with an explicit delete/data-migration of its own at
  that time.
- **R-3 — Scope creep into HOS-173.** The systemic gap (dual-write guard
  design excludes anything loaded via `example/*.seed.ts`) may have let
  other undetected baseline-only changes ship the same way. HOS-173's own
  audit (not yet spec'd) may surface more missing backfills; if so, batching
  this partners migration together with those (instead of landing it solo)
  may be more efficient — a call for whoever picks up HOS-173, not blocking
  this fix from shipping now.

## 11. Open questions

- **OQ-1**: What `aspectRatio` value (or computation) should the new home
  transform use for `PartnerData`, given the public partner API response
  carries no logo image dimensions? Candidates: a fixed default (e.g. `3.5`,
  per the field's own JSDoc suggestion) applied to all partners, or omit the
  field's precision entirely and accept minor CLS. Needs a decision before
  implementing §6 Bug B step 2.
- **OQ-2**: At prod cleanup time (post-HOS-171, post-staging-MP-verification),
  do the 6 backfilled partners get explicitly removed, or do they stay until
  organically replaced by real partner signups? Not this spec's call — flagged
  for the owner's cleanup plan.
- **OQ-3**: Should the partners data-migration be batched with whatever
  HOS-173's audit finds, or land independently now? Leaning toward "land now,
  independently" since Bug A is a confirmed, isolated gap and the owner's
  6-partners decision is already resolved — but worth a note on HOS-173 when
  that spec is written.

## 12. Implementation notes

- Follow `packages/seed/src/data-migrations/0009-hos-113-points-of-interest.ts`
  as the structural template — idempotency check pattern
  (`findOne({ slug })` before `create`), `loadJsonFiles` usage, and the
  counts/summary return shape are all directly reusable.
- The `partnerNormalizer` in `packages/seed/src/example/partners.seed.ts:12-15`
  (strips `$schema`/`id`, forwards the rest) is the exact normalization the
  data-migration needs to replicate so the two paths can't drift, matching
  0009's own stated rationale for reusing `normalizePointOfInterestSeedItem`.
- Before writing the migration, run `pnpm db:seed:migrate:status` to confirm
  the next available number (documented as `0015` here based on `0001`–`0014`
  existing at spec time, 2026-07-15 — may have moved by implementation time).
- HOS-172's own Linear issue already carries the pending prod verification
  query (§9 AC-1/AC-2) — run it before and after applying the migration and
  record the result on the Linear issue per the project's smoke-verification
  habits for prod-affecting changes.
- No `status-needs-smoke-*` label is self-evidently required (this is a
  backfill + a wiring fix, not a payment/timing/cron flow), but the
  prod-only nature of Bug A's fix means a manual prod check (the AC-1/AC-2
  query) is still mandatory before considering it done — see §9.

## 13. Linear

Canonical tracking:
HOS-172

Related: HOS-173 (systemic dual-write guard gap — not yet spec'd, blocked on
its own audit). HOS-166 (commerce self-checkout — where this was discovered
during investigation, per the Linear issue body).
