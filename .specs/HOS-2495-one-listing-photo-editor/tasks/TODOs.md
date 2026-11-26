# HOS-2495: One listing photo editor with the effective photo cap

## Progress: 0/39 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-019 -> T-020 -> T-024 -> T-025 -> T-027 -> T-028 -> T-033 -> T-039 (11 steps, complexity 26)
**Parallel Tracks:** 7 tasks start with no dependencies

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — schemas: add max_photos_per_venue / max_photos_per_experience limit keys
  - Add two ROWS to packages/schemas/src/catalog/limit-keys.ts: ['max_photos_per_venue','vertical','SUM','ARCHIVE','COMMERCIAL'] and ['max_photos_per_experience',...].
  - Blocked by: none
  - Blocks: T-002, T-004, T-005, T-006, T-008, T-010, T-013
- [ ] **T-002** (complexity: 2) — schemas: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL and partitionGalleryByCap
  - New packages/schemas/src/catalog/listing-photo-limit.ts exporting LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL (accommodation/venue/experience) and pure partitionGalleryByCap({items, cap}) -> {shown, hidden}; cap null = unlimited (nothing hidden), uses isUnlimitedLimit.
  - Blocked by: T-001
  - Blocks: T-003, T-014, T-021, T-022
- [ ] **T-003** (complexity: 2) — schemas: ListingPhotoAllowanceSchema
  - New packages/schemas/src/api/listing/listing-photo-allowance.schema.ts with the response shape of spec section API Design (limitKey, status, cap, source, used, hiddenCount, coverAllowed, breakdown|null with contributions kind/value/sources).
  - Blocked by: T-002
  - Blocks: T-019
- [ ] **T-004** (complexity: 2) — scripts: two 20-photo packs in the commercial catalog
  - In scripts/production-catalog/commercial-catalog.ts PRODUCTION_ADDON_CATALOG add limitPack entries extra-photos-venue-20 and extra-photos-experience-20 (key max_photos_per_venue / _experience, value 20, monthlyPesos 5_000, vertical venue / experience), same lifecycle as extra-photos-20.
  - Blocked by: T-001
  - Blocks: T-005, T-008
- [ ] **T-005** (complexity: 3) — db: migration 0253 with catalog keys and the two add-ons
  - Create a custom drizzle migration (journal + snapshot, like 0251) named hos2495_listing_photo_keys_and_packs at the next free number.
  - Blocked by: T-001, T-004
  - Blocks: T-007, T-030
- [ ] **T-006** (complexity: 1) — seed: PRODUCTION_PLAN_LISTING_PHOTO_LIMIT_GRANTS constant
  - Add the constant to packages/seed/src/catalog/next-version-entitlements.ts (venue-basico 15, venue-pro 30, venue-premium 50, experience-basico 15, experience-pro 30, experience-premium 50) and re-export it from the export block of scripts/production-catalog/catalog.ts.
  - Blocked by: T-001
  - Blocks: T-007
- [ ] **T-007** (complexity: 3) — seed: data-migration 0194 granting photo limits on every plan version
  - packages/seed/src/data-migrations/0194-hos-2495-listing-photo-limits-grant.ts modelled on 0191: meta {group:'required', destructive:false, contentOnly:true}; set hospeda.catalog_additive_grant='HOS-2495', insert plan_version_limit for every version of the six plans when missing, reset setting, return counts.
  - Blocked by: T-005, T-006
  - Blocks: T-030, T-032
- [ ] **T-008** (complexity: 2) — i18n: billing strings for the new keys and packs
  - In packages/i18n/src/locales/{es,en,pt}/billing.json add limit.<key>.{title,message_one,message_other,cta}, comparison.limitLabel.<key>, limitHelp.<key> for both keys and addon.<slug>.{name,description} for both packs.
  - Blocked by: T-001, T-004
  - Blocks: T-010
- [ ] **T-009** (complexity: 2) — i18n: account.listingPhotos namespace
  - Add account.json listingPhotos.* in es/en/pt: description.{accommodation,venue,experience} (plural), noPlan.{accommodation,venue,experience}, plansCta, unlimited, breakdown parts (plan, trial, addons, courtesy, permanentGrant, base, preTrialDraft, total), overCapBadge ('No se muestra: superás tu tope'), overCapSummary (plural), loading, readFailed.
  - Blocked by: none
  - Blocks: T-026
