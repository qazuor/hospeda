import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { seedPublicDestinations } from '../helpers/seed-public-destinations';

describe('GET /destinations (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    beforeEach(async () => {
        await seedPublicDestinations({ count: 3 });
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists destinations with default pagination (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(3);
        expect(body.data.pagination).toMatchObject({ page: 1, total: 3 });
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
        expect(body.data.pagination).toMatchObject({ page: 1, total: 3, totalPages: 1 });
    });
});
