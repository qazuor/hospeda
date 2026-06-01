---
spec-id: SPEC-177
title: Admin FAQ Management UI (Phase 2 of SPEC-158)
type: feature
complexity: high
status: draft
created: 2026-06-01T00:00:00Z
references:
  - SPEC-158 (Phase 1 — destination FAQs seed + public read + JSON-LD)
---

# SPEC-177 — Admin FAQ Management UI (Phase 2 of SPEC-158)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Give admins and owning hosts a UI to **create, edit, delete, and reorder** structured FAQs
for **destinations** and **accommodations**, completing the missing backend on the destination side and
introducing a single generic admin FAQ manager reused by both entities.

**Motivation.** SPEC-158 Phase 1 shipped destination FAQs as **seed-only + public read + `FAQPage`
JSON-LD**, and its "Decisions locked" explicitly deferred *"Admin/protected FAQ CRUD + editing UI"* to
Phase 2. Today:

- **Accommodation** has a full FAQ backend (`addFaq`/`updateFaq`/`removeFaq`/`getFaqs`/`adminGetFaqs`
  in `accommodation.service.ts` + 4 admin routes) but **no admin UI**.
- **Destination** has only `addFaq` + `getFaqs` in `destination.service.ts`, **zero admin routes**, no UI.
- **Neither** `destination_faqs` nor `accommodation_faqs` has a column to persist display order.

**Success criteria.**

- An admin can manage (CRUD + reorder) FAQs for any destination and any accommodation from a dedicated
  "FAQs" sub-tab.
- A HOST can manage FAQs only on accommodations they own (server-enforced); a non-owner is forbidden.
- FAQ display order persists and the **public** destination/accommodation detail returns FAQs in that order.
- All new code is covered by tests (service, API, admin component) with ≥90% on new code.

**Target users.** Platform admins (all entities) and hosts (their own accommodations).

**Decisions locked (do not re-litigate).**

- **Edit model = granular per-item.** Add/edit/delete each fire their own request
  (`POST`/`PUT`/`DELETE /{id}/faqs[/:faqId]`); reorder is a dedicated `PATCH /{id}/faqs/reorder`.
- **Category = suggested enum + free text.** Combobox preloaded with the SPEC-158 baseline
  (`Cómo llegar`, `Qué hacer`, `Cuándo visitar`, `Servicios`) but a custom value is allowed. `category`
  stays a `string` in the schema.
- **Answer = plain text** (textarea). No markdown/rich editor (faithful to Phase 1; no new public
  sanitization surface).
- **Permissions = existing entity UPDATE perms** via the service `_canUpdate` gate. NO new
  `PermissionEnum` value. Routes require only admin-panel access; the service enforces
  `*_UPDATE_ANY` OR (`*_UPDATE_OWN` + ownership).
- **Reorder via a nullable `display_order` column**, additive migration, existing rows backfilled by
  `created_at` per parent. New FAQs get `max(display_order)+1` at create time.
- **Scope covers BOTH destinations and accommodations.** The admin manager component is generic/reusable.

### 2. User Stories & Acceptance Criteria (BDD)

**US-1 — Admin adds a FAQ to a destination.**

- GIVEN an admin on a destination's "FAQs" sub-tab
- WHEN they fill question + answer + category and submit "Add FAQ"
- THEN a `POST /api/v1/admin/destinations/:id/faqs` creates the FAQ with `display_order = max+1`
- AND the new row appears at the end of the list without a full page reload.

**US-2 — Admin edits an existing FAQ.**

- GIVEN a destination/accommodation FAQ row in edit mode
- WHEN the admin changes question/answer/category and saves
- THEN a `PUT /.../faqs/:faqId` persists the change
- AND validation errors (question/answer length per `BaseFaqSchema`) are shown inline and block save.

**US-3 — Admin deletes a FAQ.**

- GIVEN a FAQ row
- WHEN the admin clicks delete and confirms
- THEN a `DELETE /.../faqs/:faqId` soft-deletes it and it disappears from the list.

**US-4 — Admin reorders FAQs by drag-and-drop.**

- GIVEN ≥2 FAQs on a parent
- WHEN the admin drags a FAQ to a new position
- THEN a `PATCH /.../faqs/reorder` persists the new `display_order` for the affected rows
- AND reordering is keyboard-accessible (dnd-kit) and respects `prefers-reduced-motion`
- AND an unknown/foreign `faqId` in the payload is rejected (validation/ownership error).

