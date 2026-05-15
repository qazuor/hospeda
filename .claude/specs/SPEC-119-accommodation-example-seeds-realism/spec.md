---
spec-id: SPEC-119
title: Accommodation Example Seeds Realism
type: improvement
complexity: medium
status: completed
created: 2026-05-14
completed: 2026-05-14
completionRef: PR #1093 — feat(seed): SPEC-119 accommodation example seeds realism
tags:
  - seeds
  - accommodation
  - fixtures
  - example-data
  - pricing
  - media
---

# SPEC-119 — Accommodation Example Seeds Realism

## 1. Overview

### Goal

Make the 104 example accommodation seeds in `packages/seed/src/data/accommodation/<destination>/*.json` look believable in dev, staging, and demo environments. Two problems:

1. **Images**: 51 specific accommodations have unrelated, repeated, or missing images.
2. **Pricing**: All 104 accommodations use only `{ price, currency }` — none exercise the rich `additionalFees`/`discounts` surface that the schema supports. The uniformity is unrealistic compared to what real hosts would publish.

### Motivation

- Stakeholder demos and beta-tester walkthroughs surface obvious "this is fake data" moments (hotel showing a kitchen photo, every camping with identical galleries, listings missing images entirely).
- The pricing UI in Admin and Web can't be validated against real-world variety because the dataset never exercises `cleaning`, `pets`, `weekly discount`, `others[]`, or null-price cases.
- Production roll-in will eventually replace this data, but the demo/staging window before that is months long.

### Success criteria

1. The 51 listed slugs each have visually plausible images for their accommodation type. No two campings share the same gallery.
2. A documented type-to-image pool exists so future seeds (and these ones) draw from a curated set per type.
3. Each of the 104 accommodations has a featured image and a gallery of 5-24 photos, all drawn from its type's 25-URL pool, with no two campings sharing more than two gallery URLs.
4. Across all 104 accommodations, pricing follows 4 realism tiers (≈25% / 25% / 30% / 20%). Every `additionalFees` field is exercised by at least 5 entries. At least 3 entries use `additionalFees.others[]` and at least 2 use `discounts.others[]`.
5. `pnpm db:fresh-dev` runs clean. `pnpm test --filter=@repo/seed` passes. Workspace `pnpm typecheck && pnpm lint` green. JSON Schema validation green.
6. Admin and Web render correctly when `price` is null/absent (no NPE, no broken layout).

---

## 2. User Stories & Acceptance Criteria

### US-1 — As a stakeholder browsing staging, the demo data looks credible

**Given** I open the public web at `/accommodations` and scroll through cards
**When** I see a camping listing
**Then** its featured image and gallery must show outdoor/tents/nature photography, NOT kitchen or hotel-lobby stock photos
**And** when I open two different camping detail pages, their galleries must NOT be identical
**And** every accommodation in the 51-item list must have a non-empty featured image and gallery

### US-2 — As a stakeholder demoing the pricing UI, I see the full range of fee/discount scenarios

**Given** I browse 10 random accommodations in staging
**When** I open each detail page
**Then** I should see a realistic mix:
- Some without any price (the listing says "Consultá disponibilidad" or equivalent)
- Some with only base price + currency
- Some with base + 1-2 additional fees (e.g., cleaning, pets) or 1 discount
- Some fully loaded with multiple fees AND discounts including custom `others[]` entries

### US-3 — As a developer adding new accommodation seeds, I can pick images from a curated pool

**Given** I am adding a new camping/apartment/hostel/hotel/cabin/room/country_house/house example
**When** I look for type-appropriate images
**Then** I find a documented list (either TS const or markdown reference) under `packages/seed/` with 8-12 curated Pexels URLs per type
**And** rotating through that pool lets me avoid duplicating galleries already used by sibling seeds

### US-4 — As a CI gate, the seed package keeps validating

**Given** the seed JSON files have been edited
**When** CI runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, and JSON Schema validation
**Then** all checks pass with zero new failures
**And** `pnpm db:fresh-dev` (or `pnpm --filter @repo/seed seed --reset --example`) completes successfully

