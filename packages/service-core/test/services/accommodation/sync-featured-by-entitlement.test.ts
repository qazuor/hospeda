/**
 * Unit Tests: syncFeaturedByEntitlementForOwner (SPEC-292 T-007 / Group A,
 * renamed SPEC-309 T-005)
 *
 * Tests the bulk featured-by-entitlement sync primitive without a live DB.
 * The function accepts an optional `db` injection param, so all tests
 * bypass `getDb()` entirely by passing a mock Drizzle client.
 *
 * Coverage (unchanged behavior, renamed from `syncFeaturedByPlan`):
 * - active:true issues UPDATE setting featuredByEntitlement=true filtered by ownerId AND deletedAt IS NULL
 * - active:false issues UPDATE setting featuredByEntitlement=false
 * - returns { updated: N, rows } = affected rows (now includes slug)
 * - empty result (owner has no non-deleted accommodations) → { updated: 0 }, no throw
 * - soft-deleted rows are excluded (the WHERE clause includes `isNull(deletedAt)`)
 * - only featuredByEntitlement + updatedAt are written (no other column in the SET object)
 *
 * The new addon-aware exclusion guard (T-005 H-1 hardening) and the new
 * `syncFeaturedByEntitlementForAccommodation` function are covered by T-022.
 * This file mocks `getOwnerAccommodationIdsWithActiveFeaturedAddon` to
 * return an empty protected set, which preserves the pre-T-005 behavior
 * (unconditional WHERE, no notInArray predicate added) for these tests.
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

const { mockReturning, mockWhere, mockSet, mockUpdate, mockGetDb, mockGetProtectedIds } =
    vi.hoisted(() => ({
        mockReturning: vi.fn(),
        mockWhere: vi.fn(),
        mockSet: vi.fn(),
        mockUpdate: vi.fn(),
        mockGetDb: vi.fn(),
        mockGetProtectedIds: vi.fn()
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

// Mock service-logger (avoids pulling in the real logger which requires @repo/logger init)
vi.mock('../../../src/utils/service-logger', () => ({
    serviceLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock the T-004 resolver module — these tests only cover the pre-existing
// (SPEC-292) bulk-write behavior, not the new addon-aware guard (T-022).
// Returning an empty protected set means no notInArray predicate is added,
// preserving the exact WHERE shape asserted below.
vi.mock('../../../src/services/accommodation/featured-entitlement.resolver.js', () => ({
    getOwnerAccommodationIdsWithActiveFeaturedAddon: mockGetProtectedIds,
    resolveOwnerPlanGrantsFeatured: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------
import { syncFeaturedByEntitlementForOwner } from '../../../src/services/accommodation/accommodation.sync-featured-by-entitlement.js';

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
});
