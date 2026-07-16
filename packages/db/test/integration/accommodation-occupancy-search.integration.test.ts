/**
 * Integration test: AccommodationModel.search() honors `checkIn`/`checkOut`
 * against `accommodation_occupancy` (HOS-43 Phase 1).
 *
 * Background:
 *   `checkIn`/`checkOut` were already wired through the HTTP schema, the
 *   `httpToDomainAccommodationSearch` mapper, and `AccommodationSearchSchema`
 *   — but the Drizzle model never built a WHERE clause for them, so they were
 *   dead params. This test proves the `NOT EXISTS` correlated subquery added
 *   to `search()` (and mirrored in `countByFilters()` /
 *   `searchWithRelations()`) implements the intended half-open-range
 *   semantics and stays retrocompatible when no dates are supplied.
 *
 * Coverage (the three acceptance criteria from the HOS-43 recon, plus one
 * HOS-162 regression case):
 *   1. Occupied 10→12 (blocked days: 10, 11), searched with
 *      checkIn=10/checkOut=12 → the accommodation is EXCLUDED (both blocked
 *      days fall inside the half-open search range).
 *   2. Same occupancy, searched with checkIn=12/checkOut=13 → the
 *      accommodation is INCLUDED (the 12th is checkout day — free again,
 *      hotel semantics).
 *   3. Same occupancy, searched with NO checkIn/checkOut → the accommodation
 *      is INCLUDED (retrocompat: the filter must be a no-op when either date
 *      is missing, matching pre-HOS-43 behavior).
 *   4. HOS-162: a date with TWO occupancy rows (same date, two different
 *      sync sources, e.g. AIRBNB + BOOKING) still excludes the accommodation
 *      — the `NOT EXISTS` filter only checks for presence of any matching
 *      row, so it is unaffected by the source-scoped unique index allowing
 *      multiple rows per date.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import {
    accommodationOccupancy,
    accommodations,
    destinations,
    users
} from '../../src/schemas/index.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

describe('AccommodationModel.search — checkIn/checkOut occupancy filter (HOS-43)', () => {
    it('excludes the accommodation when the search range covers a blocked day (checkIn=10, checkOut=12)', async () => {
        await withTestTransaction(async (tx) => {
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            const uid = crypto.randomUUID().slice(0, 8);
            const [accommodation] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `hos43-occupancy-excl-${uid}`,
                    name: 'HOS-43 Occupancy Exclusion Test',
                    summary: 'Regression test for the checkIn/checkOut occupancy filter.',
                    type: 'HOUSE',
                    description: 'Accommodation inserted for the HOS-43 occupancy filter test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodation) throw new Error('Failed to insert accommodation');

            // Occupied 10 -> 12 (blocked days: the 10th and the 11th).
            await tx.insert(accommodationOccupancy).values([
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-10',
                    isBlocked: true,
                    source: 'MANUAL',
                    createdById: owner.id
                },
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-11',
                    isBlocked: true,
                    source: 'MANUAL',
                    createdById: owner.id
                }
            ]);

            const model = new AccommodationModel();
            const result = await model.search(
                {
                    destinationId: destination.id,
                    checkIn: new Date('2024-01-10'),
                    checkOut: new Date('2024-01-12')
                },
                tx
            );

            const ids = result.items.map((item) => item.id);
            expect(ids).not.toContain(accommodation.id);
        });
    });

    it('includes the accommodation when the search starts on the checkout day (checkIn=12, checkOut=13)', async () => {
        await withTestTransaction(async (tx) => {
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            const uid = crypto.randomUUID().slice(0, 8);
            const [accommodation] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `hos43-occupancy-incl-${uid}`,
                    name: 'HOS-43 Occupancy Checkout-Day-Free Test',
                    summary: 'Regression test for the checkIn/checkOut occupancy filter.',
                    type: 'HOUSE',
                    description: 'Accommodation inserted for the HOS-43 occupancy filter test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodation) throw new Error('Failed to insert accommodation');

            // Same occupancy as the exclusion test: blocked on the 10th and 11th only.
            await tx.insert(accommodationOccupancy).values([
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-10',
                    isBlocked: true,
                    source: 'MANUAL',
                    createdById: owner.id
                },
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-11',
                    isBlocked: true,
                    source: 'MANUAL',
                    createdById: owner.id
                }
            ]);

            const model = new AccommodationModel();
            const result = await model.search(
                {
                    destinationId: destination.id,
                    checkIn: new Date('2024-01-12'),
                    checkOut: new Date('2024-01-13')
                },
                tx
            );

            const ids = result.items.map((item) => item.id);
            expect(ids).toContain(accommodation.id);
        });
    });

    it('includes the occupied accommodation when no checkIn/checkOut is supplied (retrocompat no-op)', async () => {
        await withTestTransaction(async (tx) => {
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            const uid = crypto.randomUUID().slice(0, 8);
            const [accommodation] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `hos43-occupancy-nodates-${uid}`,
                    name: 'HOS-43 Occupancy Retrocompat Test',
                    summary: 'Regression test for the checkIn/checkOut occupancy filter.',
                    type: 'HOUSE',
                    description: 'Accommodation inserted for the HOS-43 occupancy filter test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodation) throw new Error('Failed to insert accommodation');

            await tx.insert(accommodationOccupancy).values({
                accommodationId: accommodation.id,
                date: '2024-01-10',
                isBlocked: true,
                source: 'MANUAL',
                createdById: owner.id
            });

            const model = new AccommodationModel();
            // No checkIn/checkOut at all — pre-HOS-43 behavior must be unchanged.
            const result = await model.search({ destinationId: destination.id }, tx);

            const ids = result.items.map((item) => item.id);
            expect(ids).toContain(accommodation.id);
        });
    });

    it('HOS-162: excludes the accommodation when a date has TWO occupancy rows from different sources', async () => {
        await withTestTransaction(async (tx) => {
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            const uid = crypto.randomUUID().slice(0, 8);
            const [accommodation] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `hos162-occupancy-multisource-${uid}`,
                    name: 'HOS-162 Multi-Source Occupancy Test',
                    summary: 'Regression test for the cross-provider occupancy collision fix.',
                    type: 'HOUSE',
                    description:
                        'Accommodation inserted for the HOS-162 multi-source occupancy filter test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodation) throw new Error('Failed to insert accommodation');

            // 2024-01-10 is blocked by BOTH AIRBNB and BOOKING — two rows,
            // same date, different source. Allowed since HOS-162 scoped the
            // unique index to (accommodationId, date, source).
            await tx.insert(accommodationOccupancy).values([
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-10',
                    isBlocked: true,
                    source: 'AIRBNB',
                    createdById: owner.id
                },
                {
                    accommodationId: accommodation.id,
                    date: '2024-01-10',
                    isBlocked: true,
                    source: 'BOOKING',
                    createdById: owner.id
                }
            ]);

            const model = new AccommodationModel();
            const result = await model.search(
                {
                    destinationId: destination.id,
                    checkIn: new Date('2024-01-10'),
                    checkOut: new Date('2024-01-11')
                },
                tx
            );

            const ids = result.items.map((item) => item.id);
            expect(ids).not.toContain(accommodation.id);
        });
    });
});
