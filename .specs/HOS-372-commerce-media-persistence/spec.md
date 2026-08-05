---
title: Commerce listing media persists per-operation instead of waiting for form Save
linear: HOS-372
statusSource: linear
created: 2026-08-01
type: fix
areas:
  - web
  - api
  - db
---

# Commerce listing media persists per-operation instead of waiting for form Save

## 1. Summary

In the commerce owner editor (gastronomy/experience listings), uploading a photo
sends the file to Cloudinary immediately, but the association between that
uploaded file and the listing (`media.featuredImage` / `media.gallery`) is only
written to the database when the owner clicks the general "Guardar cambios"
button. If the owner navigates away before saving, the file is orphaned in
Cloudinary and never appears anywhere — not on the public listing, not back in
the editor on reload. Bring commerce media to the same relational,
per-operation persistence model the accommodation editor already uses, so an
upload is durable the moment it succeeds.

## 2. Problem

`MediaField.tsx` (`apps/web/src/components/commerce/MediaField.tsx`) uploads via
`POST /api/v1/protected/media/upload-entity` inside `uploadEntityImage()`
(lines 73–136), which returns immediately on success and calls `onChange` with
the updated `{ featuredImage, gallery }` pair (lines 219–236, 274–301). That
`onChange` only updates **local React state** in
`CommerceListingEditor.client.tsx` (`updateMedia`, lines 293–300) and marks the
`'media'` key dirty (`markDirty('media')`). The dirty `media` group is only
included in the PATCH body inside `buildPayload()` (lines 390–396) when the
owner submits the form (`handleSubmit`, lines 449–493), which sends
`PATCH /api/v1/protected/{gastronomies|experiences}/:id` with the **entire**
`media` object replacing the JSONB column (per the file's own header comment:
"gastronomy/experience do NOT merge the media JSONB, so the parent always
sends the complete media state on save").

Consequence: the file is durably stored in Cloudinary the instant the upload
XHR completes, but the pointer to it (the JSONB row) exists only in the
browser's React state until Save. If the owner closes the tab, navigates away,
or the form errors out on an unrelated dirty field, the upload is silently
lost — not shown anywhere, not recoverable, and the Cloudinary asset becomes
an orphan with no cleanup path (see §5).

`apps/web` has no `beforeunload` handler anywhere in `src/` (verified by grep),
so nothing warns the owner before they navigate away with unsaved uploads.
That gap is transversal to the whole app and explicitly out of scope here (see
§4 NG-2).

## 3. Goals

- G-1: An uploaded commerce photo (featured or gallery) is associated with its
  listing the moment the upload succeeds — no dependency on the general form
  Save.
- G-2: A refresh/navigate-away immediately after an upload preserves the photo
  (matches the acceptance test in the linked issue: "subo foto, no guardo,
  recargo → la foto sigue ahí").
- G-3: Bring the data model for gastronomy/experience media to the same
  relational, per-row shape `accommodation_media` already uses, so the same
  granular endpoints, hydration pattern, and portada/galería UX apply
  uniformly across all three verticals.
- G-4: Decide and implement a path for the media already stored as JSONB on
  existing gastronomy/experience rows (migration), and a policy for
  already-uploaded-but-never-associated Cloudinary assets (retroactive
  cleanup or explicit non-goal, see §10/§11).

## 4. Non-goals

- NG-1: Reordering / captions / alt text / attribution for commerce media
  beyond what `MediaField.tsx` already exposes today (featured + gallery,
  no reorder). `accommodation_media` has a `sortOrder` column and a reorder
  endpoint; commerce does not need to adopt reorder in this fix unless the
  owner already asks for it — out of scope here.
- NG-2: Adding a global `beforeunload` warning to `apps/web`. Noted as a
  related, transversal gap in the source issue but explicitly not bundled
  into this fix.
- NG-3: `videos` / `archivedGallery` sub-fields currently preserved verbatim
  by `CommerceListingEditor.client.tsx` (`preservedMedia`, lines 240–252).
  Nothing in the current UI writes to them; this fix must not lose them
  during migration (see §7) but does not need to build UI for them.
- NG-4: HOS-258 (splitting `CommerceListingEditor.client.tsx`, currently 931
  lines, under the 500-line cap) is a separate, already-tracked issue. This
  fix will likely shrink the file (media state/handlers move out), but a full
  split is not required here.
- NG-5: HOS-371 (visual parity of the commerce editor) is CSS/fields only and
  does not touch persistence — no overlap, but noted per the Linear issue's
  "Related" section.

## 5. Current baseline

### 5.1 Commerce editor — JSONB, save-buffered

- **Storage**: `packages/db/src/schemas/gastronomy/gastronomy.dbschema.ts:69`
  and `packages/db/src/schemas/experience/experiences.dbschema.ts:91` both
  declare `media: jsonb('media').$type<Media>()` — a single JSONB column on
  the `gastronomies` / `experiences` row itself. There is no relational media
  table for either vertical. `Media` shape (from
  `packages/schemas/src/common/media.schema.ts`) carries `featuredImage`
  (single `Image`, nullable), `gallery` (`Image[]`), and optionally `videos`
  and `archivedGallery` — the same sub-fields `CommerceListingEditor` already
  special-cases as `preservedMedia`.
- **Upload**: `MediaField.tsx` `uploadEntityImage()` posts to
  `POST /api/v1/protected/media/upload-entity` (`multipart/form-data`:
  `file`, `entityType` = `gastronomy`|`experience`, `entityId`, `role`:
  `featured`|`gallery`). The route
  (`apps/api/src/routes/media/protected/upload-entity.ts`) verifies ownership
  via the resolved entity service, enforces the gallery cap by reading
  `entityResult.data.media.gallery.length` (line ~259 — reads the JSONB
  directly, since there is no relational row to count), uploads to Cloudinary,
  and returns `{ url, publicId, ... }`. **It does not touch the DB row at
  all** — no association is written by this call, for any entity type.
- **Association**: only written by `PATCH /api/v1/protected/gastronomies/:id`
  or `/experiences/:id` when the owner submits the whole form, with `media`
  replacing the JSONB column wholesale (`buildPayload`, lines 390–396,
  `CommerceListingEditor.client.tsx`).
- **Removal**: `handleFeaturedRemove` / `handleGalleryRemove` in
  `MediaField.tsx` (lines 238–246, 303–316) update local state immediately and
  best-effort call `protectedMediaApi.deleteMedia({ publicId })` — i.e. the
  Cloudinary asset removal is fire-and-forget and unrelated to persistence
  timing; the removal from `gallery`/`featuredImage` still waits for Save.

### 5.2 Accommodation editor — relational, per-operation (target model)

- **Storage**: `accommodation_media` (`packages/db/src/schemas/accommodation/
  accommodation_media.dbschema.ts`) — one row per photo: `id` (uuid PK),
  `accommodationId` (FK, cascade delete), `url`, `caption`, `description`,
  `alt`, `publicId`, `attribution` (jsonb), `moderationState`, `state`
  (`visible`|`archived` enum), `isFeatured` (bool), `sortOrder` (int),
  `archivedAt`, plus standard `createdAt`/`updatedAt`/`deletedAt`. A partial
  unique index + CHECK (`is_featured ⇒ NOT archived`) enforcing "at most one
  featured row" live in the extras carril (T-003), not in this table
  definition. `accommodations.media` JSONB still exists but is scoped to
  `videos` only (D1 decision in the table's own doc comment) — gallery,
  featured, and archivedGallery moved out of it entirely.
- **Endpoints** (`apps/api/src/routes/accommodation/protected/`, registered in
  `protected/index.ts`):
  - `GET /api/v1/protected/accommodations/:id/media` — list (`getMedia.ts`)
  - `POST /api/v1/protected/accommodations/:id/media` — add a row
    (`addMedia.ts`; registers an already-uploaded URL, enforces
    `EDIT_ACCOMMODATION_INFO` entitlement + inline `MAX_PHOTOS_PER_ACCOMMODATION`
    plan-cap check by counting **visible rows in the table**, not a JSONB
    array length)
  - `PUT /api/v1/protected/accommodations/:id/media/:mediaId/featured` — mark
    featured (`setFeaturedMedia.ts`; unmarks the previous featured row
    server-side)
  - `DELETE /api/v1/protected/accommodations/:id/media/:mediaId` — remove a
    row (`removeMedia.ts`)
  - `PATCH /api/v1/protected/accommodations/:id/media/reorder` — reorder
    (`reorderMedia.ts`) — accommodation-only, not proposed for commerce (NG-1)
  - Route registration order matters: fixed-suffix routes (`reorder`,
    `.../featured`) are registered before the `:mediaId` param routes to avoid
    Hono resolving the literal segment as a UUID param.
- **Client component**: `PhotoSection.client.tsx` is fully self-contained.
  Every add/remove/set-featured calls the API immediately (`uploadEntityImage`
  → `accommodationMediaApi.addMedia` → optionally `setFeaturedMedia`); no
  buffering in a parent PATCH payload. On mount it hydrates from
  `accommodationMediaApi.listMedia`, using `initialFeaturedImage` /
  `initialGallery` SSR props only as a first-paint placeholder until the real
  DB-backed rows arrive (those SSR placeholders carry no DB `id` and cannot be
  operated on — `opsReady = isHydrated` gates every remove button). It renders
  a single "Portada" slot (the `isFeatured` row) plus a "Galería" grid (all
  other visible rows) — the same two-slot UX `MediaField.tsx` already
  presents, just persisted differently underneath.
- **Client API wrapper**: `apps/web/src/lib/api/endpoints-protected.ts`
  `accommodationMediaApi` (`listMedia`, `addMedia`, `removeMedia`,
  `setFeaturedMedia`, `reorderMedia`) — thin wrappers over the endpoints
  above, returning `AccommodationMediaRow[]` (`id`, `url`, `publicId?`,
  `caption?`, `description?`, `alt?`, `isFeatured`, `sortOrder`, `state`,
  `moderationState`).

### 5.3 Cloudinary orphan cleanup — does not cover this case

`apps/api/src/cron/jobs/media-orphan-cleanup.job.ts` is a weekly job, but it
only bulk-deletes the `hospeda/preview/` and `hospeda/test/` Cloudinary
prefixes (ephemeral environments) and explicitly **no-ops in production**
(`NODE_ENV === 'production'` short-circuit). There is no mechanism today that
identifies or cleans up a production Cloudinary asset that was uploaded via
`upload-entity` but never associated with any DB row/JSONB array, for any
entity type (accommodation included — accommodation just doesn't produce this
particular failure mode because association is now immediate). This means
every save-abandoned commerce upload since this feature shipped is presently
an untracked, unrecoverable-by-automation orphan.

### 5.4 Draft-visibility risk — how accommodation avoids "half-edited listing goes live"

Per-operation persistence means a photo appears in the DB the instant it's
uploaded, before the owner confirms anything else on the form. For
accommodation this is safe because listing visibility is gated independently
of the media table: `accommodations` has its own lifecycle/visibility state
(`DRAFT`/`ACTIVE`/etc., driven by `protectedPublishAccommodationRoute` /
`protectedUnpublishAccommodationRoute` — publish is a deliberate, separate
owner action), and public reads filter on that state, not on "has the owner
pressed Save on the edit form." A photo uploaded mid-edit is visible in the
owner's own editor and (if the accommodation is already `ACTIVE`) on the
public listing immediately — same as accommodation today — but it never
publishes a listing that wasn't already public.

Commerce listings (`gastronomies`/`experiences`) need the same check before
this fix ships: does `GastronomyOwnerUpdateInputSchema` /
`ExperienceOwnerUpdateInputSchema`'s owner-PATCH surface, and the underlying
row, carry an equivalent lifecycle/visibility gate independent of this form's
Save button? — **flagged as OQ-1, unresolved**; this repo did not turn up a
commerce-specific publish/visibility route during this investigation, and
`CommerceListingEditor` has no publish/unpublish action of its own. If
commerce listings are public the instant an admin creates them (no owner-side
draft state), then per-operation media writes are exactly as safe as any
other already-immediate field on this editor (name, description, etc., which
this form already PATCHes independently per dirty-group) — the "half-edited
listing goes public" risk would not be new, it would just extend to photos.
This must be confirmed with the owner before implementation, not assumed.

## 6. Proposed design

1. **New relational table**, mirroring `accommodation_media` structurally but
   polymorphic across the two commerce verticals (see §7 for the exact
   column set and the FK-vs-polymorphic decision to make).
2. **New protected endpoints**, mirroring the accommodation shape:
   `GET/POST /api/v1/protected/{gastronomies|experiences}/:id/media`,
   `PUT /api/v1/protected/{gastronomies|experiences}/:id/media/:mediaId/featured`,
   `DELETE /api/v1/protected/{gastronomies|experiences}/:id/media/:mediaId`.
   Whether these are two near-identical route trees (one per vertical, mirror
   of how gastronomy/experience already have separate PATCH routes) or a
   single polymorphic route keyed by `entityType` is an open design decision
   (OQ-2) — the accommodation precedent uses a dedicated per-entity route
   tree, which this spec defaults to for consistency, but a shared
   `commerce_media` router is worth considering given gastronomy and
   experience are otherwise handled almost identically in this editor.
3. **`MediaField.tsx` becomes self-contained**, following `PhotoSection.client.tsx`'s
   shape: hydrate on mount from the new `listMedia` endpoint, persist every
   add/remove/set-featured immediately, keep the existing "Imagen principal" +
   "Galería" two-slot UI. `onChange` to the parent is dropped entirely (no
   more buffered `media` state in `CommerceListingEditor`).
4. **`CommerceListingEditor.client.tsx` drops all `media`/`featuredImage`/
   `gallery`/`preservedMedia` state, the `'media'` dirty key, and the `media`
   branch of `buildPayload()`** — same shape as how this editor already
   excludes accommodation-style fields it doesn't own. The vertical's
   owner-update schema (`GastronomyOwnerUpdateInputSchema` /
   `ExperienceOwnerUpdateInputSchema`) should also drop `media` from its
   accepted PATCH body once nothing sends it, to avoid a dead field silently
   accepted forever (needs schema-owner confirmation, OQ-4).
5. **`upload-entity`'s gallery-cap check** (currently reads
   `entityResult.data.media.gallery.length`, upload-entity.ts line ~259) must
   be repointed at a count of visible rows in the new table for `gastronomy`/
   `experience`, mirroring how `accommodation/protected/addMedia.ts` counts
   `accommodationMediaModel.findByAccommodation({ state: 'visible' })` rather
   than trusting the JSONB length — this was already flagged in
   `upload-entity.ts` as reading the JSONB directly for lack of an
   alternative; that alternative now exists.

## 7. Data model / contracts

### 7.1 New table

Column set mirrors `accommodation_media` 1:1 (`id`, `url`, `caption`,
`description`, `alt`, `publicId`, `attribution` jsonb, `moderationState`,
`state` visible/archived enum, `isFeatured`, `sortOrder`, `archivedAt`,
`createdAt`/`updatedAt`/`deletedAt`). The only real design decision is the
FK shape:

- **Option A — one polymorphic table** `commerce_listing_media` with
  `entityType` (`'gastronomy'|'experience'`) + `entityId` (uuid, no FK
  constraint since it can't reference two tables) — mirrors the existing
  `commerce_listing_subscriptions` polymorphic pattern documented in the root
  CLAUDE.md (`entity_type` + `entity_id`, unique per listing). Loses FK
  cascade-on-delete safety; needs an app-level or trigger-level cleanup on
  hard delete.
  Note: does **not** need a `UNIQUE (entity_type, entity_id)` constraint like
  `commerce_listing_subscriptions` — a listing has *many* media rows, one
  subscription. The parallel is the polymorphic key shape, not the
  cardinality.
- **Option B — two tables** `gastronomy_media` + `experience_media`, each
  FK'd to its own table with `onDelete: 'cascade'` — mirrors
  `accommodation_media` exactly (one media table per entity type) and keeps
  cascade delete for free, at the cost of near-duplicate schema/model/route
  code for two structurally identical tables.

This spec does not pick between A and B — **flagged as OQ-3, requires an
architecture decision before implementation** (the "no autonomous
architectural decisions" rule applies directly here; this is exactly the kind
of tradeoff the global CLAUDE.md requires presenting with options, not
choosing unilaterally).

### 7.2 Existing JSONB data — migration required

Every already-seeded/live gastronomy and experience row with a non-empty
`media.featuredImage` or `media.gallery` needs those entries backfilled into
the new relational table, or the migration is a regression: existing owners'
photos would disappear from the editor (which will read from the new table
once shipped) even though the JSONB still has them. This is a **structural
schema change** (new table → `packages/db/src/migrations/`, `db:generate`)
**plus a data backfill** — per the root CLAUDE.md's three-carril rule, the
one-time backfill of existing JSONB rows into the new table is a data
conversion tied to a structural change, so it belongs in the same
`src/migrations/` carril (hand-edited `USING`/`INSERT ... SELECT` migration
file), not in `extras/` and not in `packages/seed/src/data-migrations/`
(that carril is for seed/catalog fixture data, not live production-content
backfill). `videos` and `archivedGallery` (currently preserved verbatim by
`CommerceListingEditor`'s `preservedMedia`) must be left in the JSONB column
untouched by the backfill — only `featuredImage` and `gallery` move out,
matching exactly what `accommodations.media` did (D1: videos stay in JSONB).

### 7.3 Retroactive orphan cleanup — no automated detection exists today

Per §5.3, there is no existing job that can identify a production Cloudinary
asset uploaded via `upload-entity` for `gastronomy`/`experience` that was
never written into `media.gallery`/`media.featuredImage`. Such an asset
*could* be identified after this fix ships by listing Cloudinary objects under
`hospeda/prod/gastronomies/{id}/` and `hospeda/prod/experiences/{id}/` (the
publicId already encodes entity type + id, per
`delete-entity.ts`'s `parseEntityFromPublicId`) and diffing against the
`publicId`s present in that listing's `media` JSONB (pre-migration) or new
media table (post-migration) — but building that diff-and-report tool is
additional scope this spec does not currently include. **Flagged as OQ-5**:
decide whether to (a) build a one-off audit script before/at ship time to
quantify and manually clean the backlog, (b) accept the existing orphans as
an acceptable storage-cost loss and rely on this fix preventing new ones, or
(c) scope a general orphan-detection job as follow-up work (would also cover
any future entity type, not just this bug's history).

### 7.4 New/changed API contracts

| Endpoint | Verb | Change |
|---|---|---|
| `/api/v1/protected/{gastronomies\|experiences}/:id/media` | GET | **New** — list visible rows |
| `/api/v1/protected/{gastronomies\|experiences}/:id/media` | POST | **New** — register an uploaded URL as a row (mirrors accommodation `addMedia`) |
| `/api/v1/protected/{gastronomies\|experiences}/:id/media/:mediaId/featured` | PUT | **New** — mark featured, unmark previous |
| `/api/v1/protected/{gastronomies\|experiences}/:id/media/:mediaId` | DELETE | **New** — remove a row |
| `/api/v1/protected/media/upload-entity` | POST | **Unchanged contract**, but the gallery-cap check for `gastronomy`/`experience` entityTypes must read the new table's visible-row count instead of `media.gallery.length` |
| `PATCH /api/v1/protected/{gastronomies\|experiences}/:id` | PATCH | `media` field dropped from the owner-update schema and from `buildPayload()` (OQ-4 on schema-level removal timing) |

## 8. UX / UI behavior

No visible UX change intended: `MediaField.tsx` keeps its "Imagen principal"
single slot and "Galería" grid exactly as today (this is a persistence-layer
fix, not a redesign — HOS-371 owns visual parity separately). The only
observable differences:

- An upload appears in the gallery/portada slot as soon as the API call
  resolves (already true today) and now **survives a reload without Save**
  (the fix).
- Remove now becomes an immediate, real API call with its own loading/error
  state per operation (mirroring `PhotoSection.client.tsx`'s `opLoading`),
  instead of only updating local state pending Save. This matches the
  accommodation editor's existing behavior and its error toast pattern
  (`addToast` on failure, inline error `role="alert"`) already present in
  both components.
- The general "Guardar cambios" button no longer includes photo changes in
  its dirty-count / payload — an owner who *only* adds/removes photos will
  see no pending "unsaved changes" state for that action, again matching
  accommodation.

## 9. Acceptance criteria

- AC-1: Uploading a featured or gallery photo in the commerce editor persists
  the DB association (relational row) synchronously with the upload response
  — no dependency on the form's Save button.
- AC-2: **Regression test** (the exact scenario from the linked issue):
  upload a photo in the commerce editor, do NOT click Save, reload the page →
  the photo is present in the editor (portada or gallery, as uploaded) and on
  the listing's public page if the listing is publicly visible. Automated as
  an integration/e2e test exercising upload → reload → assert-present,
  parallel to any existing accommodation `PhotoSection` regression coverage.
- AC-3: Removing a photo calls the new DELETE endpoint immediately and
  reflects removal without requiring Save.
- AC-4: Setting a new featured image immediately un-features the previous one
  server-side (mirrors accommodation's single-featured invariant) without
  requiring Save.
- AC-5: The commerce gallery cap (`getGalleryCap(vertical)`) is enforced
  against the new relational table's visible-row count, not JSONB length —
  verified by a test that fills the cap via the new table and asserts the
  next upload is rejected with `GALLERY_LIMIT_EXCEEDED`.
- AC-6: Existing gastronomy/experience listings with photos in
  `media.featuredImage`/`media.gallery` before this ships show the same
  photos, in the same featured/gallery split, after the migration — verified
  by a migration test/spot-check comparing pre- and post-migration reads for
  a seeded fixture with both a featured image and a multi-item gallery.
- AC-7: `media.videos` and `media.archivedGallery` (if present) are byte-for-byte
  unchanged in the JSONB column after the migration runs.
- AC-8: `CommerceListingEditor.client.tsx`'s PATCH payload never includes a
  `media` key after this ships (verify via a test asserting `buildPayload()`
  output / dirty-set never contains `'media'`).
- AC-9: All new endpoints enforce the same ownership model as their
  accommodation equivalents (`ownerId === actor.id`, or an admin-level
  bypass permission per vertical) — verified by a 403 test for a non-owner
  actor.
- AC-10: `pnpm typecheck`, `pnpm lint`, and the full test suite for
  `apps/web`, `apps/api`, and `packages/db` pass; `pnpm db:generate` produces
  a committed migration matching the new table (schema-drift guard green).

## 10. Risks

- R-1: **Draft-visibility gap** (§5.4) — if commerce listings have no
  independent publish/visibility gate, immediate photo persistence could make
  a photo publicly visible before the owner is ready, same as any other
  already-immediate field on this form today. Needs owner confirmation this
  is acceptable (or that a gate already exists) before implementation — see
  OQ-1.
- R-2: **Backfill correctness** — a botched migration could silently drop
  existing owners' photos (see AC-6/AC-7 as the safety net). Migration must be
  tested against a realistic seeded fixture, not just an empty DB, before
  merging.
- R-3: **Gallery cap double-enforcement gap during transition** — if the
  migration and the `upload-entity` cap-check repoint are not deployed
  atomically, there's a window where the cap check reads a stale/empty new
  table while JSONB still has photos (or vice versa), letting an owner
  temporarily exceed their plan's photo cap. Needs a single deploy that ships
  schema + migration + cap-check change together, not staggered.
- R-4: **Untracked orphan backlog** (§7.3) — every commerce upload since this
  bug shipped and was never saved is presently unrecoverable-by-automation
  Cloudinary storage cost; this fix stops new ones but does not clean
  existing ones unless OQ-5 resolves toward building the audit tool.
- R-5: **Route/schema duplication** if Option B (two separate tables/route
  trees) is chosen in OQ-3 — roughly doubles the new code surface vs. a
  polymorphic table, raising the maintenance cost of any future change to
  this feature (e.g. adding reorder later).

## 11. Open questions

- OQ-1: Do gastronomy/experience listings have an independent
  publish/visibility gate (draft vs. public) equivalent to accommodation's
  `publish`/`unpublish` routes? This investigation found no such route under
  `apps/api/src/routes/gastronomy/` or `.../experience/` (protected tier) and
  no publish action in `CommerceListingEditor.client.tsx`. If none exists,
  confirm with the owner whether immediate photo persistence pre-Save is
  acceptable (R-1) — it would not be a new behavior class for this editor,
  since other fields already PATCH independently per dirty-group, but it
  should be an explicit decision, not an assumption.
- OQ-2: Should the new endpoints be two per-vertical route trees (mirroring
  `apps/api/src/routes/gastronomy/protected/` and `.../experience/protected/`
  today, and matching accommodation's precedent) or a single polymorphic
  `commerce-media` router keyed by `entityType`? Affects route file count and
  whether `MediaField.tsx` can share one API client shape or needs
  per-vertical wrappers.
- OQ-3: Table shape — one polymorphic `commerce_listing_media` table
  (`entityType` + unconstrained `entityId`) vs. two dedicated tables
  (`gastronomy_media` + `experience_media` with real FKs), per §7.1. This is
  an architecture decision requiring explicit sign-off before implementation
  per the project's "no autonomous architectural decisions" rule.
- OQ-4: Should `media` be removed entirely from
  `GastronomyOwnerUpdateInputSchema`/`ExperienceOwnerUpdateInputSchema` (the
  PATCH validation schemas), or just stop being sent by the client while the
  schema still tolerates it for backward compatibility with any other
  caller? No other caller of these PATCH routes was found in this
  investigation, but schema ownership should confirm before a breaking
  removal.
- OQ-5: Retroactive orphan cleanup for uploads that were already made and
  never associated (§7.3) — build a one-off audit/cleanup script, accept the
  loss, or scope a general-purpose orphan-detection cron as follow-up? This
  determines whether HOS-372's scope includes a cleanup deliverable or just
  the forward-fix.
- OQ-6: Does the plan-limit check for commerce photo counts (if one exists —
  not confirmed in this investigation; `LimitKey.MAX_PHOTOS_PER_ACCOMMODATION`
  is accommodation-specific) apply to gastronomy/experience galleries at all,
  or is `getGalleryCap(vertical)` (a flat per-vertical constant, not a
  plan-tiered limit) the only cap in play? Confirm before wiring the
  `upload-entity` cap-check repoint in §6 point 5.

## 12. Implementation notes

- `PhotoSection.client.tsx` is the reference implementation for the target
  shape — mirror its hydration-then-operate pattern (`isHydrated` gating
  every mutating button so an SSR placeholder with no DB id can't trigger an
  API call), its `rowToItem`/`legacyToDisplay` mapping helpers, and its
  dual inline-error + toast error reporting (`reportUploadError`).
- `upload-entity.ts`'s `role: 'featured' | 'gallery'` publicId convention
  (`publicId = role === 'featured' ? 'featured' : 'gallery/${generateGalleryId()}'`)
  causes a Cloudinary collision risk once multiple featured-role uploads
  happen for the same entity over time — `PhotoSection.client.tsx`'s own
  header comment notes it worked around this for accommodation by uploading
  featured images with `role: 'gallery'` instead. The same workaround likely
  needs to carry over to the new `MediaField.tsx` implementation.
- `CommerceListingEditor.client.tsx` is already 931 lines (HOS-258 flags it
  over the 500-line cap); removing all `media`-related state/handlers as part
  of this fix will shrink it non-trivially, which is a welcome side effect
  but does not substitute for HOS-258's full split.
- Existing test file `apps/web/test/components/commerce/MediaField.test.tsx`
  exercises the current buffered-onChange behavior and will need rewriting
  against the new self-contained-with-API-calls behavior (parallel to however
  `PhotoSection.client.tsx`'s own test suite, if any, mocks
  `accommodationMediaApi`).

## 13. Linear

Canonical tracking:
HOS-372
