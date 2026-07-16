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
    },
    // `updateOccupancyEvent` wraps its delete + upsert in `withServiceTransaction`,
    // which calls `withTransaction` from `@repo/db` internally. The stub `tx`
    // object only needs an `.execute()` no-op (for the SET LOCAL statement_timeout
    // pragma) — the mocked model methods above don't care what `tx` value they
    // receive since they're fully replaced, not real Drizzle calls.
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ execute: vi.fn() })
    )
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------

import {
    addOccupancy,
    batchToggleOccupancy,
    removeOccupancy,
    updateOccupancyEvent
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
// updateOccupancyEvent
// ---------------------------------------------------------------------------

describe('updateOccupancyEvent', () => {
    it('throws NOT_FOUND when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-10',
                    oldEndDate: '2026-07-12',
                    newStartDate: '2026-07-11',
                    newEndDate: '2026-07-13'
                }),
            ServiceErrorCode.NOT_FOUND
        );
    });

    it('throws FORBIDDEN for a non-owner even with ACCOMMODATION_OCCUPANCY_MANAGE', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: foreignHostActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-10',
                    oldEndDate: '2026-07-12',
                    newStartDate: '2026-07-11',
                    newEndDate: '2026-07-13'
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('throws FORBIDDEN for the owner without ACCOMMODATION_OCCUPANCY_MANAGE', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: noManagePermissionOwnerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-10',
                    oldEndDate: '2026-07-12',
                    newStartDate: '2026-07-11',
                    newEndDate: '2026-07-13'
                }),
            ServiceErrorCode.FORBIDDEN
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('happy path: deletes the MANUAL rows across the old range and upserts across the new range with the new note, in one go', async () => {
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-11', note: 'moved event' }),
            makeRow({ date: '2026-07-12', note: 'moved event' }),
            makeRow({ date: '2026-07-13', note: 'moved event' })
        ]);

        const result = await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-12',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-13',
            note: 'moved event'
        });

        expect(mockDeleteManualByDates).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                // Union of old (07-10..07-12) and new (07-11..07-13) ranges,
                // deduped — the new range is authoritative (see Fix 2 doc).
                dates: ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13']
            },
            { execute: expect.any(Function) }
        );
        expect(mockBatchUpsertManual).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-11', '2026-07-12', '2026-07-13'],
                createdById: OWNER_ID,
                note: 'moved event'
            },
            { execute: expect.any(Function) }
        );
        // The delete must happen BEFORE the upsert (atomic move, not the reverse).
        expect(mockDeleteManualByDates.mock.invocationCallOrder[0]).toBeLessThan(
            mockBatchUpsertManual.mock.invocationCallOrder[0] as number
        );
        expect(result).toHaveLength(3);
    });

    it('leaves sync-sourced rows on affected dates completely untouched (only source=MANUAL is ever deleted/upserted)', async () => {
        // A GOOGLE_CALENDAR row sits on 2026-07-10 (within the old range) and
        // survives the operation — the model-level delete/upsert calls are
        // already scoped to source=MANUAL (asserted at the model layer); this
        // asserts the SERVICE never calls anything else that could touch it,
        // and that the post-op read-back still returns it untouched.
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10', source: 'GOOGLE_CALENDAR', createdById: 'system' }),
            makeRow({ date: '2026-07-11', note: 'edited' })
        ]);

        const result = await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-10',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-11',
            note: 'edited'
        });

        expect(mockDeleteManualByDates).toHaveBeenCalledWith(
            // Union of old (07-10) and new (07-11) — both single-day ranges.
            { accommodationId: ACCOMMODATION_ID, dates: ['2026-07-10', '2026-07-11'] },
            { execute: expect.any(Function) }
        );
        const syncRow = result.find((row) => row.date === '2026-07-10');
        expect(syncRow?.source).toBe('GOOGLE_CALENDAR');
    });

    it('text-only edit: keeps the same range (old === new) and only changes the note', async () => {
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10', note: 'updated text' }),
            makeRow({ date: '2026-07-11', note: 'updated text' })
        ]);

        await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-11',
            newStartDate: '2026-07-10',
            newEndDate: '2026-07-11',
            note: 'updated text'
        });

        expect(mockDeleteManualByDates).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, dates: ['2026-07-10', '2026-07-11'] },
            { execute: expect.any(Function) }
        );
        expect(mockBatchUpsertManual).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10', '2026-07-11'],
                createdById: OWNER_ID,
                note: 'updated text'
            },
            { execute: expect.any(Function) }
        );
    });

    it('a single-day event (start === end) expands to exactly one date in each range', async () => {
        mockFindByAccommodation.mockResolvedValue([makeRow({ date: '2026-07-15' })]);

        await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-14',
            oldEndDate: '2026-07-14',
            newStartDate: '2026-07-15',
            newEndDate: '2026-07-15'
        });

        expect(mockDeleteManualByDates).toHaveBeenCalledWith(
            // Union of old (07-14) and new (07-15) — both single-day ranges.
            { accommodationId: ACCOMMODATION_ID, dates: ['2026-07-14', '2026-07-15'] },
            { execute: expect.any(Function) }
        );
        expect(mockBatchUpsertManual).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-15'],
                createdById: OWNER_ID,
                note: null
            },
            { execute: expect.any(Function) }
        );
    });

    it('returns only rows within the union of old+new ranges, excluding unrelated rows for the accommodation', async () => {
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-11' }),
            makeRow({ date: '2026-09-01' }) // outside both ranges
        ]);

        const result = await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-10',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-11'
        });

        expect(result).toHaveLength(1);
        expect(result[0]?.date).toBe('2026-07-11');
    });

    it('authoritative overwrite: extending the new range over a pre-existing adjacent MANUAL row rewrites its note', async () => {
        // The event being edited only covers 07-10 (oldRange). An UNRELATED
        // MANUAL row already sits on 07-11 with its own note. The edit grows
        // the new range to 07-10..07-11, swallowing that adjacent day — the
        // new range is authoritative, so the pre-existing row's note must be
        // overwritten, not silently left untouched by an upsert conflict-skip.
        mockFindByAccommodation.mockResolvedValue([
            makeRow({ date: '2026-07-10', note: 'moved and merged' }),
            makeRow({ date: '2026-07-11', note: 'moved and merged' })
        ]);

        const result = await updateOccupancyEvent({
            actor: ownerActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-10',
            newStartDate: '2026-07-10',
            newEndDate: '2026-07-11',
            note: 'moved and merged'
        });

        // The pre-existing adjacent row's date (07-11) MUST be included in the
        // pre-upsert delete, even though it was never part of the OLD range —
        // this is what makes the upsert's conflict-skip a non-issue.
        expect(mockDeleteManualByDates).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, dates: ['2026-07-10', '2026-07-11'] },
            { execute: expect.any(Function) }
        );
        expect(mockBatchUpsertManual).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10', '2026-07-11'],
                createdById: OWNER_ID,
                note: 'moved and merged'
            },
            { execute: expect.any(Function) }
        );
        const adjacentRow = result.find((row) => row.date === '2026-07-11');
        expect(adjacentRow?.note).toBe('moved and merged');
    });

    it('throws VALIDATION_ERROR when the new range spans more than 366 days', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-10',
                    oldEndDate: '2026-07-10',
                    newStartDate: '2026-01-01',
                    newEndDate: '2027-06-01'
                }),
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when the old range spans more than 366 days', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-01-01',
                    oldEndDate: '2027-06-01',
                    newStartDate: '2026-07-10',
                    newEndDate: '2026-07-10'
                }),
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('rejects a huge unbounded old range BEFORE expanding it into a date array (DoS guard)', async () => {
        // A body like `{ oldStartDate: '1970-01-01', oldEndDate: '9999-12-31' }`
        // spans ~2.9M days. If the day-diff guard did not run before
        // `expandDateRangeInclusive`, this would allocate a multi-million-entry
        // array before ever throwing. Asserting the model methods were never
        // called is the DoS-relevant assertion here (allocation happens
        // synchronously before any model call, so a non-throw would hang the
        // test on the array-building loop long before reaching the mocks).
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '1970-01-01',
                    oldEndDate: '9999-12-31',
                    newStartDate: '2026-07-10',
                    newEndDate: '2026-07-10'
                }),
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when oldStartDate is after oldEndDate', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-15',
                    oldEndDate: '2026-07-10',
                    newStartDate: '2026-07-11',
                    newEndDate: '2026-07-13'
                }),
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when newStartDate is after newEndDate', async () => {
        await expectServiceError(
            () =>
                updateOccupancyEvent({
                    actor: ownerActor,
                    accommodationId: ACCOMMODATION_ID,
                    oldStartDate: '2026-07-10',
                    oldEndDate: '2026-07-12',
                    newStartDate: '2026-07-20',
                    newEndDate: '2026-07-11'
                }),
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(mockDeleteManualByDates).not.toHaveBeenCalled();
        expect(mockBatchUpsertManual).not.toHaveBeenCalled();
    });

    it('allows a staff actor with ACCOMMODATION_UPDATE_ANY to edit an event on a listing they do not own', async () => {
        mockFindByAccommodation.mockResolvedValue([makeRow({ date: '2026-07-11' })]);

        const result = await updateOccupancyEvent({
            actor: staffActor,
            accommodationId: ACCOMMODATION_ID,
            oldStartDate: '2026-07-10',
            oldEndDate: '2026-07-10',
            newStartDate: '2026-07-11',
            newEndDate: '2026-07-11'
        });

        expect(result).toHaveLength(1);
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
