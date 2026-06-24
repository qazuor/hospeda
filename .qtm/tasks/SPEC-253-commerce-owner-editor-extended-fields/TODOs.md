# SPEC-253 — Task Breakdown

## Spec

Commerce owner editor: extended fields + single COMMERCE_EDIT_OWN permission

Total tasks: 31

---

## Critical Path

```
T-001 (enum deletion + COMMERCE_EDIT_OWN)
  → T-004 (commerce.permissions.ts core rewrite)
    → T-005 (gastronomy.permissions.ts)
      → T-006 (gastronomy.service.ts updateOwn)  ← also needs T-013
    → T-007 (experience.permissions.ts + service) ← also needs T-014
    → T-009 (service-core permission tests)
  → T-011 (media permissions.ts)
    → T-012 (media permission-gate.test.ts)
  → T-013 (GastronomyOwnerUpdateInputSchema new fields)
    → T-006 (gastronomy.service.ts updateOwn)
  → T-014 (ExperienceOwnerUpdateInputSchema new fields)
    → T-007 (experience.service.ts updateOwn)
  → T-015 (admin commerceSections.ts migration)
    → T-016 (admin consolidated config tests)
  → T-020 (CommerceListingEditor: type/summary/polish)
    → T-021 (experience priceFrom/priceUnit)
      → T-022 (CommerceTranslationPanel component)
        → T-023 (wire TranslationPanel into editor)
          → T-025 (editar.astro integration)
            → T-028 (E2E: type + i18n persist)
  → T-024 (CommerceFaqManager component)
    → T-025 (editar.astro integration)
→ T-031 (final typecheck + full test run)
```

**Critical path bottleneck:** T-001 → T-004 → T-005/T-007 → T-006 → T-020 → T-022 → T-023 → T-025 → T-028 → T-031

---

## Parallel Tracks After T-001

```
Track A (Permissions — Backend):
  T-001 → T-004 → T-005 → T-006 → T-009, T-010
                → T-007 → T-009, T-010
  T-001 → T-002 (enum test)
  T-001 → T-003 (seed)
  T-001 → T-008 (FAQ route comments)
  T-001 → T-011 → T-012

Track B (Schemas):
  T-001 → T-013 → T-006 (merges with Track A)
  T-001 → T-014 → T-007 (merges with Track A)
           T-013, T-014 → T-027 (schema tests)

Track C (Admin Panel):
  T-001 → T-015 → T-016

Track D (Web Editor):
  T-013, T-014 → T-020 → T-021 → T-022 → T-023 → T-025
  T-001 → T-024 → T-025
  T-025 → T-028, T-029, T-030

Track E (Service Tests):
  T-004 → T-018
  T-005, T-007 → T-017, T-019
  T-006, T-007 → T-010

Merge Point:
  T-031 depends on all tracks complete
```

---

## Phase: core

| ID | Title | Complexity | Blocks |
|----|-------|-----------|--------|
| T-001 | Delete 10 per-section perms, add COMMERCE_EDIT_OWN to PermissionEnum | 1 | T-002..T-008 |
| T-002 | Rewrite permission-commerce.test.ts for single COMMERCE_EDIT_OWN | 1 | — |
| T-003 | Update seed: replace 10 per-section perms with COMMERCE_EDIT_OWN in COMMERCE_OWNER bundle | 1 | — |
| T-004 | Rewrite commerce.permissions.ts: collapse COMMERCE_OWNER_EDIT_PERMISSIONS + checkCanEditOwn signature | 2 | T-005, T-006, T-009 |
| T-005 | Rewrite gastronomy.permissions.ts: drop checkGastronomyCanEditOwn section param, update checkGastronomyCanEditFaqs | 1 | T-006, T-009 |
| T-006 | Rewrite gastronomy.service.ts updateOwn: single COMMERCE_EDIT_OWN gate, add new fields | 2 | T-009 |
| T-007 | Rewrite experience.permissions.ts + experience.service.ts updateOwn parallel to gastronomy | 2 | T-009 |
| T-008 | Update API FAQ routes (gastronomy + experience protected): COMMERCE_FAQS_EDIT_OWN → COMMERCE_EDIT_OWN | 1 | — |
| T-009 | Rewrite service-core permission tests (commerce + gastronomy + experience permissions) | 2 | — |
| T-010 | Update gastronomy.service.test.ts and experience.service.test.ts: per-section blocks + T-022 regression | 2 | — |
| T-011 | Update admin media permissions.ts: COMMERCE_MEDIA_EDIT_OWN → COMMERCE_EDIT_OWN | 1 | T-012 |
| T-012 | Update media permission-gate.test.ts: replace COMMERCE_MEDIA_EDIT_OWN with COMMERCE_EDIT_OWN | 1 | — |
| T-013 | Update GastronomyOwnerUpdateInputSchema: add type, summary, nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n | 1 | T-006 |
| T-014 | Update ExperienceOwnerUpdateInputSchema: add type, summary, i18n fields, priceFrom, priceUnit | 1 | T-007 |
| T-017 | Update gastronomy.faq.test.ts and experience.faq.test.ts: replace COMMERCE_FAQS_EDIT_OWN | 1 | — |
| T-018 | Update base-commerce-listing.service.test.ts: remove per-section perm references | 1 | — |
| T-019 | Update spec-239 integration test: replace per-section perms with COMMERCE_EDIT_OWN | 1 | — |

## Phase: integration

