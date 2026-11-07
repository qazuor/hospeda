import { AmenitiesTypeEnum, PublicationStatusEnum, VenueTypeEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { amenities } from '../../src/schemas/accommodation/amenity.dbschema.ts';
import { features } from '../../src/schemas/accommodation/feature.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { rVenueAmenity } from '../../src/schemas/venue/r_venue_amenity.dbschema.ts';
import { rVenueFeature } from '../../src/schemas/venue/r_venue_feature.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('VenueModel.findPublicFilterOptions', () => {
    it('returns only values associated with published, live listings in the requested collection', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const amenityA = crypto.randomUUID();
            const amenityB = crypto.randomUUID();
            const feature1 = crypto.randomUUID();
            const feature2 = crypto.randomUUID();
            const feature3 = crypto.randomUUID();
            await tx.insert(amenities).values(
                [amenityA, amenityB].map((id) => ({
                    id,
                    slug: `filter-${id}`,
                    type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
                    applicableVerticals: ['venue']
                }))
            );
            await tx.insert(features).values(
                [feature1, feature2, feature3].map((id) => ({
                    id,
                    slug: `filter-${id}`,
                    applicableVerticals: ['venue']
                }))
            );
            const insertVenue = async (
                type: VenueTypeEnum,
                businessLines: string[],
                published: boolean,
                deleted = false
            ) => {
                return new VenueModel().create(
                    {
                        name: 'Filter option test',
                        slug: `filter-${crypto.randomUUID()}`,
                        summary: 'Summary',
                        description: 'Description',
                        ownerId: user.id,
                        destinationId: destination.id,
                        type,
                        businessLines,
                        publicationStatus: published
                            ? PublicationStatusEnum.PUBLISHED
                            : PublicationStatusEnum.DRAFT,
                        deletedAt: deleted ? new Date() : null
                    } as never,
                    tx
                );
            };
            const night = await insertVenue(VenueTypeEnum.BOLICHE, ['nightlife'], true);
            const cafe = await insertVenue(VenueTypeEnum.CAFE, ['food'], true);
            await insertVenue(VenueTypeEnum.BAR, ['food', 'nightlife'], true);
            const draft = await insertVenue(VenueTypeEnum.BOLICHE, ['nightlife'], false);
            const deleted = await insertVenue(VenueTypeEnum.BOLICHE, ['nightlife'], true, true);
            await tx.insert(rVenueAmenity).values([
                { venueId: night.id, amenityId: amenityA },
                { venueId: draft.id, amenityId: amenityB }
            ]);
            await tx.insert(rVenueFeature).values([
                { venueId: night.id, featureId: feature1 },
                { venueId: cafe.id, featureId: feature2 },
                { venueId: draft.id, featureId: feature3 },
                { venueId: deleted.id, featureId: feature3 }
            ]);
            const model = new VenueModel();
            const nightlife = await model.findPublicFilterOptions(
                { businessLine: 'nightlife' },
                tx
            );
            expect(nightlife.types).toContain(VenueTypeEnum.BOLICHE);
            expect(nightlife.types).toContain(VenueTypeEnum.BAR);
            expect(nightlife.types).not.toContain(VenueTypeEnum.CAFE);
            expect(nightlife.amenityIds).toContain(amenityA);
            expect(nightlife.amenityIds).not.toContain(amenityB);
            expect(nightlife.featureIds).toContain(feature1);
            expect(nightlife.featureIds).not.toContain(feature2);
            expect(nightlife.featureIds).not.toContain(feature3);
            const food = await model.findPublicFilterOptions({ businessLine: 'food' }, tx);
            expect(food.types).toContain(VenueTypeEnum.BAR);
            expect(food.types).toContain(VenueTypeEnum.CAFE);
            expect(food.types).not.toContain(VenueTypeEnum.BOLICHE);
            expect(food.featureIds).toContain(feature2);
            expect(food.amenityIds).not.toContain(amenityA);
            const all = await model.findPublicFilterOptions({}, tx);
            expect(all.types).toContain(VenueTypeEnum.BOLICHE);
            expect(all.types).toContain(VenueTypeEnum.BAR);
            expect(all.types).toContain(VenueTypeEnum.CAFE);
            expect(all.amenityIds).toContain(amenityA);
            expect(all.featureIds).toContain(feature1);
            expect(all.featureIds).toContain(feature2);
        });
    });
});
