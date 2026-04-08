# SPEC-023: Pre-existing Errors Cleanup - Gap Analysis

> Generated: 2026-03-04
> Last Updated: 2026-03-08 (5th audit pass)
> Audit History: Pass 1 (2026-03-04), Pass 2 (2026-03-04), Pass 3 (2026-03-04), Pass 4 (2026-03-08), Pass 5 (2026-03-08)

## Executive Summary

SPEC-023 is marked as **completed** (25/25 tasks). However, the 5th audit pass (exhaustive, multi-agent) confirms the spec is **NOT COMPLIANT** with its own success criteria:

| Criteria | Status | Notes |
|----------|--------|-------|
| `pnpm typecheck` zero errors | **FAIL** | 8 errors (csstype 3.1.3 vs 3.2.3 conflict in web + feedback) |
| `pnpm lint` zero errors | **PASS** | All 17 packages pass, 0 errors (1 warning @repo/db redundant biome-ignore) |
| `pnpm test` zero failures | **FAIL** | 2 failures in @repo/i18n (missing `lastUpdatedLabel` key in en/pt terms.json) |
| `pnpm build` succeeds | **MITIGATED** | Admin env validation is now lazy/runtime (SPEC-035 fix), no longer blocks build |
| CI pipeline green | **FAIL** | Typecheck + test failures block CI |

