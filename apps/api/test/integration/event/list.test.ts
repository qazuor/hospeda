import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /events (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    beforeAll(async () => {
        await testDb.setup();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists events with default pagination (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination).toMatchObject({ page: 1, total: 0, totalPages: 0 });
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
        expect(body.data.pagination).toHaveProperty('pageSize');
        expect(body.data.pagination).toMatchObject({ page: 1 });
    });
});
