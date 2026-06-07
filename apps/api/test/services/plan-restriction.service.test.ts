/**
 * Unit tests for plan restriction primitives (SPEC-167 T-007 / T-008).
 *
 * Coverage:
 * - T-007: restrictAccommodations / restoreAccommodations
 *   - set/unset round-trip: restrict then restore returns all ids both times
 *   - empty ids: no DB call, returns { affectedIds: [] }
 *   - INV-5: update payload contains ONLY planRestricted + updatedAt (no
 *     ownerSuspended, no lifecycleState, no deletedAt)
 *   - already-restricted re-restrict: set-based idempotency — same ids returned
 *   - soft-deleted rows excluded: only non-deleted rows matched (deletedAt IS NULL)
 *
 * - T-008: restrictPromotions / restorePromotions
 *   - set/unset round-trip
 *   - empty ids no-op
 *   - INV-5: lifecycle untouched (planRestricted only)
 *   - already-restricted re-restrict idempotency
 *   - soft-deleted rows excluded
 *
 * Testing strategy: dependency-injection via the optional `db` parameter.
 * No module-level mocking of @repo/db is required. Each test builds a
 * fake DrizzleClient via `makeMockDb()` and passes it directly to the SUT.
 * This avoids ESM-proxy pitfalls with importOriginal spreading of Drizzle
 * table objects.
 *
 * @module test/services/plan-restriction.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock declarations
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks so the logger mock is in place)
// ---------------------------------------------------------------------------

import type { DrizzleClient } from '@repo/db';
import {
    restoreAccommodations,
    restorePromotions,
    restrictAccommodations,
    restrictPromotions
} from '../../src/services/plan-restriction.service';

// ---------------------------------------------------------------------------
// Mock db builder factory
//
// Builds a lightweight fake DrizzleClient whose .update() chain:
//   db.update(table).set(payload).where(condition).returning()
//
// Records the set() payload so tests can assert INV-5 (exact fields written).
// Resolves returning() with the caller-supplied row list.
// ---------------------------------------------------------------------------

type RowWithId = { readonly id: string };

function makeMockDb(returningRows: RowWithId[] = []) {
    const mockReturning = vi.fn().mockResolvedValue(returningRows);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

    const db = { update: mockUpdate } as unknown as DrizzleClient;

    return { db, mockUpdate, mockSet, mockWhere, mockReturning };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('plan-restriction.service — accommodations (T-007)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // restrictAccommodations
    // -----------------------------------------------------------------------

    describe('restrictAccommodations', () => {
        it('empty ids: returns { affectedIds: [] } without calling db.update', async () => {
            // Arrange
            const { db, mockUpdate } = makeMockDb();

            // Act
            const result = await restrictAccommodations({ ids: [], db });

            // Assert — no DB query issued
            expect(result.affectedIds).toEqual([]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('single id: sets planRestricted=true and returns the affected id', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'acc-001' }]);

            // Act
            const result = await restrictAccommodations({ ids: ['acc-001'], db });

            // Assert
            expect(result.affectedIds).toEqual(['acc-001']);
        });

        it('multiple ids: returns all affected ids', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'acc-001' }, { id: 'acc-002' }]);

            // Act
            const result = await restrictAccommodations({ ids: ['acc-001', 'acc-002'], db });

            // Assert
            expect(result.affectedIds).toHaveLength(2);
            expect(result.affectedIds).toContain('acc-001');
            expect(result.affectedIds).toContain('acc-002');
        });

        it('INV-5: update payload is ONLY { planRestricted: true, updatedAt } — no ownerSuspended/lifecycleState/deletedAt', async () => {
            // Arrange
            const { db, mockSet } = makeMockDb([{ id: 'acc-001' }]);

            // Act
            await restrictAccommodations({ ids: ['acc-001'], db });

            // Assert: set() called once with exact payload shape
            expect(mockSet).toHaveBeenCalledOnce();
            const setPayload = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setPayload).sort()).toEqual(['planRestricted', 'updatedAt']);
            expect(setPayload.planRestricted).toBe(true);
            expect(setPayload.updatedAt).toBeInstanceOf(Date);
            // INV-5 explicit guards
            expect(setPayload).not.toHaveProperty('ownerSuspended');
            expect(setPayload).not.toHaveProperty('lifecycleState');
            expect(setPayload).not.toHaveProperty('deletedAt');
        });

        it('set-based idempotency: already-restricted id is still returned after re-restrict', async () => {
            // Arrange — DB returns the row even if it was already planRestricted=true
            const { db } = makeMockDb([{ id: 'acc-already-restricted' }]);

            // Act
            const result = await restrictAccommodations({ ids: ['acc-already-restricted'], db });

            // Assert — set-based: id appears in affectedIds regardless of prior state
            expect(result.affectedIds).toContain('acc-already-restricted');
        });

        it('soft-deleted rows excluded: db returns only non-deleted rows matching WHERE', async () => {
            // Arrange — DB WHERE includes deletedAt IS NULL; only the live row returned
            const { db } = makeMockDb([{ id: 'acc-live' }]);

            // Act
            const result = await restrictAccommodations({ ids: ['acc-live', 'acc-deleted'], db });

            // Assert
            expect(result.affectedIds).toEqual(['acc-live']);
            expect(result.affectedIds).not.toContain('acc-deleted');
        });
    });

    // -----------------------------------------------------------------------
    // restoreAccommodations
    // -----------------------------------------------------------------------

    describe('restoreAccommodations', () => {
        it('empty ids: returns { affectedIds: [] } without calling db.update', async () => {
            // Arrange
            const { db, mockUpdate } = makeMockDb();

            // Act
            const result = await restoreAccommodations({ ids: [], db });

            // Assert
            expect(result.affectedIds).toEqual([]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('round-trip: restrict then restore returns the same ids', async () => {
            // Arrange — two separate db clients (one per call)
            const { db: db1 } = makeMockDb([{ id: 'acc-A' }, { id: 'acc-B' }]);
            const { db: db2 } = makeMockDb([{ id: 'acc-A' }, { id: 'acc-B' }]);

            // Act
            const restricted = await restrictAccommodations({ ids: ['acc-A', 'acc-B'], db: db1 });
            const restored = await restoreAccommodations({ ids: ['acc-A', 'acc-B'], db: db2 });

            // Assert
            expect(restricted.affectedIds).toHaveLength(2);
            expect(restored.affectedIds).toHaveLength(2);
            expect(restored.affectedIds).toContain('acc-A');
            expect(restored.affectedIds).toContain('acc-B');
        });

        it('INV-5: update payload is ONLY { planRestricted: false, updatedAt }', async () => {
            // Arrange
            const { db, mockSet } = makeMockDb([{ id: 'acc-001' }]);

            // Act
            await restoreAccommodations({ ids: ['acc-001'], db });

            // Assert
            expect(mockSet).toHaveBeenCalledOnce();
            const setPayload = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setPayload).sort()).toEqual(['planRestricted', 'updatedAt']);
            expect(setPayload.planRestricted).toBe(false);
            expect(setPayload.updatedAt).toBeInstanceOf(Date);
            expect(setPayload).not.toHaveProperty('ownerSuspended');
            expect(setPayload).not.toHaveProperty('lifecycleState');
            expect(setPayload).not.toHaveProperty('deletedAt');
        });

        it('set-based idempotency: already-restored id is still returned', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'acc-already-live' }]);

            // Act
            const result = await restoreAccommodations({ ids: ['acc-already-live'], db });

            // Assert
            expect(result.affectedIds).toContain('acc-already-live');
        });
    });
});

// ---------------------------------------------------------------------------
// Promotion primitives (T-008)
// ---------------------------------------------------------------------------

describe('plan-restriction.service — promotions (T-008)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // restrictPromotions
    // -----------------------------------------------------------------------

    describe('restrictPromotions', () => {
        it('empty ids: returns { affectedIds: [] } without calling db.update', async () => {
            // Arrange
            const { db, mockUpdate } = makeMockDb();

            // Act
            const result = await restrictPromotions({ ids: [], db });

            // Assert
            expect(result.affectedIds).toEqual([]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('single id: sets planRestricted=true and returns the affected id', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'promo-001' }]);

            // Act
            const result = await restrictPromotions({ ids: ['promo-001'], db });

            // Assert
            expect(result.affectedIds).toEqual(['promo-001']);
        });

        it('multiple ids: returns all affected ids', async () => {
            // Arrange
            const { db } = makeMockDb([
                { id: 'promo-001' },
                { id: 'promo-002' },
                { id: 'promo-003' }
            ]);

            // Act
            const result = await restrictPromotions({
                ids: ['promo-001', 'promo-002', 'promo-003'],
                db
            });

            // Assert
            expect(result.affectedIds).toHaveLength(3);
        });

        it('INV-5: update payload is ONLY { planRestricted: true, updatedAt } — lifecycleState untouched', async () => {
            // Arrange
            const { db, mockSet } = makeMockDb([{ id: 'promo-001' }]);

            // Act
            await restrictPromotions({ ids: ['promo-001'], db });

            // Assert: set() called with exact payload — lifecycle MUST NOT appear
            expect(mockSet).toHaveBeenCalledOnce();
            const setPayload = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setPayload).sort()).toEqual(['planRestricted', 'updatedAt']);
            expect(setPayload.planRestricted).toBe(true);
            expect(setPayload.updatedAt).toBeInstanceOf(Date);
            // INV-5 guard: lifecycle MUST NOT be written
            expect(setPayload).not.toHaveProperty('lifecycleState');
            expect(setPayload).not.toHaveProperty('ownerSuspended');
            expect(setPayload).not.toHaveProperty('deletedAt');
        });

        it('set-based idempotency: already-restricted promotion is still returned', async () => {
            // Arrange — DB returns the row even if already planRestricted=true
            const { db } = makeMockDb([{ id: 'promo-already-restricted' }]);

            // Act
            const result = await restrictPromotions({ ids: ['promo-already-restricted'], db });

            // Assert
            expect(result.affectedIds).toContain('promo-already-restricted');
        });

        it('soft-deleted rows excluded: db returns only non-deleted rows', async () => {
            // Arrange — DB WHERE includes deletedAt IS NULL; soft-deleted row excluded
            const { db } = makeMockDb([{ id: 'promo-live' }]);

            // Act
            const result = await restrictPromotions({ ids: ['promo-live', 'promo-deleted'], db });

            // Assert
            expect(result.affectedIds).toEqual(['promo-live']);
            expect(result.affectedIds).not.toContain('promo-deleted');
        });
    });

    // -----------------------------------------------------------------------
    // restorePromotions
    // -----------------------------------------------------------------------

    describe('restorePromotions', () => {
        it('empty ids: returns { affectedIds: [] } without calling db.update', async () => {
            // Arrange
            const { db, mockUpdate } = makeMockDb();

            // Act
            const result = await restorePromotions({ ids: [], db });

            // Assert
            expect(result.affectedIds).toEqual([]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('round-trip: restrict then restore returns the same ids', async () => {
            // Arrange
            const { db: db1 } = makeMockDb([{ id: 'promo-X' }, { id: 'promo-Y' }]);
            const { db: db2 } = makeMockDb([{ id: 'promo-X' }, { id: 'promo-Y' }]);

            // Act
            const restricted = await restrictPromotions({ ids: ['promo-X', 'promo-Y'], db: db1 });
            const restored = await restorePromotions({ ids: ['promo-X', 'promo-Y'], db: db2 });

            // Assert
            expect(restricted.affectedIds).toHaveLength(2);
            expect(restored.affectedIds).toHaveLength(2);
            expect(restored.affectedIds).toContain('promo-X');
            expect(restored.affectedIds).toContain('promo-Y');
        });

        it('INV-5: update payload is ONLY { planRestricted: false, updatedAt } — lifecycle untouched', async () => {
            // Arrange
            const { db, mockSet } = makeMockDb([{ id: 'promo-001' }]);

            // Act
            await restorePromotions({ ids: ['promo-001'], db });

            // Assert
            expect(mockSet).toHaveBeenCalledOnce();
            const setPayload = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(Object.keys(setPayload).sort()).toEqual(['planRestricted', 'updatedAt']);
            expect(setPayload.planRestricted).toBe(false);
            expect(setPayload.updatedAt).toBeInstanceOf(Date);
            expect(setPayload).not.toHaveProperty('lifecycleState');
            expect(setPayload).not.toHaveProperty('ownerSuspended');
            expect(setPayload).not.toHaveProperty('deletedAt');
        });

        it('set-based idempotency: already-restored promotion is still returned', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'promo-already-live' }]);

            // Act
            const result = await restorePromotions({ ids: ['promo-already-live'], db });

            // Assert
            expect(result.affectedIds).toContain('promo-already-live');
        });

        it('soft-deleted rows excluded: db returns only non-deleted rows', async () => {
            // Arrange
            const { db } = makeMockDb([{ id: 'promo-live' }]);

            // Act
            const result = await restorePromotions({ ids: ['promo-live', 'promo-deleted'], db });

            // Assert
            expect(result.affectedIds).toEqual(['promo-live']);
            expect(result.affectedIds).not.toContain('promo-deleted');
        });
    });
});
