/**
 * Integration test: cross-provider occupancy collision fix (HOS-162).
 *
 * Background: the `accommodation_occupancy` unique index was originally
 * `(accommodationId, date)` — one row per day REGARDLESS of source. With two
 * concurrent sync sources (e.g. Airbnb + Booking) blocking the same date,
 * `replaceFutureSyncOccupancy`'s `ON CONFLICT DO NOTHING` silently dropped
 * the second provider's row; a later reconcile of the FIRST provider then
 * freed the date even though the second provider still held it — a
 * cross-provider double-booking. The fix scopes the unique index (and every
 * `ON CONFLICT` target) to `(accommodationId, date, source)`, so each source
 * owns its own row per date.
 *
 * Coverage:
 *   1. AIRBNB and BOOKING can BOTH hold the same date — two
 *      `replaceFutureSyncOccupancy` calls (one per source) with the same
 *      date both persist their row; neither drops the other.
 *   2. Reconciling AIRBNB (delete + re-insert its own rows) never touches a
 *      BOOKING row on the same date.
 *   3. `deleteManualByDate` on a day that has both a `MANUAL` and a
 *      `GOOGLE_CALENDAR` row removes only the `MANUAL` row.
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
            slug: `hos162-occ-cross-${slugSuffix}-${uid}`,
            name: 'HOS-162 Cross-Provider Occupancy Test',
            summary: 'Regression test for the cross-provider occupancy collision fix.',
            type: 'HOUSE',
            description: 'Accommodation inserted for the HOS-162 cross-provider occupancy test.',
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!accommodation) throw new Error('Failed to insert accommodation');

    return { owner, destination, accommodation };
}

describe('AccommodationOccupancyModel — cross-provider collision fix (HOS-162)', () => {
    it('lets AIRBNB and BOOKING both hold a row for the same date', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'both-sources');
            const model = new AccommodationOccupancyModel();

            const airbnbResult = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.AIRBNB,
                    fromDate: '2027-01-01',
                    rows: [{ date: '2027-01-15', externalEventId: 'airbnb-event-1' }],
                    createdById: owner.id
                },
                tx
            );
            expect(airbnbResult).toEqual({ removed: 0, inserted: 1 });

            const bookingResult = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.BOOKING,
                    fromDate: '2027-01-01',
                    rows: [{ date: '2027-01-15', externalEventId: 'booking-event-1' }],
                    createdById: owner.id
                },
                tx
            );
            // Pre-fix: this insert would be silently dropped by the shared
            // (accommodationId, date) conflict target — inserted would be 0.
            expect(bookingResult).toEqual({ removed: 0, inserted: 1 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            const rowsOnDate = rows.filter((row) => row.date === '2027-01-15');
            expect(rowsOnDate).toHaveLength(2);
            const sources = rowsOnDate.map((row) => row.source).sort();
            expect(sources).toEqual(['AIRBNB', 'BOOKING']);
        });
    });

    it('reconciling AIRBNB never deletes a BOOKING row on the same date', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'reconcile-isolated');
            const model = new AccommodationOccupancyModel();

            await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.AIRBNB,
                    fromDate: '2027-02-01',
                    rows: [{ date: '2027-02-20', externalEventId: 'airbnb-event-2' }],
                    createdById: owner.id
                },
                tx
            );
            await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.BOOKING,
                    fromDate: '2027-02-01',
                    rows: [{ date: '2027-02-20', externalEventId: 'booking-event-2' }],
                    createdById: owner.id
                },
                tx
            );

            // AIRBNB's event was cancelled at the source — reconcile with an
            // empty desired set. This must delete ONLY the AIRBNB row.
            const result = await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.AIRBNB,
                    fromDate: '2027-02-01',
                    rows: [],
                    createdById: owner.id
                },
                tx
            );
            expect(result).toEqual({ removed: 1, inserted: 0 });

            const rows = await model.findByAccommodation({ accommodationId: accommodation.id }, tx);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.source).toBe('BOOKING');
            expect(rows[0]?.date).toBe('2027-02-20');
        });
    });

    it('deleteManualByDate removes only the MANUAL row, leaving a GOOGLE_CALENDAR row on the same date intact', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await seedAccommodation(tx, 'manual-vs-google');
            const model = new AccommodationOccupancyModel();

            await model.batchUpsertManual(
                { accommodationId: accommodation.id, dates: ['2027-03-10'], createdById: owner.id },
                tx
            );
            await model.replaceFutureSyncOccupancy(
                {
                    accommodationId: accommodation.id,
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    fromDate: '2027-03-01',
                    rows: [{ date: '2027-03-10', externalEventId: 'gcal-event-3' }],
                    createdById: owner.id
                },
                tx
            );

            const rowsBefore = await model.findByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            expect(rowsBefore).toHaveLength(2);

            const deletedCount = await model.deleteManualByDate(
                { accommodationId: accommodation.id, date: '2027-03-10' },
                tx
            );
            expect(deletedCount).toBe(1);

            const rowsAfter = await model.findByAccommodation(
                { accommodationId: accommodation.id },
                tx
            );
            expect(rowsAfter).toHaveLength(1);
            expect(rowsAfter[0]?.source).toBe('GOOGLE_CALENDAR');
        });
    });
});
