import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

describe('GET /accommodations (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';
    let seeded: SeededPublicAccommodation;

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    beforeEach(async () => {
        seeded = await seedPublicAccommodation();
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists accommodations with default pagination (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([seeded.id]);
        expect(body.data).toHaveProperty('pagination');
    });

    it('validates sort params (order must be ASC/DESC)', async () => {
        const res = await app.request(`${base}?sortOrder=INVALID`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(400);
    });

    it('supports pagination defaults when not provided', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1 });
    });

    it('supports filters and pagination', async () => {
        const res = await app.request(
            `${base}?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc&type=HOTEL`,
            { headers: { 'user-agent': 'vitest' } }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([seeded.id]);
        expect(body.data.pagination).toMatchObject({
            page: 1,
            pageSize: 5,
            total: 1,
            totalPages: 1
        });
    });

    it('answers 200 with an empty page beyond the last page', async () => {
        const res = await app.request(`${base}?page=2&pageSize=5`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 1 });
    });

    it('rejects a query param the route does not declare with 400 INVALID_PAGINATION_PARAMS', async () => {
        const res = await app.request(`${base}?city=Miami`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('INVALID_PAGINATION_PARAMS');
    });
});
