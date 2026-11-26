# HOS-2658: One translation model for accommodation, venue and experience listings

## Progress: 0/43 tasks (0%)

**Average Complexity:** 2.3/3 (max 3 per task)
**Critical Path:** T-005 -> T-006 -> T-008 -> T-009 -> T-012 -> T-016 -> T-023 -> T-035 -> T-043 (9 steps)
**Parallel Tracks:** 6 identified (A schemas, B db + data-migrations, C api writer/runner/state/routes, D service-core hooks, E web section, F admin)

> One PR to staging. Never run `pnpm db:fresh-dev` in a worktree. Run only the changed test files locally; CI runs the full suites. Migration numbers (0253, 0194, 0195) are the next free ones on 2026-11-26: renumber after merging staging if taken.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add optional sourceHash to TranslationMeta
  - packages/schemas/src/common/i18n.schema.ts:123-153: add `sourceHash?: string` to the TranslationMeta...
  - Blocked by: none
  - Blocks: T-002, T-008, T-027

- [ ] **T-002** (complexity: 3) - Create listing-translation schemas
  - New packages/schemas/src/entities/listing-translation/listing-translation.schema.ts + index.ts, expo...
  - Blocked by: T-001
  - Blocks: T-014, T-023, T-029, T-031

- [ ] **T-003** (complexity: 2) - Omit translationMeta from listing create/update inputs
  - Add `translationMeta: true` to the omit lists of AccommodationCreateInputSchema (accommodation.crud....
  - Blocked by: none
  - Blocks: none

- [ ] **T-004** (complexity: 2) - Add computeTranslationSourceHash helper
  - New packages/service-core/src/translation/translation-source-hash.ts with normalizeTranslationSource...
  - Blocked by: none
  - Blocks: T-008, T-027

- [ ] **T-005** (complexity: 2) - Add translation_meta column to venues and experiences
  - packages/db/src/schemas/venue/venue.dbschema.ts (after :81) and packages/db/src/schemas/experience/e...
  - Blocked by: none
  - Blocks: T-006, T-027

### Core Phase

- [ ] **T-006** (complexity: 3) - Add venue/experience to ai-translate maps and extract readSourceText
  - apps/api/src/services/ai-translate.service.ts: add 'venue' | 'experience' to TranslatableEntityType ...
  - Blocked by: T-005
  - Blocks: T-008, T-011, T-015, T-025

- [ ] **T-007** (complexity: 1) - Export the venue entry note i18n schema
  - packages/schemas/src/entities/venue/venue.schema.ts:53: rename the module-private VenueNightNoteSche...
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) - Implement writeTranslationPairs single writer with row lock
  - New apps/api/src/services/translation/translation-pair-writer.ts exporting TranslationPairWrite and ...
  - Blocked by: T-001, T-004, T-006, T-007
  - Blocks: T-009, T-010, T-016

- [ ] **T-009** (complexity: 3) - Refactor persistTranslations onto the writer
  - apps/api/src/services/ai-translate.service.ts:711-834: keep the exported signature, add optional las...
  - Blocked by: T-008
  - Blocks: T-012

- [ ] **T-010** (complexity: 2) - Refactor applyManualOverride onto the writer with sourceHash
  - apps/api/src/services/ai-translate.service.ts:965-1031: load the current Spanish via readSourceText,...
  - Blocked by: T-008
  - Blocks: T-025