**US-5 — Host scope is enforced server-side.**

- GIVEN a HOST with `ACCOMMODATION_UPDATE_OWN`
- WHEN they manage FAQs on an accommodation they own → succeeds
- AND on an accommodation they do NOT own → the service returns a forbidden error (no mutation).

**US-6 — Public detail respects FAQ order.**

- GIVEN a destination/accommodation with FAQs having `display_order`
- WHEN the public detail endpoint returns the entity
- THEN `faqs` come back ordered by `display_order ASC NULLS LAST, created_at ASC`
- AND the public FAQ accordion renders in that order.

### 3. UX Considerations

- **Entry point**: a new "FAQs" tab in `destinationTabs` and `accommodationTabs`
  (`apps/admin/src/components/layout/PageTabs.tsx`), routed via
  `routes/_authed/{destinations,accommodations}/$id_.faqs.tsx` wrapping the manager in the entity's
  `SubTabLayout`.
- **List**: rows showing question (collapsed answer), category badge, drag handle, edit + delete actions.
- **Add**: an "Add FAQ" affordance opening an inline/blank row.
- **Category combobox**: baseline suggestions + free text; consistent across both entities.
- **Answer**: multi-line textarea, max length per `BaseFaqSchema` (2000).
- **Loading/empty/error**: empty state ("No FAQs yet"), per-row busy state during mutation, toast on
  success/error naming the entity.
- **a11y**: drag handle is the only dnd-wired control (delete/edit/inputs stay independently focusable),
  mirroring `SortableGalleryItem`.

### 4. Out of Scope

- Markdown/rich-text answers (plain text only).
- Bulk import/export of FAQs.
- Public/user-submitted FAQs.
- Converting `category` to a strict enum (stays free string with suggestions).
- Touching the web FAQ accordion components beyond confirming order (read-side ordering is in service).

## Part 2 — Technical Analysis

### 5. Architecture

Layered, bottom-up (DB → schemas → service → API → admin UI → public read). Reuses the **accommodation
FAQ backend** as the canonical pattern and the **GalleryField dnd** as the reorder pattern. No new
dependencies (`@dnd-kit/*` already in admin).

### 6. Data Model Changes

Add to **both** `destination_faqs` and `accommodation_faqs`:

```ts
// packages/db/src/schemas/{destination,accommodation}/*_faq.dbschema.ts
displayOrder: integer('display_order')   // nullable
```

- **Column add** is applied by `drizzle-kit push` (the project's real schema-sync path: `db:migrate`
  and `db:fresh-dev` both run `push`, NOT generated migrations — the generated `meta/` journal is
  gitignored, so `db:generate` would emit a full-schema `0000`, which is wrong here).
- **Backfill** is a hand-written idempotent SQL at `packages/db/src/migrations/manual/0031_faq_display_order_backfill.sql`
  (`display_order` per parent ordered by `created_at`, `WHERE display_order IS NULL`), applied by
  `packages/db/scripts/apply-postgres-extras.mjs` after push (which runs every `*.sql` under `manual/`).
- After `db:fresh-dev`, `apply-postgres-extras` runs automatically; the dynamic `set_updated_at`
  trigger already covers the table (no new trigger needed). New FAQs get `max(display_order)+1` from
  the service, so on a fresh seed the backfill is a no-op.

### 7. API Design

