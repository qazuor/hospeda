/**
 * TEST:V6:34 AC:V6:26 (HOS-1483) — the reader behind the contract's inverse
 * listing queries (`ficha`, `fichaPurgada`; contract §4.1).
 *
 * Every row lives inside `withTestTransaction`, which always rolls back: the
 * suite leaves no listing behind.
 */
import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { listingContractModel } from '../../src/models/listing/listing-contract.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const TABLE: Readonly<Record<ListingVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
};

async function createListing(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly ownerId: string;
    readonly destinationId: string;
    readonly status: PublicationStatusEnum;
}): Promise<{ readonly id: string }> {
    const { tx, vertical, ownerId, destinationId, status } = args;
    const base = {
        name: 'Contract test',
        slug: `contract-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    const created =
        vertical === 'accommodation'
            ? await new AccommodationModel().create(
                  { ...base, type: 'CABIN' } as Partial<Accommodation>,
                  tx
              )
            : vertical === 'venue'
              ? await new VenueModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx)
              : await new ExperienceModel().create(
                    { ...base, type: 'EXCURSION' } as Partial<Experience>,
                    tx
                );
    await tx.execute(
        sql`UPDATE ${sql.identifier(TABLE[vertical])} SET publication_status = ${status} WHERE id = ${created.id}`
    );
    return { id: created.id };
}

async function arrangeOwner(tx: DrizzleClient) {
    const owner = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values(owner);
    await tx.insert(destinations).values(destination);
    return { ownerId: owner.id, destinationId: destination.id };
}

describe('TEST:V6:34 AC:V6:26 listingContractModel.findListingsById', () => {
    it('returns the vertical, owner and status of a listing of each vertical', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await arrangeOwner(tx);
            const cases: readonly [ListingVertical, PublicationStatusEnum][] = [
                ['accommodation', PublicationStatusEnum.PUBLISHED],
                ['venue', PublicationStatusEnum.MODERATED],
                ['experience', PublicationStatusEnum.DRAFT]
            ];
            for (const [vertical, status] of cases) {
                const { id } = await createListing({
                    tx,
                    vertical,
                    ownerId,
                    destinationId,
                    status
                });
                const rows = await listingContractModel.findListingsById({ listingId: id, tx });
                expect(rows).toEqual([{ vertical, ownerId, publicationStatus: status }]);
            }
        });
    });

    it('returns no row for an id that was never written', async () => {
        await withTestTransaction(async (tx) => {
            const rows = await listingContractModel.findListingsById({
                listingId: crypto.randomUUID(),
                tx
            });
            expect(rows).toEqual([]);
        });
    });

    it('returns no row for a soft-deleted listing', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await arrangeOwner(tx);
            const { id } = await createListing({
                tx,
                vertical: 'venue',
                ownerId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED
            });
            await tx.execute(sql`UPDATE gastronomies SET deleted_at = now() WHERE id = ${id}`);
            const rows = await listingContractModel.findListingsById({ listingId: id, tx });
            expect(rows).toEqual([]);
        });
    });

    it('still returns a PURGED listing, which PB12 leaves with deleted_at NULL', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await arrangeOwner(tx);
            const { id } = await createListing({
                tx,
                vertical: 'experience',
                ownerId,
                destinationId,
                status: PublicationStatusEnum.PURGED
            });
            const rows = await listingContractModel.findListingsById({ listingId: id, tx });
            expect(rows).toEqual([
                {
                    vertical: 'experience',
                    ownerId,
                    publicationStatus: PublicationStatusEnum.PURGED
                }
            ]);
        });
    });
});