- [ ] **T-011** (complexity: 2) - Add skipPairs to translateEntity
  - apps/api/src/services/ai-translate.service.ts:159 TranslateEntityInput gains `skipPairs?: ReadonlySe...
  - Blocked by: T-006
  - Blocks: T-012

- [ ] **T-012** (complexity: 3) - Implement runMeteredTranslation and TRANSLATE_QUOTA_VERTICAL
  - New apps/api/src/services/translation/metered-translation.ts per spec §9.4: load meta -> skipPairs (...
  - Blocked by: T-009, T-011
  - Blocks: T-016, T-018, T-024, T-037

- [ ] **T-013** (complexity: 2) - Extract ownerHasEntitlement helper
  - New apps/api/src/utils/listing-access/owner-has-entitlement.ts: ownerHasEntitlement({ownerId, vertic...
  - Blocked by: none
  - Blocks: T-015

- [ ] **T-014** (complexity: 2) - Implement derivePairState
  - In new apps/api/src/services/translation/listing-translation-state.ts export derivePairState({source...
  - Blocked by: T-002
  - Blocks: T-015

- [ ] **T-015** (complexity: 3) - Implement getListingTranslationState
  - In listing-translation-state.ts export getListingTranslationState({vertical, listingId}) -> ListingT...
  - Blocked by: T-014, T-013, T-006
  - Blocks: T-016

- [ ] **T-016** (complexity: 3) - Implement manual-write and AI-field service functions
  - New apps/api/src/services/translation/listing-translation.service.ts: writeManualTranslation({vertic...
  - Blocked by: T-008, T-012, T-015
  - Blocks: T-023

- [ ] **T-017** (complexity: 1) - Extend TranslationInput with billing
  - packages/service-core/src/translation/translation-init.ts:20-27: add `readonly billing?: { readonly ...
  - Blocked by: none
  - Blocks: T-018, T-019, T-020

- [ ] **T-018** (complexity: 3) - Route billed on-save runs through runMeteredTranslation in the adapter
  - apps/api/src/services/translation-service.adapter.ts: VALID_ENTITY_TYPES + venue, experience; when i...
  - Blocked by: T-012, T-017
  - Blocks: T-036

- [ ] **T-019** (complexity: 1) - Pass billing from AccommodationService hooks
  - packages/service-core/src/services/accommodation/accommodation.service.ts _afterCreate (:1104-1120) ...
  - Blocked by: T-017
  - Blocks: T-036

- [ ] **T-020** (complexity: 3) - Fire on-save translation from BaseListingService
  - packages/service-core/src/services/listing/base-listing.service.ts: add protected getter _translatio...
  - Blocked by: T-017
  - Blocks: T-021, T-036

- [ ] **T-021** (complexity: 2) - Venue entryNote as translation source and keep stored en/pt
  - packages/service-core/src/services/venue/venue.service.ts: override _translationSourceFields to add ...
  - Blocked by: T-020
  - Blocks: T-036, T-039

### Integration Phase

- [ ] **T-022** (complexity: 2) - Remove *I18n keys from venue/experience owner PATCH schemas
  - Remove nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n from the .pick of VenueOwnerUpdat...
  - Blocked by: none
  - Blocks: T-034

- [ ] **T-023** (complexity: 3) - Create per-vertical translation routes and mount them
  - New apps/api/src/routes/listing-translations/listing-translation-routes.ts + index.ts: listingTransl...
  - Blocked by: T-016, T-002
  - Blocks: T-035, T-040

- [ ] **T-024** (complexity: 2) - Fix legacy protected translate route quota vertical and error mapping
  - apps/api/src/routes/ai/protected/translate.ts: use TRANSLATE_QUOTA_VERTICAL[entityType] instead of V...
  - Blocked by: T-012
  - Blocks: none

- [ ] **T-025** (complexity: 2) - Accept venue/experience in admin translate and override routes
  - apps/api/src/routes/ai/admin/translate.ts:42,53: add 'venue','experience' to the translate and overr...
  - Blocked by: T-010, T-006
  - Blocks: T-026

- [ ] **T-026** (complexity: 3) - Show TranslationSection on admin venue and experience edit pages
  - apps/admin/src/features/content/components/TranslationSection.tsx: widen entityType (:26), add venue...
  - Blocked by: T-025
  - Blocks: none

- [ ] **T-027** (complexity: 3) - Data-migration 0194: backfill venue/experience translation meta
  - `pnpm db:seed:make hos-2658-venue-experience-translation-meta` -> packages/seed/src/data-migrations/...
  - Blocked by: T-005, T-004, T-001
  - Blocks: T-043

- [ ] **T-028** (complexity: 3) - Data-migration 0195: grant ai_translate to venue and experience plans
  - packages/seed/src/catalog/next-version-entitlements.ts: add PRODUCTION_PLAN_AI_TRANSLATE_GRANTS (spe...
  - Blocked by: none
  - Blocks: T-037, T-040, T-043

- [ ] **T-029** (complexity: 2) - Add web API client for listing translations
  - New apps/web/src/lib/api/endpoints-protected-translations.ts: listingTranslationsApi.get({vertical,i...
  - Blocked by: T-002
  - Blocks: T-032

- [ ] **T-030** (complexity: 2) - Add account.editorTranslations i18n keys
  - packages/i18n/src/locales/{es,en,pt}/account.json: add the account.editorTranslations.* keys of spec...
  - Blocked by: none
  - Blocks: T-031

- [ ] **T-031** (complexity: 2) - Implement translations section helpers
  - New apps/web/src/components/account/editor/listing-translations-section.helpers.ts: pillToneFor(stat...
  - Blocked by: T-002, T-030
  - Blocks: T-032

- [ ] **T-032** (complexity: 3) - Build ListingTranslationsSection island
  - New apps/web/src/components/account/editor/ListingTranslationsSection.client.tsx (+ ListingTranslati...
  - Blocked by: T-029, T-031
  - Blocks: T-033, T-034

- [ ] **T-033** (complexity: 2) - Use the new section on the accommodation translations page
  - apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/traducciones.astro: render <ListingTrans...
  - Blocked by: T-032
  - Blocks: T-042

- [ ] **T-034** (complexity: 3) - Use the new section in venue/experience editors and drop i18n from PATCH
  - apps/web/src/components/listing/editor/section-renderers.tsx:415-427 renders ListingTranslationsSect...
  - Blocked by: T-032, T-022
  - Blocks: T-038, T-039, T-041

### Testing Phase

- [ ] **T-035** (complexity: 3) - Integration suite for the translation routes
  - apps/api/test/integration/listing-translations/listing-translations.routes.test.ts (real DB, stubbed...
  - Blocked by: T-023
  - Blocks: T-043

- [ ] **T-036** (complexity: 3) - Integration suite for on-save translation
  - apps/api/test/integration/listing-translations/on-save.test.ts: through the real owner PATCH/create ...
  - Blocked by: T-018, T-019, T-020, T-021
  - Blocks: T-043

- [ ] **T-037** (complexity: 2) - Integration test for venue trial translate quota
  - apps/api/test/integration/listing-translations/trial-quota.test.ts: after 0195, a venue owner in tri...
  - Blocked by: T-028, T-012
  - Blocks: none

- [ ] **T-038** (complexity: 2) - Update e2e listing-owner-03 for the new translations section
  - apps/e2e/tests/listing-owner/listing-owner-03-owner-edits-type-i18n.spec.ts test 2 (:246): edit 'Nom...
  - Blocked by: T-034
  - Blocks: none

- [ ] **T-039** (complexity: 3) - New e2e for manual translation and stale warning
  - New apps/e2e/tests/listing-owner/listing-owner-translations-manual-stale.spec.ts (@p1): venue owner ...
  - Blocked by: T-034, T-021
  - Blocks: none

### Docs Phase

- [ ] **T-040** (complexity: 1) - Document the translation routes and grants
  - apps/api/docs/route-architecture.md: add the three /{id}/translations routes per vertical (auth, err...
  - Blocked by: T-023, T-028
  - Blocks: none

### Cleanup Phase

- [ ] **T-041** (complexity: 2) - Delete ListingTranslationPanel and its dead keys
  - Delete apps/web/src/components/listing/ListingTranslationPanel.client.tsx and apps/web/test/componen...
  - Blocked by: T-034
  - Blocks: T-043

- [ ] **T-042** (complexity: 2) - Delete the accommodation read-only translation panel
  - Delete apps/web/src/components/host/editor/TranslationPanel.client.tsx, TranslationFieldRow.client.t...
  - Blocked by: T-033
  - Blocks: T-043

- [ ] **T-043** (complexity: 2) - Run repo guards and typecheck before the PR
  - Run pnpm check:guards (G2 one-vertical, G3 catalog-key-usage, G18 catalog-sql, seed dual-write, no-l...
  - Blocked by: T-041, T-042, T-027, T-028, T-035, T-036
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-004, T-005, T-007, T-013, T-017, T-022, T-028, T-030
Level 1: T-002, T-006, T-019, T-020, T-027
Level 2: T-008, T-011, T-014, T-021, T-029, T-031
Level 3: T-009, T-010, T-015, T-032
Level 4: T-012, T-025, T-033, T-034
Level 5: T-016, T-018, T-024, T-026, T-037, T-038, T-039, T-041, T-042
Level 6: T-023, T-036
Level 7: T-035, T-040
Level 8: T-043

## Suggested Start

Begin with **T-005** (complexity: 2) - it is on the critical path and unblocks T-006 and T-027. T-001, T-003, T-004, T-007, T-013, T-017, T-022, T-028 and T-030 have no dependencies and can run in parallel.
