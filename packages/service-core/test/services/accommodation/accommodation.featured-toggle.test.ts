/**
 * Unit Tests: owner self-service featured toggle (SPEC-309 T-019/T-020, task T-028)
 *
 * Tests `setAccommodationFeaturedToggle` and `getAccommodationFeaturedEntitlement`
 * from `packages/service-core/src/services/accommodation/accommodation.featured-toggle.ts`.
 *
 * Test placement note: the API routes in
 * `apps/api/src/routes/accommodation/protected/featured-toggle.ts` have NO
 * declarative `ownership:` config and delegate 100% of the ownership +
 * entitlement gating to these two service functions (see that route file's own
 * header comment). There is zero route-level logic to test in isolation, and
 * the resolver module these functions depend on
 * (`./featured-entitlement.resolver.js`) is imported via a RELATIVE path from
 * within `packages/service-core` — that import can only be intercepted by a
 * test living in this same package (Vitest cannot mock a relative import
 * across a package boundary from an `apps/api` test file). So the 4 required
 * gating scenarios (task acceptance criteria) live here, directly against the
 * service functions, mirroring the established convention in
 * `sync-featured-by-entitlement.test.ts` (T-021/T-022/T-027) and
 * `featured-entitlement.resolver.test.ts` (T-021). A separate THIN route
 * smoke test (registration + guest 401, no gating assertions) lives in
 * `apps/api/test/routes/accommodation/protected/featured-toggle.test.ts`.
 *
 * Mock strategy:
 * - `@repo/db`'s `AccommodationModel` class is replaced with a mock whose
 *   `findById`/`update` methods are controlled per test (same technique as
 *   `apps/api/test/routes/accommodation-external-reputation/protected.test.ts`).
 * - The resolver module is mocked at its own relative path (not the
 *   `@repo/service-core` barrel) — mocking the barrel does NOT intercept this
 *   relative import (documented gotcha from T-026/T-027).
 * - `hasPermission` is NOT mocked — it is a pure function over `actor.permissions`,
 *   so real `Actor` fixtures from `createHostActor`/`createAdminActor` exercise
 *   the real ownership-check logic.
 *
 * @module test/services/accommodation/accommodation.featured-toggle
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factories.
// ---------------------------------------------------------------------------

const {
    mockFindById,
    mockUpdate,
    mockResolveOwnerPlanGrantsFeatured,
    mockResolveAccommodationHasActiveFeaturedAddon
} = vi.hoisted(() => ({
    mockFindById: vi.fn(),
    mockUpdate: vi.fn(),
    mockResolveOwnerPlanGrantsFeatured: vi.fn(),
    mockResolveAccommodationHasActiveFeaturedAddon: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db so the service's `new AccommodationModel()` resolves to a
// controllable stub without touching a real PG connection.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    AccommodationModel: vi.fn().mockImplementation(function () {
        return {
            findById: mockFindById,
            update: mockUpdate
        };
    })
}));

// Mock the T-004/T-021 resolver module at its own relative path — this is a
// same-package relative import (`./featured-entitlement.resolver.js`), NOT
// re-exported by `@repo/service-core`'s public surface in a way that would
// let an outside consumer intercept it; mocking it here (from inside
// `packages/service-core`) is the only place this interception can happen.
vi.mock('../../../src/services/accommodation/featured-entitlement.resolver.js', () => ({
    resolveOwnerPlanGrantsFeatured: mockResolveOwnerPlanGrantsFeatured,
    resolveAccommodationHasActiveFeaturedAddon: mockResolveAccommodationHasActiveFeaturedAddon
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------

import {
    getAccommodationFeaturedEntitlement,
    setAccommodationFeaturedToggle
} from '../../../src/services/accommodation/accommodation.featured-toggle.js';
import { ServiceError } from '../../../src/types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createAdminActor, createHostActor } from '../../factories/actorFactory';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = 'owner-001';
const FOREIGN_OWNER_ID = 'owner-002';
const ACCOMMODATION_ID = 'acc-001';

const ownerActor = createHostActor({ id: OWNER_ID });
const foreignHostActor = createHostActor({ id: FOREIGN_OWNER_ID });
const adminAnyActor = createAdminActor({
    id: 'admin-001',
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
});

const ownedAccommodation = createMockAccommodation({
    id: ACCOMMODATION_ID,
    ownerId: OWNER_ID,
    isFeatured: false,
    // The service's NOT_FOUND guard checks `deletedAt !== null` — the factory
    // default leaves this `undefined`, which would incorrectly trip that
    // guard, so it must be explicit here.
    deletedAt: null
});

/** Asserts a thrown ServiceError carries the expected code (single invocation). */
async function expectServiceError(
    fn: () => Promise<unknown>,
    code: ServiceErrorCode
): Promise<void> {
    let thrown: unknown;
    try {
        await fn();
    } catch (err) {
        thrown = err;
    }
    expect(thrown).toBeInstanceOf(ServiceError);
    expect((thrown as ServiceError).code).toBe(code);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue(ownedAccommodation);
    mockUpdate.mockResolvedValue({ ...ownedAccommodation, isFeatured: true });
});

