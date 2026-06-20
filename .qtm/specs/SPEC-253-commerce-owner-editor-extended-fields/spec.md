---
specId: SPEC-253
title: Commerce owner editor — extended fields + single COMMERCE_EDIT_OWN permission
slug: commerce-owner-editor-extended-fields
type: feature
complexity: medium
status: draft
created: 2026-06-20
base: staging
dependsOn:
  - SPEC-249
tags:
  - commerce
  - gastronomy
  - experience
  - web
  - owner
  - permissions
  - i18n
---

# SPEC-253 — Commerce owner editor: extended fields + single permission

## 1. Origin

SPEC-249 shipped the commerce owner self-service editor (`/[lang]/mi-cuenta/comercio`)
with an initial operational field set and a per-section permission model inherited from
SPEC-239. During the SPEC-249 close-out review (2026-06-20) the owner decided to:

1. **Expand the editable field set** the commerce owner controls.
2. **Collapse the per-section permission model** into a single owner permission.
3. **Polish the editor** (fix mismatched/missing fields surfaced during the live E2E).

## 2. Goals

- Let a `COMMERCE_OWNER` edit the full owner-facing field set agreed with the owner.
- Replace the per-section `COMMERCE_*_EDIT_OWN` gating on the **owner write path**
  (`updateOwn` + owner FAQ endpoints) with a single `COMMERCE_EDIT_OWN` permission.
- Align the web editor UI with the schema (no phantom/missing fields).

## 3. Scope — editable field set (owner)

Add to the owner-editable set (on top of what SPEC-249 already ships):

- `type` — listing category (was identity/read-only → now owner-editable). **Decision
  D1 (owner): YES.** Requires removing `type` from the identity-strip guard and updating
  the SPEC-249 AC-3 regression (T-022) accordingly.
- `summary` — short summary (string).
- `nameI18n` / `summaryI18n` / `descriptionI18n` / `richDescriptionI18n` — per-locale
  translations (es/en/pt). **Decision D3 (owner): implement EXACTLY like the
  accommodation editor** — replicate the SPEC-212 `TranslationPanel` pattern
  (`apps/web/src/components/host/editor/TranslationPanel*`).
- `faqs` — FAQ management UI in the editor. Backend already exists (SPEC-239 add/update/
  remove/reorder endpoints); this adds the web surface.
- `priceFrom` + `priceUnit` — experience-only pricing (number + unit select).

Already editable in SPEC-249 (unchanged): `richDescription`, `contactInfo.mobilePhone`,
`contactInfo.workEmail`, `socialNetworks` (facebook/instagram/twitter/tiktok/youtube),
`openingHours.days`, `media.featuredImage`, `media.gallery`, `amenityIds`, `featureIds`,
gastronomy `priceRange`+`menuUrl`, experience `isPriceOnRequest`.

### Polish (from the SPEC-249 live E2E review)

- Remove the phantom `website` field from the Contact group (not in `ContactInfoSchema`).
- Add `linkedIn` to the social group (exists in schema, missing in UI).
- Decide on `videos` (media) — currently not editable; default OUT unless owner requests.

## 4. Scope — permission model (Decision D2)

The owner write path collapses to a **single `COMMERCE_EDIT_OWN`** permission:

- Add `COMMERCE_EDIT_OWN` to `PermissionEnum` + the `COMMERCE_OWNER` role bundle.
- Rewrite `GastronomyService.updateOwn` / `ExperienceService.updateOwn` per-section
  checks → one `COMMERCE_EDIT_OWN` (owner) OR `COMMERCE_EDIT_ALL` (staff) check.
- Owner FAQ endpoints gate on `COMMERCE_EDIT_OWN`.

**OPEN DECISION (D2 a vs b)** — the per-section `COMMERCE_*_EDIT_OWN` perms are ALSO
used by the **admin panel** (`apps/admin/.../commerceSections.ts`), media gate, and
their tests:

- **(a)** Collapse only the OWNER path to `COMMERCE_EDIT_OWN`; keep the granular perms
  for the admin panel. Less invasive. *(Recommended.)*
- **(b)** Full removal of the per-section perms (rewrite admin section gating + media
  perms + all tests). Cleaner enum, larger blast radius.
  Owner to confirm a or b before implementation.

## 5. Out of scope

- The admin panel editor (unless D2=b forces touching its gating).
- Identity fields kept read-only for owners: `name`, `slug`, `description` (base),
  `destinationId`, lifecycle/visibility/moderation/`isFeatured`/`ownerId`.
  - NOTE: the agreed set edits `nameI18n`/`descriptionI18n` while leaving base
    `name`/`description` read-only — confirm this asymmetry is intentional during planning.

## 6. Acceptance criteria (BDD outline)

- AC-1: An owner can edit `type`, `summary`, the four i18n fields, FAQs, and (experience)
  `priceFrom`/`priceUnit`, and the changes persist + appear on the public ficha.
- AC-2: The owner write path is gated by a single `COMMERCE_EDIT_OWN`; an owner missing
  it gets FORBIDDEN; staff with `COMMERCE_EDIT_ALL` still passes.
- AC-3: i18n editing matches the accommodation `TranslationPanel` UX.
- AC-4: Contact has no phantom `website`; social includes `linkedIn`.
- AC-5: SPEC-249 AC-3 regression updated — `type` no longer in the stripped set; all
  other identity fields still stripped.

## 7. Tasks (outline — atomize at start)

1. Permissions: add `COMMERCE_EDIT_OWN` (enum + bundles + tests) + decide D2 a/b.
2. Service: rewrite `updateOwn` gating (both verticals) to single perm; update tests.
3. Schemas: add `type`, `summary`, i18n, `priceFrom`, `priceUnit` to owner-update;
   update SPEC-249 T-022 regression.
4. Editor UI: `type` select, `summary` textarea, experience price (number+unit).
5. Editor UI: i18n `TranslationPanel` (replicate SPEC-212).
6. Editor UI: FAQ manager (list/add/edit/reorder) wired to existing endpoints.
7. Polish: remove `website`, add `linkedIn`, decide `videos`.
8. Tests + E2E coverage of the new fields (E2E depends on SPEC-252 harness).

## 8. Dependencies

- SPEC-249 (base editor + owner endpoints) — done.
- SPEC-252 (E2E harness) for the automated E2E of the new fields.
