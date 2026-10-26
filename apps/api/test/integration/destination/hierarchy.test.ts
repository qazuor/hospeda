import { destinations, eq, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

/**
 * Integration tests for the public destination hierarchy endpoints.
 *
 * Every test seeds a COUNTRY > REGION > PROVINCE chain (levels 0, 1, 2) and
 * asserts against it, so a route that answers an empty 200 for everything
 * cannot pass. Every request sends a `user-agent`: the app answers 400 to any
 * request without one, which would make the 400 assertions pass for the wrong
 * reason.
 */
describe('Destination Hierarchy API', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';
    const headers = { 'user-agent': 'vitest' };
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';

    interface SeededNode {
        readonly id: string;
        readonly slug: string;
        readonly path: string;
    }
    let country: SeededNode;
    let region: SeededNode;
    let province: SeededNode;

    const seedNode = async ({
        suffix,
        name,
        type,
        level,
        parent
    }: {
        readonly suffix: string;
        readonly name: string;
        readonly type: 'COUNTRY' | 'REGION' | 'PROVINCE';
        readonly level: number;
        readonly parent?: { readonly id: string; readonly path: string; readonly pathIds: string };
    }): Promise<SeededNode & { readonly pathIds: string }> => {
        const slug = `${name}-${suffix}`;
        const path = parent ? `${parent.path}/${slug}` : `/${slug}`;
        const pathIds = parent
            ? parent.pathIds
                ? `${parent.pathIds}/${parent.id}`
                : parent.id
            : '';
        const [row] = await getDb()
            .insert(destinations)
            .values({
                slug,
                name: `${name} ${suffix}`,
                summary: 'Destination seeded for the hierarchy integration tests.',
                description: 'Destination seeded for the hierarchy integration tests.',
                destinationType: type,
                parentDestinationId: parent?.id ?? null,
                path,
                pathIds,
                level,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                location: {
                    country: 'AR',
                    state: 'ER',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            })
            .returning({ id: destinations.id });
        if (!row) throw new Error('hierarchy test: destination insert failed');
        return { id: row.id, slug, path, pathIds };
    };

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const seededCountry = await seedNode({
            suffix,
            name: 'argentina',
            type: 'COUNTRY',
            level: 0
        });
        const seededRegion = await seedNode({
            suffix,
            name: 'litoral',
            type: 'REGION',
            level: 1,
            parent: seededCountry
        });
        const seededProvince = await seedNode({
            suffix,
            name: 'entre-rios',
            type: 'PROVINCE',
            level: 2,
            parent: seededRegion
        });
        country = seededCountry;
        region = seededRegion;
        province = seededProvince;
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('GET /{id}/children', () => {
        it('answers 400 for an invalid UUID', async () => {
            const res = await app.request(`${base}/not-a-uuid/children`, { headers });
            expect(res.status).toBe(400);
        });

        it('returns the direct children only', async () => {
            const res = await app.request(`${base}/${country.id}/children`, { headers });
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/json');
            const body = await res.json();
            expect(body.data.children.map((child: { id: string }) => child.id)).toEqual([
                region.id
            ]);
        });

        it('returns an empty list for a leaf destination', async () => {
            const res = await app.request(`${base}/${province.id}/children`, { headers });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.children).toEqual([]);
        });

        // HOS-TODO-destination-hierarchy-unknown-id: findChildren (destination.model.ts:785) never
        // checks that the parent exists, so an unknown id answers 200 with an empty list, while
        // getBreadcrumb on the same id answers 404. error-contract.md puts existence at 404.
        it.fails('answers 404 for a destination that does not exist', async () => {
            const res = await app.request(`${base}/${NONEXISTENT_UUID}/children`, { headers });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /{id}/descendants', () => {
        const readIds = async (res: Response): Promise<readonly string[]> => {
            const body = await res.json();
            return body.data.descendants.map((node: { id: string }) => node.id);
        };

        it('answers 400 for an invalid UUID', async () => {
            const res = await app.request(`${base}/not-a-uuid/descendants`, { headers });
            expect(res.status).toBe(400);
        });

        it('returns every descendant ordered by level', async () => {
            const res = await app.request(`${base}/${country.id}/descendants`, { headers });
            expect(res.status).toBe(200);
            expect(await readIds(res)).toEqual([region.id, province.id]);
        });

        it('limits the depth with maxDepth', async () => {
            const res = await app.request(`${base}/${country.id}/descendants?maxDepth=1`, {
                headers
            });
            expect(res.status).toBe(200);
            expect(await readIds(res)).toEqual([region.id]);
        });

        it('filters by destinationType', async () => {
            const res = await app.request(
                `${base}/${country.id}/descendants?destinationType=PROVINCE`,
                { headers }
            );
            expect(res.status).toBe(200);
            expect(await readIds(res)).toEqual([province.id]);
        });

        it('answers 400 for an unknown destinationType', async () => {
            const res = await app.request(
                `${base}/${country.id}/descendants?destinationType=galaxy`,
                { headers }
            );
            expect(res.status).toBe(400);
        });

        it('answers 400 for maxDepth 0', async () => {
            const res = await app.request(`${base}/${country.id}/descendants?maxDepth=0`, {
                headers
            });
            expect(res.status).toBe(400);
        });

        it('answers 400 for maxDepth 11', async () => {
            const res = await app.request(`${base}/${country.id}/descendants?maxDepth=11`, {
                headers
            });
            expect(res.status).toBe(400);
        });

        // HOS-TODO-destination-hierarchy-unknown-id: findDescendants (destination.model.ts:817) returns []
        // when the parent is missing instead of surfacing a 404.
        it.fails('answers 404 for a destination that does not exist', async () => {
            const res = await app.request(`${base}/${NONEXISTENT_UUID}/descendants`, { headers });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /{id}/ancestors', () => {
        it('answers 400 for an invalid UUID', async () => {
            const res = await app.request(`${base}/not-a-uuid/ancestors`, { headers });
            expect(res.status).toBe(400);
        });

        it('returns the ancestors from the root down to the parent', async () => {
            const res = await app.request(`${base}/${province.id}/ancestors`, { headers });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.ancestors.map((node: { id: string }) => node.id)).toEqual([
                country.id,
                region.id
            ]);
        });

        it('returns an empty list for a root destination', async () => {
            const res = await app.request(`${base}/${country.id}/ancestors`, { headers });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.ancestors).toEqual([]);
        });

        // HOS-TODO-destination-hierarchy-unknown-id: findAncestors (destination.model.ts:876) returns []
        // when the destination is missing instead of surfacing a 404.
        it.fails('answers 404 for a destination that does not exist', async () => {
            const res = await app.request(`${base}/${NONEXISTENT_UUID}/ancestors`, { headers });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /{id}/breadcrumb', () => {
        it('answers 400 for an invalid UUID', async () => {
            const res = await app.request(`${base}/not-a-uuid/breadcrumb`, { headers });
            expect(res.status).toBe(400);
        });

        it('returns the chain from the root to the destination itself', async () => {
            const res = await app.request(`${base}/${province.id}/breadcrumb`, { headers });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.breadcrumb.map((item: { id: string }) => item.id)).toEqual([
                country.id,
                region.id,
                province.id
            ]);
        });

        it('answers 404 for a destination that does not exist', async () => {
            const res = await app.request(`${base}/${NONEXISTENT_UUID}/breadcrumb`, { headers });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /by-path', () => {
        it('answers 400 when the path is missing', async () => {
            const res = await app.request(`${base}/by-path`, { headers });
            expect(res.status).toBe(400);
        });

        it('answers 400 for an invalid path format (uppercase)', async () => {
            const res = await app.request(`${base}/by-path?path=/Argentina/Litoral`, { headers });
            expect(res.status).toBe(400);
        });

        it('answers 400 for an invalid path format (no leading slash)', async () => {
            const res = await app.request(`${base}/by-path?path=argentina/litoral`, { headers });
            expect(res.status).toBe(400);
        });

        it('returns the destination stored at the path', async () => {
            const res = await app.request(
                `${base}/by-path?path=${encodeURIComponent(province.path)}`,
                { headers }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.id).toBe(province.id);
            expect(body.data.path).toBe(province.path);
        });

        it('answers 404 for a path nobody owns', async () => {
            const res = await app.request(`${base}/by-path?path=/nonexistent/destination`, {
                headers
            });
            expect(res.status).toBe(404);
        });

        it('answers 410 for a soft-deleted public destination', async () => {
            await getDb()
                .update(destinations)
                .set({ deletedAt: new Date() })
                .where(eq(destinations.id, province.id));
            const res = await app.request(
                `${base}/by-path?path=${encodeURIComponent(province.path)}`,
                { headers }
            );
            expect(res.status).toBe(410);
        });
    });
});
