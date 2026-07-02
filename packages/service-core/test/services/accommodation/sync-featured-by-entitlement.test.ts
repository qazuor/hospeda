/**
 * Unit Tests: sync-featured-by-entitlement primitives (SPEC-292 T-007 /
 * Group A, renamed SPEC-309 T-005; addon-aware guards + accommodation-scope
 * function added T-022)
 *
 * Tests both sync primitives without a live DB. Both functions accept an
 * optional `db` injection param, so all tests bypass `getDb()` entirely by
 * passing a mock Drizzle client.
 *
 * `syncFeaturedByEntitlementForOwner` coverage (unchanged behavior, renamed
 * from `syncFeaturedByPlan`):
 * - active:true issues UPDATE setting featuredByEntitlement=true filtered by ownerId AND deletedAt IS NULL
 * - active:false issues UPDATE setting featuredByEntitlement=false
 * - returns { updated: N, rows } = affected rows (now includes slug)
 * - empty result (owner has no non-deleted accommodations) → { updated: 0 }, no throw
 * - soft-deleted rows are excluded (the WHERE clause includes `isNull(deletedAt)`)
 * - only featuredByEntitlement + updatedAt are written (no other column in the SET object)
 *
 * T-022 additions:
 * - active:false excludes owner accommodations with a live addon grant (H-1 consequence b)
 * - active:true ignores the addon-protected set (unconditional grant, regression)
 * - `syncFeaturedByEntitlementForAccommodation`: plan-still-grants no-op guard on revoke,
 *   normal writes otherwise, `.returning()` includes `slug` for both functions
 *
 * @module test/services/accommodation/sync-featured-by-entitlement
 */

import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factories.
// vi.mock() calls are hoisted to the top of the file by Vitest; any variables
// referenced inside the factory must also be hoisted via vi.hoisted().
// ---------------------------------------------------------------------------