// ---------------------------------------------------------------------------
// setAccommodationFeaturedToggle (PATCH gate)
// ---------------------------------------------------------------------------

describe('setAccommodationFeaturedToggle', () => {
    describe('NOT_FOUND', () => {
        it('throws NOT_FOUND when the accommodation does not exist', async () => {
            mockFindById.mockResolvedValue(null);

            await expectServiceError(
                () =>
                    setAccommodationFeaturedToggle({
                        actor: ownerActor,
                        accommodationId: ACCOMMODATION_ID,
                        isFeatured: true
                    }),
                ServiceErrorCode.NOT_FOUND
            );
        });

        it('throws NOT_FOUND when the accommodation is soft-deleted', async () => {
            mockFindById.mockResolvedValue({ ...ownedAccommodation, deletedAt: new Date() });

            await expectServiceError(
                () =>
                    setAccommodationFeaturedToggle({
                        actor: ownerActor,
                        accommodationId: ACCOMMODATION_ID,
                        isFeatured: true
                    }),
                ServiceErrorCode.NOT_FOUND
            );
        });
    });

    describe('ownership gate (task scenario 4)', () => {
        it('throws FORBIDDEN for a different owner even when both entitlement resolvers are true', async () => {
            // Arrange — a foreign HOST (no ACCOMMODATION_UPDATE_ANY) with BOTH
            // entitlement sources granting the entitlement. If the ownership
            // check were skipped or ordered after the entitlement check, this
            // would incorrectly succeed.
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(true);

            await expectServiceError(
                () =>
                    setAccommodationFeaturedToggle({
                        actor: foreignHostActor,
                        accommodationId: ACCOMMODATION_ID,
                        isFeatured: true
                    }),
                ServiceErrorCode.FORBIDDEN
            );

            // The entitlement resolvers are never even consulted for a
            // foreign owner — the ownership check short-circuits first.
            expect(mockResolveOwnerPlanGrantsFeatured).not.toHaveBeenCalled();
            expect(mockResolveAccommodationHasActiveFeaturedAddon).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('allows an actor with ACCOMMODATION_UPDATE_ANY to toggle a listing they do not own', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            const result = await setAccommodationFeaturedToggle({
                actor: adminAnyActor,
                accommodationId: ACCOMMODATION_ID,
                isFeatured: true
            });

            expect(result).toEqual({ isFeatured: true });
            expect(mockUpdate).toHaveBeenCalledWith(
                { id: ACCOMMODATION_ID },
                { isFeatured: true, updatedById: adminAnyActor.id }
            );
        });
    });

    describe('entitlement gate', () => {
        it('throws FORBIDDEN when neither plan nor addon grants FEATURED_LISTING (task scenario 1)', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            await expectServiceError(
                () =>
                    setAccommodationFeaturedToggle({
                        actor: ownerActor,
                        accommodationId: ACCOMMODATION_ID,
                        isFeatured: true
                    }),
                ServiceErrorCode.FORBIDDEN
            );

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('succeeds when the owner plan grants FEATURED_LISTING (task scenario 2)', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            const result = await setAccommodationFeaturedToggle({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID,
                isFeatured: true
            });

            expect(result).toEqual({ isFeatured: true });
            expect(mockResolveOwnerPlanGrantsFeatured).toHaveBeenCalledWith({ ownerId: OWNER_ID });
            expect(mockResolveAccommodationHasActiveFeaturedAddon).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID
            });
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate).toHaveBeenCalledWith(
                { id: ACCOMMODATION_ID },
                { isFeatured: true, updatedById: OWNER_ID }
            );
        });

        it('succeeds when only an accommodation-scoped addon grants FEATURED_LISTING (task scenario 3)', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(true);

            const result = await setAccommodationFeaturedToggle({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID,
                isFeatured: false
            });

            expect(result).toEqual({ isFeatured: false });
            expect(mockUpdate).toHaveBeenCalledWith(
                { id: ACCOMMODATION_ID },
                { isFeatured: false, updatedById: OWNER_ID }
            );
        });

        it('checks both resolvers concurrently (Promise.all) for a single accommodation', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(true);

            await setAccommodationFeaturedToggle({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID,
                isFeatured: true
            });

            expect(mockResolveOwnerPlanGrantsFeatured).toHaveBeenCalledTimes(1);
            expect(mockResolveAccommodationHasActiveFeaturedAddon).toHaveBeenCalledTimes(1);
        });
    });
});

