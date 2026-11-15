import { randomUUID } from 'node:crypto';
import { destinations, eq, experiences, getDb, users, venues } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from '../listing-publication/publication-routes.helpers';

const created = {
    ownerIds: [] as string[],
    destinationIds: [] as string[],
    venueIds: [] as string[],
    experienceIds: [] as string[]
};
const publicVerticals = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;

describe('HOS-1718 public featured-first lists', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    afterAll(async () => {
        for (const id of created.venueIds) await getDb().delete(venues).where(eq(venues.id, id));
        for (const id of created.experienceIds)
            await getDb().delete(experiences).where(eq(experiences.id, id));
        for (const id of created.destinationIds)
            await getDb().delete(destinations).where(eq(destinations.id, id));
        for (const id of created.ownerIds) await getDb().delete(users).where(eq(users.id, id));
        await testDb.teardown();
    });

    async function seed(vertical: typeof VerticalEnum.VENUE | typeof VerticalEnum.EXPERIENCE) {
        const owner = await createOwner();
        created.ownerIds.push(owner.id);
        const destinationId = await createVerticalDestination();
        created.destinationIds.push(destinationId);
        const ids: string[] = [];

        for (const label of ['A', 'B', 'C']) {
            const id = await createVerticalListing({
                vertical,
                ownerId: owner.id,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED,
                complete: false
            });
            ids.push(id);
            if (vertical === VerticalEnum.VENUE) created.venueIds.push(id);
            else created.experienceIds.push(id);

            const name = `${label} ${randomUUID()}`;
            if (vertical === VerticalEnum.VENUE) {
                await getDb()
                    .update(venues)
                    .set({ name, featuredByEntitlement: label === 'C' })
                    .where(eq(venues.id, id));
            } else {
                await getDb()
                    .update(experiences)
                    .set({ name, featuredByEntitlement: label === 'C' })
                    .where(eq(experiences.id, id));
            }
        }

        return { destinationId, expectedIds: [ids[2], ids[0], ids[1]] };
    }

    it.each(
        publicVerticals
    )('GET /public/<vertical> lists featured listings first', async (vertical) => {
        const { destinationId, expectedIds } = await seed(vertical);
        clearCache();

        const response = await app.request(
            `/api/v1/public/${vertical === VerticalEnum.VENUE ? 'venues' : 'experiences'}?destinationId=${destinationId}&sortBy=name&sortOrder=asc`,
            { headers: { 'user-agent': 'vitest' } }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual(expectedIds);
    });

    it.each(publicVerticals)('a client featuredFirst=false is ignored', async (vertical) => {
        const { destinationId, expectedIds } = await seed(vertical);
        clearCache();

        const response = await app.request(
            `/api/v1/public/${vertical === VerticalEnum.VENUE ? 'venues' : 'experiences'}?destinationId=${destinationId}&sortBy=name&sortOrder=asc&featuredFirst=false`,
            { headers: { 'user-agent': 'vitest' } }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual(expectedIds);
    });
});