### US-5 — As an Admin user editing an accommodation, the form handles missing prices

**Given** I open a Tier-0 (no-price) accommodation in Admin → Accommodations → Detail
**When** the page renders
**Then** there is no JS error, no broken layout
**And** the price field shows empty/null state with a clear "Sin precio definido" affordance
**And** saving the form without a price succeeds (schema allows nullish)

---

## 3. Technical Approach

### 3.1 Slug → File mapping

User-supplied slugs are in `<type>-<slug>` form (e.g., `camping-camping-rio-vida`). Actual JSON files use the pattern `NNN-accommodation-<destination>-<type>-<slug>-<dest_norm>.json`. The first task (T-001) produces a CSV mapping `user_slug → json_file_path → current_type → destination` for the 51 entries, used as the working manifest for image edits.

Verification: the JSON `slug` field is `<slug>-<destination_norm>`, and the `id` field starts with `NNN-accommodation-<destination>-<type>-<slug>-...`. Match by suffix on the user-supplied slug after stripping the leading type.

### 3.2 Image pool strategy

Approach: **TypeScript const + JSON URLs**. Create `packages/seed/src/data/accommodation/_image-pool.ts` exporting a `IMAGE_POOL_BY_TYPE: Record<AccommodationType, ImageVariant[]>` for documentation/reuse, but **the JSON files keep hardcoded URLs** (seeds are JSON-loaded; sharing TS across JSON requires loader changes which are explicitly out of scope).

Rationale:
- The pool TS is the source of truth and reference. Future seeds copy URLs from it.
- A small companion script (`packages/seed/scripts/check-image-pool-coverage.ts`, T-019) lints that every JSON's image URLs appear in the pool, catching drift on PR.

Pool size: **25** unique Pexels URLs per type × 8 types = **200 curated URLs**.

Per-accommodation assignment (deterministic, seeded by hash of `accommodation.id`):

- **Featured image**: 1 URL picked at random from the type's 25-URL pool.
- **Gallery count**: a random integer `N` in `[5, 24]`.
- **Gallery**: `N` distinct URLs picked at random from the 24 remaining URLs (pool minus featured).

Why this shape:

- 25 URLs / type gives `25 × C(24,N)` distinct (featured, gallery) combinations per accommodation — well over a million per gallery size — so collision is statistically impossible at the scale we operate (104 accommodations).
- Variable gallery count (5..24) prevents the "every listing has exactly 5 photos" tell that screams "fake seed data". Real hosts publish anywhere from 5 to 25+ photos; matching that variance is the realism the spec wants.
- Seeding on `accommodation.id` keeps the assignment deterministic. Re-runs of the assignment script produce the same gallery for the same listing — important for reviewability and reproducibility, and for the camping-uniqueness test to be stable.

Constraints:

- Every URL is from a Pexels CDN (`https://images.pexels.com/photos/<id>/...`), HTTP 200 verified, and content-verified to match its caption.
- No URL appears in two types' pools (zero cross-type pollution).
- Camping uniqueness rule (test invariant): any two camping galleries differ in ≥3 URLs. With pool 25 and min gallery 5, the chance of collision is vanishingly small but the test guards against regressions.

Quality verification: the PR description must include the pool list grouped by type and a sample gallery for one accommodation per type, for human visual review.

### 3.3 Pricing distribution strategy

Target distribution across 104 accommodations:

| Tier | Description | Count | % |
|------|-------------|-------|---|
| 0 | No price (`price` field absent or null) | 24-28 | ~25% |
| 1 | Base only (current state) | 24-28 | ~25% |
| 2 | Base + 1-2 fees OR base + 1 discount | 29-33 | ~30% |
| 3 | Base + 3-5 fees + 1-2 discounts (≥1 from `others[]`) | 19-23 | ~20% |

