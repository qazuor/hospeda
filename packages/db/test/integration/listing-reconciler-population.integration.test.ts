import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PartnerTypeEnum, PublicationStatusEnum } from '@repo/schemas';
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
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function makeListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string,
    status: PublicationStatusEnum
) {
    const base = {
        name: 'Reconciler fixture',
        slug: `reconciler-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: status
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe('TEST:V6:7 reconciler population and summaries', () => {
    it('pages eligible owner verticals and summarizes their live listing states across all verticals', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const verticals: readonly ListingVertical[] = [
                'accommodation',
                'gastronomy',
                'experience'
            ];
            for (const vertical of verticals) {
                await makeListing(
                    tx,
                    vertical,
                    user.id,
                    destination.id,
                    PublicationStatusEnum.PUBLISHED
                );
                await makeListing(
                    tx,
                    vertical,
                    user.id,
                    destination.id,
                    PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                );
                await makeListing(
                    tx,
                    vertical,
                    user.id,
                    destination.id,
                    PublicationStatusEnum.ARCHIVED
                );
            }
            const excluded: { readonly label: string; readonly status: PublicationStatusEnum }[] = [
                { label: 'draft', status: PublicationStatusEnum.DRAFT },
                { label: 'purged', status: PublicationStatusEnum.PURGED },
                { label: 'moderated', status: PublicationStatusEnum.MODERATED }
            ];
            const excludedUsers: string[] = [];
            for (const item of excluded) {
                const excludedUser = testData.user();
                excludedUsers.push(excludedUser.id);
                await tx.insert(users).values(excludedUser);
                await makeListing(
                    tx,
                    'accommodation',
                    excludedUser.id,
                    destination.id,
                    item.status
                );
            }
            const deleted = await makeListing(
                tx,
                'accommodation',
                user.id,
                destination.id,
                PublicationStatusEnum.PUBLISHED
            );
            await tx.execute(
                sql`UPDATE accommodations SET deleted_at = now() WHERE id = ${deleted.id}`
            );
            const mixedUser = testData.user();
            await tx.insert(users).values(mixedUser);
            await makeListing(
                tx,
                'accommodation',
                mixedUser.id,
                destination.id,
                PublicationStatusEnum.MODERATED
            );
            await makeListing(
                tx,
                'accommodation',
                mixedUser.id,
                destination.id,
                PublicationStatusEnum.PUBLISHED
            );
            const nullOwnerPartner = {
                id: crypto.randomUUID(),
                slug: `rec-null-${crypto.randomUUID()}`,
                name: 'Reconciler fixture',
                type: PartnerTypeEnum.NGO
            };
            const ownedPartner = {
                id: crypto.randomUUID(),
                slug: `rec-owned-${crypto.randomUUID()}`,
                name: 'Reconciler fixture',
                type: PartnerTypeEnum.NGO,
                ownerUserId: user.id
            };
            await tx.insert(partners).values([nullOwnerPartner, ownedPartner]);
            const seen: { readonly userId: string; readonly vertical: ListingVertical }[] = [];
            let after: { readonly userId: string; readonly vertical: ListingVertical } | null =
                null;
            do {
                const page = await listingPublicationModel.listReconcilerPopulation({
                    tx,
                    after,
                    limit: 1
                });
                seen.push(...page.items);
                after = page.next;
            } while (after !== null);
            expect(
                seen.filter((item) => item.userId === user.id).map(({ vertical }) => vertical)
            ).toEqual([...verticals].sort());
            expect(seen).toContainEqual({ userId: mixedUser.id, vertical: 'accommodation' });
            expect(new Set(seen.map(({ userId, vertical }) => `${userId}:${vertical}`)).size).toBe(
                seen.length
            );
            for (const userId of excludedUsers) {
                const page = await listingPublicationModel.listReconcilerPopulation({
                    tx,
                    after: null,
                    limit: 100
                });
                expect(page.items.some((item) => item.userId === userId)).toBe(false);
            }
            const partnerPage = await listingPublicationModel.listPartnerPresenceUsers({
                tx,
                after: null,
                limit: 100
            });
            expect(partnerPage.items).toContain(user.id);
            expect(partnerPage.items).toHaveLength(new Set(partnerPage.items).size);
            for (const vertical of verticals) {
                await expect(
                    listingPublicationModel.summarizeOwnerListings({
                        tx,
                        ownerId: user.id,
                        vertical
                    })
                ).resolves.toEqual({ published: 1, unpublishedByBilling: 1, archived: 1 });
            }
        });
    });
});
