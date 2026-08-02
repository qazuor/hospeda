---
title: Admin media uploads must hit Cloudinary
linear: HOS-338
statusSource: linear
created: 2026-07-27
type: fix
areas:
  - admin
  - api
---

# Admin media uploads must hit Cloudinary

## 1. Summary

Fix admin entity editors so featured-image and gallery uploads actually call the admin media upload API and persist Cloudinary-backed URLs instead of browser-local `blob:` URLs.

## 2. Problem

Event media uploads were appearing persisted in entity data while no asset existed in Cloudinary. After reload, neither the admin panel nor the public web could render those images because the persisted URLs were local object URLs created in the browser session.

## 3. Goals

- G-1: Event editors upload featured and gallery images through `/api/v1/admin/media/upload`.
- G-2: Apply the same fix to any other admin entity editor with the same wiring bug.
- G-3: Add regression coverage for both edit and create-adjacent media behavior.

## 4. Non-goals

- NG-1: Redesign the admin media UX.
- NG-2: Change Cloudinary provider behavior or storage layout.
- NG-3: Implement pre-create temporary uploads for entities that still lack an `entityId`.

## 5. Current baseline

Admin media fields are configured under real field ids like `media.featuredImage` and `media.gallery`, but some edit routes register upload handlers under a stale `images` key. `EntityFormSection` forwards upload handlers to `GalleryField` only, not `ImageField`, and several create-mode forms expose upload-backed image fields before an entity id exists. Both `ImageField` and `GalleryField` fall back to `URL.createObjectURL()` when no upload handler is present.

## 6. Proposed design

Make media handler wiring field-id driven and reusable across edit surfaces. Ensure both `IMAGE` and `GALLERY` fields can receive upload handlers, expand the admin media upload path to every entity type already modeled in the upload schema, and remove create-mode image/gallery fields that cannot upload correctly before the entity exists.

## 7. Data model / contracts

No DB migration. No API response contract change expected. The existing admin media upload endpoint remains the upload path and continues returning Cloudinary asset metadata.

## 8. UX / UI behavior

- Editing affected entities should upload featured images, galleries, and supported logos immediately to Cloudinary.
- Create screens must no longer offer upload-backed image fields before an entity exists.

## 9. Acceptance criteria

- AC-1: Event edit media fields no longer persist `blob:` URLs.
- AC-2: Any other admin entity editor with the same stale wiring pattern is fixed in the same change.
- AC-3: Featured-image fields can use the same upload plumbing as galleries.
- AC-4: Regression tests fail if media fields silently bypass the upload handler again.

## 10. Risks

- R-1: Broadening media handler plumbing could accidentally affect unrelated fields if keyed incorrectly.
- R-2: Some entity editors may rely on create-mode image inputs that now have to happen after creation.

## 11. Open questions

- OQ-1: None at the moment.

## 12. Implementation notes

Initial investigation confirmed the API upload endpoint was not the failure point; the bypass happened in admin before the API was called.

## 13. Linear

Canonical tracking:
HOS-338