const {
    mockReturning,
    mockWhere,
    mockSet,
    mockUpdate,
    mockGetDb,
    mockGetProtectedIds,
    mockResolveOwnerPlanGrantsFeatured,
    mockNotInArray,
    mockGetRevalidationService,
    mockScheduleRevalidationBatch
} = vi.hoisted(() => ({
    mockReturning: vi.fn(),
    mockWhere: vi.fn(),
    mockSet: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetDb: vi.fn(),
    mockGetProtectedIds: vi.fn(),
    mockResolveOwnerPlanGrantsFeatured: vi.fn(),
    mockNotInArray: vi.fn((col: unknown, ids: unknown) => ({ op: 'notInArray', col, ids })),
    mockGetRevalidationService: vi.fn(),
    mockScheduleRevalidationBatch: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db so we can intercept the Drizzle chain without a real PG connection.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    accommodations: {
        ownerId: 'owner_id',
        deletedAt: 'deleted_at',
        featuredByEntitlement: 'featured_by_entitlement',
        id: 'id',
        slug: 'slug'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: mockGetDb
}));

// notInArray is imported directly from 'drizzle-orm' (not re-exported by the
// fully-mocked '@repo/db' above), so it needs its own mock to capture the
// exact ids passed by the T-005 addon-protected exclusion guard.
vi.mock('drizzle-orm', () => ({
    notInArray: mockNotInArray
}));

// Mock service-logger (avoids pulling in the real logger which requires @repo/logger init)
vi.mock('../../../src/utils/service-logger', () => ({
    serviceLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock the T-004 resolver module. `mockGetProtectedIds` defaults to an empty
// array (see beforeEach) so the pre-existing (SPEC-292) tests keep seeing the
// unconditional WHERE shape; T-022 tests override both mocks per-case.
vi.mock('../../../src/services/accommodation/featured-entitlement.resolver.js', () => ({
    getOwnerAccommodationIdsWithActiveFeaturedAddon: mockGetProtectedIds,
    resolveOwnerPlanGrantsFeatured: mockResolveOwnerPlanGrantsFeatured
}));

// Mock the revalidation singleton (T-017/T-018/T-027, SPEC-309 G-3).
// `mockGetRevalidationService` defaults to `undefined` (see beforeEach in both
// describe blocks below) so every pre-existing test — none of which cares
// about revalidation — exercises the exact same `if (revalidationService)`
// false branch the real singleton returns when nothing has initialized it.
// T-027 tests override this per-case to return a service stub.
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: mockGetRevalidationService
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------
import {
    syncFeaturedByEntitlementForAccommodation,
    syncFeaturedByEntitlementForOwner
} from '../../../src/services/accommodation/accommodation.sync-featured-by-entitlement.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Drizzle client that simulates the UPDATE chain and returns
 * the given rows array from `.returning()`.
 *
 * Chain: db.update(table).set({...}).where({...}).returning({...}) → rows
 */
function buildMockDb(returnRows: { id: string; slug: string }[]): DrizzleClient {
    mockReturning.mockResolvedValue(returnRows);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    return { update: mockUpdate } as unknown as DrizzleClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncFeaturedByEntitlementForOwner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetProtectedIds.mockResolvedValue([]);
        mockGetRevalidationService.mockReturnValue(undefined);
    });

    describe('active: true', () => {
        it('issues UPDATE setting featuredByEntitlement=true and returns { updated: N }', async () => {
            // Arrange
            const ownerId = 'owner-001';
            const rows = [
                { id: 'acc-1', slug: 'acc-1-slug' },
                { id: 'acc-2', slug: 'acc-2-slug' },
                { id: 'acc-3', slug: 'acc-3-slug' }
            ];
            const db = buildMockDb(rows);

            // Act
            const result = await syncFeaturedByEntitlementForOwner({ ownerId, active: true, db });

            // Assert — return value
            expect(result).toEqual({ updated: 3, rows });

            // Assert — update was called with the accommodations table
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ ownerId: 'owner_id' })
            );

            // active:true never consults the addon-protected set
            expect(mockGetProtectedIds).not.toHaveBeenCalled();
        });

        it('passes featuredByEntitlement=true in the SET object', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db });

            // Assert — SET contains featuredByEntitlement:true and updatedAt (Date)
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByEntitlement', true);
            expect(setCall.updatedAt).toBeInstanceOf(Date);
        });

        it('only writes featuredByEntitlement and updatedAt — no other column', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db });

            // Assert — the SET object has exactly two keys
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setCall)).toHaveLength(2);
            expect(Object.keys(setCall)).toContain('featuredByEntitlement');
            expect(Object.keys(setCall)).toContain('updatedAt');
        });
    });

    describe('active: false', () => {
        it('issues UPDATE setting featuredByEntitlement=false and returns { updated: N }', async () => {
            // Arrange
            const db = buildMockDb([
                { id: 'acc-1', slug: 'acc-1-slug' },
                { id: 'acc-2', slug: 'acc-2-slug' }
            ]);

            // Act
            const result = await syncFeaturedByEntitlementForOwner({
                ownerId: 'owner-002',
                active: false,
                db
            });

            // Assert
            expect(result.updated).toBe(2);

            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByEntitlement', false);

            // active:false consults the addon-protected set (empty here, so no
            // notInArray predicate is added — WHERE shape is unchanged below)
            expect(mockGetProtectedIds).toHaveBeenCalledWith({ ownerId: 'owner-002' });
        });
    });

    describe('empty owner (no non-deleted accommodations)', () => {
        it('returns { updated: 0 } without throwing', async () => {
            // Arrange — DB returns empty rows (owner has no matching accommodations)
            const db = buildMockDb([]);

            // Act
            const result = await syncFeaturedByEntitlementForOwner({
                ownerId: 'ghost-owner',
                active: true,
                db
            });

            // Assert
            expect(result).toEqual({ updated: 0, rows: [] });
            // UPDATE was still issued (Drizzle's WHERE filters at the DB level)
            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });
    });

    describe('soft-deleted rows exclusion', () => {
        it('includes isNull(deletedAt) in the WHERE clause', async () => {
            // Arrange
            const db = buildMockDb([]);
            const { isNull } = await import('@repo/db');

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-soft', active: true, db });

            // Assert — isNull was called with the mock deletedAt column value
            // (accommodations.deletedAt resolves to the string 'deleted_at' in the mock)
            expect(isNull).toHaveBeenCalledWith('deleted_at');
        });

        it('includes eq(ownerId, ...) in the WHERE clause', async () => {
            // Arrange
            const db = buildMockDb([]);
            const { eq } = await import('@repo/db');

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-soft', active: true, db });

            // Assert — eq was called with the mock ownerId column ('owner_id') and the owner's id
            expect(eq).toHaveBeenCalledWith('owner_id', 'owner-soft');
        });

        it('combines both WHERE predicates with and()', async () => {
            // Arrange
            const db = buildMockDb([]);
            const { and } = await import('@repo/db');

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-soft', active: true, db });

            // Assert — and() was called (merges ownerId + deletedAt predicates)
            expect(and).toHaveBeenCalledTimes(1);
        });
    });

    describe('db injection', () => {
        it('uses the injected db instead of getDb()', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db });

            // Assert — the singleton getDb was NOT called
            expect(mockGetDb).not.toHaveBeenCalled();
            // The injected db's update method was called
            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });
    });

    describe('addon-protected exclusion on revoke (T-022 / H-1 consequence b)', () => {
        it('adds a notInArray(id, protectedIds) predicate when the owner has addon-protected accommodations', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);
            mockGetProtectedIds.mockResolvedValue(['acc-2', 'acc-3']);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-x', active: false, db });

            // Assert — the protected set was resolved and fed into notInArray
            expect(mockGetProtectedIds).toHaveBeenCalledWith({ ownerId: 'owner-x' });
            expect(mockNotInArray).toHaveBeenCalledWith('id', ['acc-2', 'acc-3']);

            // Assert — and() received 3 predicates (ownerId, deletedAt, notInArray) instead of 2
            const { and } = await import('@repo/db');
            expect(and).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ op: 'notInArray' })
            );
        });

        it('adds no notInArray predicate when the owner has no addon-protected accommodations', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);
            mockGetProtectedIds.mockResolvedValue([]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-x', active: false, db });

            // Assert — notInArray was never called, and() received exactly 2 predicates
            expect(mockNotInArray).not.toHaveBeenCalled();
            const { and } = await import('@repo/db');
            expect(and).toHaveBeenCalledWith(expect.anything(), expect.anything());
        });
    });

    describe('active:true ignores the addon-protected set (regression)', () => {
        it('does not consult or apply the addon-protected set even when it is non-empty', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);
            mockGetProtectedIds.mockResolvedValue(['acc-2']);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-x', active: true, db });

            // Assert — the grant path is unconditional, never touches the protected set
            expect(mockGetProtectedIds).not.toHaveBeenCalled();
            expect(mockNotInArray).not.toHaveBeenCalled();
        });
    });

    describe('.returning() projection', () => {
        it('includes slug alongside id', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db });

            // Assert
            expect(mockReturning).toHaveBeenCalledWith({ id: 'id', slug: 'slug' });
        });
    });

    describe('revalidation on update (T-017 / T-027, SPEC-309 G-3)', () => {
        it('schedules a revalidation batch with one event per updated accommodation when updated > 0', async () => {
            // Arrange
            mockGetRevalidationService.mockReturnValue({
                scheduleRevalidationBatch: mockScheduleRevalidationBatch
            });
            const rows = [
                { id: 'acc-1', slug: 'acc-1-slug' },
                { id: 'acc-2', slug: 'acc-2-slug' }
            ];
            const db = buildMockDb(rows);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db });

            // Assert
            expect(mockScheduleRevalidationBatch).toHaveBeenCalledTimes(1);
            const call = mockScheduleRevalidationBatch.mock.calls[0]?.[0] as {
                events: { entityType: string; slug: string }[];
                reason: string;
            };
            expect(call.events).toEqual([
                { entityType: 'accommodation', slug: 'acc-1-slug' },
                { entityType: 'accommodation', slug: 'acc-2-slug' }
            ]);
            expect(call.reason.length).toBeGreaterThan(0);
        });

        it('does NOT schedule a revalidation batch when updated === 0 (no-op)', async () => {
            // Arrange
            mockGetRevalidationService.mockReturnValue({
                scheduleRevalidationBatch: mockScheduleRevalidationBatch
            });
            const db = buildMockDb([]);

            // Act
            await syncFeaturedByEntitlementForOwner({ ownerId: 'ghost-owner', active: true, db });

            // Assert
            expect(mockScheduleRevalidationBatch).not.toHaveBeenCalled();
        });

        it('never throws when the revalidation service is unavailable (undefined)', async () => {
            // Arrange — mockGetRevalidationService already defaults to undefined (beforeEach)
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act / Assert
            await expect(
                syncFeaturedByEntitlementForOwner({ ownerId: 'owner-001', active: true, db })
            ).resolves.toEqual({ updated: 1, rows: [{ id: 'acc-1', slug: 'acc-1-slug' }] });
            expect(mockScheduleRevalidationBatch).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// syncFeaturedByEntitlementForAccommodation (T-022)
// ---------------------------------------------------------------------------

describe('syncFeaturedByEntitlementForAccommodation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
        mockGetRevalidationService.mockReturnValue(undefined);
    });

    describe('active: false (addon grant expiring)', () => {
        it('is a no-op — no DB write — when the owner plan still grants FEATURED_LISTING', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);

            // Act
            const result = await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: false,
                db
            });

            // Assert
            expect(result).toEqual({ updated: 0, rows: [] });
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('writes normally when the owner plan does NOT grant FEATURED_LISTING', async () => {
            // Arrange
            const rows = [{ id: 'acc-1', slug: 'acc-1-slug' }];
            const db = buildMockDb(rows);
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);

            // Act
            const result = await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: false,
                db
            });

            // Assert
            expect(result).toEqual({ updated: 1, rows });
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByEntitlement', false);
        });
    });

    describe('active: true (addon grant applied)', () => {
        it('always writes, without consulting the plan guard', async () => {
            // Arrange
            const rows = [{ id: 'acc-1', slug: 'acc-1-slug' }];
            const db = buildMockDb(rows);

            // Act
            const result = await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: true,
                db
            });

            // Assert
            expect(result).toEqual({ updated: 1, rows });
            expect(mockResolveOwnerPlanGrantsFeatured).not.toHaveBeenCalled();
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByEntitlement', true);
        });
    });

    describe('.returning() projection', () => {
        it('includes slug alongside id', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: true,
                db
            });

            // Assert
            expect(mockReturning).toHaveBeenCalledWith({ id: 'id', slug: 'slug' });
        });
    });

    describe('empty result (row not found / soft-deleted)', () => {
        it('returns { updated: 0 } without throwing', async () => {
            // Arrange
            const db = buildMockDb([]);

            // Act
            const result = await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'ghost-acc',
                ownerId: 'owner-1',
                active: true,
                db
            });

            // Assert
            expect(result).toEqual({ updated: 0, rows: [] });
        });
    });

    describe('revalidation on update (T-018 / T-027, SPEC-309 G-3)', () => {
        it('schedules a revalidation batch with a single event when updated > 0', async () => {
            // Arrange
            mockGetRevalidationService.mockReturnValue({
                scheduleRevalidationBatch: mockScheduleRevalidationBatch
            });
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: true,
                db
            });

            // Assert
            expect(mockScheduleRevalidationBatch).toHaveBeenCalledTimes(1);
            const call = mockScheduleRevalidationBatch.mock.calls[0]?.[0] as {
                events: { entityType: string; slug: string }[];
                reason: string;
            };
            expect(call.events).toEqual([{ entityType: 'accommodation', slug: 'acc-1-slug' }]);
            expect(call.reason.length).toBeGreaterThan(0);
        });

        it('does NOT schedule a revalidation batch when the plan-still-grants guard no-ops the write', async () => {
            // Arrange
            mockGetRevalidationService.mockReturnValue({
                scheduleRevalidationBatch: mockScheduleRevalidationBatch
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act
            await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'acc-1',
                ownerId: 'owner-1',
                active: false,
                db
            });

            // Assert
            expect(mockScheduleRevalidationBatch).not.toHaveBeenCalled();
        });

        it('does NOT schedule a revalidation batch when the row is not found (updated === 0)', async () => {
            // Arrange
            mockGetRevalidationService.mockReturnValue({
                scheduleRevalidationBatch: mockScheduleRevalidationBatch
            });
            const db = buildMockDb([]);

            // Act
            await syncFeaturedByEntitlementForAccommodation({
                accommodationId: 'ghost-acc',
                ownerId: 'owner-1',
                active: true,
                db
            });

            // Assert
            expect(mockScheduleRevalidationBatch).not.toHaveBeenCalled();
        });

        it('never throws when the revalidation service is unavailable (undefined)', async () => {
            // Arrange — mockGetRevalidationService already defaults to undefined (beforeEach)
            const db = buildMockDb([{ id: 'acc-1', slug: 'acc-1-slug' }]);

            // Act / Assert
            await expect(
                syncFeaturedByEntitlementForAccommodation({
                    accommodationId: 'acc-1',
                    ownerId: 'owner-1',
                    active: true,
                    db
                })
            ).resolves.toEqual({ updated: 1, rows: [{ id: 'acc-1', slug: 'acc-1-slug' }] });
            expect(mockScheduleRevalidationBatch).not.toHaveBeenCalled();
        });
    });
});
