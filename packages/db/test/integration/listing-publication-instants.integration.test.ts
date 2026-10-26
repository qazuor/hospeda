import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../src/models/listing/listing-publication.model.ts';
import { GastronomyModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function makeListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: 'Publication instant fixture',
        slug: `publication-instant-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.PUBLISHED
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx);
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe.each([
    'accommodation',
    'gastronomy',
    'experience'
] as const)('publication instants: %s', (vertical) => {
    it('TEST:V6:5 reads the latest owner PB1 only for matching entity type and ids', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const first = await makeListing(tx, vertical, user.id, destination.id);
            const second = await makeListing(tx, vertical, user.id, destination.id);
            const noEvent = await makeListing(tx, vertical, user.id, destination.id);
            const outside = await makeListing(tx, vertical, user.id, destination.id);
            const firstAt = new Date('2026-01-01T00:00:00.000Z');
            const latestAt = new Date('2026-02-01T00:00:00.000Z');
            const record = (args: {
                listingId: string;
                from: PublicationStatusEnum;
                to: PublicationStatusEnum;
                actorType: 'owner' | 'job';
                occurredAt: Date;
                entityVertical?: ListingVertical;
            }) =>
                listingPublicationModel.insertStatusChangedEvent({
                    tx,
                    vertical: args.entityVertical ?? vertical,
                    listingId: args.listingId,
                    from: args.from,
                    to: args.to,
                    actorType: args.actorType,
                    actorId: args.actorType === 'owner' ? user.id : undefined,
                    correlationId: crypto.randomUUID(),
                    occurredAt: args.occurredAt
                });
            await record({
                listingId: first.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                occurredAt: firstAt
            });
            await record({
                listingId: first.id,
                from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                occurredAt: latestAt
            });
            await record({
                listingId: first.id,
                from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'job',
                occurredAt: new Date('2026-03-01T00:00:00.000Z')
            });
            await record({
                listingId: first.id,
                from: PublicationStatusEnum.PUBLISHED,
                to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                actorType: 'owner',
                occurredAt: new Date('2026-04-01T00:00:00.000Z')
            });
            await record({
                listingId: second.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                occurredAt: firstAt,
                entityVertical: vertical === 'experience' ? 'gastronomy' : 'experience'
            });
            await record({
                listingId: outside.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                occurredAt: firstAt
            });

            const result = await listingPublicationModel.readPublicationInstants({
                tx,
                vertical,
                listingIds: [first.id, second.id, noEvent.id]
            });
            expect(result).toEqual(new Map([[first.id, latestAt]]));
            expect(
                await listingPublicationModel.readPublicationInstants({
                    tx,
                    vertical,
                    listingIds: []
                })
            ).toEqual(new Map());
        });
    });
});
