/**
 * Unit Tests: occupancy calendar READS (HOS-43 Phase 1).
 *
 * Tests `getOwnerOccupancyForAccommodation`, `getAdminOccupancyForAccommodation`,
 * and `getPublicOccupancyForAccommodation` from
 * `packages/service-core/src/services/accommodation/accommodation.occupancy.ts`.
 *
 * Mock strategy mirrors `accommodation.featured-toggle.test.ts`:
 * - `@repo/db`'s `AccommodationModel` class and the `accommodationOccupancyModel`
 *   singleton are replaced with controllable mocks (no real PG connection).
 * - `hasPermission` is NOT mocked — real `Actor` fixtures exercise the real
 *   ownership/permission-check logic.
 *
 * @module test/services/accommodation/accommodation.occupancy.reads
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factories.
// ---------------------------------------------------------------------------

const {
    mockFindById,
    mockFindByAccommodationAndRange,
    mockFindByAccommodation,
    mockBatchUpsertManual,
    mockDeleteManualByDate,
    mockDeleteManualByDates
} = vi.hoisted(() => ({
    mockFindById: vi.fn(),
    mockFindByAccommodationAndRange: vi.fn(),
    mockFindByAccommodation: vi.fn(),
    mockBatchUpsertManual: vi.fn(),
    mockDeleteManualByDate: vi.fn(),
    mockDeleteManualByDates: vi.fn()
}));

vi.mock('@repo/db', () => ({
    AccommodationModel: vi.fn().mockImplementation(function () {
        return { findById: mockFindById };
    }),
    accommodationOccupancyModel: {
        findByAccommodationAndRange: mockFindByAccommodationAndRange,
        findByAccommodation: mockFindByAccommodation,
        batchUpsertManual: mockBatchUpsertManual,
        deleteManualByDate: mockDeleteManualByDate,
        deleteManualByDates: mockDeleteManualByDates
    }
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------

import {
    getAdminOccupancyForAccommodation,
    getOwnerOccupancyForAccommodation,
    getPublicOccupancyForAccommodation
} from '../../../src/services/accommodation/accommodation.occupancy.js';
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
const staffActor = createAdminActor({
    id: 'admin-001',
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
});
const viewerActor = createAdminActor({
    id: 'admin-002',
    permissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW]
});
const noPermissionAdminActor = createAdminActor({ id: 'admin-003', permissions: [] });

const ownedAccommodation = createMockAccommodation({
    id: ACCOMMODATION_ID,
    ownerId: OWNER_ID,
    deletedAt: null
});

function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'occ-1',
        accommodationId: ACCOMMODATION_ID,
        date: '2026-07-10',
        isBlocked: true,
        source: 'MANUAL',
        externalEventId: null,
        note: 'internal note',
        createdById: OWNER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

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
    mockFindByAccommodation.mockResolvedValue([makeRow()]);
    mockFindByAccommodationAndRange.mockResolvedValue([makeRow()]);
});

// ---------------------------------------------------------------------------
// getOwnerOccupancyForAccommodation
// ---------------------------------------------------------------------------

describe('getOwnerOccupancyForAccommodation', () => {
    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                getOwnerOccupancyForAccommodation({
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
                getOwnerOccupancyForAccommodation({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('throws FORBIDDEN for a non-owner without ACCOMMODATION_UPDATE_ANY', async () => {
        await expectServiceError(
            () =>
                getOwnerOccupancyForAccommodation({
                    actor: foreignHostActor,
                    accommodationId: ACCOMMODATION_ID
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockFindByAccommodation).not.toHaveBeenCalled();
    });

    it('allows a staff actor with ACCOMMODATION_UPDATE_ANY to read a listing they do not own', async () => {
        const result = await getOwnerOccupancyForAccommodation({
            actor: staffActor,
            accommodationId: ACCOMMODATION_ID
        });
        expect(result).toHaveLength(1);
    });

    it('fetches the full row set (all fields, no stripping) when no range is given', async () => {
        const result = await getOwnerOccupancyForAccommodation({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID
        });
        expect(mockFindByAccommodation).toHaveBeenCalledWith({ accommodationId: ACCOMMODATION_ID });
        expect(mockFindByAccommodationAndRange).not.toHaveBeenCalled();
        expect(result[0]).toHaveProperty('note', 'internal note');
        expect(result[0]).toHaveProperty('createdById', OWNER_ID);
    });

    it('fetches the half-open range when both from and to are given', async () => {
        await getOwnerOccupancyForAccommodation({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
        expect(mockFindByAccommodationAndRange).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
        expect(mockFindByAccommodation).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getAdminOccupancyForAccommodation
// ---------------------------------------------------------------------------

describe('getAdminOccupancyForAccommodation', () => {
    it('throws FORBIDDEN when the actor lacks ACCOMMODATION_OCCUPANCY_VIEW', async () => {
        await expectServiceError(
            () =>
                getAdminOccupancyForAccommodation({
                    actor: noPermissionAdminActor,
                    accommodationId: ACCOMMODATION_ID
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockFindById).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                getAdminOccupancyForAccommodation({
                    actor: viewerActor,
                    accommodationId: ACCOMMODATION_ID
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('returns the full row set with no ownership scoping', async () => {
        const result = await getAdminOccupancyForAccommodation({
            actor: viewerActor,
            accommodationId: ACCOMMODATION_ID
        });
        expect(result).toHaveLength(1);
    });

    it('uses the half-open range when both from and to are given', async () => {
        await getAdminOccupancyForAccommodation({
            actor: viewerActor,
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
        expect(mockFindByAccommodationAndRange).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
    });
});

// ---------------------------------------------------------------------------
// getPublicOccupancyForAccommodation
// ---------------------------------------------------------------------------

describe('getPublicOccupancyForAccommodation', () => {
    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () => getPublicOccupancyForAccommodation({ accommodationId: ACCOMMODATION_ID }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('strips note/createdById/id/accommodationId/externalEventId/timestamps from every row', async () => {
        const result = await getPublicOccupancyForAccommodation({
            accommodationId: ACCOMMODATION_ID
        });

        expect(result).toEqual([{ date: '2026-07-10', isBlocked: true, source: 'MANUAL' }]);
        expect(result[0]).not.toHaveProperty('note');
        expect(result[0]).not.toHaveProperty('createdById');
        expect(result[0]).not.toHaveProperty('id');
        expect(result[0]).not.toHaveProperty('accommodationId');
        expect(result[0]).not.toHaveProperty('externalEventId');
        expect(result[0]).not.toHaveProperty('createdAt');
        expect(result[0]).not.toHaveProperty('updatedAt');
    });

    it('filters out isBlocked:false rows defensively', async () => {
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10', isBlocked: true }),
            makeRow({ date: '2026-07-11', isBlocked: false })
        ]);

        const result = await getPublicOccupancyForAccommodation({
            accommodationId: ACCOMMODATION_ID
        });

        expect(result).toEqual([{ date: '2026-07-10', isBlocked: true, source: 'MANUAL' }]);
    });

    it('uses the half-open range when both from and to are given', async () => {
        await getPublicOccupancyForAccommodation({
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
        expect(mockFindByAccommodationAndRange).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            from: '2026-07-01',
            to: '2026-08-01'
        });
        expect(mockFindByAccommodation).not.toHaveBeenCalled();
    });
});
