/**
 * Unit Tests: syncFeaturedByPlan (SPEC-292 T-007 / Group A)
 *
 * Tests the bulk featured-by-plan sync primitive without a live DB.
 * The function accepts an optional `db` injection param, so all tests
 * bypass `getDb()` entirely by passing a mock Drizzle client.
 *
 * Coverage:
 * - active:true issues UPDATE setting featuredByPlan=true filtered by ownerId AND deletedAt IS NULL
 * - active:false issues UPDATE setting featuredByPlan=false
 * - returns { updated: N } = affected rows
 * - empty result (owner has no non-deleted accommodations) → { updated: 0 }, no throw
 * - soft-deleted rows are excluded (the WHERE clause includes `isNull(deletedAt)`)
 * - only featuredByPlan + updatedAt are written (no other column in the SET object)
 *
 * @module test/services/accommodation/sync-featured-by-plan
 */

import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factories.
// vi.mock() calls are hoisted to the top of the file by Vitest; any variables
// referenced inside the factory must also be hoisted via vi.hoisted().
// ---------------------------------------------------------------------------

const { mockReturning, mockWhere, mockSet, mockUpdate, mockGetDb } = vi.hoisted(() => ({
    mockReturning: vi.fn(),
    mockWhere: vi.fn(),
    mockSet: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetDb: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db so we can intercept the Drizzle chain without a real PG connection.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    accommodations: {
        ownerId: 'owner_id',
        deletedAt: 'deleted_at',
        featuredByPlan: 'featured_by_plan',
        id: 'id'
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

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------
import { syncFeaturedByPlan } from '../../../src/services/accommodation/accommodation.sync-featured-by-plan.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Drizzle client that simulates the UPDATE chain and returns
 * the given rows array from `.returning()`.
 *
 * Chain: db.update(table).set({...}).where({...}).returning({...}) → rows
 */
function buildMockDb(returnRows: { id: string }[]): DrizzleClient {
    mockReturning.mockResolvedValue(returnRows);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    return { update: mockUpdate } as unknown as DrizzleClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncFeaturedByPlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('active: true', () => {
        it('issues UPDATE setting featuredByPlan=true and returns { updated: N }', async () => {
            // Arrange
            const ownerId = 'owner-001';
            const rows = [{ id: 'acc-1' }, { id: 'acc-2' }, { id: 'acc-3' }];
            const db = buildMockDb(rows);

            // Act
            const result = await syncFeaturedByPlan({ ownerId, active: true, db });

            // Assert — return value
            expect(result).toEqual({ updated: 3 });

            // Assert — update was called with the accommodations table
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ ownerId: 'owner_id' })
            );
        });

        it('passes featuredByPlan=true in the SET object', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1' }]);

            // Act
            await syncFeaturedByPlan({ ownerId: 'owner-001', active: true, db });

            // Assert — SET contains featuredByPlan:true and updatedAt (Date)
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByPlan', true);
            expect(setCall.updatedAt).toBeInstanceOf(Date);
        });

        it('only writes featuredByPlan and updatedAt — no other column', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1' }]);

            // Act
            await syncFeaturedByPlan({ ownerId: 'owner-001', active: true, db });

            // Assert — the SET object has exactly two keys
            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setCall)).toHaveLength(2);
            expect(Object.keys(setCall)).toContain('featuredByPlan');
            expect(Object.keys(setCall)).toContain('updatedAt');
        });
    });

    describe('active: false', () => {
        it('issues UPDATE setting featuredByPlan=false and returns { updated: N }', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1' }, { id: 'acc-2' }]);

            // Act
            const result = await syncFeaturedByPlan({ ownerId: 'owner-002', active: false, db });

            // Assert
            expect(result).toEqual({ updated: 2 });

            const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setCall).toHaveProperty('featuredByPlan', false);
        });
    });

    describe('empty owner (no non-deleted accommodations)', () => {
        it('returns { updated: 0 } without throwing', async () => {
            // Arrange — DB returns empty rows (owner has no matching accommodations)
            const db = buildMockDb([]);

            // Act
            const result = await syncFeaturedByPlan({ ownerId: 'ghost-owner', active: true, db });

            // Assert
            expect(result).toEqual({ updated: 0 });
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
            await syncFeaturedByPlan({ ownerId: 'owner-soft', active: true, db });

            // Assert — isNull was called with the mock deletedAt column value
            // (accommodations.deletedAt resolves to the string 'deleted_at' in the mock)
            expect(isNull).toHaveBeenCalledWith('deleted_at');
        });

        it('includes eq(ownerId, ...) in the WHERE clause', async () => {
            // Arrange
            const db = buildMockDb([]);
            const { eq } = await import('@repo/db');

            // Act
            await syncFeaturedByPlan({ ownerId: 'owner-soft', active: true, db });

            // Assert — eq was called with the mock ownerId column ('owner_id') and the owner's id
            expect(eq).toHaveBeenCalledWith('owner_id', 'owner-soft');
        });

        it('combines both WHERE predicates with and()', async () => {
            // Arrange
            const db = buildMockDb([]);
            const { and } = await import('@repo/db');

            // Act
            await syncFeaturedByPlan({ ownerId: 'owner-soft', active: true, db });

            // Assert — and() was called (merges ownerId + deletedAt predicates)
            expect(and).toHaveBeenCalledTimes(1);
        });
    });

    describe('db injection', () => {
        it('uses the injected db instead of getDb()', async () => {
            // Arrange
            const db = buildMockDb([{ id: 'acc-1' }]);

            // Act
            await syncFeaturedByPlan({ ownerId: 'owner-001', active: true, db });

            // Assert — the singleton getDb was NOT called
            expect(mockGetDb).not.toHaveBeenCalled();
            // The injected db's update method was called
            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });
    });
});
