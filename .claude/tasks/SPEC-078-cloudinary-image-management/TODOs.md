# SPEC-078: Cloudinary Image Management System

## Progress: 0/25 tasks (0%)

**Average Complexity:** 2.9/4 (max)
**Critical Path:** T-001 -> T-007 -> T-010 -> T-013 -> T-019 -> T-025 (6 steps)
**Parallel Tracks:** 4 identified

---

### Setup Phase (3 tasks)

- [ ] **T-001** (complexity: 2) - Scaffold packages/media package with tsup, ESM+CJS, and workspace registration
  - Create @repo/media package following @repo/icons template. Deps: cloudinary, image-size, nanoid
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005, T-006, T-007

- [ ] **T-008** (complexity: 2) - Register 4 Cloudinary env vars in packages/config env registry
  - Add HOSPEDA_CLOUDINARY_CLOUD_NAME, _API_KEY, _API_SECRET, HOSPEDA_MEDIA_MAX_FILE_SIZE_MB
  - Blocked by: none
  - Blocks: T-010, T-011

- [ ] **T-009** (complexity: 2) - Add upload request Zod schemas to @repo/schemas
  - AdminUploadRequestSchema, DeleteMediaQuerySchema, UploadResponseSchema
  - Blocked by: none
  - Blocks: T-010, T-011, T-012

### Core Phase (6 tasks)

- [ ] **T-002** (complexity: 1) - Implement resolveEnvironment() function with env detection logic
  - Pure function returning dev|test|preview|prod based on VERCEL_ENV and NODE_ENV
  - Blocked by: T-001
  - Blocks: T-010, T-015, T-024

- [ ] **T-003** (complexity: 1) - Define MEDIA_PRESETS constant with all 7 named transform presets
  - thumbnail, card, hero, gallery, avatar, full, og
  - Blocked by: T-001
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - Implement getMediaUrl() pure string transformation function
  - Cloudinary URL transform insertion, non-Cloudinary passthrough, fallback for nullish
  - Blocked by: T-003
  - Blocks: T-021, T-022

- [ ] **T-005** (complexity: 3) - Implement extractPublicId() function for Cloudinary URL parsing
  - Parse public ID from Cloudinary URLs, skip transforms/versions, return null for non-Cloudinary
  - Blocked by: T-001
  - Blocks: T-019, T-020

- [ ] **T-006** (complexity: 3) - Implement validateMediaFile() for file size, MIME type, and dimension validation
  - Entity vs avatar validation contexts, image-size for dimensions, spoofed MIME handling
  - Blocked by: T-001
  - Blocks: T-010, T-011

- [ ] **T-007** (complexity: 4) - Define ImageProvider interface and implement CloudinaryProvider class
  - upload (upload_stream), delete (destroy), deleteByPrefix, generateGalleryId (nanoid)
  - Blocked by: T-001
  - Blocks: T-010, T-011, T-012, T-024

### Integration Phase (14 tasks)

- [ ] **T-010** (complexity: 4) - Implement POST /api/v1/admin/media/upload endpoint
  - Admin upload with Content-Length pre-check, entity validation, file validation, Cloudinary upload
  - Blocked by: T-002, T-006, T-007, T-008, T-009
  - Blocks: T-013, T-019

- [ ] **T-011** (complexity: 3) - Implement POST /api/v1/protected/media/upload avatar endpoint
  - Avatar upload with 5MB limit, overwrite:true, user scoped
  - Blocked by: T-006, T-007, T-008, T-009
  - Blocks: T-013, T-023

- [ ] **T-012** (complexity: 2) - Implement DELETE /api/v1/admin/media endpoint
  - Delete via query param, namespace validation, idempotent
  - Blocked by: T-007, T-009
  - Blocks: T-013, T-020

- [ ] **T-013** (complexity: 3) - Initialize CloudinaryProvider in API app and mount media routes
  - Lazy singleton, graceful degradation, route mounting
  - Blocked by: T-010, T-011, T-012
  - Blocks: T-019, T-020

- [ ] **T-014** (complexity: 3) - Create or verify PATCH /api/v1/protected/users/me endpoint
  - Avatar URL persistence after upload
  - Blocked by: none
  - Blocks: T-023

- [ ] **T-015** (complexity: 3) - Implement seed image cache system
  - Read/write cache, hit/miss logic, corruption handling, atomic write
  - Blocked by: T-002
  - Blocks: T-016

- [ ] **T-016** (complexity: 4) - Implement seed image upload integration
  - Fetch URL, upload to Cloudinary, update cache, graceful degradation
  - Blocked by: T-015
  - Blocks: T-017

- [ ] **T-017** (complexity: 4) - Integrate seed upload into runners and add --clean-images CLI flag
  - Wire into existing seed flow, CLI arg parsing, cleanup flow
  - Blocked by: T-016
  - Blocks: T-025

- [ ] **T-018** (complexity: 3) - Create useMediaUpload hook for admin upload API calls
  - TanStack Query mutations for upload and delete
  - Blocked by: none
  - Blocks: T-019, T-020

- [ ] **T-019** (complexity: 4) - Wire GalleryField onUpload to admin upload API
  - Update limits, wire upload hook, progress indicator, featured image upload
  - Blocked by: T-005, T-010, T-013, T-018
  - Blocks: T-025

- [ ] **T-020** (complexity: 3) - Wire gallery image removal to delete API
  - extractPublicId for cleanup, skip non-Cloudinary URLs
  - Blocked by: T-005, T-012, T-013, T-018
  - Blocks: T-025

- [ ] **T-021** (complexity: 2) - Refactor apps/web/src/lib/media.ts to use getMediaUrl()
  - Delegate URL building to @repo/media, add preset params
  - Blocked by: T-004
  - Blocks: T-025

- [ ] **T-022** (complexity: 3) - Update admin image display to use getMediaUrl() with presets
  - Audit and update all <img> elements in admin
  - Blocked by: T-004
  - Blocks: T-025

- [ ] **T-023** (complexity: 4) - Implement web app avatar upload React island
  - AvatarUpload component on account edit page, client:idle
  - Blocked by: T-011, T-014
  - Blocks: T-025

- [ ] **T-024** (complexity: 4) - Add Cloudinary cleanup hooks to entity services
  - _beforeHardDelete/_afterHardDelete for accommodation, destination, event, post, user
  - Blocked by: T-002, T-007
  - Blocks: T-025

### Testing Phase (1 task)

- [ ] **T-025** (complexity: 2) - End-to-end verification: no direct cloudinary imports outside @repo/media
  - Codebase grep, getMediaUrl usage audit, full typecheck/lint/test run
  - Blocked by: T-017, T-019, T-020, T-021, T-022, T-023, T-024
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-008, T-009, T-014, T-018
Level 1: T-002, T-003, T-005, T-006, T-007
Level 2: T-004, T-012, T-015, T-024
Level 3: T-010, T-011, T-016, T-021, T-022
Level 4: T-013, T-017, T-023
Level 5: T-019, T-020
Level 6: T-025
```

## Parallel Tracks

1. **Package core** (T-001 -> T-002/T-003/T-005/T-006/T-007 -> T-004)
2. **Config/Schemas** (T-008, T-009) -- independent, can run in parallel with Track 1
3. **Seed system** (T-015 -> T-016 -> T-017) -- starts after T-002
4. **Admin UI** (T-018 -> T-019/T-020) -- T-018 has no deps, can start early

## Suggested Start

Begin with **T-001** (complexity: 2), **T-008** (complexity: 2), and **T-009** (complexity: 2) in parallel -- they have no dependencies and collectively unblock 18 other tasks.
