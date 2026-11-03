import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { listOpenFixRequests } from '../../src/models/listing/listing-fix-request-list.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { experiences } from '../../src/schemas/experience/experiences.dbschema.ts';
import { fixRequests } from '../../src/schemas/listing/fix_request.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { venues } from '../../src/schemas/venue/venue.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function createListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: 'Fix list',
        slug: `fix-list-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'venue')
        return new VenueModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx);
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe('TEST:1704:2 listing fix-request list model', () => {
    it('filters, orders, counts, and paginates the test rows across verticals', async () => {
        await withTestTransaction(async (tx) => {
            const today = getLocalDateString({ instant: new Date() });
            const [year, month, day] = today.split('-').map(Number);
            const yesterday = new Date(Date.UTC(year!, month! - 1, day! - 1))
                .toISOString()
                .slice(0, 10);
            const owner = testData.user();
            const admin = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, admin]);
            await tx.insert(destinations).values(destination);
            const verticals: ListingVertical[] = [
                VerticalEnum.ACCOMMODATION,
                VerticalEnum.VENUE,
                VerticalEnum.EXPERIENCE
            ];
            const initial = await listOpenFixRequests({
                client: tx,
                verticals,
                page: 1,
                pageSize: 100
            });
            const initialAccommodation = await listOpenFixRequests({
                client: tx,
                verticals: [VerticalEnum.ACCOMMODATION],
                page: 1,
                pageSize: 100
            });
            const ownIds: string[] = [];
            const ownFixIds: string[] = [];
            const all = [] as {
                id: string;
                vertical: ListingVertical;
                listingId: string;
                listingName: string;
                listingSlug: string;
                publicationStatus: string;
                reason: string;
                suggestedDate: string | null;
                openedAt: Date;
                ownerReportedFixedAt: Date | null;
            }[];
            for (const vertical of verticals) {
                const listings = [];
                for (let index = 0; index < 5; index += 1) {
                    const listing = await createListing(tx, vertical, owner.id, destination.id);
                    listings.push(listing);
                    ownIds.push(listing.id);
                }
                const deletedId = listings[3]!.id;
                if (vertical === 'accommodation')
                    await tx
                        .update(accommodations)
                        .set({ deletedAt: new Date('2026-01-01T00:00:00Z') })
                        .where(eq(accommodations.id, deletedId));
                if (vertical === 'venue')
                    await tx
                        .update(venues)
                        .set({ deletedAt: new Date('2026-01-01T00:00:00Z') })
                        .where(eq(venues.id, deletedId));
                if (vertical === 'experience')
                    await tx
                        .update(experiences)
                        .set({ deletedAt: new Date('2026-01-01T00:00:00Z') })
                        .where(eq(experiences.id, deletedId));
                for (let index = 0; index < 5; index += 1) {
                    const listing = listings[index]!;
                    const closed = index === 2;
                    const id = crypto.randomUUID();
                    const openedAt = new Date(`2026-10-${index === 1 ? '31' : '01'}T00:00:00.000Z`);
                    const suggestedDate = index === 4 ? today : index === 1 ? yesterday : null;
                    const ownerReportedFixedAt =
                        index === 1 ? new Date('2026-11-01T10:00:00Z') : null;
                    await tx.insert(fixRequests).values({
                        id,
                        entityType: vertical,
                        entityId: listing.id,
                        reason: `reason-${vertical}-${index}`,
                        suggestedDate,
                        openedById: admin.id,
                        openedAt,
                        closedAt: closed ? new Date('2026-11-02T00:00:00Z') : null,
                        ownerReportedFixedAt
                    });
                    ownFixIds.push(id);
                    if (index !== 2 && index !== 3) {
                        all.push({
                            id,
                            vertical,
                            listingId: listing.id,
                            listingName: listing.name,
                            listingSlug: listing.slug,
                            publicationStatus: listing.publicationStatus,
                            reason: `reason-${vertical}-${index}`,
                            suggestedDate,
                            openedAt,
                            ownerReportedFixedAt
                        });
                    }
                }
            }
            const query = async (
                extra: Partial<Parameters<typeof listOpenFixRequests>[0]> = {}
            ) => {
                const result = await listOpenFixRequests({
                    client: tx,
                    verticals,
                    page: 1,
                    pageSize: 100,
                    ...extra
                });
                return {
                    ...result,
                    items: result.items.filter((item) => ownFixIds.includes(item.id))
                };
            };
            const ordered = [...all].sort(
                (a, b) => a.openedAt.getTime() - b.openedAt.getTime() || a.id.localeCompare(b.id)
            );
            const baseline = await query();
            expect(baseline.items).toEqual(ordered);
            expect(baseline.total - initial.total).toBe(ordered.length);
            expect(baseline.items.some((item) => ownIds.includes(item.listingId))).toBe(true);
            expect((await query({ ownerReported: true })).items).toEqual(
                ordered.filter((item) => item.ownerReportedFixedAt !== null)
            );
            expect((await query({ ownerReported: false })).items).toEqual(
                ordered.filter((item) => item.ownerReportedFixedAt === null)
            );
            expect((await query({ suggestedBefore: today })).items).toEqual(
                ordered.filter((item) => item.suggestedDate === yesterday)
            );
            expect((await query({ ownerReported: true, suggestedBefore: today })).items).toEqual(
                ordered.filter(
                    (item) => item.ownerReportedFixedAt !== null && item.suggestedDate === yesterday
                )
            );
            const accommodation = await listOpenFixRequests({
                client: tx,
                verticals: [VerticalEnum.ACCOMMODATION],
                page: 1,
                pageSize: 2
            });
            const accommodationPageTwo = await listOpenFixRequests({
                client: tx,
                verticals: [VerticalEnum.ACCOMMODATION],
                page: 2,
                pageSize: 2
            });
            const allAccommodation = await listOpenFixRequests({
                client: tx,
                verticals: [VerticalEnum.ACCOMMODATION],
                page: 1,
                pageSize: 100
            });
            expect(accommodation.items.filter((item) => ownFixIds.includes(item.id))).toEqual(
                allAccommodation.items.slice(0, 2).filter((item) => ownFixIds.includes(item.id))
            );
            expect(
                accommodationPageTwo.items.filter((item) => ownFixIds.includes(item.id))
            ).toEqual(
                allAccommodation.items.slice(2, 4).filter((item) => ownFixIds.includes(item.id))
            );
            expect(allAccommodation.total - initialAccommodation.total).toBe(3);
        });
    });
});
