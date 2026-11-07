import { randomUUID } from 'node:crypto';
import { eq, experiences, getDb } from '@repo/db';
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

describe('GET /experiences (public q)', () => {
    let app: ReturnType<typeof initApp>;
    let destinationId: string;
    let token: string;
    let publishedIds: string[];
    let draftId: string;
    const base = '/api/v1/public/experiences';

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
                    vertical: VerticalEnum.EXPERIENCE,
                    ownerId: owner.id,
                    destinationId,
                    status: PublicationStatusEnum.PUBLISHED
                })
            )
        );
        draftId = await createVerticalListing({
            vertical: VerticalEnum.EXPERIENCE,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        await getDb()
            .update(experiences)
            .set({ name: `Parrilla ${token}` })
            .where(eq(experiences.id, publishedIds[0]!));
        await getDb()
            .update(experiences)
            .set({ name: `Café Ñandú ${token}` })
            .where(eq(experiences.id, publishedIds[1]!));
        await getDb()
            .update(experiences)
            .set({ name: `Bar ${token}` })
            .where(eq(experiences.id, publishedIds[2]!));
        await getDb()
            .update(experiences)
            .set({ name: `Draft ${token}` })
            .where(eq(experiences.id, draftId));
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('filters names accent-insensitively, excludes drafts, and reports exact totals', async () => {
        const request = async (query = '') => {
            clearCache();
            const url = `${base}?destinationId=${destinationId}${query ? `&${query}` : ''}`;
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

        const parrilla = await request('q=parrilla');
        expect(parrilla.items.map(({ id }) => id)).toEqual([publishedIds[0]]);
        expect(parrilla.pagination.total).toBe(1);

        const nandu = await request('q=nandu');
        expect(nandu.items.map(({ id }) => id)).toEqual([publishedIds[1]]);
        expect(nandu.pagination.total).toBe(1);

        const missing = await request('q=zzzqqqnoexiste');
        expect(missing.items).toEqual([]);
        expect(missing.pagination.total).toBe(0);

        const tokenMatches = await request(`q=${token}`);
        expect(tokenMatches.items.map(({ id }) => id).sort()).toEqual([...publishedIds].sort());
        expect(tokenMatches.items.some(({ id }) => id === draftId)).toBe(false);
        expect(tokenMatches.pagination.total).toBe(3);
    });
});