- [ ] **T-010** (complexity: 1) — web: register new keys in KNOWN_LIMIT_KEYS and addon-category
  - Add both keys to apps/web/src/lib/billing-limit-error.ts KNOWN_LIMIT_KEYS and to apps/web/src/lib/billing/addon-category.ts as 'media'.
  - Blocked by: T-001, T-008
  - Blocks: none

### Core Phase

- [ ] **T-011** (complexity: 2) — verticals: extract collectFoldableSources from resolveEffectiveSet
  - Refactor packages/verticals/src/effective-set/resolve-effective-set.ts so source collection and grantsOf resolution live in an exported-internal collectFoldableSources(args) used by resolveEffectiveSet.
  - Blocked by: none
  - Blocks: T-012
- [ ] **T-012** (complexity: 3) — verticals: resolveEffectiveLimitBreakdown
  - New packages/verticals/src/effective-set/limit-breakdown.ts: resolveEffectiveLimitBreakdown({...ResolveEffectiveSetArgs, keys}) -> per key {total, contributions[{kind, value|'unlimited', sources}]} built from collectFoldableSources + selectPlegableSources, total = foldPlegableSet value.
  - Blocked by: T-011
  - Blocks: T-019
- [ ] **T-013** (complexity: 1) — verticals: pre-trial draft keys for venue and experience
  - Add venue and experience photo keys to PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL (packages/verticals/src/authorization/pre-trial-draft-limit.ts), fix its docblock, extend pre-trial-draft-limit.test.ts and the resolve-listing-access DRAFT fallback test for venue.
  - Blocked by: T-001
  - Blocks: T-019
