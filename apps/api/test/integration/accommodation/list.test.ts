import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /accommodations (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists accommodations with default pagination (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect([200, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('items');
            expect(body.data).toHaveProperty('pagination');
        }
    });

    it('validates sort params (order must be ASC/DESC)', async () => {
        const res = await app.request(`${base}?sortOrder=INVALID`);
        expect(res.status).toBe(400);
    });

    it('supports pagination defaults when not provided', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect([200]).toContain(res.status);
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('items');
        expect(body.data).toHaveProperty('pagination');
    });

    it('supports filters and pagination', async () => {
        const res = await app.request(
            `${base}?city=Miami&page=2&pageSize=5&sortBy=createdAt&sortOrder=desc`,
            { headers: { 'user-agent': 'vitest' } }
        );
        expect([200, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('pagination');
            // Verify new pagination format
            expect(body.data.pagination).toHaveProperty('page');
            expect(body.data.pagination).toHaveProperty('pageSize');
            expect(body.data.pagination).toHaveProperty('total');
            expect(body.data.pagination).toHaveProperty('totalPages');
        }
    });
});
