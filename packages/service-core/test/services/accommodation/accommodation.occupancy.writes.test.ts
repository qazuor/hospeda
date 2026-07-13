/**
 * Unit Tests: occupancy calendar WRITES (HOS-43 Phase 1).
 *
 * Tests `addOccupancy`, `batchToggleOccupancy`, and `removeOccupancy` from
 * `packages/service-core/src/services/accommodation/accommodation.occupancy.ts`.
 *
 * Mock strategy mirrors `accommodation.featured-toggle.test.ts`:
 * - `@repo/db`'s `AccommodationModel` class and the `accommodationOccupancyModel`
 *   singleton are replaced with controllable mocks (no real PG connection).
 * - `hasPermission` is NOT mocked — real `Actor` fixtures exercise the real
 *   ownership/permission-check logic.
 *
 * NOTE — the `CAN_USE_CALENDAR` billing entitlement is NOT exercised here.
 * It is enforced at the ROUTE layer (`requireEntitlement` in
 * `apps/api/src/routes/accommodation/protected/{add,batch,remove}Occupancy.ts`),
 * not in the service — see route-level tests for that coverage.
 *
 * @module test/services/accommodation/accommodation.occupancy.writes
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
    addOccupancy,
    batchToggleOccupancy,
    removeOccupancy
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

const ownerActor = createHostActor({
    id: OWNER_ID,
    permissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE]
});
const foreignHostActor = createHostActor({
    id: FOREIGN_OWNER_ID,
    permissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE]
});
const noManagePermissionOwnerActor = createHostActor({ id: OWNER_ID, permissions: [] });
const staffActor = createAdminActor({
    id: 'admin-001',
    permissions: [
        PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY
    ]
});

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
        note: null,
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
    mockBatchUpsertManual.mockResolvedValue([makeRow()]);
    mockDeleteManualByDate.mockResolvedValue(1);
    mockDeleteManualByDates.mockResolvedValue(1);
    mockFindByAccommodation.mockResolvedValue([makeRow()]);
});

// ---------------------------------------------------------------------------
// addOccupancy
// ---------------------------------------------------------------------------

describe('addOccupancy', () => {
    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                addOccupancy({
                    actor: ownerActor,
                    input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10' }
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('throws FORBIDDEN for a non-owner even with ACCOMMODATION_OCCUPANCY_MANAGE', async () => {
        await expectServiceError(
            () =>
                addOccupancy({
                    actor: foreignHostActor,
                    input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10' }
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('throws FORBIDDEN for the owner without ACCOMMODATION_OCCUPANCY_MANAGE', async () => {
        await expectServiceError(
            () =>
                addOccupancy({
                    actor: noManagePermissionOwnerActor,
                    input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10' }
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('inserts a single MANUAL row and returns it on success', async () => {
        const expectedRow = makeRow();
        mockBatchUpsertManual.mockResolvedValue([expectedRow]);

        const result = await addOccupancy({
            actor: ownerActor,
            input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10', note: 'off-platform' }
        });

        expect(mockBatchUpsertManual).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            dates: ['2026-07-10'],
            createdById: OWNER_ID,
            note: 'off-platform'
        });
        expect(result).toEqual(expectedRow);
    });

    it('is idempotent: re-adding an already-occupied date reads back the existing row instead of failing', async () => {
        mockBatchUpsertManual.mockResolvedValue([]); // conflict-skip
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10', source: 'AIRBNB' })
        ]);

        const result = await addOccupancy({
            actor: ownerActor,
            input: { accommodationId: ACCOMMODATION_ID, date: '2026-07-10' }
        });

        expect(result.source).toBe('AIRBNB');
    });
});

// ---------------------------------------------------------------------------
// batchToggleOccupancy
// ---------------------------------------------------------------------------

describe('batchToggleOccupancy', () => {
    const dates = ['2026-07-10', '2026-07-11', '2026-07-12'];

    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                batchToggleOccupancy({
                    actor: ownerActor,
                    input: { accommodationId: ACCOMMODATION_ID, dates, isBlocked: true }
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('throws FORBIDDEN for a non-owner', async () => {
        await expectServiceError(
            () =>
                batchToggleOccupancy({
                    actor: foreignHostActor,
                    input: { accommodationId: ACCOMMODATION_ID, dates, isBlocked: true }
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
    });

    it('isBlocked=true: idempotently upserts MANUAL rows for every date (idempotent batch block)', async () => {
        mockFindByAccommodation.mockResolvedValue(dates.map((date) => makeRow({ date })));

        const result = await batchToggleOccupancy({
            actor: ownerActor,
            input: { accommodationId: ACCOMMODATION_ID, dates, isBlocked: true, note: 'busy week' }
        });

        expect(mockBatchUpsertManual).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            dates,
            createdById: OWNER_ID,
            note: 'busy week'
        });
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(result).toHaveLength(3);
    });

    it('isBlocked=false: deletes only MANUAL rows for the given dates (unblock deletes only MANUAL)', async () => {
        // The model call itself is scoped to source='MANUAL' internally — this
        // asserts the SERVICE calls the MANUAL-only delete method, not a
        // generic delete-by-date, and never touches batchUpsertManual.
        mockFindByAccommodation.mockResolvedValue([]);

        const result = await batchToggleOccupancy({
            actor: ownerActor,
            input: { accommodationId: ACCOMMODATION_ID, dates, isBlocked: false }
        });

        expect(mockDeleteManualByDates).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            dates
        });
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('returns only rows matching the requested dates, excluding unrelated rows for the accommodation', async () => {
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10' }),
            makeRow({ date: '2026-09-01' }) // not in `dates`
        ]);

        const result = await batchToggleOccupancy({
            actor: ownerActor,
            input: { accommodationId: ACCOMMODATION_ID, dates, isBlocked: true }
        });

        expect(result).toHaveLength(1);
        expect(result[0]?.date).toBe('2026-07-10');
    });
});

// ---------------------------------------------------------------------------
// removeOccupancy
// ---------------------------------------------------------------------------

describe('removeOccupancy', () => {
    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                removeOccupancy({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    date: '2026-07-10'
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('throws FORBIDDEN for a non-owner', async () => {
        await expectServiceError(
            () =>
                removeOccupancy({
                    actor: foreignHostActor,
                    accommodationId: ACCOMMODATION_ID,
                    date: '2026-07-10'
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockDeleteManualByDate).not.toHaveBeenCalled();
    });

    it('deletes the MANUAL row and returns deleted:true', async () => {
        const result = await removeOccupancy({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10'
        });

        expect(mockDeleteManualByDate).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10'
        });
        expect(result).toEqual({ deleted: true });
    });

    it('returns deleted:false when no MANUAL row existed for the date (only a sync row, or none at all)', async () => {
        mockDeleteManualByDate.mockResolvedValue(0);

        const result = await removeOccupancy({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10'
        });

        expect(result).toEqual({ deleted: false });
    });

    it('allows a staff actor with ACCOMMODATION_UPDATE_ANY to remove a date on a listing they do not own', async () => {
        const result = await removeOccupancy({
            actor: staffActor,
            accommodationId: ACCOMMODATION_ID,
            date: '2026-07-10'
        });
        expect(result).toEqual({ deleted: true });
    });
});
