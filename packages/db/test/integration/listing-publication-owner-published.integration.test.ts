import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../src/models/listing/listing-publication.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function makeListing(args: {
    tx: DrizzleClient;
    vertical: ListingVertical;
    ownerId: string;
    destinationId: string;
}) {
    const base = {
        name: 'Owner publication test',
        slug: `owner-publication-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId: args.ownerId,
        destinationId: args.destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    if (args.vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            args.tx
        );
    if (args.vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            args.tx
        );
    return new ExperienceModel().create(
        { ...base, type: 'EXCURSION' } as Partial<Experience>,
        args.tx
    );
}

async function record(args: {
    tx: DrizzleClient;
    vertical: ListingVertical;
    listingId: string;
    from: PublicationStatusEnum;
    to: PublicationStatusEnum;
    actorType?: 'owner' | 'job';
}) {
    const table = {
        accommodation: 'accommodations',
        gastronomy: 'gastronomies',
        experience: 'experiences'
    }[args.vertical];
    const listing = await args.tx.execute(sql<{ readonly ownerId: string }>`
        SELECT owner_id AS "ownerId" FROM ${sql.identifier(table)} WHERE id = ${args.listingId}`);
    await listingPublicationModel.insertStatusChangedEvent({
        ...args,
        actorType: args.actorType ?? 'owner',
        actorId: listing.rows[0]?.ownerId,
        tx: args.tx,
        correlationId: crypto.randomUUID()
    });
}

describe('listingPublicationModel.hasOwnerPublished', () => {
    it('counts only completed owner PB1 events for the same owner, vertical, and listing, including deleted listings', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const other = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, other]);
            await tx.insert(destinations).values(destination);
            const draftToPublished = await makeListing({
                tx,
                vertical: 'accommodation',
                ownerId: owner.id,
                destinationId: destination.id
            });
            const billingRestored = await makeListing({
                tx,
                vertical: 'accommodation',
                ownerId: owner.id,
                destinationId: destination.id
            });
            const jobListing = await makeListing({
                tx,
                vertical: 'accommodation',
                ownerId: owner.id,
                destinationId: destination.id
            });
            const otherOwnerListing = await makeListing({
                tx,
                vertical: 'accommodation',
                ownerId: other.id,
                destinationId: destination.id
            });
            const otherVerticalListing = await makeListing({
                tx,
                vertical: 'gastronomy',
                ownerId: owner.id,
                destinationId: destination.id
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: owner.id
                })
            ).toBe(false);
            await record({
                tx,
                vertical: 'accommodation',
                listingId: draftToPublished.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: owner.id
                })
            ).toBe(true);
            await record({
                tx,
                vertical: 'accommodation',
                listingId: billingRestored.id,
                from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: owner.id
                })
            ).toBe(true);
            await record({
                tx,
                vertical: 'accommodation',
                listingId: jobListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'job'
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: owner.id
                })
            ).toBe(true);
            await record({
                tx,
                vertical: 'accommodation',
                listingId: otherOwnerListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: other.id
                })
            ).toBe(true);
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: other.id
                })
            ).toBe(true);
            await record({
                tx,
                vertical: 'gastronomy',
                listingId: otherVerticalListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'gastronomy',
                    userId: owner.id
                })
            ).toBe(true);
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'experience',
                    userId: owner.id
                })
            ).toBe(false);

            const jobOnlyOwner = testData.user();
            await tx.insert(users).values(jobOnlyOwner);
            const jobOnlyListing = await makeListing({
                tx,
                vertical: 'experience',
                ownerId: jobOnlyOwner.id,
                destinationId: destination.id
            });
            await record({
                tx,
                vertical: 'experience',
                listingId: jobOnlyListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'job'
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'experience',
                    userId: jobOnlyOwner.id
                })
            ).toBe(false);

            const noEventOwner = testData.user();
            await tx.insert(users).values(noEventOwner);
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: noEventOwner.id
                })
            ).toBe(false);

            const crossOwner = testData.user();
            await tx.insert(users).values(crossOwner);
            const crossOwnerListing = await makeListing({
                tx,
                vertical: 'experience',
                ownerId: other.id,
                destinationId: destination.id
            });
            await record({
                tx,
                vertical: 'experience',
                listingId: crossOwnerListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'experience',
                    userId: crossOwner.id
                })
            ).toBe(false);

            const crossVertical = testData.user();
            await tx.insert(users).values(crossVertical);
            const crossVerticalListing = await makeListing({
                tx,
                vertical: 'gastronomy',
                ownerId: crossVertical.id,
                destinationId: destination.id
            });
            await record({
                tx,
                vertical: 'gastronomy',
                listingId: crossVerticalListing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: crossVertical.id
                })
            ).toBe(false);

            const onlyNegative = testData.user();
            await tx.insert(users).values(onlyNegative);
            const unpublished = await makeListing({
                tx,
                vertical: 'experience',
                ownerId: onlyNegative.id,
                destinationId: destination.id
            });
            const archived = await makeListing({
                tx,
                vertical: 'experience',
                ownerId: onlyNegative.id,
                destinationId: destination.id
            });
            await record({
                tx,
                vertical: 'experience',
                listingId: unpublished.id,
                from: PublicationStatusEnum.PUBLISHED,
                to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            });
            await record({
                tx,
                vertical: 'experience',
                listingId: archived.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.ARCHIVED
            });
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'experience',
                    userId: onlyNegative.id
                })
            ).toBe(false);

            const deletedTable = sql.identifier('accommodations');
            await tx.execute(
                sql`UPDATE ${deletedTable} SET deleted_at = now() WHERE id = ${draftToPublished.id}`
            );
            await tx.execute(
                sql`UPDATE ${deletedTable} SET deleted_at = now() WHERE id = ${billingRestored.id}`
            );
            expect(
                await listingPublicationModel.hasOwnerPublished({
                    tx,
                    vertical: 'accommodation',
                    userId: owner.id
                })
            ).toBe(true);
        });
    });
});
