import { randomUUID } from 'node:crypto';
import { eq, getDb, venues } from '@repo/db';
import {
    listPublicBusinessLines,
    PublicationStatusEnum,
    VenueTypeEnum,
    VerticalEnum
} from '@repo/schemas';
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

describe('GET /venues (public q)', () => {
    let app: ReturnType<typeof initApp>;
    let destinationId: string;
    let token: string;
    let publishedIds: string[];
    let draftId: string;
    const base = '/api/v1/public/venues';

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();

        token = randomUUID().replaceAll('-', '').slice(0, 12);
        const owner = await createOwner();
        destinationId = await createVerticalDestination();
        publishedIds = await Promise.all(
            Array.from({ length: 3 }, () =>
                createVerticalListing({
                    vertical: VerticalEnum.VENUE,
                    ownerId: owner.id,
                    destinationId,
                    status: PublicationStatusEnum.PUBLISHED
                })
            )
        );
        draftId = await createVerticalListing({
            vertical: VerticalEnum.VENUE,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        await getDb()
            .update(venues)
            .set({ name: `Parrilla ${token}` })
            .where(eq(venues.id, publishedIds[0]!));
        await getDb()
            .update(venues)
            .set({ name: `Café Ñandú ${token}` })
            .where(eq(venues.id, publishedIds[1]!));
        await getDb()
            .update(venues)
            .set({ name: `Bar ${token}` })
            .where(eq(venues.id, publishedIds[2]!));
        await getDb()
            .update(venues)
            .set({ name: `Draft ${token}` })
            .where(eq(venues.id, draftId));
        const nightlife = listPublicBusinessLines({ vertical: 'venue' }).find(
            (line) => line.value === 'nightlife'
        );
        if (!nightlife) throw new Error('Expected a public venue business line');
        await getDb()
            .update(venues)
            .set({ businessLines: [nightlife.value], type: VenueTypeEnum.BAR })
            .where(eq(venues.id, publishedIds[2]!));
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('filters names, accent-insensitively, intersects filters, and counts only matching published rows', async () => {
        const request = async (query = '') => {
            clearCache();
            const separator = query ? '&' : '?';
            const url = `${base}?destinationId=${destinationId}${query ? `${separator}${query}` : ''}`;
            const response = await app.request(url, { headers: { 'user-agent': 'vitest' } });
            expect(response.status).toBe(200);
            return (await response.json()).data as {
                items: Array<{ id: string; name: string }>;
                pagination: { total: number };
            };
        };

        const all = await request();
        expect(all.items.map(({ id }) => id).sort()).toEqual([...publishedIds].sort());
        expect(all.pagination.total).toBe(3);

        const parrilla = await request(`q=parrilla`);
        expect(parrilla.items.map(({ id }) => id)).toEqual([publishedIds[0]]);
        expect(parrilla.pagination.total).toBe(1);

        const nandu = await request(`q=nandu`);
        expect(nandu.items.map(({ id }) => id)).toEqual([publishedIds[1]]);
        expect(nandu.pagination.total).toBe(1);

        const missing = await request(`q=zzzqqqnoexiste`);
        expect(missing.items).toEqual([]);
        expect(missing.pagination.total).toBe(0);

        const draft = await request(`q=${token}`);
        expect(draft.items.map(({ id }) => id).sort()).toEqual([...publishedIds].sort());
        expect(draft.items.some(({ id }) => id === draftId)).toBe(false);
        expect(draft.pagination.total).toBe(3);

        const nightlife = listPublicBusinessLines({ vertical: 'venue' }).find(
            (line) => line.value === 'nightlife'
        );
        if (!nightlife) throw new Error('Expected a public venue business line');
        const intersection = await request(`q=${token}&businessLine=${nightlife.value}`);
        expect(intersection.items.map(({ id }) => id)).toEqual([publishedIds[2]]);
        expect(intersection.pagination.total).toBe(1);
    });
});