Anti-clustering rules:
- Each accommodation type (camping/apartment/hostel/etc.) must have representation in **all 4 tiers** — no all-Tier-0 type, no all-Tier-3 type.
- Tier 0 must be spread across destinations: no destination has more than ~30% of its accommodations as Tier 0 (e.g., a 10-listing destination has ≤3 Tier 0; a 5-listing destination has ≤2). This prevents a "this destination is broken" demo experience.
- The 14 `additionalFees` named fields (cleaning, tax, lateCheckout, pets, bedlinen, towels, babyCrib, babyHighChair, extraBed, securityDeposit, extraGuest, parking, earlyCheckin, lateCheckin, luggageStorage) must each appear in **≥5 entries** across the dataset.
- ≥3 entries use `additionalFees.others[]` (custom fee names).
- ≥2 entries use `discounts.others[]` (custom discount names).
- Tier 2 and Tier 3 fees/discounts must use realistic ARS values appropriate to base price (e.g., a $7,500/night camping shouldn't have a $50,000 cleaning fee).

A planning script (T-020) generates a CSV `accommodation_id → assigned_tier → fees → discounts` from a deterministic algorithm (seeded RNG by accommodation id) so the distribution is reviewable and reproducible.

### 3.4 Schema confirmation

`packages/schemas/src/entities/accommodation/subtypes/accommodation.price.schema.ts` declares:

```ts
// Excerpt — confirmed during exploration
export const AccommodationPriceSchema = PriceSchema.extend({
  additionalFees: AccommodationAdditionalFeesInfoSchema.optional(),
  discounts: AccommodationDiscountInfoSchema.optional()
});
// On Accommodation entity: price: AccommodationPriceSchema.nullish()
```

`.nullish()` allows both `undefined` (Tier 0 via omission) and `null` (Tier 0 via explicit null). The seed must use **omission** (drop the `price` key entirely) for Tier 0 to mirror what real omitted-price hosts would produce. JSON Schema validator must accept the missing key.

### 3.5 Files affected

**Modified** (104 + maybe Admin/Web):
- `packages/seed/src/data/accommodation/<11 destinations>/*.json` — all 104 files for pricing; 51 of them for images too.

**Created**:
- `packages/seed/src/data/accommodation/_image-pool.ts` — curated image pool by type.
- `packages/seed/scripts/check-image-pool-coverage.ts` — drift linter, optional in CI initially.
- `packages/seed/scripts/plan-pricing-tiers.ts` — generates the tier assignment CSV.
- `packages/seed/test/accommodation-seeds-realism.test.ts` — invariants (distribution, fee coverage, gallery uniqueness for campings, image pool membership).
- `.claude/specs/SPEC-119-accommodation-example-seeds-realism/spec.md` — this file.
- `.claude/tasks/SPEC-119-accommodation-example-seeds-realism/{state.json,TODOs.md}`.

**Possibly modified** (only if a quick grep finds them broken on null price):
- `apps/web/src/components/.../AccommodationCard.astro` (or similar)
- `apps/admin/src/routes/.../accommodation/$id.tsx`

### 3.6 Patterns to follow

- JSON edits done in small batches by `(type, destination)` so each commit is reviewable.
- No `git add .` — stage individual JSON files per the project rule.
- Conventional commits: `chore(seed): fix camping images for paranacito accommodations`, `chore(seed): apply Tier 2 pricing to 8 apartments`, etc.
- Atomic commits, each with seed tests green.

### 3.7 Testing strategy

The spec defines WHAT to test; tasks define WHEN. No tests = not done.

**Unit / data invariant tests** (new file `packages/seed/test/accommodation-seeds-realism.test.ts`):
1. Image pool membership: every URL in every accommodation JSON must appear in `IMAGE_POOL_BY_TYPE[accommodation.type]`.
2. Camping gallery uniqueness: any two camping JSONs must differ in ≥3 of their gallery URLs.
3. Gallery count distribution: every accommodation's gallery count is in `[5, 24]`. The dataset shows variance — standard deviation of gallery counts across the 104 entries must be ≥ 3 (proves the random sizing actually fired and didn't collapse to a constant).
4. Featured image uniqueness within type: at least 70% of accommodations of the same type have a unique featured image (no clumping). For small-pool types (e.g. HOUSE with 9 accommodations / 25 pool), this should trivially pass.
5. Pricing distribution: tier counts across 104 entries fall within target ranges (±5%).
6. Fee coverage: each named `additionalFees` field appears in ≥5 entries across the dataset.
7. `others[]` coverage: ≥3 with custom fees, ≥2 with custom discounts.
8. JSON Schema validation: all 104 JSON files still validate against `packages/seed/src/schemas/accommodation.schema.json`.

