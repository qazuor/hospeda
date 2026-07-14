/**
 * Integration test: AccommodationOccupancyModel.replaceFutureSyncOccupancy
 * (HOS-157 Phase 2 — declarative full-window reconcile primitive).
 *
 * Coverage:
 *   1. First sync inserts the desired rows and reports `{ removed: 0,
 *      inserted: N }`.
 *   2. OVERLAP — a date covered by two events stays blocked when only one of
 *      them is removed from the desired set on a second reconcile.
 *   3. A `MANUAL` row on a date in the desired set is NOT deleted by the
 *      replace and NOT overwritten (stays `MANUAL` via `ON CONFLICT DO
 *      NOTHING`).
 *   4. A pre-existing `GOOGLE_CALENDAR` row with `date < fromDate` is left
 *      untouched — only `date >= fromDate` is replaced.
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

describe('AccommodationOccupancyModel.replaceFutureSyncOccupancy (HOS-157 Phase 2)', () => {
    it('inserts the desired rows on a first sync and reports removed=0', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'first-sync');
            const model = new AccommodationOccupancyModel();

            const result = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-08-01',
                    rows: [
                        { date: '2026-08-10', externalEventId: 'gcal-event-1' },
                        { date: '2026-08-11', externalEventId: 'gcal-event-1' }
                    ],
                    createdById: owner.id
                },
                tx
            );

            expect(result).toEqual({ removed: 0, inserted: 2 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            expect(rows.map((row) => row.date)).toEqual(['2026-08-10', '2026-08-11']);
            expect(rows.every((row) => row.source === 'GOOGLE_CALENDAR')).toBe(true);
        });
    });

    it('OVERLAP: a date covered by two events stays blocked when only one is removed from the desired set', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'overlap');
            const model = new AccommodationOccupancyModel();

            // First reconcile: ev-A covers 09-10..09-11, ev-B covers 09-11..09-12.
            // Shared date 09-11 is attributed to ev-A (first event wins provenance,
            // mirroring the sync service's desired-set construction).
            await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-09-01',
                    rows: [
                        { date: '2026-09-10', externalEventId: 'ev-A' },
                        { date: '2026-09-11', externalEventId: 'ev-A' },
                        { date: '2026-09-12', externalEventId: 'ev-B' }
                    ],
                    createdById: owner.id
                },
                tx
            );

            // Second reconcile: ev-A was removed at the source, but ev-B still
            // covers 09-11..09-12 — so 09-11 must stay blocked (attributed to ev-B
            // now), while 09-10 (only ev-A) is freed.
            const result = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-09-01',
                    rows: [
                        { date: '2026-09-11', externalEventId: 'ev-B' },
                        { date: '2026-09-12', externalEventId: 'ev-B' }
                    ],
                    createdById: owner.id
                },
                tx
            );

            expect(result).toEqual({ removed: 3, inserted: 2 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            expect(rows.map((row) => row.date)).toEqual(['2026-09-11', '2026-09-12']);
            expect(rows.every((row) => row.externalEventId === 'ev-B')).toBe(true);
        });
    });

    it('does not delete or overwrite a MANUAL row on a date in the desired set', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'manual-wins');
            const model = new AccommodationOccupancyModel();

            await model.batchUpsertManual(
                { accommodationId: accommodation.id, dates: ['2026-10-05'], createdById: owner.id },
                tx
            );

            const result = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-10-01',
                    rows: [
                        { date: '2026-10-05', externalEventId: 'gcal-event-2' },
                        { date: '2026-10-06', externalEventId: 'gcal-event-2' }
                    ],
                    createdById: owner.id
                },
                tx
            );

            // The MANUAL row is not a GOOGLE_CALENDAR row so the DELETE never
            // touches it, and the conflicting INSERT for 10-05 is a no-op.
            expect(result).toEqual({ removed: 0, inserted: 1 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            const manualRow = rows.find((row) => row.date === '2026-10-05');
            expect(manualRow?.source).toBe('MANUAL');
            const syncRow = rows.find((row) => row.date === '2026-10-06');
            expect(syncRow?.source).toBe('GOOGLE_CALENDAR');
        });
    });

    it('leaves a pre-existing GOOGLE_CALENDAR row before fromDate untouched', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'past-untouched');
            const model = new AccommodationOccupancyModel();

            // Seed a "past" GOOGLE_CALENDAR row before the reconcile window.
            await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-11-01',
                    rows: [{ date: '2026-11-01', externalEventId: 'gcal-event-past' }],
                    createdById: owner.id
                },
                tx
            );

            // Reconcile again with a LATER fromDate — the 2026-11-01 row is
            // before the new window and must survive, even though it is empty
            // of desired rows for this run.
            const result = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2026-11-02',
                    rows: [{ date: '2026-11-05', externalEventId: 'gcal-event-future' }],
                    createdById: owner.id
                },
                tx
            );

            expect(result).toEqual({ removed: 0, inserted: 1 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            expect(rows.map((row) => row.date)).toEqual(['2026-11-01', '2026-11-05']);
            expect(rows.find((row) => row.date === '2026-11-01')?.externalEventId).toBe(
                'gcal-event-past'
            );
        });
    });
});
