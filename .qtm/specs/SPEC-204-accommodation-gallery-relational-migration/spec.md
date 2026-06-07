---
spec-id: SPEC-204
title: Accommodation gallery migration to relational table
type: refactor
complexity: high
status: draft
created: 2026-06-06T00:00:00Z
depends_on: [SPEC-167]
relates_to: [SPEC-186]
priority: low
base: staging
worktree: null
---

# SPEC-204: Accommodation gallery migration to relational table

> Draft created during SPEC-167 realign (decision D-2 follow-up, owner 2026-06-06). Accommodation photos
> live embedded in the `accommodations.media` JSONB column (`gallery` + `featuredImage`). SPEC-167 adds
> `media.archivedGallery` (same JSONB) as the interim mechanism for downgrade-restricted photos. The
> owner decided the proper long-term home is a relational table — for the WHOLE gallery, not just
> archived photos.

## 1. Problem

Photos-as-JSONB cannot model per-photo state (visible/archived/pending-moderation), ordering as data,
per-photo metadata (uploader, dimensions, moderation status), or referential integrity. Every state
mechanism (like SPEC-167's `archivedGallery`) is a JSONB-shape workaround. Counting for limit
enforcement (`MAX_PHOTOS_PER_ACCOMMODATION`) re-parses JSONB on every check.

## 2. Scope sketch (to formalize before atomization)

- New `accommodation_media` table: id, accommodationId FK, kind (gallery/featured), state
  (visible/archived), sortOrder, url/asset fields, timestamps, soft-delete.
- Dual-write migration strategy: backfill from JSONB, switch reads, retire the JSONB fields
  (`media.gallery`, `media.featuredImage`, `media.archivedGallery`) behind a transition window.
- Update: Zod schemas (`@repo/schemas`), models (`@repo/db`), services, photo limit enforcement
  (`enforcePhotoLimit` counts rows instead of JSONB), SPEC-167 restrict/restore primitives
  (state flip instead of JSONB move), seed data, web/admin consumers.
- Versioned migration (structural carril) + data backfill (extras carril if triggers/constraints needed).

## 3. Trigger / timing

Post billing go-live (SPEC-193). Not on the critical path; SPEC-167's JSONB mechanism is fully
functional in the interim.
