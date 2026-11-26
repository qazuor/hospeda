# HOS-2636: F1. Bloques dinámicos y resolver

## Progress: 5/23 tasks (22%)

**Average Complexity:** 2.5/10
**Critical Path:** T-001 -> T-003 -> T-006 -> T-013 -> T-014 -> T-015 -> T-016 -> T-019 -> T-021 -> T-023 (10 steps)
**Parallel Tracks:** 4 (schemas, DB resolvers, email render, admin editor)

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Add NewsletterDynamicSourceEnum and NewsletterIfBelowMinEnum
  - New enums in packages/schemas/src/enums/ (newsletter-dynamic-source.enum.ts with most_viewed|newest|
  - Blocked by: none
  - Blocks: T-003

- [x] **T-002** (complexity: 2) - Add NewsletterDynamicEntityTypeEnum and ENABLED_DYNAMIC_ENTITY_TYPES
  - F1 §4.6. Enum ACCOMMODATION|VENUE|POST|EVENT|EXPERIENCE|PARTNER (subset of EntityTypeEnum, entity-ty
  - Blocked by: none
  - Blocks: T-003

- [x] **T-005** (complexity: 2) - Add resolved_body_json and resolved_at to newsletter_campaigns
  - Columns in packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts (jsonb nullable, time
  - Blocked by: none
  - Blocks: T-016

### Core Phase

- [x] **T-003** (complexity: 3) - Create DynamicBlockConfigSchema with superRefine error codes
  - packages/schemas/src/entities/newsletter/newsletter-dynamic-block.schema.ts per F1 §4.5: params .str
  - Blocked by: T-001, T-002
  - Blocks: T-004, T-006, T-020

- [x] **T-004** (complexity: 2) - Implement applyDynamicBlockDefaults()
  - Defaults per decisions D-2/D-5: ifBelowMin skip_run when single dynamic block else hide_block (recal
  - Blocked by: T-003
  - Blocks: T-021

- [ ] **T-006** (complexity: 3) - Create DynamicSourcePort, eligibleAccommodationPredicate and typed registries
  - packages/service-core/src/services/newsletter/dynamic/: dynamic-source.port.ts (interface F1 §4.5),
  - Blocked by: T-003
  - Blocks: T-007, T-008, T-009, T-010, T-011, T-013

- [ ] **T-007** (complexity: 2) - Implement newest accommodation resolver
  - sources/newest.source.ts: created_at desc, id asc, excludeIds, limit. Integration test in packages/s
  - Blocked by: T-006
  - Blocks: none

- [ ] **T-008** (complexity: 3) - Implement most_viewed accommodation resolver
  - sources/most-viewed.source.ts: COUNT(entity_views) with viewed_at >= now()-windowDays, desc, id asc,
  - Blocked by: T-006
  - Blocks: none

- [ ] **T-009** (complexity: 2) - Implement top_rated accommodation resolver
  - sources/top-rated.source.ts: average_rating desc, reviews_count desc, id asc, filter reviews_count >
  - Blocked by: T-006
  - Blocks: none

- [ ] **T-010** (complexity: 2) - Implement DrizzleDynamicSource.revalidate
  - drizzle-dynamic-source.ts revalidate(ids) through the shared predicate plus minReviews for top_rated
  - Blocked by: T-006
  - Blocks: none

- [ ] **T-011** (complexity: 3) - Implement resolveBlocks ordering, dedup and fillWithRepeats
  - resolve-blocks.ts (RO-RO, F1 §4.5): deterministic order, exclude history ids (excludeRecentEditions;
  - Blocked by: T-006
  - Blocks: T-012

- [ ] **T-012** (complexity: 3) - Add revalidation and minItems/ifBelowMin to resolveBlocks
  - Phase send revalidates and refills; manuallyEdited only removes invalid. Decision skip_run|send; hid
  - Blocked by: T-011
  - Blocks: T-016

- [ ] **T-013** (complexity: 2) - Implement accommodation loadCards with i18n fallback
  - name_i18n/summary_i18n with fallback to name/summary (es), cover from accommodation_media.is_feature
  - Blocked by: T-006
  - Blocks: T-014

- [ ] **T-014** (complexity: 2) - Create DynamicBlockCards email component
  - packages/notifications/src/templates/newsletter/dynamic-block-cards.tsx on @repo/email Button + emai
  - Blocked by: T-013
  - Blocks: T-015

- [ ] **T-015** (complexity: 3) - Implement renderNewsletterEmail by segments
  - packages/notifications/src/utils/render-newsletter-email.ts splits doc at root dynamicBlock nodes; T
  - Blocked by: T-014
  - Blocks: T-016, T-018

### Integration Phase

- [ ] **T-016** (complexity: 3) - Resolve and persist blocks in campaign send()
  - send() delegates to dynamic/ (do not grow newsletter-campaign.service.ts), resolves with phase send,
  - Blocked by: T-005, T-012, T-015
  - Blocks: T-017, T-019

- [ ] **T-017** (complexity: 3) - Render resolved_body_json in processBatch and fail unresolved blocks
  - newsletter-delivery.service.ts:657 renders resolved_body_json ?? body_json via segments; never resol
  - Blocked by: T-016
  - Blocks: T-023

- [ ] **T-018** (complexity: 2) - Add sendTestEmailFromContent and make testSend resolve dry
  - sendTestEmailFromContent next to sendTestEmail (:959); testSend resolves without writes. Test AC-F1-
  - Blocked by: T-015
  - Blocks: T-019

- [ ] **T-019** (complexity: 3) - Add resolve-preview and dynamic-sources admin routes and wire delivery-factory
  - apps/api/src/routes/newsletter/admin/campaigns.ts POST /campaigns/{id}/resolve-preview (no writes, A
  - Blocked by: T-016, T-018
  - Blocks: T-021, T-022

- [ ] **T-020** (complexity: 3) - Add TipTap dynamicBlock extension to the admin editor
  - apps/admin/src/components/newsletter/dynamic-block/ extension (root-level atomic node, attrs blockKe
  - Blocked by: T-003
  - Blocks: T-021

- [ ] **T-021** (complexity: 3) - Build dynamic block config panel
  - TanStack Form + DynamicBlockConfigSchema.safeParse; entity selector shows 6 types, non-enabled disab
  - Blocked by: T-020, T-019, T-004
  - Blocks: T-023

- [ ] **T-022** (complexity: 3) - Render API preview in sandboxed iframe and show resolution report on send
  - CampaignPreview.tsx uses iframe sandbox with HTML from resolve-preview; SendConfirmDialog.tsx shows
  - Blocked by: T-019
  - Blocks: T-023

### Testing Phase

- [ ] **T-023** (complexity: 2) - Run manual mutations and repo guards
  - Mutations from F1 §7: drop publication_status from predicate (AC-F1-7 must fail), drop id tiebreak (
  - Blocked by: T-017, T-021, T-022
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-005
Level 1: T-003
Level 2: T-004, T-006, T-020
Level 3: T-007, T-008, T-009, T-010, T-011, T-013
Level 4: T-012, T-014
Level 5: T-015
Level 6: T-016, T-018
Level 7: T-017, T-019
Level 8: T-021, T-022
Level 9: T-023

## Suggested Start

Begin with **T-001** (complexity: 1). T-002 and T-005 have no dependencies either and can run in parallel.