| ID | Title | Complexity | Blocks |
|----|-------|-----------|--------|
| T-015 | Update admin commerceSections.ts: replace all per-section COMMERCE_*_EDIT_OWN with COMMERCE_EDIT_OWN | 2 | T-016 |
| T-016 | Update admin consolidated config tests for gastronomy and experience | 1 | — |
| T-020 | Add type select and summary textarea to CommerceListingEditor; polish website/linkedIn | 3 | T-021 |
| T-021 | Add experience priceFrom + priceUnit fields to CommerceListingEditor | 2 | T-022 |
| T-022 | Add CommerceTranslationPanel component (replicating SPEC-212 TranslationPanel pattern) | 3 | T-023 |
| T-023 | Wire CommerceTranslationPanel into CommerceListingEditor | 2 | T-025 |
| T-024 | Add CommerceFaqManager component (web owner FAQ UI) | 3 | T-025 |
| T-025 | Integrate CommerceFaqManager and CommerceTranslationPanel into editar.astro page | 2 | T-028, T-029, T-030 |

## Phase: testing

| ID | Title | Complexity | Blocks |
|----|-------|-----------|--------|
| T-026 | Write unit tests for CommerceTranslationPanel and CommerceFaqManager | 2 | — |
| T-027 | Write schema unit tests: GastronomyOwnerUpdateInputSchema and ExperienceOwnerUpdateInputSchema new fields | 1 | — |
| T-028 | E2E: owner can edit type + i18n fields and changes persist on public ficha | 2 | — |
| T-029 | E2E: owner without COMMERCE_EDIT_OWN gets FORBIDDEN on PATCH updateOwn | 1 | — |
| T-030 | E2E: contact has no website field; social includes linkedIn | 1 | — |

## Phase: cleanup

| ID | Title | Complexity | Blocks |
|----|-------|-----------|--------|
| T-031 | Final typecheck + full test run across affected packages | 1 | — |

---

## Acceptance Criteria Map

| AC | Tasks |
|----|-------|
| AC-1: owner can edit type, summary, i18n, FAQs, experience price; changes persist | T-013, T-014, T-006, T-007, T-020, T-021, T-023, T-024, T-025, T-027, T-028 |
| AC-2: owner write path gated by single COMMERCE_EDIT_OWN; missing → FORBIDDEN; staff with EDIT_ALL passes | T-001, T-004, T-005, T-007, T-009, T-010, T-011, T-012, T-029 |
| AC-3: i18n editing matches accommodation TranslationPanel UX | T-022, T-023, T-026, T-028 |
| AC-4: contact has no phantom website; social includes linkedIn | T-020, T-030 |
| AC-5: SPEC-249 AC-3 regression updated — type no longer stripped; other identity fields still stripped | T-013, T-014, T-010, T-027 |

---

## Key Files Affected

### packages/schemas

- `src/enums/permission.enum.ts` — T-001
- `src/enums/__tests__/permission-commerce.test.ts` — T-002
- `src/entities/gastronomy/gastronomy.crud.schema.ts` — T-013
- `src/entities/experience/experience.crud.schema.ts` — T-014

### packages/seed

- `src/required/rolePermissions.seed.ts` — T-003

### packages/service-core

- `src/services/commerce/commerce.permissions.ts` — T-004
- `src/services/gastronomy/gastronomy.permissions.ts` — T-005
- `src/services/gastronomy/gastronomy.service.ts` — T-006
- `src/services/experience/experience.permissions.ts` — T-007 (permissions part)
- `src/services/experience/experience.service.ts` — T-007 (service part)
- `src/services/gastronomy/gastronomy.faq.ts` — no code change (gating via helper, already updated in T-005)
- `src/services/experience/experience.faq.ts` — no code change (gating via helper, already updated in T-007)
- `test/services/commerce/commerce.permissions.test.ts` — T-009
- `test/services/commerce/base-commerce-listing.service.test.ts` — T-018
- `test/services/gastronomy/gastronomy.permissions.test.ts` — T-009
- `test/services/gastronomy/gastronomy.faq.test.ts` — T-017
- `test/services/gastronomy/gastronomy.service.test.ts` — T-010
- `test/services/experience/experience.permissions.test.ts` — T-009
- `test/services/experience/experience.faq.test.ts` — T-017
- `test/services/experience/experience.service.test.ts` — T-010
- `test/integration/services/spec-239-gastronomy-commerce.integration.test.ts` — T-019

### apps/api

- `src/routes/gastronomy/protected/addFaq.ts` — T-008 (comment only)
- `src/routes/gastronomy/protected/removeFaq.ts` — T-008
- `src/routes/gastronomy/protected/reorderFaqs.ts` — T-008
- `src/routes/gastronomy/protected/updateFaq.ts` — T-008
- `src/routes/experience/protected/addFaq.ts` — T-008
- `src/routes/experience/protected/removeFaq.ts` — T-008
- `src/routes/experience/protected/reorderFaqs.ts` — T-008
- `src/routes/experience/protected/updateFaq.ts` — T-008
- `src/routes/media/admin/permissions.ts` — T-011
- `test/routes/media/permission-gate.test.ts` — T-012

### apps/admin

- `src/features/commerce/config/commerceSections.ts` — T-015
- `src/features/gastronomy/__tests__/gastronomy-consolidated.config.test.ts` — T-016
- `src/features/experience/__tests__/experience-consolidated.config.test.ts` — T-016

### apps/web

- `src/components/commerce/CommerceListingEditor.client.tsx` — T-020, T-021, T-023
- `src/components/commerce/CommerceTranslationPanel.client.tsx` (new) — T-022
- `src/components/commerce/CommerceTranslationPanel.module.css` (new) — T-022
- `src/components/commerce/CommerceFaqManager.client.tsx` (new) — T-024
- `src/components/commerce/CommerceFaqManager.module.css` (new) — T-024
- `src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro` — T-025
- `src/lib/commerce/owner-listings.ts` — T-025 (if CommerceListingDetail lacks new fields)
