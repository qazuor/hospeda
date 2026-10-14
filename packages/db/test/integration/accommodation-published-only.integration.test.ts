/**
 * Integration test: `publishedOnly` on AccommodationModel's public reads
 * (HOS-1641, V6.9b; AC:V5:5 — what is not yours exists only PUBLISHED).
 *
 * The old public filter combined four flags over `lifecycle_state`,
 * `visibility` and two suspension columns. Those columns are gone; the one
 * predicate left is `publication_status = 'PUBLISHED'`. This suite inserts one
 * listing per publication state for a fresh owner and checks that `search`,
 * `countByFilters`, `searchWithRelations` and `findTopRated` return only the
 * PUBLISHED one with `publishedOnly`, and all six without it (owner scope).
 *
 * Every row lives inside `withTestTransaction`, which rolls back: no listing is
 * left behind to change the global PUBLISHED population.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodations, destinations, users } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

const ALL_STATES = Object.values(PublicationStatusEnum);

/** Inserts one listing per publication state, all with the same owner and destination. */
async function seedOneListingPerState(tx: DrizzleClient): Promise<{
    readonly ownerId: string;
    readonly destinationId: string;
    readonly idByState: ReadonlyMap<PublicationStatusEnum, string>;
}> {
    const [owner] = await tx
        .insert(users)
        .values(testData.user({ role: 'HOST' }))
        .returning();
    if (!owner) throw new Error('Failed to insert owner');
    const [destination] = await tx
        .insert(destinations)
        .values(testData.destination({ ownerId: owner.id }))
        .returning();
    if (!destination) throw new Error('Failed to insert destination');

    const uid = crypto.randomUUID().slice(0, 8);
    const rows = await tx
        .insert(accommodations)
        .values(
            ALL_STATES.map((state) => ({
                publicationStatus: state,
                inactiveSince: new Date(),
                deadlinesVersion: 1,
                ownerId: owner.id,
                destinationId: destination.id,
                slug: `hos1641-published-only-${state.toLowerCase()}-${uid}`,
                name: `HOS-1641 ${state}`,
                summary: 'Listing inserted for the publishedOnly filter test.',
                type: 'HOUSE' as const,
                description: 'Listing inserted for the HOS-1641 publishedOnly filter test.'
            }))
        )
        .returning({ id: accommodations.id, publicationStatus: accommodations.publicationStatus });

    return {
        ownerId: owner.id,
        destinationId: destination.id,
        idByState: new Map(rows.map((row) => [row.publicationStatus, row.id]))
    };
}

describe('AccommodationModel — publishedOnly (HOS-1641)', () => {
    it.each(
        ALL_STATES.filter((state) => state !== PublicationStatusEnum.PUBLISHED)
    )('search() excludes a %s listing and keeps the PUBLISHED one', async (state) => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { ownerId, idByState } = await seedOneListingPerState(tx);
            const model = new AccommodationModel();

            // Act
            const result = await model.search({ ownerId, publishedOnly: true }, tx);

            // Assert
            const ids = result.items.map((item) => item.id);
            expect(ids).not.toContain(idByState.get(state));
            expect(ids).toEqual([idByState.get(PublicationStatusEnum.PUBLISHED)]);
            expect(result.total).toBe(1);
        });
    });

    it('countByFilters(), searchWithRelations() and findTopRated() see only the PUBLISHED listing', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { ownerId, destinationId, idByState } = await seedOneListingPerState(tx);
            const model = new AccommodationModel();
            const publishedId = idByState.get(PublicationStatusEnum.PUBLISHED);

            // Act
            const counted = await model.countByFilters({ ownerId, publishedOnly: true }, tx);
            const withRelations = await model.searchWithRelations(
                { ownerId, publishedOnly: true },
                tx
            );
            const topRated = await model.findTopRated(
                { destinationId, publishedOnly: true, limit: 20 },
                tx
            );

            // Assert
            expect(counted.count).toBe(1);
            expect(withRelations.items.map((item) => item.id)).toEqual([publishedId]);
            expect(topRated.map((item) => item.id)).toEqual([publishedId]);
        });
    });

    it('without publishedOnly (owner scope) every state is returned', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { ownerId, idByState } = await seedOneListingPerState(tx);
            const model = new AccommodationModel();

            // Act
            const result = await model.search({ ownerId, pageSize: 20 }, tx);

            // Assert
            expect(new Set(result.items.map((item) => item.id))).toEqual(
                new Set(idByState.values())
            );
        });
    });
});