**Integration tests**: existing `packages/seed/test/` runs untouched (if anything asserts on price shape, update minimally to accept nullish — that's part of the task).

**E2E / smoke**:
- `pnpm db:fresh-dev` must complete cleanly. Validated locally; CI doesn't run this but the seed test invariants approximate it.
- Manual visual review: open 3 random accommodations of each type in the local Web app, confirm images and price block render correctly across all 4 tiers.

**Admin/Web consumer safety**:
- Quick grep: `rg "accommodation\\?\\.price|accommodation\\.price\\." apps/` — confirm every read either uses optional chaining or has a fallback. If not, fix as part of T-021/T-022.

### 3.8 Risks

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R1 | Admin/Web crashes on null price | High (Tier 0 is now ~25% of dataset, so a quarter of any listing page hits the null path) | High (blocks demo) | Pre-flight grep (T-002); fix all unsafe price reads before publishing Tier 0 (T-021/T-022); consumer audit is no longer optional |
| R2 | JSON Schema rejects omitted price | Low | Medium | Schema declares `.nullish()` (confirmed); validate one Tier 0 entry in isolation before batch (T-003) |
| R3 | Pexels URLs decay (photos removed) | Low | Low | Pool is curated once; if a URL 404s later it's a separate housekeeping fix |
| R4 | Distribution drifts from target through hand edits | Medium | Low | Planning script (T-020) is deterministic; invariant test (T-027) is the gate |
| R5 | Camping galleries still feel repetitive even after pool rotation | Medium | Medium | Pool has 10 distinct URLs / 15 campings = ≤2 URLs of overlap on average; if needed, expand camping pool to 15 URLs |
| R6 | Image fixes break visual-regression tests (if any exist in the web app) | Low | Medium | Check `apps/web/test/` for snapshot tests on accommodation cards |
| R7 | User-supplied slug list misidentifies a JSON file | Low | Low | Mapping CSV (T-001) is reviewed before edits |

---

## 4. Out of Scope

- Changes to `AccommodationPriceSchema` (rich enough already).
- Changes to `accommodations.seed.ts` factory or `runExampleSeeds` orchestrator.
- Adding/removing accommodations.
- Changing destinations, amenities, features, FAQs, or owners of existing accommodations.
- Touching `required` seeds (only `example/` is in scope).
- Cloudinary migration (Pexels stays).
- Image-pool-loaded-at-runtime (loader stays JSON-only; pool TS is documentation+linter only).
- Rewriting the seed JSON Schema or moving to TypeScript-only seed authoring.

---

## 5. Implementation Approach (Phased Tasks Outline)

The full task breakdown lives in `.claude/tasks/SPEC-119-accommodation-example-seeds-realism/`. Summary:

### Phase 1 — Discovery & Mapping (setup)
- T-001 Map the 51 user slugs to JSON file paths (CSV manifest).
- T-002 Grep Admin/Web for unsafe `price` reads. Document findings.
- T-003 Smoke test: edit ONE JSON to omit `price`, run JSON Schema validator, confirm pass.

### Phase 2 — Image Pool Foundation (setup)
- T-004 Curate 10 Pexels URLs per accommodation type (8 types × 10 = 80 URLs). Manual selection.
- T-005 Write `packages/seed/src/data/accommodation/_image-pool.ts` with the typed pool.
- T-006 Document the pool in `packages/seed/docs/image-pool.md`.

### Phase 3 — Image Fixes by Type (core)

Each task in this phase rewrites the `media.featuredImage` and `media.gallery[]` of every accommodation of the given type using a deterministic random assignment seeded by `accommodation.id`. Featured = one URL from the 25-URL type pool; gallery = a random count `N ∈ [5, 24]` of additional URLs from the same pool. The same script powers all 7 tasks; the per-task split exists for atomic-commit reviewability.

- T-007 Refresh camping images (all 15 camping JSONs).
- T-008 Refresh apartment images (all 20 apartment JSONs).
- T-009 Refresh hostel images (all 10 hostel JSONs).
- T-010 Refresh hotel images (all 14 hotel JSONs).
- T-011 Refresh cabin images (all 12 cabin JSONs).
- T-012 Refresh room images (all 13 room JSONs).
- T-013 Refresh country_house and house images (all 11 + 9 = 20 JSONs).

### Phase 4 — Pricing Tier Planning (core)
- T-014 Write `packages/seed/scripts/plan-pricing-tiers.ts` (deterministic seed → tier assignment).
- T-015 Run script, produce `packages/seed/docs/pricing-tier-plan.md` with the 104-entry assignment.
- T-016 Define ARS value ranges per type (so $7,500/night camping doesn't get $50k cleaning fee).

### Phase 5 — Pricing Tier Application (core)
- T-017 Apply Tier 0 (no-price) to assigned ~24-28 entries.
- T-018 Apply Tier 1 (base only) — confirm assigned ~24-28 entries are already correct, no edit.
- T-019 Apply Tier 2 (base + partial) to assigned ~29-33 entries.
- T-020 Apply Tier 3 (full stack) to assigned ~19-23 entries, including `others[]` custom fees/discounts.

### Phase 6 — Consumer Safety (integration)
- T-021 If T-002 found unsafe price reads in Web, fix them.
- T-022 If T-002 found unsafe price reads in Admin, fix them.
- T-023 Smoke `pnpm db:fresh-dev` end-to-end locally.

### Phase 7 — Testing (testing)
- T-024 Write `accommodation-seeds-realism.test.ts` — image pool membership invariant.
- T-025 Same file — camping gallery uniqueness invariant.
- T-026 Same file — pricing distribution invariants.
- T-027 Same file — fee coverage + `others[]` coverage invariants.
- T-028 Write `check-image-pool-coverage.ts` lint script + add to `packages/seed/package.json` scripts.
- T-029 Run `pnpm test --filter=@repo/seed` until green.
- T-030 Run workspace `pnpm typecheck && pnpm lint` until green.

### Phase 8 — Visual Review (testing)
- T-031 Manual visual review: open 3 random of each type in local Web. Capture in PR description.
- T-032 Manual visual review of Admin accommodation detail for one Tier 0 and one Tier 3 entry.

### Phase 9 — Docs & PR (docs + cleanup)
- T-033 Write PR description with tier distribution tally + pool sample.
- T-034 Update `packages/seed/CLAUDE.md` if any new convention (image pool, etc.) deserves a callout.
- T-035 Open PR targeting `staging` and link to this SPEC.

Total: 35 atomic tasks. Average complexity ≤4. Critical path: T-001 → T-004 → T-005 → T-007..T-013 → T-014 → T-015 → T-017..T-020 → T-024..T-029 → T-033 → T-035.

---

## 6. References

- Pricing schema: `packages/schemas/src/entities/accommodation/subtypes/accommodation.price.schema.ts`
- Seed JSON schema: `packages/seed/src/schemas/accommodation.schema.json`
- Seed factory: `packages/seed/src/example/accommodations.seed.ts`
- Seed CLI: `packages/seed/src/cli.ts`
- Project policy on commits/branches: `CLAUDE.md` and `.claude/docs/git-branch-workflow.md`
- User input list (51 slugs to fix images): captured in this spec § 1 and § 3.1.
