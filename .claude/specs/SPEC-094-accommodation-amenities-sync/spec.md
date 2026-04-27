# SPEC-094: Accommodation Amenities Sync Endpoint

> **Status**: draft (deferred-post-beta)
> **Priority**: P2 (post-beta cleanup)
> **Complexity**: S
> **Origin**: 2026-04-25 — BBT item 11b. Discovered while auditing the host onboarding flow before beta. The frontend mid-form selection of amenities is silently discarded by the API; the new accommodation publishes with zero amenities attached.
> **Affected packages**: packages/schemas, packages/service-core, apps/api, apps/web
> **Created**: 2026-04-27
> **Estimated effort**: ~6 hours
> **Depends on**: none (the M2M plumbing already exists)
> **Blocks**: full host onboarding parity — accommodations published from `/publicar/nueva` cannot have amenities until this lands.

---

## Problem

The host-facing property form (`apps/web/src/components/accommodation/PropertyForm.client.tsx`) lets the host pick amenities (wifi, pool, AC, etc.) and sends `amenityIds: string[]` in the PATCH body to `/api/v1/protected/accommodations/:id`.

`AccommodationUpdateSchema` (in `@repo/schemas`) does NOT include `amenityIds`, so Zod strips the field silently before it reaches the service. The accommodation is updated, the response is 200 OK, the form shows success, and the property publishes with no amenities attached.

The M2M relation works fine end-to-end:

- `accommodation_amenities` join table exists.
- `AccommodationService` has `addAmenityToAccommodation` and `removeAmenityFromAccommodation` already implemented.
- Admin panel can manage amenities via existing routes.

The gap is exclusively the lack of a public-facing endpoint that exposes those service methods to the protected (host-owned) tier.

## Why deferred to post-beta

- **Not blocking publication**: the property still goes live, just without filterable amenity tags.
- **Workaround available**: an admin can attach amenities manually from the admin panel after the host publishes.
- **Beta hosts will be a small cohort**: hand-holding amenity assignment for ~5-10 properties is cheap.
- **Search filters by amenity exist on the public side but degrade gracefully**: properties without amenities simply don't match those filters; nothing breaks.

The correct trade-off is to ship beta with this gap explicitly known and tracked, and close it during the post-beta hardening sprint with real user feedback informing UX details (e.g., do hosts expect amenity changes to persist as drafts? Should we show a confirmation toast on amenity sync? Etc.).

## Proposed Solution

New endpoint: `PUT /api/v1/protected/accommodations/{id}/amenities`

- Body: `{ amenityIds: string[] }`
- Behavior: **diff sync** — compare against the current set of amenities for the accommodation, then call `addAmenityToAccommodation` for the new entries and `removeAmenityFromAccommodation` for the removed ones. Idempotent if called twice with the same payload.
- Authz: same `PermissionEnum.ACCOMMODATION_UPDATE` check used by the rest of the protected accommodation routes; the route handler also asserts `actor.userId === accommodation.ownerId` (mirroring `protected/patch.ts`).
- Response: returns the updated amenity list (or 204 — TBD when implementing).

Frontend changes:

- `PropertyForm.client.tsx`: after the main PATCH succeeds, call the new endpoint with the selected `amenityIds` set. Errors on this call do NOT block the form save (show a non-blocking toast and let the host retry).
- Remove the dead `amenityIds` field from the body of the main PATCH so the contract is clean.

## Acceptance Criteria

- [ ] Endpoint `PUT /api/v1/protected/accommodations/{id}/amenities` exists, is auth-gated, and rejects non-owners with 403.
- [ ] Diff sync is correct: adding, removing, and keeping amenities all work in one call. Calling the endpoint with the current set is a no-op.
- [ ] Frontend `PropertyForm` wires the new call after the main PATCH; toast UX defined and accessible.
- [ ] Tests cover create-then-sync, update with adds-only, update with removes-only, update with mixed adds+removes, no-op when set unchanged, 403 for non-owner.
- [ ] No hidden coupling: the main accommodation PATCH no longer mentions `amenityIds` and Zod schema reflects that.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Race conditions if two browser tabs sync different amenity sets | Low | Low | Last-write-wins is acceptable for amenities. Optional: add `If-Match` later if a real user hits this. |
| Diff query is N+1 if implemented naively | Low | Low | Single SELECT for current set + array diff in JS, then batch insert/delete. M2M tables for amenities are small (<30 rows per accommodation). |
| Frontend partial-failure UX (main PATCH OK, amenity sync fails) | Medium | Low | Non-blocking toast on amenity error with retry CTA. Acceptable because the property is already saved. |

## Out of Scope

- Bulk-edit amenities across multiple accommodations.
- Admin-side amenity sync endpoint (admin already manages amenities via its own routes).
- Amenity creation / deletion / catalog management.
- Search-side optimizations for amenity filters (orthogonal).

## Notes

This spec stays in `draft` status and is not yet broken into tasks (`task-master:task-from-spec`). When the post-beta cleanup window opens, run that command to generate the task breakdown and pick this up.
