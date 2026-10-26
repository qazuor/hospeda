import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodationMediaModel } from '../../src/models/accommodation/accommodationMedia.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { experienceMediaModel } from '../../src/models/experience/experienceMedia.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { venueMediaModel } from '../../src/models/venue/venueMedia.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const MARKED_AT = new Date('2026-10-12T12:00:00.000Z');

async function insertMedia(args: {
    readonly tx: DrizzleClient;
    readonly table: 'accommodation_media' | 'gastronomy_media' | 'experience_media';
    readonly fk: 'accommodation_id' | 'gastronomy_id' | 'experience_id';
    readonly listingId: string;
    readonly sortOrder: number;
    readonly isFeatured: boolean;
    readonly markedAt: Date | null;
}): Promise<string> {
    const result = await args.tx.execute(sql<{ id: string }>`
        INSERT INTO ${sql.identifier(args.table)}
            (${sql.identifier(args.fk)}, url, public_id, sort_order, is_featured,
             remote_deletion_pending_at)
        VALUES (${args.listingId}, ${`https://cdn.example.test/${crypto.randomUUID()}.jpg`},
            ${`media-shown/${crypto.randomUUID()}`}, ${args.sortOrder}, ${args.isFeatured},
            ${args.markedAt})
        RETURNING id`);
    return String(result.rows[0]?.id);
}

/**
 * Seeds one listing with a shown gallery photo, a marked gallery photo and a
 * marked featured photo, and returns their ids.
 */
async function seedListingMedia(args: {
    readonly tx: DrizzleClient;
    readonly table: 'accommodation_media' | 'gastronomy_media' | 'experience_media';
    readonly fk: 'accommodation_id' | 'gastronomy_id' | 'experience_id';
    readonly listingId: string;
}) {
    const shownId = await insertMedia({ ...args, sortOrder: 0, isFeatured: false, markedAt: null });
    await insertMedia({ ...args, sortOrder: 1, isFeatured: false, markedAt: MARKED_AT });
    await insertMedia({ ...args, sortOrder: 2, isFeatured: true, markedAt: MARKED_AT });
    return { shownId };
}

describe('AC:V6:30 a media row marked for remote deletion is never shown', () => {
    it('AC:V6:30 every display finder of the three listing media models hides the marked rows', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const base = {
                summary: 'summary',
                description: 'description',
                ownerId: owner.id,
                destinationId: destination.id
            };
            const fixture = () => ({
                ...base,
                name: `Media shown fixture ${crypto.randomUUID()}`,
                slug: `media-shown-${crypto.randomUUID()}`
            });
            const accommodation = await new AccommodationModel().create(
                { ...fixture(), type: 'CABIN' } as Partial<Accommodation>,
                tx
            );
            const venue = await new VenueModel().create(
                { ...fixture(), type: 'RESTAURANT' } as Partial<Venue>,
                tx
            );
            const experience = await new ExperienceModel().create(
                { ...fixture(), type: 'EXCURSION' } as Partial<Experience>,
                tx
            );
            const acc = await seedListingMedia({
                tx,
                table: 'accommodation_media',
                fk: 'accommodation_id',
                listingId: accommodation.id
            });
            const gas = await seedListingMedia({
                tx,
                table: 'gastronomy_media',
                fk: 'gastronomy_id',
                listingId: venue.id
            });
            const exp = await seedListingMedia({
                tx,
                table: 'experience_media',
                fk: 'experience_id',
                listingId: experience.id
            });

            const ids = (rows: readonly { readonly id: string }[] | undefined) =>
                (rows ?? []).map((row) => row.id);

            const accList = await accommodationMediaModel.findByAccommodation({
                accommodationId: accommodation.id,
                tx
            });
            const accBatch = await accommodationMediaModel.findByAccommodations({
                accommodationIds: [accommodation.id],
                tx
            });
            const gasList = await venueMediaModel.findByVenue({
                gastronomyId: venue.id,
                tx
            });
            const gasBatch = await venueMediaModel.findByVenues({
                gastronomyIds: [venue.id],
                tx
            });
            const expList = await experienceMediaModel.findByExperience({
                experienceId: experience.id,
                tx
            });
            const expBatch = await experienceMediaModel.findByExperiences({
                experienceIds: [experience.id],
                tx
            });

            expect({
                accommodationList: { ids: ids(accList.items), total: accList.total },
                accommodationBatch: ids(accBatch.get(accommodation.id)),
                accommodationFeatured: await accommodationMediaModel.findFeatured({
                    accommodationId: accommodation.id,
                    tx
                }),
                gastronomyList: { ids: ids(gasList.items), total: gasList.total },
                gastronomyBatch: ids(gasBatch.get(venue.id)),
                gastronomyFeatured: await venueMediaModel.findFeatured({
                    gastronomyId: venue.id,
                    tx
                }),
                experienceList: { ids: ids(expList.items), total: expList.total },
                experienceBatch: ids(expBatch.get(experience.id)),
                experienceFeatured: await experienceMediaModel.findFeatured({
                    experienceId: experience.id,
                    tx
                })
            }).toEqual({
                accommodationList: { ids: [acc.shownId], total: 1 },
                accommodationBatch: [acc.shownId],
                accommodationFeatured: null,
                gastronomyList: { ids: [gas.shownId], total: 1 },
                gastronomyBatch: [gas.shownId],
                gastronomyFeatured: null,
                experienceList: { ids: [exp.shownId], total: 1 },
                experienceBatch: [exp.shownId],
                experienceFeatured: null
            });
        });
    });
});