- [ ] **T-014** (complexity: 2) — api: generalize photo-limit helpers per vertical
  - In apps/api/src/utils/listing-access/photo-limit.ts add listingGalleryPhotoLimit(vertical) (requested = visible non-featured + 1 via the vertical's media model) and listingCoverPhotoLimit(vertical) (requested 1); keep accommodationGalleryPhotoLimit as a thin alias for existing callers.
  - Blocked by: T-002
  - Blocks: T-015, T-016, T-019
- [ ] **T-015** (complexity: 2) — api: step 7 on venue/experience protected addMedia and addFeaturedMedia
  - Declare listingAccess.limit on routes/venue/protected/addMedia.ts, addFeaturedMedia.ts and the experience equivalents.
  - Blocked by: T-014
  - Blocks: T-030, T-033
- [ ] **T-016** (complexity: 3) — api: upload-entity listing branches and rate-limit constant
  - Split UPLOAD_LISTING_ACCESS venue/experience into gallery and featured entries with the new limit helpers (literal listingAccess objects, G2).
  - Blocked by: T-014
  - Blocks: T-030, T-037
- [ ] **T-017** (complexity: 2) — service-core: drop literal gallery caps in listing services
  - Remove the getGalleryCap gallery-count checks from accommodation.service.ts (~3681), venue/venue.media.ts (~181) and experience/experience.media.ts (~189).
  - Blocked by: none
  - Blocks: T-037
- [ ] **T-018** (complexity: 2) — api: drop literal caps for listing verticals in admin upload and stock import
  - In routes/media/admin/upload.ts (~441-467) and routes/media/admin/import-stock.ts (~153) skip getGalleryCap when entityType is accommodation/venue/experience; keep the owner step 7 for accommodation.
  - Blocked by: none
  - Blocks: T-037
- [ ] **T-019** (complexity: 3) — api: resolveListingPhotoAllowance util
  - New apps/api/src/utils/listing-access/photo-allowance.ts: cap from the same effectiveSet port and DRAFT fallback step 7 uses; used and hiddenCount via the media model + partitionGalleryByCap; breakdown via resolveEffectiveLimitBreakdown, null + warn log when totals differ or it throws.
  - Blocked by: T-003, T-012, T-013, T-014
  - Blocks: T-020
- [ ] **T-020** (complexity: 2) — api: GET {accommodations|venues|experiences}/{id}/photo-allowance
  - Three protected routes (getPhotoAllowance.ts) with listingAccess READ_OWN like sectionStates.ts, response ListingPhotoAllowanceSchema; register in the vertical routers.
  - Blocked by: T-019
  - Blocks: T-024, T-035
- [ ] **T-021** (complexity: 2) — api: trim venue/experience public galleries to the owner's cap
  - In apps/api/src/utils/public-listing-projector.ts trim media.gallery with partitionGalleryByCap using the owner effective set already read by readOwnerEffectiveSets; never touch featuredImage.
  - Blocked by: T-002
  - Blocks: T-031, T-032
- [ ] **T-022** (complexity: 3) — api: trim accommodation public galleries and add no-store on lookup failure
  - Same trim in apps/api/src/utils/public-accommodation-projection.ts; add onEffectiveSetFailure no-store hook to accommodation public routes (getById, getBySlug, getByDestination, getTopRatedByDestination, similar, user/feature/destination lists) like venue getBySlug:137.
  - Blocked by: T-002
  - Blocks: T-031
- [ ] **T-023** (complexity: 3) — api: coverage-changed gallery revalidation listener
  - New apps/api/src/utils/listing-media/gallery-coverage-revalidation.ts subscribeListingGalleryRevalidation(): for listing verticals invalidateEffectiveSetsForUser first, then getListingPublicationPorts().afterCommit.revalidate({vertical, listingIds}) for the owner's PUBLISHED non-deleted listings; errors logged not thrown; in-flight tracking like featured-sync-listener.
  - Blocked by: none
  - Blocks: T-032, T-035

### Integration Phase

- [ ] **T-024** (complexity: 2) — web: createListingPhotoApi adapter
  - New apps/web/src/lib/api/listing-photo-api.ts createListingPhotoApi({vertical}) delegating to accommodationMediaApi / listingMediaApi and normalizing rows to ListingPhotoRow; add getAllowance endpoint calls in endpoints-protected.ts.
  - Blocked by: T-020
  - Blocks: T-025, T-026
- [ ] **T-025** (complexity: 3) — web: generalize photo hooks to {api, vertical, listingId}
  - Change use-photo-section.ts and use-photo-gallery-mutations.ts to take the adapter; every error path via translateApiError; refetch allowance after upload batch, delete and cover change.
  - Blocked by: T-024
  - Blocks: T-027
- [ ] **T-026** (complexity: 3) — web: resolveGalleryCapView and description states with breakdown
  - Replace resolveEffectiveGalleryCap in photo-section-helpers.ts with resolveGalleryCapView({allowance,isLoading,failed}) -> loading/limited/unlimited/none/failed; remove MAX_PHOTOS_LIMIT_KEY; PhotoSectionDescription renders the five states with account.listingPhotos copy, per-vertical pricing link and the breakdown line (only when breakdown non-null).
  - Blocked by: T-024, T-009
  - Blocks: T-027
- [ ] **T-027** (complexity: 3) — web: over-cap marking and summary alert
  - SortablePhotoGallery marks approved visible non-featured tiles at index >= cap (partitionGalleryByCap) with the badge, dimmed CSS Module class, aria-describedby; controls stay enabled.
  - Blocked by: T-025, T-026
  - Blocks: T-028, T-034
- [ ] **T-028** (complexity: 2) — web: one PhotoSection for both fotos.astro pages
  - PhotoSection props become {vertical, listingId, publishContext?}; propiedades/[id]/editar/fotos.astro and comercio/[vertical]/[id]/editar/fotos.astro render it (videos widget untouched).
  - Blocked by: T-027
  - Blocks: T-033, T-036, T-038
- [ ] **T-029** (complexity: 2) — admin: drop literal caps from listing gallery managers
  - GalleryManager.tsx and ListingGalleryManager.tsx show the count without /N and never block uploads client-side; ContentGalleryManager unchanged.
  - Blocked by: none
  - Blocks: T-037

### Testing Phase

- [ ] **T-030** (complexity: 3) — api integration: effective cap from plan, packs and grants
  - apps/api/test/integration/listing-photos/effective-cap.integration.test.ts on a real DB: venue-pro + 1 pack = 50 (51st refused), 2 packs = 70, permanent grant 30, experience and accommodation (extra-photos-20, 70 > old literal 50).
  - Blocked by: T-005, T-007, T-015, T-016
  - Blocks: T-034
- [ ] **T-031** (complexity: 2) — e2e: give guest-11's seed owner coverage
  - apps/e2e/tests/guest/guest-11-listing-detail-mobile.spec.ts T-033 needs >1 slide; read fixtures permanent-grant-flow.ts / listing-owner-trial.ts and grant coverage to the owner of paraiso-calido-country-house-colon before the assertion.
  - Blocked by: T-021, T-022
  - Blocks: T-039
- [ ] **T-032** (complexity: 3) — api integration: over-cap hidden publicly and reappears
  - apps/api/test/integration/listing-photos/over-cap-public.integration.test.ts: 20 photos at cap 15 -> 15 public, rows unchanged; add pack + notice -> 20; expire -> 15; listener purge called.
  - Blocked by: T-021, T-023, T-007
  - Blocks: T-034
- [ ] **T-033** (complexity: 3) — e2e: venue photo cap journey
  - New apps/e2e/tests/verticals/listing-photos-cap.spec.ts with fixtures/listing-editor-helpers.ts: trial venue owner uploads to 15, cap line visible, 16th refused with localized message (no 'Limit reached'), reorder persists after reload.
  - Blocked by: T-028, T-015
  - Blocks: T-039
- [ ] **T-034** (complexity: 2) — Mutation pass over the new behaviours
  - Apply each mutation listed in the spec's Testing Strategy table one at a time, run the owning test file, confirm it fails with a non-zero test count, revert.
  - Blocked by: T-030, T-032, T-027
  - Blocks: T-039

### Docs Phase

- [ ] **T-035** (complexity: 2) — Docs: error contract, route architecture, web CLAUDE.md
  - Update apps/api/docs/error-contract.md (listing uploads no longer 422 GALLERY_LIMIT_EXCEEDED), apps/api/docs/route-architecture.md (photo-allowance routes), apps/web/CLAUDE.md (one PhotoSection), and the docblock of apps/web/src/pages/[lang]/presentacion/comer-y-salir/index.astro:33 ('flat 30').
  - Blocked by: T-020, T-023
  - Blocks: T-039
- [ ] **T-036** (complexity: 1) — Smoke checklist entry for staging
  - Add the HOS-2495 steps to the staging section of docs/billing/smoke-checklist.md: buy extra-photos-venue-20 in the MP sandbox, cap moves to +20, cancel/expire hides photos, check a venue gallery right after deploy (R-1).
  - Blocked by: T-028
  - Blocks: T-039

### Cleanup Phase

- [ ] **T-037** (complexity: 2) — Shrink ENTITY_GALLERY_CAPS to content entities
  - Remove accommodation/venue/experience from ENTITY_GALLERY_CAPS and narrow getGalleryCap's parameter to 'destination'|'event'|'post' so a listing call is a type error; rg gate for getGalleryCap/ENTITY_GALLERY_CAPS usages with listing verticals returns nothing.
  - Blocked by: T-016, T-017, T-018, T-029
  - Blocks: T-039
- [ ] **T-038** (complexity: 2) — Delete the legacy venue/experience editor files
  - Delete components/listing/editor/{MediaSection.client.tsx,use-listing-media.ts,use-listing-media-upload.ts,listing-media-upload.ts,media-section-helpers.ts} and their tests (after T-028 ported them); add apps/web/test/static-guards/no-legacy-listing-media-section.test.ts asserting no import remains.
  - Blocked by: T-028
  - Blocks: T-039
- [ ] **T-039** (complexity: 2) — Final gate: guards, typecheck, affected suites
  - Run pnpm check:guards, scripts/check-seed-dual-write.sh on the committed diff, pnpm env:check:registry, CI=true pnpm typecheck, biome with --max-diagnostics=400, and each affected package's suite one at a time (never all at once).
  - Blocked by: T-031, T-033, T-034, T-035, T-036, T-037, T-038
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-009, T-011, T-017, T-018, T-023, T-029
Level 1: T-002, T-004, T-006, T-012, T-013
Level 2: T-003, T-005, T-008, T-014, T-021, T-022
Level 3: T-007, T-010, T-015, T-016, T-019, T-031
Level 4: T-020, T-030, T-032, T-037
Level 5: T-024, T-035
Level 6: T-025, T-026
Level 7: T-027
Level 8: T-028, T-034
Level 9: T-033, T-036, T-038
Level 10: T-039

## Suggested Start

Begin with **T-001** (complexity: 2): it unblocks the catalog chain (T-002, T-004, T-005, T-006, T-008, T-010, T-013). In parallel, **T-011**, **T-017**, **T-018**, **T-023**, **T-009** and **T-029** have no dependencies.