// ---------------------------------------------------------------------------
// getAccommodationFeaturedEntitlement (GET counterpart — no entitlement gate on read)
// ---------------------------------------------------------------------------

describe('getAccommodationFeaturedEntitlement', () => {
    describe('NOT_FOUND', () => {
        it('throws NOT_FOUND when the accommodation does not exist', async () => {
            mockFindById.mockResolvedValue(null);

            await expectServiceError(
                () =>
                    getAccommodationFeaturedEntitlement({
                        actor: ownerActor,
                        accommodationId: ACCOMMODATION_ID
                    }),
                ServiceErrorCode.NOT_FOUND
            );
        });

        it('throws NOT_FOUND when the accommodation is soft-deleted', async () => {
            mockFindById.mockResolvedValue({ ...ownedAccommodation, deletedAt: new Date() });

            await expectServiceError(
                () =>
                    getAccommodationFeaturedEntitlement({
                        actor: ownerActor,
                        accommodationId: ACCOMMODATION_ID
                    }),
                ServiceErrorCode.NOT_FOUND
            );
        });
    });

    describe('ownership gate', () => {
        it('throws FORBIDDEN for a different owner regardless of entitlement state', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(true);

            await expectServiceError(
                () =>
                    getAccommodationFeaturedEntitlement({
                        actor: foreignHostActor,
                        accommodationId: ACCOMMODATION_ID
                    }),
                ServiceErrorCode.FORBIDDEN
            );

            expect(mockResolveOwnerPlanGrantsFeatured).not.toHaveBeenCalled();
            expect(mockResolveAccommodationHasActiveFeaturedAddon).not.toHaveBeenCalled();
        });
    });

    describe('read succeeds regardless of entitlement (no write gate on GET)', () => {
        it('returns hasEntitlement: true when only the plan grants it', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            const result = await getAccommodationFeaturedEntitlement({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID
            });

            expect(result).toEqual({ isFeatured: false, hasEntitlement: true });
        });

        it('returns hasEntitlement: true when only the addon grants it', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(true);

            const result = await getAccommodationFeaturedEntitlement({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID
            });

            expect(result).toEqual({ isFeatured: false, hasEntitlement: true });
        });

        it('returns hasEntitlement: false when neither plan nor addon grants it', async () => {
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            const result = await getAccommodationFeaturedEntitlement({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID
            });

            expect(result).toEqual({ isFeatured: false, hasEntitlement: false });

            // Unlike setAccommodationFeaturedToggle, the read path never writes.
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('reflects the current isFeatured column value verbatim', async () => {
            mockFindById.mockResolvedValue({ ...ownedAccommodation, isFeatured: true });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockResolveAccommodationHasActiveFeaturedAddon.mockResolvedValue(false);

            const result = await getAccommodationFeaturedEntitlement({
                actor: ownerActor,
                accommodationId: ACCOMMODATION_ID
            });

            expect(result.isFeatured).toBe(true);
        });
    });
});
