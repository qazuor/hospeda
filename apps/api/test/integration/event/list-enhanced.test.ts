import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /events (list enhanced)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns items[] and pagination object with expected keys', async () => {
        const res = await app.request(`${base}?page=2&pageSize=5`);
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('items');
            expect(Array.isArray(body.data.items)).toBe(true);
            expect(body.data).toHaveProperty('pagination');
            expect(body.data.pagination).toHaveProperty('page');
            expect(body.data.pagination).toHaveProperty('pageSize');
            expect(body.data.pagination).toHaveProperty('total');
            expect(body.data.pagination).toHaveProperty('totalPages');
        }
    });
});