All under the admin tier. Routes thin; service enforces ownership.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/admin/destinations/:id/faqs` | — | new (copy accommodation getFaqs) |
| POST | `/api/v1/admin/destinations/:id/faqs` | `FaqCreatePayloadSchema` | new |
| PUT | `/api/v1/admin/destinations/:id/faqs/:faqId` | `FaqUpdatePayloadSchema` | new |
| DELETE | `/api/v1/admin/destinations/:id/faqs/:faqId` | — | new |
| PATCH | `/api/v1/admin/destinations/:id/faqs/reorder` | `FaqReorderPayloadSchema` | new |
| PATCH | `/api/v1/admin/accommodations/:id/faqs/reorder` | `FaqReorderPayloadSchema` | new |

`FaqReorderPayloadSchema = { order: Array<{ faqId: uuid, displayOrder: int }> }`.

Errors: `401` (no admin-panel access), `403` (host non-owner via service), `404` (parent/faq missing),
`422`/`VALIDATION_ERROR` (bad payload, foreign faqId).

### 8. Schema Changes (`@repo/schemas`)

- `BaseFaqSchema` += `displayOrder: z.number().int().nonnegative().nullish()` (additive).
- New `FaqReorderPayloadSchema` (shared) + `DestinationFaqReorderInputSchema` /
  `AccommodationFaqReorderInputSchema` (service inputs, mirroring existing `*FaqAdd/Update/Remove`).
- Shared baseline categories constant (e.g. `FAQ_BASELINE_CATEGORIES`) exported for admin combobox.

### 9. Service Changes (`@repo/service-core`)

- **Destination** `destination.service.ts`: add `updateFaq`, `removeFaq`, `adminGetFaqs` mirroring
  `accommodation.service.ts` (~2080–2237).
- **Both**: add `reorderFaqs(actor, { <parent>Id, order })` — `_canUpdate` gate, validate each faqId
  belongs to parent, apply order in a transaction. (No audit entry: FAQ mutations in this codebase
  do not write audit logs — `addFaq`/`updateFaq`/`removeFaq` don't either; audit infra is
  billing-only. Reorder matches that parity rather than introducing a new audit path.)
- `addFaq` (both): assign `displayOrder = max+1` at create.
- Read order in `getFaqs`/`adminGetFaqs` + `findWithRelations` faqs load:
  `display_order ASC NULLS LAST, created_at ASC`.

### 10. Admin UI (`apps/admin`)

- Generic `FaqManager` + `SortableFaqRow` (e.g. `apps/admin/src/components/faqs/`), parameterized by
  `{ entityType, parentId, apiBasePath }`.
- Per-item CRUD via TanStack Query mutations; drag-reorder copied from `GalleryField` +
  `SortableGalleryItem`; `field.handleChange(newArray)` form style; Zod `safeParse`; Shadcn + Tailwind.
- Generic hook `useFaqs(entityType, parentId)` (list/create/update/delete/reorder).
- Tabs added to `PageTabs.tsx`; routes `$id_.faqs.tsx` for both entities via their `SubTabLayout`.
- i18n keys es/en/pt (restart admin dev after JSON edits — SSR cache gotcha).

### 11. Dependencies

- None new. `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` already present in `apps/admin`.

### 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `db:push` drops `search_index` | High | Formal generated migration + `apply-postgres-extras.sh` |
| Reorder race under concurrent edits | Medium | Reorder on current server order; re-fetch after; reject unknown faqIds |
| i18n SSR cache shows `[MISSING]` | Low | Restart admin dev after JSON edits (don't trust HMR) |
| Migration backfill wrong order | Medium | Backfill by `created_at` per parent; verify on `db:fresh-dev` |

### 13. Testing Strategy (no tests = not done)

- **Service**: destination `updateFaq`/`removeFaq`/`adminGetFaqs`/`reorderFaqs`; accommodation
  `reorderFaqs`. Cover ownership denial (`UPDATE_OWN` non-owner → forbidden), foreign-faqId rejection,
  reorder persistence + read order, `addFaq` → `max+1`.
- **API integration**: 4 destination admin routes + reorder on both — success, 401/403, 422, 404.
- **Admin component**: `FaqManager` add/edit/delete/reorder happy paths, category custom value, drag
  fires reorder mutation.
- **Public**: existing Phase 1 destination FAQ integration test stays green + assert `faqs` come back
  ordered by `display_order`.

## Implementation Approach (phases)

1. **setup** — DB column + migration + backfill; schema additions (`displayOrder`, reorder schemas,
   baseline categories).
2. **core** — service methods (destination CRUD parity + reorder both + addFaq order + read order).
3. **integration** — API routes (destination CRUD + reorder both) + registration.
4. **integration** — admin UI (FaqManager, hooks, tabs, routes, i18n).
5. **testing** — service + API + component tests; public order assertion.
6. **docs + cleanup** — `apps/web/CLAUDE.md` / admin notes; verify; close.

## Internal Review Notes

- **Strengthened**: permission model pinned to service `_canUpdate` (no new PermissionEnum), matching
  the documented accommodation pattern (`addFaq.ts` JSDoc). Reorder payload shape fixed and shared.
- **Open questions for impl**: exact destination UPDATE permission constant name (resolve by reading
  `destination.service.ts` `_canUpdate`); whether baseline categories live in `@repo/schemas` (preferred)
  vs admin const; whether `getFaqs` already exposes a stable order today (verify before changing).
- **No external services involved** (no web-doc verification needed).
