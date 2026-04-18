# SPEC-078 Gaps — Already Done Evidence

> Generated: 2026-04-18
> Scope: FASE 0 + FASE 1A merged on main
> Verifier: Explore agent (read-only verification against main branch HEAD)

## Phase 0 — Bloqueadores críticos (status: done)

- **GAP-078-001**: Register media routes in apps/api
  - Status: **done**
  - Evidence: `apps/api/src/routes/index.ts:196` (admin), `apps/api/src/routes/index.ts:245` (protected)
  - Notes: Both `/api/v1/admin/media` and `/api/v1/protected/media` mounted and routable.

- **GAP-078-003**: Add `@repo/media` dependency to apps/api
  - Status: **done**
  - Evidence: commit `f0d9d2fc`, `apps/api/package.json`
  - Notes: Package resolves, API builds.

- **GAP-078-025**: Add Cloudinary env vars to Zod env schema
  - Status: **done**
  - Evidence: commit `9ec6a723`, `apps/api/src/utils/env.ts` (ApiEnvSchema)
  - Notes: All 4 vars present: `HOSPEDA_CLOUDINARY_CLOUD_NAME`, `HOSPEDA_CLOUDINARY_API_KEY`, `HOSPEDA_CLOUDINARY_API_SECRET`, `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`.

- **GAP-078-002**: Fix mediaProvider injection in `_afterHardDelete` handlers
  - Status: **done**
  - Evidence: commit `3747b982`
  - Notes: Fixed in 5 services (accommodation, destination, event, post, user). Services now instantiated per-request with `getMediaProvider()`.

## Phase 1A — Permissions (status: done)

- **GAP-078-053 + 164** (compound): `MEDIA_UPLOAD` / `MEDIA_DELETE` + `requiredPermissions` decorators + entity-specific validation helper + mounting bug fix
  - Status: **done**
  - Evidence: commit `e40c32f3` (8 files)
  - Notes:
    - `PermissionEnum` extended with `MEDIA_UPLOAD` and `MEDIA_DELETE`
    - Upload routes declare `requiredPermissions`
    - Helper `apps/api/src/routes/media/admin/permissions.ts` validates entity-specific perms:
      - Ownership-aware for accommodation (`ACCOMMODATION_UPDATE_OWN` / `_ANY`)
      - Flat `UPDATE` for destination, event, post, user
    - `rolePermissions` seed grants both permissions to SUPER_ADMIN, ADMIN, EDITOR, HOST
    - Mounting bug fixed (upload sub-app scoped to `/upload` path)
    - 14+ test cases in `permission-gate.test.ts`

## Summary

- **Total gaps checked**: 5 (4 Phase 0 atomic + 1 Phase 1A compound)
- **Fully done**: 5
- **Partial**: 0
- **Not found**: 0
- **Blockers for downstream**: none

## Downstream use

A task-planner agent should generate tasks from `spec.md` and mark every task that maps to the gaps above as `status: completed`. Timestamps should be backdated to the commit time of the referenced commit.
