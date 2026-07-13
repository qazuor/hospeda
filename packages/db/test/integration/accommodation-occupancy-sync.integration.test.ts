/**
 * Integration test: AccommodationOccupancyModel's sync counterpart methods
 * (HOS-157 Phase 2 DB foundation).
 *
 * Coverage:
 *   1. `upsertSyncOccupancy` never clobbers an existing `MANUAL` row for the
 *      same date (the manual block wins; the sync insert is a silent no-op
 *      via `onConflictDoNothing`).
 *   2. `upsertSyncOccupancy` is idempotent for the same sync source — running
 *      it twice for the same dates does not create duplicates or error.
 *   3. `deleteByExternalEventId` is scoped to `source` + `externalEventId` —
 *      it never deletes a `MANUAL` row, even one that happens to share a
 *      date with the sync event.
 *   4. `deleteStaleSyncByExternalEventId` deletes only the dates NOT in
 *      `keepDates` (event shrank), and deletes everything when `keepDates`
 *      is empty (event removed entirely).
 *   5. `findBySource` returns only rows for the requested source, ordered by
 *      date ascending.
 */
import { OccupancySourceEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationOccupancyModel } from '../../src/models/accommodation/accommodationOccupancy.model.ts';
import { accommodations, destinations, users } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/** Inserts a minimal owner + destination + accommodation fixture and returns their ids. */
async function seedAccommodation(tx: DrizzleClient, slugSuffix: string) {
    const ownerPayload = testData.user({ role: 'HOST' });
    const [owner] = await tx.insert(users).values(ownerPayload).returning();
    if (!owner) throw new Error('Failed to insert owner');

    const destinationPayload = testData.destination({ ownerId: owner.id });
    const [destination] = await tx.insert(destinations).values(destinationPayload).returning();
    if (!destination) throw new Error('Failed to insert destination');

    const uid = crypto.randomUUID().slice(0, 8);
    const [accommodation] = await tx
        .insert(accommodations)
        .values({
            ownerId: owner.id,
            destinationId: destination.id,
            slug: `hos157-occ-sync-${slugSuffix}-${uid}`,
            name: 'HOS-157 Occupancy Sync Test',
            summary: 'Regression test for the occupancy sync model methods.',
            type: 'HOUSE',
            description: 'Accommodation inserted for the HOS-157 occupancy sync test.',
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!accommodation) throw new Error('Failed to insert accommodation');

    return { owner, destination, accommodation };
}

describe('AccommodationOccupancyModel — sync methods (HOS-157 Phase 2)', () => {
    it('upsertSyncOccupancy does not clobber an existing MANUAL row for the same date', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'no-clobber');
            const model = new AccommodationOccupancyModel();

            await model.batchUpsertManual(
                { accommodationId: accommodation.id, dates: ['2026-08-10'], createdById: owner.id },
                tx
            );

            const inserted = await model.upsertSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    dates: ['2026-08-10', '2026-08-11'],
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-1',
                    createdById: owner.id
                },
                tx
            );

            // Only the 11th was actually inserted — the 10th already had a MANUAL row.
            expect(inserted.map((row) => row.date)).toEqual(['2026-08-11']);

            const allRows = await model.findByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            const row10 = allRows.find((row) => row.date === '2026-08-10');
            expect(row10?.source).toBe('MANUAL');
        });
    });

    it('upsertSyncOccupancy is idempotent for the same sync source', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'idempotent');
            const model = new AccommodationOccupancyModel();

            const params = {
                accommodationId: accommodation.id,
                dates: ['2026-09-01', '2026-09-02'],
                source: OccupancySourceEnum.GOOGLE_CALENDAR,
                externalEventId: 'gcal-event-2',
                createdById: owner.id
            };

            const firstRun = await model.upsertSyncOccupancy(params, tx);
            expect(firstRun).toHaveLength(2);

            const secondRun = await model.upsertSyncOccupancy(params, tx);
            expect(secondRun).toHaveLength(0);

            const rows = await model.findBySource(
                { accommodationId: accommodation.id, source: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            expect(rows).toHaveLength(2);
        });
    });

    it('deleteByExternalEventId only deletes rows for that source + event, never MANUAL', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'delete-event');
            const model = new AccommodationOccupancyModel();

            await model.batchUpsertManual(
                { accommodationId: accommodation.id, dates: ['2026-10-05'], createdById: owner.id },
                tx
            );
            await model.upsertSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    dates: ['2026-10-06', '2026-10-07'],
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-3',
                    createdById: owner.id
                },
                tx
            );

            const deletedCount = await model.deleteByExternalEventId(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-3'
                },
                tx
            );
            expect(deletedCount).toBe(2);

            const remaining = await model.findByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            expect(remaining.map((row) => row.date)).toEqual(['2026-10-05']);
            expect(remaining[0]?.source).toBe('MANUAL');
        });
    });

    it('deleteStaleSyncByExternalEventId removes only dates outside keepDates', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'stale-shrink');
            const model = new AccommodationOccupancyModel();

            await model.upsertSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    dates: ['2026-11-01', '2026-11-02', '2026-11-03'],
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-4',
                    createdById: owner.id
                },
                tx
            );

            // Event shrank to only cover the 1st now.
            const deletedCount = await model.deleteStaleSyncByExternalEventId(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-4',
                    keepDates: ['2026-11-01']
                },
                tx
            );
            expect(deletedCount).toBe(2);

            const remaining = await model.findBySource(
                { accommodationId: accommodation.id, source: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            expect(remaining.map((row) => row.date)).toEqual(['2026-11-01']);
        });
    });

    it('deleteStaleSyncByExternalEventId with empty keepDates deletes every row for the event', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'stale-empty');
            const model = new AccommodationOccupancyModel();

            await model.upsertSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    dates: ['2026-12-01', '2026-12-02'],
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-5',
                    createdById: owner.id
                },
                tx
            );

            const deletedCount = await model.deleteStaleSyncByExternalEventId(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-5',
                    keepDates: []
                },
                tx
            );
            expect(deletedCount).toBe(2);

            const remaining = await model.findBySource(
                { accommodationId: accommodation.id, source: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            expect(remaining).toHaveLength(0);
        });
    });

    it('findBySource returns only rows for the requested source, ordered by date', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'find-by-source');
            const model = new AccommodationOccupancyModel();

            await model.batchUpsertManual(
                { accommodationId: accommodation.id, dates: ['2027-01-05'], createdById: owner.id },
                tx
            );
            await model.upsertSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    dates: ['2027-01-03', '2027-01-01'],
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'gcal-event-6',
                    createdById: owner.id
                },
                tx
            );

            const rows = await model.findBySource(
                { accommodationId: accommodation.id, source: OccupancySourceEnum.GOOGLE_CALENDAR },
                tx
            );
            expect(rows.map((row) => row.date)).toEqual(['2027-01-01', '2027-01-03']);
            expect(rows.every((row) => row.source === 'GOOGLE_CALENDAR')).toBe(true);
        });
    });
});