The 5th audit confirms **all 4th-pass findings** and adds **7 NEW gaps** (Gap #41-#47), including schema `.pick()` bugs that pick non-existent fields, filter schemas referencing non-existent entity fields, and a `packages/config` package without tests despite containing validation logic.

**Total gaps: 47** (40 previously documented + 7 new). Of these: 2 FIXED, 1 INVALIDATED, 3 INFO/non-actionable, 1 MITIGATED, leaving **40 actionable gaps**.

---

## Audit Pass Status Legend

- `[P1]` = Found in Pass 1 (2026-03-04)
- `[P2]` = Found in Pass 2 (2026-03-04)
- `[P3]` = Found in Pass 3 (2026-03-04)
- `[P4]` = Found in Pass 4 (2026-03-08)
- `[P5]` = Found in Pass 5 (2026-03-08) - exhaustive multi-agent audit

---

## SECTION A: PREVIOUSLY DOCUMENTED GAPS (#1-#22) - STATUS UPDATE

---

### Gap #1: `apps/web2` Contaminates Entire Monorepo Pipeline `[P1]`

**STATUS: FIXED** (confirmed P4: `apps/web2/` directory no longer exists)

~~CRITICAL - Untracked Next.js app (`apps/web2`) breaks `pnpm test`, `pnpm lint`, and `pnpm build`~~

---

### Gap #2: Lint Error in `.claude/settings.local.json` `[P1]`

**STATUS: STILL PRESENT** (P4: file exists, `.claude/` not in biome ignore patterns)

- **Priority**: HIGH | **Severity**: MEDIUM | **Complexity**: 1/10
- **Risk**: `pnpm lint` may fail for web scope, blocking CI
- **Evidence**: `apps/web/.claude/settings.local.json` exists. Biome uses `vcs.useIgnoreFile: true` but `.gitignore` does not exclude `.claude/` completely. No `apps/web/biome.json` with local ignore exists.
- **Recommendation**: Fix direct.. add `.claude/` to biome ignore in shared config. No SPEC needed.

---

### Gap #3: 24 Skipped Schema Tests Mask Real Field Mismatch Bugs `[P1]`

**STATUS: STILL PRESENT - exactly 24 skipped** (P5 verified: amenity 7, attraction 9, userBookmark 3, event 2, destination 1, debug-helpers 2)

- **Priority**: MEDIUM | **Severity**: MEDIUM | **Complexity**: 5/10
- **Distribution**: amenity (7), attraction (9), userBookmark (3), event (2), destination (1), debug-helpers (2)
- **P5 UPDATE**: Total skip count across all `packages/schemas/test/` confirmed at 24. Many skip reasons remain **stale/incorrect** (see Gap #26). Additionally, some `.pick()` calls in schema definitions reference fields that genuinely don't exist (see NEW Gaps #41, #42).
- **Recommendation**: Needs a focused SPEC to audit each skip, update fixtures, and re-enable tests.

---

### Gap #4: 32 DB Model Test Suites Entirely Skipped `[P1]`

**STATUS: STILL PRESENT - exactly 32 skipped** (P5 verified via grep)

- **Priority**: LOW | **Severity**: LOW | **Complexity**: 8/10
- **P5 UPDATE**: Confirmed 32 `describe.skip` in `packages/db/test/models/`. Full list: accommodationListing, accommodationListingPlan, adPricingCatalog, adSlotReservation, attraction, benefitListing, benefitListingPlan, benefitPartner, business-model-4.7.integration, campaign, client, clientAccessRight, creditNote, eventLocation, eventOrganizer, invoice, invoiceLine, payment, paymentMethod, pricingPlan, pricingTier, product, professionalServiceOrder, professionalServiceType, purchase, refund, serviceListing, serviceListingPlan, sponsorship, subscription, subscriptionItem, touristService.
- **Recommendation**: Post-launch debt. Keep as `describe.todo` for clarity.

---

### Gap #5: `apps/web` Coverage Thresholds Below Project Standard `[P1]`

**STATUS: STILL PRESENT** (P4: thresholds unchanged at 80/80/75/80)

- **Priority**: LOW | **Severity**: LOW | **Complexity**: 6/10
- **Note**: See Gap #19 for CI escalation of this issue.
- **Recommendation**: Document as acceptable exception for web (Astro SSG testing characteristics differ).

---

### Gap #6: `@repo/utils` Build Produces No Output Files `[P1]`

**STATUS: STILL PRESENT** (P4: `dist/` directory does NOT exist, `tsconfig.json` has no `outDir`)

- **Priority**: MEDIUM | **Severity**: MEDIUM | **Complexity**: 2/10
- **Evidence**: `package.json` declares `main: "dist/index.js"` and `types: "dist/index.d.ts"` but `tsc` produces nothing because tsconfig inherits from base with no `outDir`. Turbo warns on every build.
- **Recommendation**: Fix direct.. add `outDir: "dist"` to `tsconfig.json` or switch to `tsup`. No SPEC needed.

---

### Gap #7: Build Warnings - `Astro.request.headers` in Prerendered Pages `[P1]`

**STATUS: STILL PRESENT** (P4: scope reduced from "83+" to focused on error pages)

- **Priority**: LOW | **Severity**: LOW | **Complexity**: 3/10
- **P4 UPDATE**: 404.astro and 500.astro pages access `Astro.request.headers.get('accept-language')` which generates warnings during prerender. The original count of 83+ was overestimated.. the actual warnings depend on how many prerendered pages import layouts that access headers.
- **Recommendation**: Fix direct.. use URL `[lang]` param instead of header in affected pages. No SPEC needed.

---

### Gap #8: `@ts-expect-error` in Production Code for QZPay Types `[P1]`

**STATUS: STILL PRESENT** (P4: lines 243, 469 unchanged)

- **Priority**: LOW | **Severity**: LOW | **Complexity**: 3/10
- **Recommendation**: Defer to SPEC-021 (Billing System Fixes). Add type declarations for QZPay missing methods.

---

### Gap #9: `eslint-disable` Comments in Biome-Based Project `[P1]`

**STATUS: STILL PRESENT - 3 occurrences in source code** (P4 verified)

- **Priority**: LOW | **Severity**: VERY LOW | **Complexity**: 1/10
- **Files**: `apps/api/src/cron/bootstrap.ts:52`, `packages/service-core/src/services/event/event.normalizers.ts:38,51`
- **Note**: Gaps #16 and #17 are absorbed into this gap for tracking purposes.
- **Recommendation**: Fix direct.. replace with `biome-ignore` or `_` prefix. No SPEC needed.

---

### Gap #10: `biome-ignore` with Empty `<explanation>` Placeholders `[P1]`

**STATUS: STILL PRESENT - reduced from 41 to 34** (P4: 7 removed since last audit)

- **Priority**: VERY LOW | **Severity**: VERY LOW | **Complexity**: 2/10
- **Distribution (P4)**: seed (9), schemas/test (15), icons/test (2), i18n scripts (5), admin (1), api (1), service-core (1)
- **Recommendation**: Fix direct.. add real explanations. No SPEC needed.

---

### Gap #11: CI Pipeline Not Configured to Exclude `apps/web2` `[P1]`

**STATUS: FIXED** (by elimination of `apps/web2/` - see Gap #1)

---

### Gap #12: `@repo/utils` Has NO Source Files `[P2]`

**STATUS: INVALIDATED** (confirmed P4: `packages/utils/src/` has 7 source files)

---

### Gap #13: `biome-ignore <explanation>` in Production Code `[P2]`

**STATUS: STILL PRESENT - 8 occurrences** (P4 verified)

- **Priority**: VERY LOW | **Severity**: VERY LOW | **Complexity**: 1/10
- **Files**: `apps/api/src/types.ts:61`, `apps/admin/.../EntitySelectField.tsx:429`, `packages/service-core/src/base/base.service.ts:54`, `packages/i18n/scripts/generate-types.ts` (5x)
- **Recommendation**: Fix direct.. add real explanations. Merge with Gap #10 for fix.

---

### Gap #14: 5 Skipped Tests in service-core `[P2]`

**STATUS: STILL PRESENT - 5 skipped** (P5 verified: updateVisibility 1, getByName 1, getBySlug 1, count 1, list 1)

- **Priority**: MEDIUM | **Severity**: MEDIUM | **Complexity**: 3/10
- **P5 UPDATE**: Recount shows 5 skipped (not 4 as P4 stated). The `amenity/updateVisibility.test.ts` has `describe.skip` and was missed in P4.
- **Remaining**: `amenity/updateVisibility.test.ts` (AmenityType has no visibility), `userBookmark/getByName.test.ts`, `userBookmark/getBySlug.test.ts`, `destination/count.test.ts:46`, `destination/list.test.ts:59`
- **Recommendation**: Fix direct for bookmark methods (implement or remove). Document destination count/list as design decision.

---

### Gap #15: 1 Skipped Test in api/cron-routes `[P2]`

**STATUS: STILL PRESENT** (P4: `cron-routes.test.ts:269` still skipped)

- **Priority**: LOW | **Severity**: LOW | **Complexity**: 2/10
- **Recommendation**: Fix direct.. unskip or convert to `.todo`. No SPEC needed.

---

### Gap #16: 4th `eslint-disable` File Not in Gap #9 `[P2]`

**STATUS: ABSORBED INTO GAP #9** (tracking purposes only)

---

### Gap #17: Gap #9 Undercount `[P2]`

**STATUS: ABSORBED INTO GAP #9** (tracking purposes only)

---

### Gap #18: `console.*` in Production Code When `@repo/logger` Available `[P2]`

**STATUS: PARTIALLY IMPROVED - 3-4 real occurrences remain** (P4 verified)

- **Priority**: MEDIUM | **Severity**: MEDIUM | **Complexity**: 3/10
- **Remaining occurrences**:
  - `packages/service-core/src/services/exchange-rate/clients/exchange-rate-api.client.ts:129` - `console.info()`
  - `packages/billing/src/adapters/mercadopago.ts:168` - `console.warn()`
  - `packages/billing/src/validation/config-validator.ts:270,272` - `console.warn()` (2x)
- **Note**: `apps/admin` and `apps/web` have their own `logger.ts` wrappers around `console.*` which is correct for browser contexts.
- **Recommendation**: Fix direct for server-side packages. No SPEC needed.

---

### Gap #19: CI Coverage vs Web Threshold Conflict `[P2]`

**STATUS: STILL PRESENT but nuanced** (P5 verified)

- **Priority**: MEDIUM | **Severity**: MEDIUM | **Complexity**: 3/10
- **P5 UPDATE**: CI workflow (`.github/workflows/ci.yml:126,151`) enforces 90% global. Web vitest config (`apps/web/vitest.config.ts:25-29`) allows 80%. The conflict is real but the impact depends on whether web's coverage is aggregated into the global check or evaluated separately. Web's lower threshold (80%) is architecturally justified (Astro SSG has different testing characteristics).
- **Recommendation**: Fix direct.. add web exception in CI script, or document that per-package thresholds override the global. No SPEC needed.

---

### Gap #20: JS Chunks Excessively Large `[P2]`

**STATUS: UNVERIFIABLE** (P4: admin build fails on env, can't check chunk sizes)

- **Priority**: MEDIUM | **Severity**: LOW | **Complexity**: 4/10
- **P4 NOTE**: Icon imports in admin now use `@repo/icons` correctly (tree-shakeable). Issue may be resolved. Needs build to verify.
- **Recommendation**: Verify after Gap #24 (admin build) is fixed. May be resolved already.

---

### Gap #21: `routeTree.gen.ts` eslint-disable `[P3]`

**STATUS: VALID EXCEPTION** - auto-generated file, excluded from biome config. Not a gap.

---

### Gap #22: 17 biome-ignore in Test Schema Files `[P3]`

**STATUS: STILL PRESENT - reduced from 17 to 15** (P4 verified)

- **Priority**: VERY LOW | **Severity**: VERY LOW | **Complexity**: 1/10
- **Recommendation**: Fix direct.. add real explanations. Merge with Gap #10 for fix.

---

## SECTION B: NEW GAPS DISCOVERED IN 4TH AUDIT PASS

---

### Gap #23: 8 NEW TypeScript Errors - csstype Version Conflict `[P4]`

**SPEC**: SPEC-023 (direct regression against success criteria #1)
**Gap**: `pnpm typecheck` now fails with 8 errors across 2 files due to csstype version mismatch

#### Description

The `pnpm typecheck` command that previously passed now **fails with 8 errors**:

| File | Errors | Issue |
|------|--------|-------|
| `apps/web/src/components/ui/calendar.tsx` | 3 | `React.Ref<HTMLDivElement>` and style props incompatible |
| `packages/feedback/src/components/FeedbackFAB.tsx` | 5 | `CSSProperties` incompatible (alignment-baseline, "hanging" value) |

**Root Cause**: `csstype` version conflict. The `feedback` package depends on `csstype@3.1.3` where `alignment-baseline: "hanging"` is valid. But `@types/react` in the monorepo resolves to `csstype@3.2.3` where that value was removed. The two versions are incompatible.

#### Proposed Solutions

1. **Pin csstype version** across the monorepo via `pnpm.overrides` in root `package.json`:
   ```json
   "pnpm": { "overrides": { "csstype": "3.1.3" } }
   ```
2. **Update feedback component** to use values valid in csstype@3.2.3 (remove "hanging" alignment-baseline)
3. **Add `@ts-expect-error`** as temporary workaround (NOT recommended.. defeats purpose of SPEC-023)

#### Priority/Severity/Complexity

- **Priority**: CRITICAL
- **Severity**: HIGH (SPEC-023 success criterion #1 FAILED)
- **Complexity**: 2/10
- **Recommendation**: Fix direct.. option 1 or 2. No SPEC needed.

---

### Gap #24: Admin Build Fails on Environment Validation `[P4]`

**STATUS: MITIGATED** (P5: SPEC-035 changed env validation to lazy/runtime singleton pattern)

**SPEC**: SPEC-023 (direct regression against success criteria #4)
**Gap**: `pnpm build` fails for admin app.. env validation requires `VITE_API_URL`

#### Description

~~The admin app build included environment validation that runs at build time.~~

**P5 UPDATE**: SPEC-035 refactored `apps/admin/src/env.ts` to use a lazy-validated singleton pattern. The `validateAdminEnv()` function now runs at **runtime** (on first access to `env` proxy), NOT at build time. The build no longer fails.

- `apps/admin/src/env.ts` lines 135-159: validation is deferred via lazy singleton
- `VITE_API_URL`, `VITE_SITE_URL`, `VITE_BETTER_AUTH_URL` are still required but validated on first use

#### Priority/Severity/Complexity

- **Priority**: ~~CRITICAL~~ RESOLVED
- **Severity**: ~~HIGH~~ N/A
- **Complexity**: N/A
- **Recommendation**: No action needed. Verify build passes once Gap #23 (csstype) is fixed.

---

### Gap #25: 2 i18n Test Failures - Missing Translation Key `[P4]`

**SPEC**: SPEC-023 (direct regression against success criteria #3)
**Gap**: `pnpm test` fails for @repo/i18n.. missing `lastUpdatedLabel` key in en/pt terms.json

#### Description

The i18n key coverage tests fail:

- `EN locale > namespace: terms > should have all 65 keys from ES` - FAILED
- `PT locale > namespace: terms > should have all 65 keys from ES` - FAILED

**Root Cause**: `packages/i18n/locales/es/terms.json` has the key `lastUpdatedLabel`, but `en/terms.json` and `pt/terms.json` are missing it.

#### Proposed Solutions

1. **Add the missing key** to both `en/terms.json` and `pt/terms.json` with proper translations
2. **Remove the key** from `es/terms.json` if it's unused
3. **Run `pnpm i18n:check`** to find and fix all similar gaps

#### Priority/Severity/Complexity

- **Priority**: CRITICAL
- **Severity**: HIGH (SPEC-023 success criterion #3 FAILED)
- **Complexity**: 1/10
- **Recommendation**: Fix direct.. add translations. No SPEC needed.

---

### Gap #26: Schema Skipped Tests Have Stale/Incorrect Reasons `[P4]`

**SPEC**: SPEC-023 (extends Gap #3)
**Gap**: Multiple skipped schema tests cite bugs that were already fixed; tests were never re-enabled

#### Description

Deep analysis reveals that several of the 24 skipped tests (Gap #3) have **stale skip reasons**:

| Entity | Skip Reason | Reality |
|--------|-------------|---------|
| Amenity (6 tests) | "schema field mismatch for usageCount/accommodationCount" | `AmenityListItemSchema` now uses `.extend()` correctly. Skips are stale. |
| Attraction (9 tests) | "AttractionListItemSchema picks 'summary' field that does not exist" | Schema was already fixed (no longer picks summary). Real issue is **test fixtures** missing `displayWeight`/`lifecycleState`. Skip reasons are wrong. |
| Event (2 tests) | "Schema tries to pick non-existent startDate field" | Schema uses `date` instead of `startDate`. Fixture/test mismatch. |
| UserBookmark (3 tests) | "pick(['notes', 'isPrivate']) fields don't exist" | **STILL VALID** - these fields genuinely don't exist in `UserBookmarkSchema` or DB. |
| Destination (1 test) | "climate field" | **STILL VALID** - `climate` doesn't exist in `DestinationSchema`. |

Additionally, `UserBookmarkSummarySchema` (line 189) also picks `notes: true` which doesn't exist.

#### Proposed Solutions

1. **For Amenity/Attraction/Event (17 tests)**: Update test fixtures to include new required fields (`displayWeight`, `lifecycleState`, `date`), then unskip
2. **For UserBookmark (3 tests)**: Either add `notes`/`isPrivate` to `UserBookmarkSchema` + DB, or remove from `.pick()` calls
3. **For Destination (1 test)**: Either add `climate` to `DestinationSchema` or remove from `DestinationSummaryExtendedSchema.pick()`
4. **For debug-helpers (2 tests)**: Fix `NewEntityInputSchema.omit()` to handle schemas missing system fields

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: 5/10
- **Recommendation**: Create formal SPEC.. this touches schema definitions, DB schemas, and test fixtures across 5 entities.

---

### Gap #27: Zombie Schema File - Duplicate Export Names `[P4]`

**SPEC**: SPEC-023
**Gap**: `accommodation.query.optimized.schema.ts` exists but is not exported; has duplicate symbol names

#### Description

`packages/schemas/src/entities/accommodation/accommodation.query.optimized.schema.ts` is a dead file that:
- Is NOT referenced in the module's `index.ts`
- Exports `AccommodationListItemSchema`, `AccommodationSearchSchema`, `AccommodationListResponseSchema` - names that duplicate the canonical `accommodation.query.schema.ts`
- If accidentally added to `index.ts`, would cause export name conflicts

#### Proposed Solutions

1. **Delete the file** (recommended - YAGNI, it's dead code)
2. **Rename exported symbols** if the optimized version should be kept for future use

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 1/10
- **Recommendation**: Fix direct.. delete file. No SPEC needed.

---

### Gap #28: `z.any()` for Actor Validation in Service-Core `[P4]`

**SPEC**: SPEC-023
**Gap**: All `runWithLoggingAndValidation` calls use `z.any()` for the `actor` parameter, bypassing runtime validation

#### Description

In service-core base classes and services, every call to `runWithLoggingAndValidation()` uses:

```ts
schema: z.object({ id: z.string(), adminInfo: z.any(), actor: z.any() })
```

The `Actor` type is a well-defined structure with `userId`, `permissions`, `roles` etc. Using `z.any()` means:
- No runtime validation of the actor shape
- A malformed actor passes silently
- The validation layer provides zero protection for the most security-critical parameter

**Affected files**: `base.crud.admin.ts:43,72`, `base.crud.write.ts:467`, `post.service.ts:674,699`

#### Proposed Solutions

1. **Create `ActorSchema` in @repo/schemas** and use it in all `runWithLoggingAndValidation` calls
2. **Use `z.object({ userId: z.string(), permissions: z.array(z.string()) })` inline** as minimum validation
3. **Accept as known limitation** and document.. the actor comes from auth middleware which already validates it

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: 4/10
- **Recommendation**: Add to a security-focused SPEC (SPEC-037 or SPEC-019). The actor always comes from trusted auth middleware, so risk is contained, but defense-in-depth matters.

---

### Gap #29: Critical TODOs - Production Endpoints Return Wrong Data `[P4]`

**SPEC**: SPEC-023 (quality issue) / Multiple SPECs
**Gap**: 4 endpoints silently return incorrect/placeholder data in production

#### Description

| Endpoint | File | Bug |
|----------|------|-----|
| `POST .../posts/:id/comments/:id` (delete comment) | `packages/service-core/src/services/post/post.service.ts:703` | `removeComment()` always returns `{ success: false }` without implementation |
| `GET .../eventLocations/:id/stats` | `packages/service-core/src/services/eventLocation/eventLocation.service.ts:325` | `totalEvents: 0` hardcoded |
| `GET .../destinations/:id/summary` | `packages/service-core/src/services/destination/destination.service.ts:351` | `eventsCount: 0` hardcoded |
| `POST /api/v1/protected/reviews` (web form) | `apps/web/src/components/review/ReviewForm.client.tsx:164` | Shows success toast but **never sends data to backend** |

The `removeComment()` case is the most severe: it exists in the public API, is callable, and silently reports failure without any logging.

The `ReviewForm` case means **every user review submitted on the web is silently lost**.

#### Proposed Solutions

1. **removeComment**: Implement the delete logic or throw `NotImplementedError` with a clear message
2. **totalEvents/eventsCount**: Add actual count queries to the normalizers
3. **ReviewForm**: Connect the form to `POST /api/v1/protected/reviews` endpoint (verify endpoint exists first)

#### Priority/Severity/Complexity

- **Priority**: HIGH
- **Severity**: HIGH (data loss for reviews, incorrect data for stats)
- **Complexity**: 5/10
- **Recommendation**: Create formal SPEC.. these are functional bugs that affect user-facing features.

---

### Gap #30: Services Without Any Test Coverage `[P4]`

**SPEC**: SPEC-023 (test coverage)
**Gap**: 4 service files in service-core have zero test coverage

#### Description

| Service | File | Coverage |
|---------|------|----------|
| `OwnerPromotionService` | `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts` | 0% - no test directory |
| `SponsorshipService` | `packages/service-core/src/services/sponsorship/sponsorship.service.ts` | 0% - no test directory |
| `SponsorshipLevelService` | `packages/service-core/src/services/sponsorship/sponsorshipLevel.service.ts` | 0% - no test directory |
| `SponsorshipPackageService` | `packages/service-core/src/services/sponsorship/sponsorshipPackage.service.ts` | 0% - no test directory |

These services have business logic that is completely untested.

#### Proposed Solutions

1. **Write unit tests** following the existing service test patterns (use `createActor`, mock model layer)
2. **Defer to post-launch** if these features are not yet active
3. **Add `// TODO: needs tests` marker** and track as tech debt

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: 6/10
- **Recommendation**: Create tasks within a testing-focused SPEC. Not urgent for launch if features are inactive.

---

### Gap #31: 5 Billing DB Schemas Without Model Abstraction `[P4]`

**SPEC**: SPEC-023 / SPEC-021
**Gap**: 5 billing DB tables have schema definitions but no `BaseModel` wrapper

#### Description

These schemas in `packages/db/src/schemas/billing/` have no corresponding model in `packages/db/src/models/`:

- `billing_addon_purchase.dbschema.ts`
- `billing_dunning_attempt.dbschema.ts`
- `billing_notification_log.dbschema.ts`
- `billing_settings.dbschema.ts`
- `billing_subscription_event.dbschema.ts`

Direct Drizzle access without the `BaseModel` layer violates the project pattern where all DB access goes through models (which provide soft-delete, audit fields, logging, etc.).

#### Proposed Solutions

1. **Create models** extending `BaseModel` for each schema
2. **Accept for billing internals**.. these may be used only by the billing adapter internally and don't need the full model abstraction
3. **Defer to SPEC-021** (Billing System Fixes)

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 4/10
- **Recommendation**: Defer to SPEC-021. Document as known pattern exception for billing internals.

---

### Gap #32: Migration 0018 Not Committed to Git `[P4]`

**SPEC**: SPEC-023
**Gap**: `packages/db/src/migrations/0018_perfect_the_fallen.sql` is untracked

#### Description

Migration `0018` creates `billing_subscription_events` table and is registered in `_journal.json`, but the SQL file is untracked in git (`??` in `git status`). This means:
- The migration won't exist in other developer environments
- CI/staging won't have this migration
- The `_journal.json` references a migration that doesn't exist in the repo

#### Proposed Solutions

1. **Commit the migration** (after reviewing it for correctness)
2. **Remove from journal** if it shouldn't exist yet
3. **Regenerate** if it was auto-generated incorrectly

#### Priority/Severity/Complexity

- **Priority**: HIGH
- **Severity**: HIGH (DB migration desync)
- **Complexity**: 1/10
- **Recommendation**: Fix direct.. review and commit the migration, or remove from journal. No SPEC needed.

---

### Gap #33: 14 Admin Files Exceed 500-Line Limit `[P4]`

**SPEC**: SPEC-023
**Gap**: 14 non-generated files in admin app violate the 500-line maximum

#### Description

| File | Lines |
|------|-------|
| `routes/dev/icon-comparison.tsx` | 1095 |
| `routes/_authed/billing/promo-codes.tsx` | 811 |
| `lib/billing-http-adapter.ts` | 803 |
| `routes/_authed/billing/owner-promotions.tsx` | 722 |
| `routes/_authed/billing/invoices.tsx` | 718 |
| `routes/_authed/billing/webhook-events.tsx` | 711 |
| `features/billing-plans/components/PlanDialog.tsx` | 692 |
| `routes/_authed/billing/sponsorships.tsx` | 683 |
| `routes/_authed/billing/notification-logs.tsx` | 662 |
| `routes/auth/change-password.tsx` | 616 |
| `features/billing-addons/components/AddonDialog.tsx` | 598 |
| `components/entity-list/columns.factory.ts` | 598 |
| `components/entity-form/fields/EntitySelectField.tsx` | 588 |
| `lib/factories/createEntityColumns.ts` | 577 |

All violate the project's 500-line maximum per file.

#### Proposed Solutions

1. **Refactor large route files** by extracting hooks, form components, and table columns into separate files
2. **Split dialog components** from route files (common pattern: route file + dialog file)
3. **Accept `icon-comparison.tsx`** as dev-only exception

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 6/10
- **Recommendation**: Create formal SPEC for admin code quality. This overlaps with SPEC-022 (Frontend Quality).

---

### Gap #34: Direct `@phosphor-icons/react` Imports Bypassing `@repo/icons` `[P4]`

**SPEC**: SPEC-023
**Gap**: 2 production components import icons directly from phosphor instead of @repo/icons

#### Description

Policy violation (CLAUDE.md: "Icons: use `@repo/icons` | NEVER phosphor-react direct"):

- `apps/admin/src/features/users/components/ImpersonateButton.tsx:14` - imports `UserSwitch`
- `apps/admin/src/components/auth/ImpersonationBanner.tsx:13` - imports `Warning`, `X`

`Warning` maps to `AlertTriangleIcon` and `X` maps to `CloseIcon` in `@repo/icons`. `UserSwitch` is not exported by `@repo/icons` and would need to be added.

#### Proposed Solutions

1. **Add `UserSwitchIcon` to `@repo/icons`** and update imports in both components
2. **Replace with existing icons** if equivalents exist

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 1/10
- **Recommendation**: Fix direct.. add icon and update imports. No SPEC needed.

---

### Gap #35: 12 HACK Comments for TanStack Router Import Workaround `[P4]`

**SPEC**: SPEC-023
**Gap**: 12 admin route files have `// HACK:` comments to suppress TS errors from TanStack Router

#### Description

Pattern found in 12 authenticated route files:

```ts
// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;
```

The bare reference to `createFileRoute` (without using it) prevents TypeScript from removing the import, which `routeTree.gen.ts` depends on. This is a workaround for a TanStack Router configuration issue.

**Files**: sponsors, posts, accommodations, and 9+ other `_authed/` routes.

#### Proposed Solutions

1. **Fix TanStack Router configuration** to properly handle unused imports
2. **Update `tsconfig.json`** to set `"verbatimModuleSyntax": true` or `"importsNotUsedAsValues": "preserve"`
3. **Accept as known TanStack Router quirk** and document

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: VERY LOW
- **Complexity**: 3/10
- **Recommendation**: Investigate root cause in TanStack Router config. If it's a framework limitation, document and accept.

---

### Gap #36: EntityForm `visibleIf`/`editableIf` Predicates Not Evaluated `[P4]`

**SPEC**: SPEC-023 / SPEC-022
**Gap**: Admin form sections with conditional visibility/editability always show (predicates are ignored)

#### Description

The entity form system has `visibleIf` and `editableIf` predicates in section configuration, but they are **never evaluated**:

| File | Issue |
|------|-------|
| `components/entity-form/EntityFormSection.tsx:92` | `visibleIf` predicate not evaluated.. section always shows if permission exists |
| `components/entity-form/EntityViewSection.tsx:108` | Same bug in view mode |
| `components/entity-form/hooks/useEntityForm.ts:68,84` | `visibleIf`/`editableIf` conditions not evaluated |
| `components/entity-form/providers/EntityFormProvider.tsx:151,221` | Zod form validation not connected |

This means any admin form with conditional sections (e.g., "show billing fields only for premium") will always display all sections.

#### Proposed Solutions

1. **Implement the predicate evaluation** in `EntityFormSection` and `useEntityForm`
2. **Remove the unused `visibleIf`/`editableIf` props** if no forms actually use them yet (YAGNI)
3. **Add to SPEC-022** (Frontend Quality) as admin form system completion

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM (admin-only, no end-user impact, but forms show sections they shouldn't)
- **Complexity**: 5/10
- **Recommendation**: Create formal SPEC if any entity uses conditional sections. If none do, remove the props (YAGNI).

---

### Gap #37: API Tests Mock DB Layer Instead of Service Layer `[P4]`

**SPEC**: SPEC-023
**Gap**: Multiple API test files mock `@repo/db` directly instead of service layer, creating fragile tests

#### Description

API route tests should mock the service layer (business logic), not the DB layer (data access). The following files mock `@repo/db` or `drizzle-orm` directly:

| File | Mock Target | Issue |
|------|-------------|-------|
| `test/routes/billing-admin-notifications.test.ts` | `@repo/db` + `drizzle-orm` | 7 `@ts-expect-error` from type mismatches |
| `test/routes/billing-promo-apply.test.ts` | `@repo/db` | Fragile when schema changes |
| `test/middlewares/billing-middleware.test.ts` | `@repo/db` | Same |
| `test/cron/webhook-retry.test.ts` | `@repo/db` | Same |
| `test/cron/exchange-rate-fetch.test.ts` | `@repo/db` | Same |
| `test/cron/dunning.job.test.ts` | `@repo/db` | Same |
| `test/integration/webhook-retry-flow.test.ts` | `@repo/db` | Same |

These tests break whenever DB schema changes (column names, relations), even if the API behavior hasn't changed.

#### Proposed Solutions

1. **Refactor to mock service layer** instead of DB layer
2. **Accept for integration tests** (some deliberately test DB interaction)
3. **Add to post-launch debt** if refactoring effort is too high now

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW (tests work currently, just fragile)
- **Complexity**: 7/10
- **Recommendation**: Post-launch debt. Document as test architecture improvement. No SPEC needed now.

---

### Gap #38: `as any` in Base CRUD Classes (6 uses) `[P4]`

**SPEC**: SPEC-023
**Gap**: 6 `as any` type assertions in service-core base classes affect all services

#### Description

| File | Line | Expression |
|------|------|------------|
| `base.crud.write.ts` | 82 | `await this.model.create(payload as any)` |
| `base.crud.write.ts` | 168 | `await this.model.update(where as any, finalPayload)` |
| `base.crud.write.ts` | 225 | `as any` in soft delete |
| `base.crud.write.ts` | 261 | `as any` in hard delete |
| `base.crud.write.ts` | 309 | `as any` in restore |
| `base.crud.read.ts` | 81 | `as any` in findById |

These are justified by the generic nature of `BaseCrudService<TEntity>` where the exact type can't be narrowed within the base class. They have `biome-ignore` comments. All 6 flow through to every service that extends the base.

#### Proposed Solutions

1. **Improve generic type constraints** to eliminate `as any` (requires deep TypeScript generic refactor)
2. **Accept and document** as structural limitation of the generic pattern (recommended)
3. **Replace with `as unknown as T`** for slightly better type safety signaling

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 8/10 (deep generic refactor)
- **Recommendation**: Accept as known limitation. Document in service-core CLAUDE.md. No SPEC needed.

---

### Gap #39: Redundant biome-ignore in db.test.ts `[P4]`

**SPEC**: SPEC-023
**Gap**: `packages/db/test/utils/db.test.ts:18` has a redundant `biome-ignore` that Biome flags as `suppressions/unused`

#### Description

Line 16 has `@ts-expect-error` and line 18 has a `biome-ignore lint/suspicious/noExplicitAny` that is redundant because TypeScript already suppresses the error. Biome reports this as a `suppressions/unused` warning.

#### Proposed Solutions

1. **Remove the redundant `biome-ignore`** and keep only `@ts-expect-error`

#### Priority/Severity/Complexity

- **Priority**: VERY LOW
- **Severity**: VERY LOW
- **Complexity**: 1/10
- **Recommendation**: Fix direct.. remove redundant line. No SPEC needed.

---

### Gap #40: 8 DB Models Without Any Test File `[P4]`

**SPEC**: SPEC-023 (extends Gap #4)
**Gap**: 8 models in `packages/db/src/models/` have no corresponding test file at all (not even skipped)

#### Description

Unlike Gap #4 (32 test files with `describe.skip`), these models have **no test file whatsoever**:

- `accommodation/accommodationFaq.model.ts`
- `accommodation/accommodationIaData.model.ts`
- `accommodation/accommodationReview.model.ts`
- `owner-promotion/ownerPromotion.model.ts`
- `post/postSponsor.model.ts`
- `sponsorship/sponsorshipLevel.model.ts`
- `sponsorship/sponsorshipPackage.model.ts`
- `user/userBookmark.model.ts`
- `user/userIdentity.model.ts`

#### Proposed Solutions

1. **Create stub test files** with `describe.todo` for tracking
2. **Write actual tests** when these models are actively used
3. **Track as debt** alongside Gap #4

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 5/10
- **Recommendation**: Post-launch debt. Merge tracking with Gap #4.

---

## SECTION B2: NEW GAPS DISCOVERED IN 5TH AUDIT PASS

---

### Gap #41: AmenitySummarySchema `.pick()` References Non-existent Fields `[P5]`

**SPEC**: SPEC-023 (extends Gap #26)
**Gap**: `AmenitySummarySchema.pick()` references `category` and `usageCount` which do not exist in `AmenitySchema`

#### Description

`packages/schemas/src/entities/amenity/amenity.query.schema.ts:317-325`:

```typescript
export const AmenitySummarySchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    category: true,     // Does NOT exist in AmenitySchema
    icon: true,
    usageCount: true    // Does NOT exist in AmenitySchema
});
```

**AmenitySchema** (`amenity.schema.ts:15-66`) defines: `id`, `slug`, `name`, `description`, `icon`, `type`, `isBuiltin`, `isFeatured`, `displayWeight`, + base fields. There is no `category` or `usageCount` field.

Zod's `.pick()` with non-existent keys produces an empty/undefined field silently (does not throw at schema definition time). Data passing through this schema will have `category` and `usageCount` stripped or undefined.

#### Proposed Solutions

1. **Replace `category` with `type`** (the actual field name in AmenitySchema) and remove `usageCount` from pick
2. **Add `usageCount` as a computed/extended field** via `.extend()` if it's needed in summary views
3. **Remove the schema entirely** if it's not used in production

#### Priority/Severity/Complexity

- **Priority**: HIGH
- **Severity**: HIGH (silent data loss.. fields silently become undefined)
- **Complexity**: 2/10
- **Recommendation**: Fix direct.. correct field names. No SPEC needed.

---

### Gap #42: UserBookmarkListItemSchema `.pick()` References Non-existent Fields `[P5]`

**SPEC**: SPEC-023 (extends Gap #26)
**Gap**: `UserBookmarkListItemSchema.pick()` references `notes` and `isPrivate` which do not exist in `UserBookmarkSchema`

#### Description

`packages/schemas/src/entities/userBookmark/userBookmark.query.schema.ts:141-150`:

```typescript
export const UserBookmarkListItemSchema = UserBookmarkSchema.pick({
    id: true,
    userId: true,
    entityId: true,
    entityType: true,
    notes: true,       // Does NOT exist in UserBookmarkSchema
    isPrivate: true,   // Does NOT exist in UserBookmarkSchema
    createdAt: true,
    updatedAt: true
});
```

**UserBookmarkSchema** (`userBookmark.schema.ts:12-37`) defines: `id`, `userId`, `entityId`, `entityType`, `name`, `description`, + base fields. There is no `notes` or `isPrivate` field in schema or DB.

This schema is used by `UserBookmarkSearchResultItemSchema` (extends it with `score`) and `UserBookmarkListResponseSchema` (pagination wrapper). Any code consuming these schemas will get `notes: undefined` and `isPrivate: undefined`.

#### Proposed Solutions

1. **Remove `notes` and `isPrivate` from `.pick()`** (YAGNI.. fields don't exist anywhere)
2. **Add the fields to `UserBookmarkSchema` + DB** if they're actually needed for the feature
3. **Replace with `name` and `description`** if those were the intended fields

#### Priority/Severity/Complexity

- **Priority**: HIGH
- **Severity**: HIGH (silent data loss + 3 skipped tests depend on this)
- **Complexity**: 2/10
- **Recommendation**: Fix direct.. option 1 (remove non-existent fields from pick). This also enables re-enabling 3 skipped tests from Gap #3.

---

### Gap #43: AttractionFiltersSchema References Non-existent Entity Fields `[P5]`

**SPEC**: SPEC-023
**Gap**: `AttractionFiltersSchema` defines 9 filter fields that don't exist in `AttractionSchema` or DB

#### Description

`packages/schemas/src/entities/attraction/attraction.query.schema.ts` defines filter fields that have no corresponding field in `AttractionSchema`:

| Filter Field | Exists in AttractionSchema? |
|---|---|
| `category` | NO |
| `subcategory` | NO |
| `isAccessible` | NO |
| `isIndoor` | NO |
| `isOutdoor` | NO |
| `isFree` | NO |
| `hasEntryFee` | NO |
| `isOperational` | NO |
| `isTemporarilyClosed` | NO |

**AttractionSchema** has: `id`, `name`, `slug`, `description`, `icon`, `destinationId`, `isFeatured`, `isBuiltin`, `displayWeight` + base fields.

These filter fields represent aspirational/planned features that were never implemented in the DB or entity schema. Any filter query using these fields would be silently ignored by the service layer.

#### Proposed Solutions

1. **Remove non-existent filter fields** from `AttractionFiltersSchema` (YAGNI)
2. **Keep as aspirational** but add comments marking them as "planned" with TODO
3. **Implement the fields** in both DB and schema if they're needed for launch

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM (filters silently ignored, misleading API contract)
- **Complexity**: 2/10 (to remove) or 6/10 (to implement)
- **Recommendation**: Fix direct.. remove non-existent fields or add `// PLANNED:` comments. No SPEC needed unless fields need implementation.

---

### Gap #44: AmenityFiltersSchema References Non-existent Entity Fields `[P5]`

**SPEC**: SPEC-023 (same pattern as Gap #43)
**Gap**: `AmenityFiltersSchema` defines filter fields (`category`, `usageCount` ranges) that reference non-existent `AmenitySchema` fields

#### Description

Similar to Gap #43 but for amenities. The filter schema references `category` (should be `type`) and `usageCount`-related fields that don't exist in the base entity schema.

#### Priority/Severity/Complexity

- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: 2/10
- **Recommendation**: Fix direct.. rename `category` to `type`, remove or mark `usageCount` filters. No SPEC needed.

---

### Gap #45: `packages/config` Has No Tests Despite Validation Logic `[P5]`

**SPEC**: SPEC-023 (test coverage)
**Gap**: `packages/config` contains env validation logic but has zero test files

#### Description

`packages/config` is listed as having no test directory. While config-only packages typically don't need tests, this package contains the **canonical env var registry** and validation logic used by `pnpm env:check`. Validation logic should be tested.

Other config packages without tests (`biome-config`, `tailwind-config`, `typescript-config`) are pure configuration with no logic, so their lack of tests is acceptable.

#### Proposed Solutions

1. **Add basic tests** for env validation functions
2. **Accept as exception** if validation is simple enough to be self-evident
3. **Defer to post-launch**

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 3/10
- **Recommendation**: Post-launch debt. No SPEC needed.

---

### Gap #46: Total Monorepo Skip Count is 81 (72 skip + 9 todo) `[P5]`

**SPEC**: SPEC-023 (test coverage meta-gap)
**Gap**: Consolidated skip count across the entire monorepo is higher than individual gap tracking suggests

#### Description

**P5 exhaustive grep results:**

| Category | Count | Packages |
|---|---|---|
| `describe.skip` / `it.skip` / `test.skip` | 72 | db (32), schemas (24), service-core (5), api (3+8 conditional) |
| `describe.todo` / `it.todo` / `test.todo` | 9 | api integration tests (real-user-scenarios 7, subscription-purchase 2) |
| **Total** | **81** | |

Individual gaps track: #3 (24 schemas), #4 (32 db), #14 (5 service-core), #15 (1 cron) = 62.
Remaining 19 are: api test-db conditional skips (8), api billing smoke skips (2), api integration todos (9).

The api test-db skips (`it.skipIf`) are conditional on DB availability and are architecturally correct (not a gap).

#### Priority/Severity/Complexity

- **Priority**: INFO
- **Severity**: INFO
- **Complexity**: N/A
- **Recommendation**: No action needed. This is a meta-tracking gap for completeness. Individual gaps (#3, #4, #14, #15) cover the actionable items.

---

### Gap #47: 9 DB Models Have No Test File At All (Updated Count) `[P5]`

**SPEC**: SPEC-023 (extends Gap #40)
**Gap**: P5 recount confirms 9 models (not 8 as P4 stated) have no test file

#### Description

**P5 verified list** (added `user/userIdentity.model.ts` which was omitted from P4 list header but present in body):

- `accommodation/accommodationFaq.model.ts`
- `accommodation/accommodationIaData.model.ts`
- `accommodation/accommodationReview.model.ts`
- `owner-promotion/ownerPromotion.model.ts`
- `post/postSponsor.model.ts`
- `sponsorship/sponsorshipLevel.model.ts`
- `sponsorship/sponsorshipPackage.model.ts`
- `user/userBookmark.model.ts`
- `user/userIdentity.model.ts`

#### Priority/Severity/Complexity

- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: 5/10
- **Recommendation**: Post-launch debt. Merge tracking with Gap #4/40.

---

## SECTION C: CONSOLIDATED PRIORITY SUMMARY

### CRITICAL (Must fix before next release)

| # | Gap | Description | Effort | Action | P5 Status |
|---|-----|-------------|--------|--------|-----------|
| 23 | csstype version conflict | 8 typecheck errors | 15 min | Fix direct | CONFIRMED |
| 25 | Missing i18n key | 2 test failures | 5 min | Fix direct | CONFIRMED |

### HIGH (Should fix soon)

| # | Gap | Description | Effort | Action | P5 Status |
|---|-----|-------------|--------|--------|-----------|
| 41 | AmenitySummarySchema .pick() bug | `category`/`usageCount` don't exist | 15 min | Fix direct | NEW [P5] |
| 42 | UserBookmarkListItemSchema .pick() bug | `notes`/`isPrivate` don't exist | 15 min | Fix direct | NEW [P5] |
| 29 | Production endpoints return wrong data | ReviewForm loses data, removeComment fails | 2-4 hours | New SPEC | CONFIRMED |
| 32 | Migration 0018 not committed | DB migration desync (untracked in git) | 10 min | Fix direct | CONFIRMED |

### MEDIUM (Plan to fix)

| # | Gap | Description | Effort | Action | P5 Status |
|---|-----|-------------|--------|--------|-----------|
| 43 | AttractionFiltersSchema phantom fields | 9 filter fields don't exist in entity | 20 min | Fix direct | NEW [P5] |
| 44 | AmenityFiltersSchema phantom fields | `category` should be `type` | 10 min | Fix direct | NEW [P5] |
| 26 | Stale schema test skip reasons | 24 tests with wrong reasons | 2-4 hours | New SPEC | CONFIRMED |
| 28 | z.any() for actor validation | No runtime validation of actors | 2 hours | Add to SPEC-037 | CONFIRMED |
| 36 | EntityForm predicates not evaluated | Admin form conditions ignored | 3 hours | Add to SPEC-022 | CONFIRMED |
| 6 | @repo/utils build no output | dist/ never generated | 15 min | Fix direct | CONFIRMED |
| 30 | Services without test coverage | 4 services at 0% | 4-6 hours | Post-launch | CONFIRMED |
| 19 | CI coverage vs web threshold | Per-package vs global | 15 min | Fix direct | NUANCED |
| 18 | console.* in production | 3-4 occurrences | 30 min | Fix direct | CONFIRMED |
| 3 | 24 skipped schema tests | Real bugs masked | 2-4 hours | See Gap #26 | CONFIRMED |
| 14 | 5 skipped service-core tests | Permission + visibility tests | 1 hour | Fix direct | UPDATED (5 not 4) |
| 2 | Biome ignoring `.claude/` | Preventive.. no code there now | 5 min | Fix direct | LOW RISK |
| 20 | Large JS chunks | Bundle size | 1 hour | Verify after #23 | UNVERIFIABLE |

### LOW (Technical debt)

| # | Gap | Description | Effort | Action | P5 Status |
|---|-----|-------------|--------|--------|-----------|
| 33 | 14 admin files > 500 lines | Code standard violation | 4-8 hours | Add to SPEC-022 | CONFIRMED |
| 37 | API tests mock DB layer | Fragile test architecture | 6-10 hours | Post-launch | CONFIRMED |
| 34 | Direct @phosphor-icons imports | Policy violation | 15 min | Fix direct | CONFIRMED |
| 35 | 12 HACK comments in routes | TanStack Router workaround | 1 hour | Investigate | CONFIRMED |
| 31 | 5 billing schemas no model | Pattern violation | 2 hours | Add to SPEC-021 | CONFIRMED |
| 45 | packages/config no tests | Validation logic untested | 2 hours | Post-launch | NEW [P5] |
| 4 | 32 skipped DB model tests | Zero DB test coverage | 20+ hours | Post-launch | CONFIRMED |
| 47 | 9 DB models no test file | No test at all (updated from 8) | 4 hours | Post-launch | UPDATED [P5] |
| 38 | as any in base CRUD | Generic type limitation | 8 hours | Accept/document | CONFIRMED |
| 8 | @ts-expect-error QZPay | Incomplete SDK types | 30 min | Add to SPEC-021 | CONFIRMED |
| 15 | 1 skipped cron test | Security test gap | 15 min | Fix direct | CONFIRMED |
| 7 | Astro build warnings | Prerender + headers | 30 min | Fix direct | CONFIRMED |
| 5 | Web coverage at 80% | Standard mismatch | 2+ hours | Document exception | CONFIRMED |
| 27 | Zombie schema file | Dead code | 5 min | Fix direct | CONFIRMED |

### VERY LOW (Nice to have)

| # | Gap | Description | Effort | Action | P5 Status |
|---|-----|-------------|--------|--------|-----------|
| 10 | 34 biome-ignore `<explanation>` | Missing explanations | 30 min | Fix direct | CONFIRMED |
| 13 | 8 in production code | Subset of #10 | Included in #10 | Fix direct | CONFIRMED |
| 22 | 15 biome-ignore in test files | Subset of #10 | Included in #10 | Fix direct | CONFIRMED |
| 9 | 3 eslint-disable comments | Dead comments | 10 min | Fix direct | CONFIRMED |
| 39 | Redundant biome-ignore | 1 lint warning | 2 min | Fix direct | CONFIRMED |

### INFO / RESOLVED (Not actionable)

| # | Gap | Description | Status |
|---|-----|-------------|--------|
| 1 | apps/web2 contamination | FIXED |
| 11 | CI not excluding web2 | FIXED (by #1) |
| 12 | @repo/utils no source | INVALIDATED |
| 21 | routeTree.gen.ts eslint | VALID EXCEPTION |
| 24 | Admin build env validation | MITIGATED (SPEC-035 lazy validation) |
| 46 | Total skip count 81 | INFO (meta-tracking only) |

---

## SECTION D: RECOMMENDATIONS FOR NEW SPECs

Based on the 5th audit, the following clusters of gaps would benefit from formal SPECs:

### Recommended: SPEC-039 (or equivalent) - "Schema Consistency and Test Re-enablement"
- Covers: Gaps #3, #26, #27, #41, #42, #43, #44
- Scope: Fix schema `.pick()` bugs referencing non-existent fields, correct filter schemas, update stale test fixtures, re-enable 24 skipped tests, delete zombie file
- Complexity: MEDIUM (5/10)
- P5 NOTE: Gaps #41 and #42 are quick fixes (15 min each) that could be done before this SPEC

### Recommended: SPEC-040 (or equivalent) - "Production Data Integrity Fixes"
- Covers: Gap #29
- Scope: Fix removeComment, totalEvents/eventsCount hardcoded zeros, connect ReviewForm to backend
- Complexity: MEDIUM (5/10)
- Priority: HIGH (user-facing data loss)

### Quick Fixes (no SPEC needed, can do immediately):
- **Gap #23**: Pin `csstype` version via pnpm.overrides (15 min)
- **Gap #25**: Add `lastUpdatedLabel` to en/pt terms.json (5 min)
- **Gap #32**: Review and commit migration 0018 (10 min)
- **Gap #41**: Fix AmenitySummarySchema `.pick()` (15 min)
- **Gap #42**: Fix UserBookmarkListItemSchema `.pick()` (15 min)
- **Gap #27**: Delete zombie schema file (5 min)

### Extend existing SPECs:
- **SPEC-022** (Frontend Quality): Add Gaps #33, #36
- **SPEC-021** (Billing System Fixes): Add Gaps #8, #31
- **SPEC-037** (Security Gaps): Add Gap #28

---

## Verification Commands Used (5th Pass)

```bash
# Direct verification (run during P5 audit)
pnpm typecheck                    # FAILED: 8 errors (csstype 3.1.3 vs 3.2.3 conflict)
pnpm lint                         # PASSED: 17/17 packages, 0 errors
pnpm test                         # FAILED: 2 failures (@repo/i18n lastUpdatedLabel missing in en/pt)

# Quantitative grep counts
grep -r "describe.skip\|it.skip\|test.skip" --include="*.test.*" -c packages/ apps/  # 72 occurrences
grep -r "describe.todo\|it.todo\|test.todo" --include="*.test.*" -c packages/ apps/  # 9 occurrences

# Schema consistency checks
grep -rn "\.pick({" packages/schemas/src/entities/  # Verified all .pick() calls against base schemas
grep -rn "\.omit({" packages/schemas/src/entities/  # Verified all .omit() calls

# Multi-agent audit areas
# Agent 1: Critical gaps #23, #24, #25 verification
# Agent 2: High priority gaps #29, #32, #19, #2 verification
# Agent 3: New code quality issues scan (TODO/FIXME/HACK, empty catches, any types, console.log, etc.)
# Agent 4: Test coverage audit (skipped tests, packages without tests, services without tests)
# Agent 5: Schema/DB consistency audit (.pick()/.omit() bugs, field mismatches, orphaned exports)
```
