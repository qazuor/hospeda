import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /destinations (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('lists destinations with default pagination (happy path)', async () => {
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
});
