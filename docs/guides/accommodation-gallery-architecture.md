# Accommodation Gallery Architecture

This guide describes the accommodation photo gallery subsystem after the SPEC-204 migration: how data is stored, which endpoints manage it, how permissions and plan caps work, and how the two UI surfaces (admin and owner) interact with the granular API.

---

## Table of Contents

- [Overview: blob to relational table](#overview-blob-to-relational-table)
- [Data Model](#data-model)
- [API Endpoints](#api-endpoints)
- [Permission, Entitlement, and Plan-Cap Model](#permission-entitlement-and-plan-cap-model)
- [UI Surfaces](#ui-surfaces)
- [Migration Carriles](#migration-carriles)
- [Reusable Table-per-Entity Media Pattern](#reusable-table-per-entity-media-pattern)
- [Known Compat Debt / Follow-up (SPEC-280)](#known-compat-debt--follow-up-spec-280)

---

## Overview: blob to relational table

Before SPEC-204, accommodation photos lived as an array of objects inside the `accommodations.media` JSONB column alongside video metadata. That blob made per-photo operations (reorder, toggle featured, archive one photo) awkward: every mutation required reading the whole blob, mutating the array in application code, and writing it back.

SPEC-204 moved photos to a dedicated relational table, `accommodation_media`. After the migration:

- **`accommodation_media`** is the sole source of truth for accommodation photos.
- **`accommodations.media`** (JSONB) now holds **video metadata only**. All photo-related keys were stripped from the blob by a post-backfill data migration.
- Photos are managed exclusively through **granular per-operation endpoints** — not through the accommodation create/update PATCH body.

---

## Data Model

### `accommodation_media` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `accommodationId` | `uuid` (FK) | References `accommodations.id`, cascade delete |
| `url` | `text` | CDN/storage URL of the photo |
| `publicId` | `text` | Cloud storage provider public ID (e.g. Cloudinary public_id) |
| `caption` | `text` (nullable) | Optional display caption |
| `alt` | `text` (nullable) | Accessibility alt text |
| `isFeatured` | `boolean` | Whether this is the cover/portada photo. At most one row per accommodation should have `isFeatured = true`. |
| `sortOrder` | `integer` | Zero-based display order within the gallery |
| `state` | `enum` | `visible` or `archived` |
| `moderationState` | `enum` | Moderation lifecycle state |
| `createdAt` | `timestamptz` | Audit field |
| `updatedAt` | `timestamptz` | Audit field |
| `createdById` | `uuid` (nullable FK) | Audit field |
| `updatedById` | `uuid` (nullable FK) | Audit field |

### `accommodations.media` JSONB (videos only)

After extras `021` runs, the blob retains only video-related fields. Photo keys (`featuredImage`, `gallery`) are removed from every row. **Do not add photo data back to this column** — all photo reads and writes go through `accommodation_media`.

---

## API Endpoints

Photos are managed through granular endpoints. There is no bulk photo management via the accommodation PATCH body.

### Admin endpoints

Base path: `/api/v1/admin/accommodations/{id}/media`

| Method | Path | Gate | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/admin/accommodations/{id}/media` | `ACCOMMODATION_VIEW_ALL` | List all media for an accommodation |
| `POST` | `/api/v1/admin/accommodations/{id}/media` | `ACCOMMODATION_UPDATE_ANY` | Add a photo |
| `DELETE` | `/api/v1/admin/accommodations/{id}/media/{mediaId}` | `ACCOMMODATION_UPDATE_ANY` | Remove a photo |
| `PATCH` | `/api/v1/admin/accommodations/{id}/media/reorder` | `ACCOMMODATION_UPDATE_ANY` | Update sort order |
| `PUT` | `/api/v1/admin/accommodations/{id}/media/{mediaId}/featured` | `ACCOMMODATION_UPDATE_ANY` | Set or unset featured photo |
| `POST` | `/api/v1/admin/accommodations/{id}/media/{mediaId}/archive` | `ACCOMMODATION_UPDATE_ANY` | Archive a photo (moderation) |
| `POST` | `/api/v1/admin/accommodations/{id}/media/{mediaId}/restore` | `ACCOMMODATION_UPDATE_ANY` | Restore an archived photo |

### Protected (owner-facing) endpoints

Base path: `/api/v1/protected/accommodations/{id}/media`

| Method | Path | Gate | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/protected/accommodations/{id}/media` | session + ownership | List photos for own accommodation |
| `POST` | `/api/v1/protected/accommodations/{id}/media` | `EDIT_ACCOMMODATION_INFO` entitlement + plan cap | Add a photo |
| `DELETE` | `/api/v1/protected/accommodations/{id}/media/{mediaId}` | `EDIT_ACCOMMODATION_INFO` entitlement | Remove a photo |
| `PATCH` | `/api/v1/protected/accommodations/{id}/media/reorder` | `EDIT_ACCOMMODATION_INFO` entitlement | Update sort order |
| `PUT` | `/api/v1/protected/accommodations/{id}/media/{mediaId}/featured` | `EDIT_ACCOMMODATION_INFO` entitlement | Set or unset featured photo |

The archive and restore operations are **admin-only** (moderation actions).

---

## Permission, Entitlement, and Plan-Cap Model

### Admin routes

Admin media routes require a valid admin session and check `ACCOMMODATION_UPDATE_ANY` (or `ACCOMMODATION_VIEW_ALL` for the GET). Permission evaluation follows the standard `PermissionEnum` check in the service's `_canUpdate` hook — roles are never checked directly.

### Protected routes

Protected media routes layer three guards in order:

1. **Authentication** — a valid user session is required.
2. **Ownership** — the service's `_canUpdate` hook checks that the actor holds either `ACCOMMODATION_UPDATE_ANY` (staff override) or `ACCOMMODATION_UPDATE_OWN` plus confirmed ownership of the accommodation.
3. **Entitlement** — `requireEntitlement(EDIT_ACCOMMODATION_INFO)` is applied via the middleware chain. Staff bypass this gate automatically (see the API CLAUDE.md invariant INV-6).

### Plan cap (add endpoint only)

The protected add endpoint (`POST /api/v1/protected/accommodations/{id}/media`) also enforces the `MAX_PHOTOS_PER_ACCOMMODATION` plan limit. The count is checked inline in the handler before inserting the new row. If the accommodation already has photos at or above the plan cap, the API returns HTTP 403 with `ServiceErrorCode.LIMIT_REACHED`.

---

## UI Surfaces

Both UIs operate on a per-operation basis: every mutation hits the API immediately and invalidates/refetches the local state. There is no bulk-save step.

### Admin: Galería sub-tab (`GalleryManager`)

The admin accommodation editor has a dedicated "Galería" sub-tab that renders a `GalleryManager` component. Key characteristics:

- **Separate portada slot** — the featured photo is displayed in its own slot above the gallery grid. Clicking "Set as portada" on a grid photo calls `PUT /{mediaId}/featured`.
- **Per-operation TanStack Query mutations** — each action (add, delete, archive, restore, set-featured) is a separate TanStack Query mutation with optimistic invalidation of the gallery query.
- **No drag-reorder UI** — the `PATCH /reorder` endpoint is implemented in the API but is not wired to a drag-and-drop interaction in the current UI. Sort order can be set on upload; reorder is deferred to a future iteration.

### Web owner: `PhotoSection`

The web accommodation owner dashboard includes a `PhotoSection` component (a React island). Key characteristics:

- **Separate portada slot** — same conceptual split as admin: one featured slot + a gallery grid.
- **Per-operation native fetch** — each mutation uses a direct `fetch()` call to the protected API. There is no client-side state library (TanStack Query is admin-only).
- **No drag-reorder UI** — same as admin: the reorder endpoint exists but has no drag-and-drop UI.
- **Plan cap feedback** — if the plan cap is reached, the add button is disabled and a message explains the limit.

---

## Migration Carriles

SPEC-204 touched both migration carriles. See [`docs/guides/migrations.md`](migrations.md) for the full two-carril explanation.

### Structural carril (`packages/db/src/migrations/`)

A Drizzle-generated migration created the `accommodation_media` table and its indexes. This migration is applied once, in order, by `pnpm db:migrate`.

### Extras carril (`packages/db/src/migrations/extras/`)

Two idempotent extras scripts handle data concerns that Drizzle cannot express:

| File | What it does |
|------|--------------|
| [`019-accommodation-media-backfill.data-migration.sql`](../../packages/db/src/migrations/extras/019-accommodation-media-backfill.data-migration.sql) | Reads existing photo data from the `accommodations.media` JSONB blob and inserts corresponding rows into `accommodation_media`. Idempotent (skips rows that already exist by public ID). |
| [`021-accommodation-media-strip-blob-photos.data-migration.sql`](../../packages/db/src/migrations/extras/021-accommodation-media-strip-blob-photos.data-migration.sql) | Removes the retired photo keys (`featuredImage`, `gallery`) from every `accommodations.media` JSONB blob. Idempotent (safe to re-run after the keys are already removed). |

These extras are re-applied by `pnpm db:apply-extras`. Always run `db:apply-extras` after `db:migrate` in both local dev and VPS deployments.

---

## Reusable Table-per-Entity Media Pattern

The `accommodation_media` table establishes a pattern that any future entity (destination, event, post, ...) can follow for its own photo gallery:

1. **Create a dedicated table** `<entity>_media` with columns: `id`, `entityId` (FK to the owning entity), `url`, `publicId`, `caption`, `alt`, `isFeatured`, `sortOrder`, `state`, `moderationState`, plus audit columns. This is the schema pattern used by `accommodation_media`.

2. **Retire any JSONB photo blob** in the parent entity. JSONB is appropriate for semi-structured, non-queryable data (like video metadata); photos need per-row operations and are better served by rows.

3. **Expose granular endpoints** — GET list, POST add, DELETE remove, PATCH reorder, PUT featured, POST archive, POST restore — following the same admin/protected split used for accommodations. Reuse the existing route factories.

4. **Guard with the entity's own permission enum** — e.g. `DESTINATION_UPDATE_ANY` / `DESTINATION_UPDATE_OWN` for destinations. The entitlement and plan-cap middleware composition is identical.

5. **Backfill via extras** if migrating from an existing blob. Write an idempotent `.data-migration.sql` extra in `packages/db/src/migrations/extras/`, applying the same "insert if not exists by public ID" guard used in `019-accommodation-media-backfill`.

6. **Strip the blob via extras** in a separate numbered extra once the backfill is confirmed complete on staging.

---

## Known Compat Debt / Follow-up (SPEC-280)

> **Important:** Read this section before modifying how accommodation responses serialize media.

The SPEC-204 migration moved the source of truth for photos to `accommodation_media`, but it did **not** change the shape of accommodation API responses. The API still **composes** a synthetic `media.featuredImage` / `media.gallery` object in every accommodation response by reading from the relational table at query time and merging the result into the JSONB-shaped response.

This was a deliberate compatibility decision. All existing read-clients — web listing cards and their transform functions, admin score-signal columns — depend on `response.media.featuredImage` and `response.media.gallery` being present. Changing the response shape without migrating those read-clients would break the web frontend silently.

The clean-up is tracked as **SPEC-280** (`accommodation-media-blob-response-cleanup`) and will:

1. Remove the composed `media.featuredImage` / `media.gallery` fields from the accommodation GET responses.
2. Migrate all read-clients (web cards/transforms, admin columns) to consume the raw `AccommodationMedia[]` list returned by the granular media endpoints.
3. Retire the photo-related fields from `MediaSchema` and `HttpMediaSchema` in `@repo/schemas`.

**Until SPEC-280 ships**, treat the composed response fields as a read-only compatibility shim. Do not add new product features that depend on `response.media.gallery`; build against the `AccommodationMedia[]` list from the granular endpoints instead.
